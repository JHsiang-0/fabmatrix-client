import axios from 'axios'
import { notifyRequestError } from './message'
import { useUserStore } from '@/stores/user'
import router from '@/router'
import { REQUEST_TIMEOUT } from './constants'
import { isMockEnabled, mockRequest } from '@/mock'
import { getApiBaseUrl } from './serverConfig'
import {
  getErrorContext,
  getErrorMessage,
  isBinaryResponse,
  isSuccessfulEnvelope,
  normalizeResponseEnvelope,
  RequestError
} from './requestCore'

export { RequestError } from './requestCore'
export {
  getErrorContext,
  getErrorMessage,
  isBinaryResponse,
  isSuccessfulEnvelope,
  normalizeResponseEnvelope
} from './requestCore'

const REQUEST_CONFIG = {
  TIMEOUT: REQUEST_TIMEOUT.DEFAULT,
  BASE_URL: import.meta.env.VITE_API_BASE_URL || ''
}

export const service = axios.create({
  baseURL: REQUEST_CONFIG.BASE_URL,
  timeout: REQUEST_CONFIG.TIMEOUT
})

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])
const pendingRequests = new Map()
// Session credentials stay private to this module and are never attached to
// Axios config/error objects that may be logged or returned to callers.
const requestAuthSessions = new WeakMap()

const isCanceledError = error => (
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'
)

const rememberRequestSession = (config, token) => {
  if (config && typeof config === 'object') requestAuthSessions.set(config, token || '')
  return config
}

const sanitizeRequestConfig = config => {
  if (!config || typeof config !== 'object') return undefined
  return {
    method: config.method,
    url: config.url,
    responseType: config.responseType,
    timeout: config.timeout
  }
}

const isUnsupportedBody = value => {
  if (value == null) return false

  return (
    (typeof FormData !== 'undefined' && value instanceof FormData) ||
    isBinaryResponse(value)
  )
}

const serializeRequestPart = value => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (isUnsupportedBody(value)) return null

  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

/**
 * Generate a lock key for non-idempotent requests. Callers may opt out for
 * operations where submitting the same body twice is intentional.
 */
export const getRequestLockKey = config => {
  if (config.dedupe === false) return null

  const method = String(config.method || 'get').toLowerCase()
  if (!MUTATING_METHODS.has(method)) return null
  if (config.dedupeKey) return String(config.dedupeKey)

  const params = serializeRequestPart(config.params)
  const data = serializeRequestPart(config.data)
  if (params === null || data === null) return null

  return `${method}:${config.url || ''}:${params}:${data}`
}

const withAuthHeader = config => {
  const userStore = useUserStore()
  const headers = { ...config.headers }
  const requestToken = userStore.token || ''

  if (requestToken) headers.Authorization = `Bearer ${requestToken}`
  return rememberRequestSession({ ...config, headers }, requestToken)
}

const createErrorFromFailure = (error, config) => {
  const requestConfig = config || error?.config || error?.response?.config
  const safeConfig = sanitizeRequestConfig(requestConfig)
  if (error instanceof RequestError) {
    error.config = safeConfig
    error.request = undefined
    error.originalError = undefined
    if (error.response) {
      error.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        config: safeConfig
      }
    }
    return error
  }

  const response = error?.response
  const responsePayload = response?.data
  const status = response?.status ?? null
  const envelope = responsePayload && typeof responsePayload === 'object' && !isBinaryResponse(responsePayload)
    ? normalizeResponseEnvelope(responsePayload, status || 500)
    : null
  const code = envelope?.code ?? status ?? error?.code ?? 'REQUEST_ERROR'
  const responseMessage = typeof envelope?.message === 'string' ? envelope.message : ''
  const messageText = getErrorMessage({
    code,
    status,
    originalCode: error?.code,
    originalMessage: error?.message,
    responseMessage
  })
  const normalizedResponse = response
    ? {
        status: response.status,
        statusText: response.statusText,
        data: envelope || responsePayload,
        config: safeConfig
      }
    : undefined

  return new RequestError({
    message: messageText,
    code,
    businessCode: envelope?.code ?? (typeof code === 'number' ? code : null),
    status,
    data: envelope?.data ?? null,
    timestamp: envelope?.timestamp ?? null,
    context: getErrorContext(code, status, error?.code),
    method: requestConfig?.method,
    url: requestConfig?.url,
    axiosCode: error?.code,
    response: normalizedResponse,
    config: safeConfig
  })
}

