const STORAGE_KEY = 'fabmatrix.server.connection'
const DESKTOP_API_BASE_URL = 'http://localhost:28081'
const DESKTOP_WS_URL = 'ws://localhost:28081/ws/farm-status'

const envApiBaseUrl = import.meta.env?.VITE_API_BASE_URL || ''
const envWsUrl = import.meta.env?.VITE_WS_URL || ''
const envMode = import.meta.env?.MODE || ''

const trimTrailingSlash = value => String(value || '').trim().replace(/\/+$/, '')

export const normalizeServerUrl = value => {
  const url = trimTrailingSlash(value)
  if (!url) return ''

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    if (parsed.username || parsed.password) return ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

export const resolveEnvironmentServerConfig = ({ mode = '', apiBaseUrl = '', wsUrl = '' } = {}) => {
  const desktopMode = mode === 'desktop' || mode.startsWith('desktop-')
  const explicitApiBaseUrl = String(apiBaseUrl || '').trim()
  const explicitWsUrl = String(wsUrl || '').trim()
  return {
    apiBaseUrl: normalizeServerUrl(explicitApiBaseUrl || (desktopMode ? DESKTOP_API_BASE_URL : '')),
    wsUrl: explicitWsUrl || (desktopMode ? DESKTOP_WS_URL : '')
  }
}

const readEnvironmentServerConfig = () => resolveEnvironmentServerConfig({
  mode: envMode,
  apiBaseUrl: envApiBaseUrl,
  wsUrl: envWsUrl
})

const readStoredConfig = () => {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw)
    const apiBaseUrl = normalizeServerUrl(value?.apiBaseUrl)
    const wsUrl = String(value?.wsUrl || '').trim()
    return apiBaseUrl || wsUrl ? { apiBaseUrl, wsUrl } : null
  } catch {
    return null
  }
}

export const getServerConfig = () => {
  const stored = readStoredConfig()
  const hasStoredConfig = Boolean(stored)
  const environment = readEnvironmentServerConfig()
  return {
    apiBaseUrl: hasStoredConfig ? stored.apiBaseUrl : environment.apiBaseUrl,
    wsUrl: hasStoredConfig ? stored.wsUrl : environment.wsUrl
  }
}

export const getEnvironmentServerConfig = () => readEnvironmentServerConfig()

export const parseServerEndpoint = value => {
  const normalized = normalizeServerUrl(value)
  if (!normalized) return { protocol: 'http', host: '', port: '' }

  const parsed = new URL(normalized)
  return {
    protocol: parsed.protocol === 'https:' ? 'https' : 'http',
    host: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
  }
}

export const parseWebSocketEndpoint = wsUrl => {
  const value = String(wsUrl || '').trim()
  const match = value.match(/^(wss?):\/\/(.*)$/i)
  return {
    protocol: match?.[1]?.toLowerCase() || 'ws',
    address: match?.[2] || ''
  }
}

const normalizeEndpointHost = value => String(value || '').trim().replace(/^\[|\]$/g, '')

export const isValidServerHost = value => {
  const host = normalizeEndpointHost(value)
  if (!host || /[\s/\\?#@]/.test(host) || host.includes('://')) return false

  if (host.includes(':')) {
    try {
      const parsed = new URL(`http://[${host}]`)
      return parsed.hostname === `[${host}]`
    } catch {
      return false
    }
  }

  const ipv4Parts = host.split('.')
  if (ipv4Parts.length === 4 && ipv4Parts.every(part => /^\d{1,3}$/.test(part))) {
    return ipv4Parts.every(part => Number(part) <= 255)
  }

  return /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(host)
}

export const buildServerBaseUrl = ({ protocol = 'http', host, port }) => {
  const normalizedProtocol = protocol === 'https' ? 'https' : 'http'
  const normalizedHost = normalizeEndpointHost(host)
  const normalizedPort = String(port || '').trim()
  if (!isValidServerHost(normalizedHost) || !/^\d{1,5}$/.test(normalizedPort) || Number(normalizedPort) < 1 || Number(normalizedPort) > 65535) return ''

  const hostWithBrackets = normalizedHost.includes(':') && !normalizedHost.startsWith('[')
    ? `[${normalizedHost}]`
    : normalizedHost
  return normalizeServerUrl(`${normalizedProtocol}://${hostWithBrackets}:${normalizedPort}`)
}

export const deriveWebSocketUrl = apiBaseUrl => {
  const normalizedApiBaseUrl = normalizeServerUrl(apiBaseUrl)
  if (!normalizedApiBaseUrl) return ''

  try {
    const parsed = new URL(normalizedApiBaseUrl)
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    parsed.pathname = '/ws/farm-status'
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

export const deriveWebSocketEndpoint = endpoint => parseWebSocketEndpoint(
  deriveWebSocketUrl(buildServerBaseUrl(endpoint))
)

export const getApiBaseUrl = () => getServerConfig().apiBaseUrl

export const getWebSocketBaseUrl = () => {
  const { wsUrl, apiBaseUrl } = getServerConfig()
  if (wsUrl) return wsUrl
  const derived = deriveWebSocketUrl(apiBaseUrl)
  if (derived) return derived

  if (typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol)) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws/farm-status`
  }

  return ''
}

export const saveServerConfig = ({ apiBaseUrl, wsUrl = '' }) => {
  const normalizedApiBaseUrl = normalizeServerUrl(apiBaseUrl)
  if (!normalizedApiBaseUrl) throw new Error('请输入有效的 HTTP/HTTPS 服务器地址')

  const normalizedWsUrl = String(wsUrl || '').trim()
  if (normalizedWsUrl) {
    try {
      const parsed = new URL(normalizedWsUrl)
      if (!['ws:', 'wss:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) {
        throw new Error('WebSocket 地址必须使用 ws:// 或 wss://，且不能包含账号密码')
      }
      if (parsed.port && (Number(parsed.port) < 1 || Number(parsed.port) > 65535)) {
        throw new Error('WebSocket 端口必须是 1 到 65535 的数字')
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('WebSocket')) throw error
      throw new Error('请输入有效的 WebSocket 地址', { cause: error })
    }
  }

  const config = { apiBaseUrl: normalizedApiBaseUrl, wsUrl: normalizedWsUrl }
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  return config
}

export const clearServerConfig = () => {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
}

export const getServerConfigStorageKey = () => STORAGE_KEY
