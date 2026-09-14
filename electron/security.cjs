const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:'])
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

const parseUrl = value => {
  try {
    return new URL(String(value))
  } catch {
    return null
  }
}

const hasUnsafeControlCharacter = value => [...String(value || '')]
  .some(character => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f)

const hasUnsafeUrlParts = url => (
  !url
  || Boolean(url.username || url.password)
  || hasUnsafeControlCharacter(url.href)
)

const isLoopbackUrl = url => Boolean(url && LOOPBACK_HOSTS.has(url.hostname.toLowerCase()))

const formatUrl = url => url.toString().replace(/\/$/, '')

/**
 * Renderer development URLs are deliberately limited to loopback HTTP.
 * Packaged applications never use this path because app.isPackaged wins.
 */
const getAllowedDevServerUrl = (candidate, fallback = 'http://127.0.0.1:5176') => {
  const url = parseUrl(candidate || fallback)
  if (!url || url.protocol !== 'http:' || !isLoopbackUrl(url) || hasUnsafeUrlParts(url)) return fallback
  return formatUrl(url)
}

const isAllowedExternalUrl = value => {
  const url = parseUrl(value)
  return Boolean(url && ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol) && url.hostname && !hasUnsafeUrlParts(url))
}

const isAllowedRendererUrl = (value, renderer) => {
  const url = parseUrl(value)
  const source = parseUrl(renderer?.source)
  if (!url || !source || hasUnsafeUrlParts(url) || hasUnsafeUrlParts(source)) return false

  if (renderer.mode === 'dist-file') {
    return url.protocol === 'file:' && source.protocol === 'file:' && url.pathname === source.pathname
  }

  return renderer.mode === 'dev-server'
    && source.protocol === 'http:'
    && isLoopbackUrl(source)
    && url.protocol === source.protocol
    && url.origin === source.origin
}

const getContentSecurityPolicy = ({ isDevelopment = false } = {}) => {
  const scriptSources = ["'self'"]
  if (isDevelopment) scriptSources.push("'unsafe-inline'", "'unsafe-eval'")

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: http: https:",
    "font-src 'self' data:",
    "connect-src 'self' http: https: ws: wss:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
}

module.exports = {
  ALLOWED_EXTERNAL_PROTOCOLS,
  getAllowedDevServerUrl,
  getContentSecurityPolicy,
  isAllowedExternalUrl,
  isAllowedRendererUrl,
  isLoopbackUrl
}
