export const normalizeCloudUrl = value => {
  try {
    const url = new URL(String(value || '').trim())
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return ''
    if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) return ''
    return url.origin
  } catch { return '' }
}

export const createCloudState = () => ({
  apiUrl: '', token: '', user: null, organizations: [], farms: [], organizationId: '', farmId: '',
  printers: [], total: 0, page: 1, size: 50, error: '', loading: false, authenticating: false, lastRefreshAt: null
})

export const createCloudSession = (api, state = createCloudState()) => {
  let generation = 0
  let controller = new AbortController()
  const cancel = () => {
    generation += 1
    controller.abort()
    controller = new AbortController()
    state.loading = false
    return generation
  }
  const clear = () => {
    cancel()
    const url = state.apiUrl
    Object.assign(state, createCloudState(), { apiUrl: url })
  }
  const failure = (error, current, login = false) => {
    if (current !== generation || error?.name === 'CanceledError' || error?.name === 'AbortError') return
    if (error?.status === 401) {
      clear()
      state.error = login ? '用户名或密码不正确，或账号不可用' : '云端登录已失效，请重新登录'
    } else {
      if ([403, 404].includes(error?.status)) { state.printers = []; state.total = 0 }
      state.error = error?.status === 429 ? '登录尝试过于频繁，请稍后重试'
        : [403, 404].includes(error?.status) ? '没有访问所选组织或农场的权限'
          : '云端暂时无法连接，请检查网络后重试'
    }
  }
  const request = (method, path, data) => api.request(state.apiUrl, state.token, method, path, data, controller.signal)

  const refresh = async () => {
    if (!state.token || !state.farmId || state.loading) return false
    const current = generation
    state.loading = true
    try {
      const result = await request('get', `/api/v1/farms/${encodeURIComponent(state.farmId)}/printers?page=${state.page}&size=${state.size}`)
      if (current !== generation) return false
      state.printers = result.items
      state.total = result.total
      state.lastRefreshAt = Date.now()
      state.error = ''
      return true
    } catch (error) { failure(error, current); return false }
    finally { if (current === generation) state.loading = false }
  }

  const selectFarm = async id => {
    cancel()
    state.farmId = id
    state.printers = []
    state.total = 0
    state.page = 1
    state.lastRefreshAt = null
    state.error = ''
    return refresh()
  }

  const selectOrganization = async id => {
    const current = cancel()
    state.organizationId = id
    state.farmId = ''
    state.farms = []
    state.printers = []
    state.total = 0
    state.lastRefreshAt = null
    state.error = ''
    state.loading = true
    try {
      const farms = await request('get', `/api/v1/organizations/${encodeURIComponent(id)}/farms`)
      if (current !== generation) return false
      state.farms = farms
      state.loading = false
      if (farms.length) return selectFarm(farms[0].id)
      return true
    } catch (error) { failure(error, current); return false }
    finally { if (current === generation) state.loading = false }
  }

  const login = async (url, username, password) => {
    const normalized = normalizeCloudUrl(url)
    if (!normalized) { state.error = '请输入 HTTPS 云端地址，本机调试可使用 HTTP 地址'; return false }
    clear()
    const current = generation
    state.apiUrl = normalized
    state.authenticating = true
    try {
      const result = await api.login(normalized, username, password, controller.signal)
      if (current !== generation) return false
      const organizations = await api.request(normalized, result.accessToken, 'get', '/api/v1/organizations', undefined, controller.signal)
      if (current !== generation) return false
      state.token = result.accessToken
      state.user = result.user
      state.organizations = organizations
      state.authenticating = false
      if (organizations.length) return selectOrganization(organizations[0].id)
      return true
    } catch (error) { failure(error, current, true); return false }
    finally { if (current === generation) state.authenticating = false }
  }

  const logout = async () => {
    const { apiUrl, token } = state
    clear()
    if (token) {
      try { await api.request(apiUrl, token, 'post', '/api/v1/auth/logout', {}) }
      catch { /* The local cloud session is already cleared; never touch the LAN session. */ }
    }
  }
  return { state, login, logout, refresh, selectOrganization, selectFarm, cancel }
}