const handleUnauthorized = (error, requestConfig) => {
  if (error.context !== 'unauthorized') return false

  const userStore = useUserStore()
  const requestToken = requestAuthSessions.get(requestConfig)
  const currentToken = userStore.token || ''
  if (requestToken === undefined || requestToken !== currentToken) return true

  userStore.logout()

  const currentPath = router.currentRoute?.value?.path
  if (currentPath !== '/login') {
    void router.push({ name: 'login' }).catch(() => {})
  }
  return false
}

export const handleRequestError = (error, config) => {
  if (isCanceledError(error)) return Promise.reject(error)

  const requestConfig = config || error?.config || error?.response?.config
  const requestError = createErrorFromFailure(error, requestConfig)
  const staleUnauthorized = handleUnauthorized(requestError, requestConfig)

  if (!staleUnauthorized && !requestError.toastShown) {
    requestError.toastShown = true
    try {
      notifyRequestError(requestError)
    } catch {
      // SSR/测试环境可能没有可用的消息挂载点；请求仍须 reject 原始脱敏错误。
    }
  }

  console.error('[Request Error]', requestError)
  return Promise.reject(requestError)
}

const normalizeSuccess = (responseData, config, status = 200) => {
  if (isBinaryResponse(responseData, config)) return responseData

  const envelope = normalizeResponseEnvelope(responseData, status)
  if (!isSuccessfulEnvelope(envelope, status)) {
    throw new RequestError({
      message: getErrorMessage({
        code: envelope.code,
        status,
        responseMessage: envelope.message
      }),
      code: envelope.code,
      businessCode: envelope.code,
      status,
      data: envelope.data,
      timestamp: envelope.timestamp,
      context: getErrorContext(envelope.code, status),
      response: { status, data: envelope },
      config
    })
  }

  return envelope
}

const validateAxiosResponse = response => {
  try {
    return normalizeSuccess(response.data, response.config, response.status)
  } catch (error) {
    return handleRequestError(error)
  }
}

service.interceptors.request.use(
  config => {
    const userStore = useUserStore()
    const requestToken = userStore.token || ''
    config.baseURL = getApiBaseUrl()
    config.headers = { ...config.headers }
    if (requestToken) config.headers.Authorization = `Bearer ${requestToken}`
    return rememberRequestSession(config, requestToken)
  },
  error => Promise.reject(error)
)

service.interceptors.response.use(validateAxiosResponse, handleRequestError)

const executeRequest = config => {
  if (!isMockEnabled) return service(config)

  const requestConfig = withAuthHeader(config)
  return mockRequest(requestConfig)
    .then(response => normalizeSuccess(response, requestConfig, 200))
    .catch(error => handleRequestError(error, requestConfig))
}

const request = config => {
  const requestConfig = { ...config }
  const lockKey = getRequestLockKey(requestConfig)
  delete requestConfig.dedupe
  delete requestConfig.dedupeKey

  if (!lockKey) return executeRequest(requestConfig)

  const pendingRequest = pendingRequests.get(lockKey)
  if (pendingRequest) return pendingRequest

  const promise = Promise.resolve()
    .then(() => executeRequest(requestConfig))
    .finally(() => {
      if (pendingRequests.get(lockKey) === promise) pendingRequests.delete(lockKey)
    })

  pendingRequests.set(lockKey, promise)
  return promise
}

export default request
