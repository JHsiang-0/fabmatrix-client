import axios from 'axios'
import { notifyRequestError } from './message'
import { useUserStore } from '@/stores/user'
import router from '@/router'
import { REQUEST_TIMEOUT } from './constants'
import { isMockEnabled, mockRequest } from '@/mock'
import { getApiBaseUrl } from './serverConfig'
import { readJsonDownloadBody } from './fileExport'
import {
  getErrorContext,
  getErrorMessage,
  getTraceId,
  isBinaryResponse,
  isSuccessfulEnvelope,
  normalizeResponseEnvelope,
  RequestError
} from './requestCore'

export { RequestError } from './requestCore'
export {
  getErrorContext,
  getErrorMessage,
  getTraceId,
  isSafeErrorMessage,
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

// Cloud identity is independent of the local JWT/Result interceptors and request lifecycle.
export const createCloudTransport = () => axios.create({
  timeout: REQUEST_TIMEOUT.DEFAULT,
  withCredentials: false,
  headers: { Authorization: null }
})

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])
const pendingRequests = new Map()
// Session credentials stay private to this module and are never attached to
// Axios config/error objects that may be logged or returned to callers.
const requestAuthSessions = new WeakMap()
let observedAuthToken
let observedStoreGeneration
let authSessionGeneration = 0

const isCanceledError = error => (
  error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'
)

const getCurrentAuthSession = () => {
  const userStore = useUserStore()
  const token = userStore.token || ''
  const storeGeneration = userStore.getSessionGeneration()
  if (observedAuthToken !== token || observedStoreGeneration !== storeGeneration) {
    observedAuthToken = token
    observedStoreGeneration = storeGeneration
    authSessionGeneration += 1
  }
  return { token, generation: authSessionGeneration }
}

const rememberRequestSession = (config, generation) => {
  if (config && typeof config === 'object') requestAuthSessions.set(config, generation)
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
export const getRequestLockKey = (config, sessionGeneration = 0) => {
  if (config.dedupe === false) return null

  const method = String(config.method || 'get').toLowerCase()
  if (!MUTATING_METHODS.has(method)) return null
  if (config.dedupeKey) return `${sessionGeneration}:${String(config.dedupeKey)}`

  const params = serializeRequestPart(config.params)
  const data = serializeRequestPart(config.data)
  if (params === null || data === null) return null

  return `${sessionGeneration}:${method}:${config.url || ''}:${params}:${data}`
}

const withAuthSession = (config, session) => {
  const headers = { ...config.headers }

  if (session.token) headers.Authorization = `Bearer ${session.token}`
  return { ...config, headers, authSessionGeneration: session.generation }
}

const bindRequestSession = config => {
  let generation = config.authSessionGeneration
  if (!Number.isSafeInteger(generation)) {
    const session = getCurrentAuthSession()
    config.headers = { ...config.headers }
    if (session.token) config.headers.Authorization = `Bearer ${session.token}`
    generation = session.generation
  }
  delete config.authSessionGeneration
  return rememberRequestSession(config, generation)
}

const createCanceledError = (error, config) => {
  const requestConfig = config || error?.config || error?.response?.config
  const safeConfig = sanitizeRequestConfig(requestConfig)
  const response = error?.response
    ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: getSafeResponseHeaders(error.response.headers),
        config: safeConfig
      }
    : undefined
  const canceledError = new RequestError({
    message: error?.message || '请求已取消',
    code: 'ERR_CANCELED',
    businessCode: 'ERR_CANCELED',
    status: response?.status ?? null,
    context: 'canceled',
    traceId: getTraceId(error?.response),
    method: requestConfig?.method,
    url: requestConfig?.url,
    axiosCode: 'ERR_CANCELED',
    response,
    config: safeConfig
  })

  canceledError.name = 'CanceledError'
  canceledError.isAxiosError = error?.isAxiosError === true
  canceledError.__CANCEL__ = true
  delete canceledError.request
  delete canceledError.originalError
  return canceledError
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
        headers: getSafeResponseHeaders(response.headers),
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
    traceId: envelope?.traceId || getTraceId(response),
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
  const requestGeneration = requestAuthSessions.get(requestConfig)
  const currentSession = getCurrentAuthSession()
  if (requestGeneration === undefined || requestGeneration !== currentSession.generation) return true

  userStore.logout()

  const currentPath = router.currentRoute?.value?.path
  if (currentPath !== '/login') {
    void router.push({ name: 'login' }).catch(() => {})
  }
  return false
}

