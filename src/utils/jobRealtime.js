import { isActiveJob, selectActiveJobs } from './jobSelectors.js'

const sortByUpdatedAt = (left, right) => (
  new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
)

export function normalizeRealtimeJobStatus(message = {}) {
  const data = message.data || {}
  const id = data.jobId ?? message.jobId
  const status = String(data.status || data.currentJobStatus || '').toUpperCase()
  if (id === undefined || id === null || !status) return null
  return { data, id, status, key: String(id), message }
}

/**
 * Merge WS status updates only into the REST page currently held by the Store.
 * An event for an unknown page ID is intentionally ignored; TC-006 owns the
 * later full convergence/unknown-job refresh protocol.
 */
export function mergeRealtimeActivePage(activeJobs = [], jobDetails = new Map(), messages = []) {
  const jobsById = new Map(activeJobs.map(job => [String(job.id), job]))
  const details = new Map(jobDetails)
  const updatedJobs = []

  messages.forEach(message => {
    const normalized = normalizeRealtimeJobStatus(message)
    if (!normalized) return

    const { data, id, status, key } = normalized
    const pageJob = jobsById.get(key)
    const detailJob = details.get(key)
    if (!pageJob && !detailJob) return

    const updated = { ...(pageJob || detailJob), id, status }
    if (data.progress !== undefined) updated.progress = data.progress
    if (data.printerId !== undefined) updated.printerId = data.printerId
    if (data.errorReason !== undefined) updated.errorReason = data.errorReason
    if (data.completedAt !== undefined) updated.completedAt = data.completedAt
    if (data.updatedAt !== undefined) updated.updatedAt = data.updatedAt
    if (message.timestamp !== undefined && updated.updatedAt === undefined) updated.updatedAt = message.timestamp

    if (pageJob) {
      if (isActiveJob(updated)) jobsById.set(key, updated)
      else jobsById.delete(key)
    }
    if (detailJob) details.set(key, updated)
    updatedJobs.push(updated)
  })

  return {
    activeJobs: selectActiveJobs([...jobsById.values()]).sort(sortByUpdatedAt),
    jobDetails: details,
    updatedJobs
  }
}
