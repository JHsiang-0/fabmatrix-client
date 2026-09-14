const ERROR_MESSAGES = Object.freeze({
  400: '请求参数错误，请检查后重试',
  401: '登录已过期，请重新登录',
  403: '当前账号没有执行此操作的权限',
  404: '请求的资源不存在',
  10004: '功能暂未开放',
  405: '当前请求方法不受支持',
  409: '当前资源存在冲突，请刷新后重试',
  422: '当前状态不允许执行此操作',
  500: '服务器内部错误，请稍后重试',
  503: '服务暂时不可用，请稍后重试',
  10001: '打印机当前离线或不可用',
  10002: '打印机当前忙碌，请稍后重试',
  10003: '打印机协议不支持当前操作',
  5001: '数据库服务异常，请稍后重试',
  5002: '缓存服务异常，请稍后重试',
  5003: '文件存储服务暂不可用，请稍后重试',
  5004: '打印设备网络异常，请检查设备连接'
})

const UNSAFE_ERROR_MESSAGE = /###|\b(?:sql|mybatis|jdbc|stack trace|connection refused)\b|(?:[A-Za-z]:\\|\/var\/|\/tmp\/|\/home\/|org\.|java\.)/i

export const isSafeErrorMessage = message => (
  typeof message === 'string'
  && message.trim().length > 0
  && message.length <= 256
  && !UNSAFE_ERROR_MESSAGE.test(message)
)

export const getTraceId = response => {
  const headers = response?.headers
  if (!headers) return ''
  const value = typeof headers.get === 'function'
    ? headers.get('X-Trace-Id') || headers.get('x-trace-id')
    : headers['X-Trace-Id'] || headers['x-trace-id']
  return typeof value === 'string' ? value.trim() : ''
}

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

const isBinaryValue = value => {
  if (value == null) return false

  return (
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) ||
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value))
  )
}

/**
 * Binary responses are payloads, rather than the JSON response envelope.
 * `responseType` is checked as well because an empty Blob is still a valid
 * response for a download endpoint.
 */
export const isBinaryResponse = (value, config = {}) => {
  const responseType = String(config.responseType || '').toLowerCase()
  return ['arraybuffer', 'blob', 'stream'].includes(responseType) || isBinaryValue(value)
}

/**
 * Normalize the success side of the API contract without changing the
 * envelope shape consumed by the existing API modules (`response.data`).
 */
export function normalizeResponseEnvelope(payload, status = 200) {
  if (payload === null || payload === undefined) {
    return {
      code: status === 204 ? 204 : 200,
      message: '',
      data: null,
      timestamp: Date.now()
    }
  }

  if (typeof payload === 'object' && !isBinaryValue(payload)) {
    const hasEnvelopeField = ['code', 'message', 'data', 'timestamp'].some(field => hasOwn(payload, field))
    if (hasEnvelopeField) {
      return {
        ...payload,
        code: payload.code ?? (status >= 200 && status < 300 ? 200 : status),
        message: typeof payload.message === 'string' ? payload.message : '',
        data: hasOwn(payload, 'data') ? payload.data : null,
        timestamp: payload.timestamp ?? Date.now()
      }
    }
  }

  // A successful bare payload is tolerated for old endpoints, but is wrapped
  // immediately so callers still receive one stable response shape.
  return {
    code: status >= 200 && status < 300 ? 200 : status,
    message: '',
    data: payload,
    timestamp: Date.now()
  }
}

export const isSuccessfulEnvelope = (envelope, status = 200) => (
  status >= 200 && status < 300 && (
    Number(envelope?.code) === 200 || (status === 204 && Number(envelope?.code) === 204)
  )
)

export function getErrorContext(code, status, originalCode) {
  const numericCode = Number(code)
  const numericStatus = Number(status)

  if (numericStatus === 401 || numericCode === 401) return 'unauthorized'
  if (numericStatus === 403 || numericCode === 403) return 'forbidden'
  if (numericStatus === 404 || numericCode === 404) return 'not-found'
  if (numericStatus === 409 || numericCode === 409 || numericCode === 10002) return 'conflict'
  if (numericStatus === 422 || numericCode === 422 || numericCode === 10003) return 'validation'
  if (
    numericStatus === 503 ||
    [10001, 5001, 5002, 5003, 5004].includes(numericCode)
  ) return 'service-unavailable'
  if (numericStatus >= 500 || numericCode === 500) return 'server-error'
  if (originalCode === 'ECONNABORTED' || originalCode === 'ETIMEDOUT') return 'timeout'
  if (!numericStatus) return 'network'
  return 'request-error'
}

export function getErrorMessage({ code, status, originalCode, originalMessage, responseMessage } = {}) {
  if (isSafeErrorMessage(responseMessage)) return responseMessage.trim()
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]

  const context = getErrorContext(code, status, originalCode)
  if (context === 'timeout') return '请求超时，请检查后端服务是否正常运行'
  if (context === 'network') return '网络连接异常，请检查服务地址和网络连接'
  if (context === 'service-unavailable') return '服务暂时不可用，请稍后重试'
  if (status) return `请求失败 (${status})`
  return isSafeErrorMessage(originalMessage) ? originalMessage.trim() : '请求失败'
}

/**
 * A stable error type for both Axios failures and business-code failures.
 * `response` intentionally keeps the normalized backend envelope for legacy
 * callers that still read `error.response.data.message`.
 */
export class RequestError extends Error {
  constructor(messageOrOptions, options = {}) {
    const details = typeof messageOrOptions === 'string'
      ? { ...options, message: messageOrOptions }
      : (messageOrOptions || {})

    super(details.message || '请求失败')
    this.name = 'RequestError'
    this.code = details.code ?? details.status ?? 'REQUEST_ERROR'
    this.businessCode = details.businessCode ?? this.code
    this.status = details.status ?? null
    this.httpStatus = this.status
    this.data = details.data ?? null
    this.timestamp = details.timestamp ?? null
    this.traceId = details.traceId || null
    this.context = details.context || getErrorContext(this.code, this.status, details.axiosCode)
    this.method = details.method || null
    this.url = details.url || null
    this.axiosCode = details.axiosCode || null
    this.response = details.response
    this.request = details.request
    this.config = details.config
    this.originalError = details.originalError
    this.isRequestError = true
    this.toastShown = details.toastShown === true
  }
}
