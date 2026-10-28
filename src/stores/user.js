import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getCurrentUser, login, logoutSession } from '@/api/user'
import {
  createAuthSession,
  isSessionExpired,
  refreshAuthSession
} from '@/utils/authSession'

const SESSION_STORAGE_KEY = 'farm-ui-session'

const readStoredSession = () => {
  if (typeof window === 'undefined') return null

  for (const [storage, remember] of [
    [window.sessionStorage, false],
    [window.localStorage, true]
  ]) {
    try {
      const value = storage.getItem(SESSION_STORAGE_KEY)
      if (value) return { ...JSON.parse(value), remember }
    } catch {
      // 存储不可用或内容损坏时继续尝试另一个存储区。
    }
  }

  return null
}

const clearStoredSession = () => {
  if (typeof window === 'undefined') return
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      storage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      // 忽略浏览器禁用存储的情况，内存中的登录态仍会被清理。
    }
  }
}

export const useUserStore = defineStore('user', () => {
  const storedSession = readStoredSession()
  const token = ref(storedSession?.token || '')
  const userInfo = ref(storedSession?.userInfo || {})
  const expiresIn = ref(storedSession?.expiresIn || null)
  const expiresAt = ref(storedSession?.expiresAt || null)
  const rememberSession = ref(storedSession?.remember === true)
  const restoreState = ref(token.value ? 'restoring' : 'anonymous')
  const isAdmin = computed(() => userInfo.value.role === 'ADMIN')
  const canOperate = computed(() => (Array.isArray(userInfo.value.permissions) ? userInfo.value.permissions.includes('job:operate') : ['ADMIN', 'OPERATOR'].includes(userInfo.value.role)) && !userInfo.value.mustChangePassword)
  const isViewer = computed(() => userInfo.value.role === 'VIEWER')
  const isOperator = computed(() => userInfo.value.role === 'OPERATOR')
  const isAuthenticated = computed(() => Boolean(token.value && restoreState.value === 'authenticated'))
  const isRestoring = computed(() => restoreState.value === 'restoring')
  let restorePromise = null
  let sessionGeneration = 0

  const invalidateSessionRequests = () => {
    sessionGeneration += 1
    restorePromise = null
  }

  const getSessionGeneration = () => sessionGeneration

  const persistSession = remember => {
    if (typeof window === 'undefined') return

    rememberSession.value = remember === true
    clearStoredSession()
    try {
      const storage = remember ? window.localStorage : window.sessionStorage
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        token: token.value,
        userInfo: userInfo.value,
        expiresIn: expiresIn.value,
        expiresAt: expiresAt.value
      }))
    } catch {
      // 存储不可用时保留当前页面内存登录态，不阻断登录。
    }
  }

  const clearSession = () => {
    invalidateSessionRequests()
    token.value = ''
    userInfo.value = {}
    expiresIn.value = null
    expiresAt.value = null
    restoreState.value = 'anonymous'
    clearStoredSession()
  }

  const applyLoginResult = (data, options = {}) => {
    const session = createAuthSession(data)
    if (!session) {
      clearSession()
      throw new Error('登录响应缺少有效的身份信息')
    }

    invalidateSessionRequests()
    token.value = session.token
    userInfo.value = session.userInfo
    expiresIn.value = session.expiresIn
    expiresAt.value = session.expiresAt
    restoreState.value = 'authenticated'
    persistSession(options.remember === true)
  }

  // 登录动作
  const userLogin = async (loginForm, options = {}) => {
    const res = await login(loginForm)
    applyLoginResult(res.data, options)
  }

  // 首次管理员初始化接口已经返回登录结果，避免创建后再次发送一次密码登录请求。
  const userLoginWithResult = (data, options = {}) => {
    applyLoginResult(data, options)
  }

  /**
   * Validate a stored token against the server and replace the locally stored
   * role/profile with the trusted /auth/me response.
   */
  const restoreSession = () => {
    if (restorePromise) return restorePromise

    if (!token.value) {
      restoreState.value = 'anonymous'
      return Promise.resolve(false)
    }

    if (isSessionExpired(expiresAt.value)) {
      clearSession()
      return Promise.resolve(false)
    }

    const generation = sessionGeneration
    const currentSession = {
      token: token.value,
      userInfo: userInfo.value,
      expiresIn: expiresIn.value,
      expiresAt: expiresAt.value
    }
    const isCurrentSession = () => (
      generation === sessionGeneration && token.value === currentSession.token
    )
    // A route awaiting an obsolete restore must use the new session's result.
    const resolveCurrentSession = () => (
      restorePromise && restorePromise !== promise ? restorePromise : isAuthenticated.value
    )

    restoreState.value = 'restoring'
    const promise = (async () => {
      try {
        const response = await getCurrentUser()
        if (!isCurrentSession()) return resolveCurrentSession()
        const session = refreshAuthSession(currentSession, response?.data)

        if (!session) throw new Error('当前用户身份无效')

        token.value = session.token
        userInfo.value = session.userInfo
        expiresIn.value = session.expiresIn
        expiresAt.value = session.expiresAt
        restoreState.value = 'authenticated'
        persistSession(rememberSession.value)
        return true
      } catch {
        if (!isCurrentSession()) return resolveCurrentSession()
        clearSession()
        return false
      }
    })().finally(() => {
      if (restorePromise === promise) restorePromise = null
    })

    restorePromise = promise
    return promise
  }

  const hasRole = roles => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles]
    return requiredRoles
      .filter(Boolean)
      .some(role => String(role).toUpperCase() === userInfo.value.role)
  }

  // 登出动作
  const logout = () => {
    clearSession()

    // Avoid a hard dependency during app bootstrap while ensuring logout also
    // clears an active realtime connection when that store has been used.
    void import('@/stores/printer/realtimeStore')
      .then(({ useRealtimeStore }) => useRealtimeStore().disconnectWs())
      .catch(() => {})
  }

  const endSession = async () => {
    const generation = sessionGeneration
    try { await logoutSession() } finally {
      if (generation === sessionGeneration) logout()
    }
  }

  return {
    canOperate,
    isViewer,
    endSession,
    token,
    userInfo,
    expiresIn,
    expiresAt,
    restoreState,
    isAuthenticated,
    isRestoring,
    isAdmin,
    isOperator,
    userLogin,
    userLoginWithResult,
    restoreSession,
    getSessionGeneration,
    hasRole,
    logout
  }
})