const getSafeResponseHeaders = headers => {
  const traceId = getTraceId({ headers })
  return traceId ? { 'X-Trace-Id': traceId } : undefined
}

export const handleRequestError = (error, config) => {
  const requestConfig = config || error?.config || error?.response?.config
  if (isCanceledError(error)) return Promise.reject(createCanceledError(error, requestConfig))

  const requestError = createErrorFromFailure(error, requestConfig)
  if (Number(requestError.businessCode) === 4031
      && requestAuthSessions.get(requestConfig) === getCurrentAuthSession().generation) {
    const userStore = useUserStore()
    userStore.userInfo.mustChangePassword = true
    void router.replace({ name: 'change-password' }).catch(() => {})
  }
  const staleUnauthorized = handleUnauthorized(requestError, requestConfig)

  if (!staleUnauthorized && !requestError.toastShown && requestConfig?.notifyError !== false) {
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

const normalizeSuccess = (responseData, config, status = 200, headers) => {
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
      traceId: envelope.traceId || getTraceId({ headers }),
      context: getErrorContext(envelope.code, status),
      response: { status, data: envelope, headers: getSafeResponseHeaders(headers) },
      config
    })
  }

  return envelope
}

const normalizeDownloadResponse = async response => {
  const payload = await readJsonDownloadBody(response.data, response.headers)
  if (payload !== null) {
    normalizeSuccess(payload, { ...response.config, responseType: 'json' }, response.status, response.headers)
    throw new RequestError({ message: '服务端未返回导出文件，请重试', code: 503, status: 503, config: response.config })
  }
  const contentType = String(response.headers?.['content-type'] || response.data?.type || '').split(';')[0].trim().toLowerCase()
  if (!(response.data instanceof Blob) || !response.data.size
    || !response.config.downloadContentTypes?.includes(contentType)) {
    throw new RequestError({ message: '导出文件格式无效，请重试', code: 503, status: 503, config: response.config })
  }
  return {
    blob: response.data,
    contentType,
    contentDisposition: String(response.headers?.['content-disposition'] || '').slice(0, 2048)
  }
}

const handleAxiosFailure = async (error, config) => {
  const requestConfig = config || error?.config || error?.response?.config
  if (requestConfig?.downloadResponse && error?.response?.data instanceof Blob) {
    const payload = await readJsonDownloadBody(error.response.data, error.response.headers, true)
    if (payload !== null) error.response.data = payload
  }
  return handleRequestError(error, requestConfig)
}

const validateAxiosResponse = async response => {
  try {
    if (response.config?.downloadResponse) return await normalizeDownloadResponse(response)
    return normalizeSuccess(response.data, response.config, response.status, response.headers)
  } catch (error) {
    return handleRequestError(error, response.config)
  }
}

service.interceptors.request.use(
  config => {
    config.baseURL = getApiBaseUrl()
    return bindRequestSession(config)
  },
  error => Promise.reject(error)
)

service.interceptors.response.use(validateAxiosResponse, handleAxiosFailure)

const executeRequest = (config, session) => {
  const requestConfig = withAuthSession(config, session)
  if (!isMockEnabled) return service(requestConfig)

  const boundRequestConfig = bindRequestSession(requestConfig)
  return mockRequest(boundRequestConfig)
    .then(response => boundRequestConfig.downloadResponse
      ? validateAxiosResponse({ ...response, config: boundRequestConfig })
      : normalizeSuccess(response, boundRequestConfig, 200))
    .catch(error => handleAxiosFailure(error, boundRequestConfig))
}

const request = config => {
  const session = getCurrentAuthSession()
  const requestConfig = { ...config }
  const lockKey = getRequestLockKey(requestConfig, session.generation)
  delete requestConfig.dedupe
  delete requestConfig.dedupeKey

  if (!lockKey) return executeRequest(requestConfig, session)

  const pendingRequest = pendingRequests.get(lockKey)
  if (pendingRequest) return pendingRequest

  const promise = Promise.resolve()
    .then(() => executeRequest(requestConfig, session))
    .finally(() => {
      if (pendingRequests.get(lockKey) === promise) pendingRequests.delete(lockKey)
    })

  pendingRequests.set(lockKey, promise)
  return promise
}

export default request
