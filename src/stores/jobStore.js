import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getJobDetail, getJobPage, getJobQueue } from '@/api/job'
import { ACTIVE_JOB_STATUSES, selectActiveJobs } from '@/utils/jobSelectors'
import { fetchPageWithLastValidFallback } from '@/utils/jobPagination'
import {
  getRealtimeJobCollection,
  getRealtimeJobPatch,
  normalizeRealtimeJobStatus as normalizeRealtimeJobStatusMessage
} from '@/utils/jobRealtime'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard'
import { rememberRealtimeEvent as rememberBoundedRealtimeEvent } from '@/utils/realtimeProtocol'

const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : callback => Promise.resolve().then(callback)
const MAX_JOB_DETAIL_CACHE_SIZE = 100
const MAX_REALTIME_EVENT_IDS = 1000

const sortByUpdatedAt = (left, right) => (
  new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
)

export const useJobStore = defineStore('job', () => {
  const queueJobs = ref([])
  const activeJobs = ref([])
  const terminalJobs = ref([])
  const jobDetails = ref(new Map())
  const queueLoading = ref(false)
  const activeLoading = ref(false)
  const detailLoading = ref(false)
  const queueError = ref(null)
  const activeError = ref(null)
  const detailError = ref(null)
  const activePage = ref(1)
  const activePageSize = ref(10)
  const pendingRealtimeStatuses = new Map()
  let queueRequestGuard = createLatestRequestGuard()
  let activeRequestGuard = createLatestRequestGuard()
  let detailRequestGuard = createLatestRequestGuard()
  let realtimeFlushScheduled = false
  let realtimeRefreshPromise = null
  let realtimeRefreshRequested = false
  let realtimeCollectionRefreshRequested = false
  const realtimeMetadata = new Map()
  const realtimeOverlays = new Map()
  const realtimeEventIds = new Set()
  const realtimeUnknownKeys = new Set()
  const historyInvalidationVersion = ref(0)
  let realtimeRevision = 0

  const isValidSequence = value => {
    const sequence = Number(value)
    return Number.isInteger(sequence) && sequence >= 0
  }

  const eventTimestamp = message => {
    const rawTimestamp = message?.timestamp ?? message?.data?.updatedAt
    const timestamp = Number(rawTimestamp)
    if (Number.isFinite(timestamp)) return timestamp
    const parsedTimestamp = Date.parse(rawTimestamp)
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0
  }

  const shouldAcceptRealtimeEvent = (key, message) => {
    const sequence = isValidSequence(message?.sequence) ? Number(message.sequence) : null
    const timestamp = eventTimestamp(message)
    const previous = realtimeMetadata.get(key)
    if (!previous) return true
    if (sequence === null && previous.sequence !== null) return false
    if (sequence !== null && previous.sequence !== null) return sequence > previous.sequence
    if (sequence !== null && previous.sequence === null) return timestamp >= previous.timestamp
    return timestamp > previous.timestamp
  }

  const isNewerPendingMessage = (previous, next) => {
    const previousSequence = isValidSequence(previous?.sequence) ? Number(previous.sequence) : null
    const nextSequence = isValidSequence(next?.sequence) ? Number(next.sequence) : null
    if (nextSequence === null && previousSequence !== null) return false
    if (nextSequence !== null && previousSequence !== null) return nextSequence > previousSequence
    if (nextSequence !== null && previousSequence === null) return eventTimestamp(next) >= eventTimestamp(previous)
    return eventTimestamp(next) >= eventTimestamp(previous)
  }

  const rememberRealtimeEvent = (key, message) => {
    realtimeMetadata.set(key, {
      sequence: isValidSequence(message?.sequence) ? Number(message.sequence) : null,
      timestamp: eventTimestamp(message)
    })
  }

  const mergeRestJob = (job, collection = null) => {
    if (!job || job.id === undefined || job.id === null) return job
    const key = String(job.id)
    const overlay = realtimeOverlays.get(key)
    if (!overlay) return job
    if (collection && overlay.collection !== collection) {
      return { ...job, status: overlay.patch.status }
    }
    return { ...job, ...overlay.patch }
  }

  const settleRestOverlays = (records, requestRevision) => {
    records.forEach(job => {
      if (!job || job.id === undefined || job.id === null) return
      const key = String(job.id)
      const overlay = realtimeOverlays.get(key)
      if (!overlay) return

      const patch = {}
      const fieldRevisions = {}
      Object.entries(overlay.patch).forEach(([field, value]) => {
        const fieldRevision = overlay.fieldRevisions?.[field] ?? overlay.revision ?? 0
        if (fieldRevision > requestRevision) {
          patch[field] = value
          fieldRevisions[field] = fieldRevision
        }
      })
      if (!Object.keys(patch).length) {
        realtimeOverlays.delete(key)
        return
      }
      realtimeOverlays.set(key, {
        collection: getRealtimeJobCollection(patch.status ?? job.status),
        patch,
        fieldRevisions,
        revision: Math.max(...Object.values(fieldRevisions))
      })
    })
  }

  const mergeRestCollection = (records, collection) => records
    .map(job => mergeRestJob(job, collection))

  const findKnownJob = key => (
    queueJobs.value.find(job => String(job.id) === key)
      || activeJobs.value.find(job => String(job.id) === key)
      || terminalJobs.value.find(job => String(job.id) === key)
      || jobDetails.value.get(key)
  )

  function scheduleRealtimeRefresh() {
    realtimeRefreshRequested = true
    if (realtimeRefreshPromise) return realtimeRefreshPromise

    const run = async () => {
      realtimeRefreshRequested = false
      try {
        await refresh()
      } finally {
        realtimeRefreshPromise = null
        if (realtimeRefreshRequested) scheduleRealtimeRefresh()
      }
    }
    realtimeRefreshPromise = run()
    return realtimeRefreshPromise
  }

  function cacheJobDetail(id, detail) {
    const key = String(id)
    const nextDetails = new Map(jobDetails.value)
    nextDetails.delete(key)
    nextDetails.set(key, detail)
    while (nextDetails.size > MAX_JOB_DETAIL_CACHE_SIZE) {
      nextDetails.delete(nextDetails.keys().next().value)
    }
    jobDetails.value = nextDetails
  }

  const activeTotal = ref(0)
  const activePageJobs = computed(() => activeJobs.value)

  async function fetchQueue() {
    const guard = queueRequestGuard
    const requestId = guard.begin()
    if (requestId === null) return queueJobs.value
    const requestRealtimeRevision = realtimeRevision
    queueLoading.value = true
    queueError.value = null
    try {
      const response = await getJobQueue()
      if (!guard.isCurrent(requestId)) return queueJobs.value
      const records = response.data || []
      settleRestOverlays(records, requestRealtimeRevision)
      queueJobs.value = mergeRestCollection(records, 'queue')
        .filter(job => job.status === 'QUEUED')
      return queueJobs.value
    } catch (error) {
      if (!guard.isCurrent(requestId)) return queueJobs.value
      queueError.value = error
      throw error
    } finally {
      if (guard.isCurrent(requestId)) queueLoading.value = false
    }
  }

  async function fetchActive(options = {}) {
    const guard = activeRequestGuard
    const requestId = guard.begin()
    if (requestId === null) return activeJobs.value
    const requestRealtimeRevision = realtimeRevision
    activeLoading.value = true
    activeError.value = null
    try {
      const pageNum = options.pageNum ?? activePage.value
      const pageSize = options.pageSize ?? activePageSize.value
      const response = await fetchPageWithLastValidFallback(getJobPage, {
        pageNum,
        pageSize,
        statuses: ACTIVE_JOB_STATUSES
      })
      if (!guard.isCurrent(requestId)) return activeJobs.value
      const page = response.data || {}
      const records = page.records || []
      settleRestOverlays(records, requestRealtimeRevision)
      activePage.value = page.pageNum ?? pageNum
      activePageSize.value = page.pageSize ?? pageSize
      activeTotal.value = page.total ?? 0
      activeJobs.value = selectActiveJobs(mergeRestCollection(records, 'active'))
      return activeJobs.value
    } catch (error) {
      if (!guard.isCurrent(requestId)) return activeJobs.value
      activeError.value = error
      throw error
    } finally {
      if (guard.isCurrent(requestId)) activeLoading.value = false
    }
  }

  async function fetchJobDetail(id) {
    const guard = detailRequestGuard
    const requestId = guard.begin()
    if (requestId === null) return null
    const requestRealtimeRevision = realtimeRevision
    detailLoading.value = true
    detailError.value = null
    try {
      const response = await getJobDetail(id)
      if (!guard.isCurrent(requestId)) return null
      settleRestOverlays(response.data ? [response.data] : [], requestRealtimeRevision)
      const detail = mergeRestJob(response.data)
      cacheJobDetail(id, detail)
      return detail
    } catch (error) {
      if (!guard.isCurrent(requestId)) return null
      detailError.value = error
      throw error
    } finally {
      if (guard.isCurrent(requestId)) detailLoading.value = false
    }
  }

  function invalidateJobDetailRequest() {
    detailRequestGuard.invalidate()
    detailRequestGuard = createLatestRequestGuard()
    detailLoading.value = false
    detailError.value = null
  }

  function normalizeRealtimeJobStatus(message = {}) {
    return normalizeRealtimeJobStatusMessage(message)
  }

  function applyRealtimeJobStatuses(messages = []) {
    const queues = new Map(queueJobs.value.map(job => [String(job.id), job]))
    const active = new Map(activeJobs.value.map(job => [String(job.id), job]))
    const terminal = new Map(terminalJobs.value.map(job => [String(job.id), job]))
    const details = new Map(jobDetails.value)
    const updatedJobs = []
    let historyInvalidated = false
    let collectionChanged = false

    messages.forEach(message => {
      const normalized = normalizeRealtimeJobStatus(message)
      if (!normalized || !shouldAcceptRealtimeEvent(normalized.key, message)) return
      const eventKey = message.eventId === undefined || message.eventId === null || String(message.eventId) === ''
        ? `${normalized.key}:${message.sequence ?? eventTimestamp(message)}`
        : String(message.eventId)
      if (rememberBoundedRealtimeEvent(realtimeEventIds, eventKey, MAX_REALTIME_EVENT_IDS)) return
      rememberRealtimeEvent(normalized.key, message)

      const known = queues.get(normalized.key)
        || active.get(normalized.key)
        || terminal.get(normalized.key)
        || details.get(normalized.key)
        || findKnownJob(normalized.key)
      const patch = getRealtimeJobPatch(message, normalized)
      const previousOverlay = realtimeOverlays.get(normalized.key)
      const revision = ++realtimeRevision
      const overlayPatch = { ...previousOverlay?.patch, ...patch }
      const fieldRevisions = { ...previousOverlay?.fieldRevisions }
      Object.keys(patch).forEach(field => {
        fieldRevisions[field] = revision
      })
      const targetCollection = getRealtimeJobCollection(overlayPatch.status)
      realtimeOverlays.set(normalized.key, {
        collection: targetCollection,
        patch: overlayPatch,
        fieldRevisions,
        revision
      })

      if (!known) {
        if (targetCollection === 'terminal') historyInvalidated = true
        realtimeUnknownKeys.add(normalized.key)
        return
      }

      const sourceCollection = queues.has(normalized.key)
        ? 'queue'
        : active.has(normalized.key)
          ? 'active'
          : terminal.has(normalized.key)
            ? 'terminal'
            : getRealtimeJobCollection(known.status)
      const wasVisible = queues.has(normalized.key) || active.has(normalized.key) || terminal.has(normalized.key)
      const updated = { ...known, ...overlayPatch }
      queues.delete(normalized.key)
      active.delete(normalized.key)
      terminal.delete(normalized.key)

      if (sourceCollection === targetCollection && wasVisible) {
        if (targetCollection === 'queue') queues.set(normalized.key, updated)
        if (targetCollection === 'active') active.set(normalized.key, updated)
        if (targetCollection === 'terminal') terminal.set(normalized.key, updated)
      } else {
        collectionChanged = true
        if (sourceCollection === 'active' && targetCollection !== 'active') {
          activeTotal.value = Math.max(0, Number(activeTotal.value || 0) - 1)
        } else if (sourceCollection !== 'active' && targetCollection === 'active') {
          activeTotal.value = Number(activeTotal.value || 0) + 1
        }
      }
      if ((sourceCollection === 'terminal') !== (targetCollection === 'terminal')) historyInvalidated = true
      if (!wasVisible) realtimeUnknownKeys.add(normalized.key)
      details.set(normalized.key, updated)
      updatedJobs.push(updated)
    })

    if (collectionChanged) realtimeCollectionRefreshRequested = true

    if (!updatedJobs.length) {
      if (historyInvalidated) historyInvalidationVersion.value += 1
      return []
    }
    queueJobs.value = [...queues.values()]
    activeJobs.value = selectActiveJobs([...active.values()]).sort(sortByUpdatedAt)
    terminalJobs.value = [...terminal.values()].sort(sortByUpdatedAt)
    jobDetails.value = details
    if (historyInvalidated) historyInvalidationVersion.value += 1
    return updatedJobs
  }

  function applyRealtimeJobStatus(message = {}) {
    return applyRealtimeJobStatuses([message])[0] || null
  }

  function flushRealtimeJobStatuses() {
    if (!pendingRealtimeStatuses.size) return []
    const messages = [...pendingRealtimeStatuses.values()]
    pendingRealtimeStatuses.clear()
    realtimeFlushScheduled = false
    const updated = applyRealtimeJobStatuses(messages)
    if (realtimeUnknownKeys.size || realtimeCollectionRefreshRequested) {
      realtimeUnknownKeys.clear()
      realtimeCollectionRefreshRequested = false
      void scheduleRealtimeRefresh().catch(() => {
        console.error('[JobStore] 实时集合刷新失败')
      })
    }
    return updated
  }

  function queueRealtimeJobStatus(message = {}) {
    const normalized = normalizeRealtimeJobStatus(message)
    if (!normalized) return false

    const previous = pendingRealtimeStatuses.get(normalized.key)
    if (!previous || isNewerPendingMessage(previous, message)) {
      pendingRealtimeStatuses.set(normalized.key, previous
        ? { ...message, data: { ...previous.data, ...message.data } }
        : message)
    }
    if (!realtimeFlushScheduled) {
      realtimeFlushScheduled = true
      scheduleMicrotask(flushRealtimeJobStatuses)
    }
    return true
  }

  function clearQueuedRealtimeStatuses() {
    pendingRealtimeStatuses.clear()
    realtimeFlushScheduled = false
  }

  function resetRealtimeOrdering() {
    clearQueuedRealtimeStatuses()
    realtimeMetadata.clear()
    realtimeOverlays.clear()
    realtimeEventIds.clear()
    realtimeUnknownKeys.clear()
    realtimeCollectionRefreshRequested = false
  }

  function resetRealtimeSequence() {
    clearQueuedRealtimeStatuses()
    realtimeMetadata.clear()
    realtimeEventIds.clear()
    realtimeUnknownKeys.clear()
    realtimeCollectionRefreshRequested = false
  }

  function beginRealtimeRecovery() {
    resetRealtimeOrdering()
    queueRequestGuard.invalidate()
    activeRequestGuard.invalidate()
    queueRequestGuard = createLatestRequestGuard()
    activeRequestGuard = createLatestRequestGuard()
    queueLoading.value = false
    activeLoading.value = false
  }

  function invalidateHistory() {
    historyInvalidationVersion.value += 1
  }

  async function refresh() {
    const results = await Promise.allSettled([fetchQueue(), fetchActive()])
    const rejected = results.find(result => result.status === 'rejected')
    if (rejected) throw rejected.reason
    return { queue: queueJobs.value, active: activeJobs.value }
  }

  return {
    queueJobs,
    activeJobs,
    jobDetails,
    queueLoading,
    activeLoading,
    detailLoading,
    queueError,
    activeError,
    detailError,
    activePage,
    activePageSize,
    activeTotal,
    activePageJobs,
    terminalJobs,
    historyInvalidationVersion,
    fetchQueue,
    fetchActive,
    fetchJobDetail,
    invalidateJobDetailRequest,
    applyRealtimeJobStatus,
    applyRealtimeJobStatuses,
    queueRealtimeJobStatus,
    flushRealtimeJobStatuses,
    clearQueuedRealtimeStatuses,
    resetRealtimeOrdering,
    resetRealtimeSequence,
    beginRealtimeRecovery,
    invalidateHistory,
    refresh
  }
})
