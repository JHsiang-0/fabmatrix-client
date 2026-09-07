export const MOCK_JOB_STATUS_TRANSITIONS = Object.freeze({
  QUEUED: Object.freeze(['ASSIGNED', 'CANCELLED']),
  ASSIGNED: Object.freeze(['UPLOADING', 'QUEUED', 'CANCELLED']),
  UPLOADING: Object.freeze(['READY', 'FAILED', 'CANCELLED']),
  READY: Object.freeze(['PRINTING', 'QUEUED', 'CANCELLED']),
  PRINTING: Object.freeze(['PAUSED', 'RECONCILING', 'CANCELLED', 'COMPLETED', 'FAILED']),
  PAUSED: Object.freeze(['PRINTING', 'RECONCILING', 'CANCELLED']),
  RECONCILING: Object.freeze(['COMPLETED', 'FAILED', 'CANCELLED', 'QUEUED']),
  COMPLETED: Object.freeze([]),
  FAILED: Object.freeze(['QUEUED']),
  CANCELLED: Object.freeze([])
})

export const canTransitionMockJob = (from, to) => (
  from === to || MOCK_JOB_STATUS_TRANSITIONS[from]?.includes(to) === true
)

export const transitionMockJob = (from, to) => {
  if (!canTransitionMockJob(from, to)) {
    throw new Error(`非法任务状态转移：${from} -> ${to}`)
  }
  return to
}
