import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getJobDetail, getJobPage, getJobQueue } from '@/api/job'
import { ACTIVE_JOB_STATUSES, selectActiveJobs } from '@/utils/jobSelectors'
import { fetchPageWithLastValidFallback } from '@/utils/jobPagination'
import { mergeRealtimeActivePage, normalizeRealtimeJobStatus as normalizeRealtimeJobStatusMessage } from '@/utils/jobRealtime'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard'

const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : callback => Promise.resolve().then(callback)
const MAX_JOB_DETAIL_CACHE_SIZE = 100

const sortByUpdatedAt = (left, right) => (
  new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
)

export const useJobStore = defineStore('job', () => {
  const queueJobs = ref([])
  const activeJobs = ref([])
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
  const activeRequestGuard = createLatestRequestGuard()
  let detailRequestGuard = createLatestRequestGuard()
  let realtimeFlushScheduled = false

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
    queueLoading.value = true
    queueError.value = null
    try {
      const response = await getJobQueue()
      queueJobs.value = (response.data || []).filter(job => job.status === 'QUEUED')
      return queueJobs.value
    } catch (error) {
      queueError.value = error
      throw error
    } finally {
      queueLoading.value = false
    }
  }

  async function fetchActive(options = {}) {
    const requestId = activeRequestGuard.begin()
    if (requestId === null) return activeJobs.value
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
      if (!activeRequestGuard.isCurrent(requestId)) return activeJobs.value
      const page = response.data || {}
      activePage.value = page.pageNum ?? pageNum
      activePageSize.value = page.pageSize ?? pageSize
      activeTotal.value = page.total ?? 0
      activeJobs.value = selectActiveJobs(page.records || [])
      return activeJobs.value
    } catch (error) {
      if (!activeRequestGuard.isCurrent(requestId)) return activeJobs.value
      activeError.value = error
      throw error
    } finally {
      if (activeRequestGuard.isCurrent(requestId)) activeLoading.value = false
    }
  }

  async function fetchJobDetail(id) {
    const guard = detailRequestGuard
    const requestId = guard.begin()
    if (requestId === null) return null
    detailLoading.value = true
    detailError.value = null
    try {
      const response = await getJobDetail(id)
      const detail = response.data
      if (!guard.isCurrent(requestId)) return null
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
    const result = mergeRealtimeActivePage(activeJobs.value, jobDetails.value, messages)
    if (!result.updatedJobs.length) return []
    activeJobs.value = result.activeJobs
    jobDetails.value = result.jobDetails
    return result.updatedJobs
  }

  function applyRealtimeJobStatus(message = {}) {
    return applyRealtimeJobStatuses([message])[0] || null
  }

  function flushRealtimeJobStatuses() {
    if (!pendingRealtimeStatuses.size) return []
    const messages = [...pendingRealtimeStatuses.values()]
    pendingRealtimeStatuses.clear()
    realtimeFlushScheduled = false
    return applyRealtimeJobStatuses(messages)
  }

  function queueRealtimeJobStatus(message = {}) {
    const normalized = normalizeRealtimeJobStatus(message)
    if (!normalized) return false

    const previous = pendingRealtimeStatuses.get(normalized.key)
    pendingRealtimeStatuses.set(normalized.key, previous
      ? { ...previous, ...message, data: { ...previous.data, ...message.data } }
      : message)
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

  function applyBatchConfirmResults(result = {}) {
    const jobs = (result.items || [])
      .map(item => item.job)
      .filter(Boolean)
    if (!jobs.length) return []

    const jobsById = new Map(activeJobs.value.map(job => [String(job.id), job]))
    jobs.forEach(job => {
      const key = String(job.id)
      if (jobsById.has(key)) jobsById.set(key, job)
    })
    activeJobs.value = selectActiveJobs([...jobsById.values()]).sort(sortByUpdatedAt)
    const details = new Map(jobDetails.value)
    jobs.forEach(job => details.set(String(job.id), job))
    jobDetails.value = details
    return jobs
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
    fetchQueue,
    fetchActive,
    fetchJobDetail,
    invalidateJobDetailRequest,
    applyRealtimeJobStatus,
    applyRealtimeJobStatuses,
    queueRealtimeJobStatus,
    flushRealtimeJobStatuses,
    clearQueuedRealtimeStatuses,
    applyBatchConfirmResults,
    refresh
  }
})
