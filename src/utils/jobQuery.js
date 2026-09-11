/** 校验任务分页请求的互斥筛选语义。 */
export function validateJobPageParams(params = {}) {
  const hasStatus = params.status !== undefined && params.status !== null
    && String(params.status).trim() !== ''
  const hasStatuses = Array.isArray(params.statuses)
  if (hasStatus && hasStatuses) {
    throw new TypeError('status 与 statuses 不能同时使用')
  }
  if (hasStatuses && params.statuses.length === 0) {
    throw new TypeError('statuses 不能为空')
  }
  return params
}
