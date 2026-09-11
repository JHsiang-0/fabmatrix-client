export function getJobActionKey(action, jobId) {
  return `${action}:${jobId}`
}

export function acquireJobActionLock({ actionLoadingKey, action, jobId }) {
  if (actionLoadingKey.value) return false
  actionLoadingKey.value = getJobActionKey(action, jobId)
  return true
}

export function releaseJobActionLock({ actionLoadingKey, action, jobId }) {
  const key = getJobActionKey(action, jobId)
  if (actionLoadingKey.value === key) actionLoadingKey.value = ''
}
