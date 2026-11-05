const segment = (value) => encodeURIComponent(value)
const conflictMessages = {
  ORGANIZATION_NOT_EMPTY: '组织仍有农场、其他成员或受管账号，请先处理下级资源',
  FARM_NOT_EMPTY: '农场仍有网关或成员授权，请先处理下级资源',
  GATEWAY_NOT_REVOKED: '请先吊销网关凭据，再删除网关',
  GATEWAY_HAS_DATA: '网关已有设备或上报历史，暂时不能删除',
  USERNAME_EXISTS: '用户名已存在，请更换用户名',
}
export const cloudManagementError = (error) =>
  conflictMessages[error?.code] ||
  {
    400: '资料格式不正确，请检查输入',
    401: '云端登录已失效，请重新登录',
    403: '当前账号没有此操作权限，请刷新组织信息',
    404: '资源不存在或访问权限已变化',
    409: '当前资源状态不允许此操作，请刷新后检查',
    429: '操作过于频繁，请稍后重试',
  }[error?.status] ||
  '云端暂时无法连接，请重试'

export const createManagementState = () => ({
  detail: null,
  farms: [],
  rows: [],
  total: 0,
  page: 1,
  busy: false,
  error: '',
  ticket: null,
})

// A page owns its requests. Account, organization and farm switches invalidate all late responses.
export function createCloudManagement(
  api,
  session,
  state = createManagementState(),
  unauthorized = () => {},
) {
  let revision = 0
  let abort = new AbortController()
  const key = () =>
    `${session.apiUrl}|${session.token}|${session.organizationId}|${session.farmId}|${session.organizations.find((o) => o.id === session.organizationId)?.role}`
  const cancel = () => {
    revision++
    abort.abort()
    abort = new AbortController()
    Object.assign(state, createManagementState())
  }
  const orgPath = () => `/api/v1/organizations/${segment(session.organizationId)}`
  const farmPath = () => `/api/v1/farms/${segment(session.farmId)}`
  const run = async (operation) => {
    if (!session.token || state.busy) return false
    const current = ++revision,
      context = key()
    const { apiUrl, token } = session
    const signal = abort.signal
    const isCurrent = () => current === revision && context === key() && !signal.aborted
    const request = (method, path, data) => api.request(apiUrl, token, method, path, data, signal)
    state.busy = true
    state.error = ''
    try {
      const result = await operation(request, isCurrent)
      if (current !== revision || context !== key()) return false
      return result
    } catch (error) {
      if (
        current !== revision ||
        context !== key() ||
        ['CanceledError', 'AbortError'].includes(error?.name)
      )
        return false
      state.detail = null
      state.rows = []
      state.farms = []
      state.total = 0
      state.ticket = null
      state.error = cloudManagementError(error)
      if (error?.status === 401) unauthorized()
      return false
    } finally {
      if (current === revision) state.busy = false
    }
  }
  const load = (section = 'overview', page = 1, action = '') =>
    run(async (send, isCurrent) => {
      if (!session.organizationId) return false
      const path = session.farmId ? farmPath() : orgPath()
      const organizationPath = orgPath(),
        farm = Boolean(session.farmId)
      let detail = null,
        farms = [],
        rows = [],
        total = 0
      if (section === 'overview') {
        detail = await send('get', path + (farm ? '/overview' : ''))
        if (!isCurrent()) return false
        if (!farm) farms = await send('get', organizationPath + '/farms')
      } else if (section === 'audit') {
        const result = await send(
          'get',
          `${organizationPath}/audit/page?page=${page}&size=30&action=${segment(action)}`,
        )
        rows = result.items
        total = result.total
      } else {
        rows = await send('get', `${path}/${section}`)
        total = rows.length
      }
      if (!isCurrent()) return false
      Object.assign(state, { detail, farms, rows, total, page })
      return true
    })
  const mutate = (method, path, data, { ticket = false } = {}) =>
    run(async (send, isCurrent) => {
      const response = await send(method, path, data)
      if (!isCurrent()) return false
      if (ticket) state.ticket = response
      return true
    })
  return { state, cancel, load, mutate, orgPath, farmPath }
}
