import request from '@/utils/request'
import {
  mapResponseData,
  normalizePageParams,
  normalizePageResponse,
  normalizeAuditLog,
  normalizeUser
} from '@/utils/dataAdapters'

/**
 * 用户认证 API 模块
 * @module api/user
 */

/**
 * 用户登录
 * @param {Object} data - 登录参数
 * @param {string} data.username - 用户名
 * @param {string} data.password - 密码
 * @returns {Promise<{code: number, message: string, data: LoginResult}>} 登录结果
 */
export function login(data) {
  const { username, password } = data || {}
  return request({
    url: '/api/v1/auth/login',
    method: 'post',
    data: { username, password }
  }).then(response => mapResponseData(response, normalizeUser))
}

/**
 * 查询首次管理员初始化状态。
 */
export function getFirstAdminSetupStatus() {
  return request({
    url: '/api/v1/auth/setup/status',
    method: 'get'
  })
}

/** 读取仅允许服务端本机访问的短期首次初始化凭据。 */
export function getFirstAdminBootstrapToken() {
  return request({
    url: '/api/v1/auth/setup/bootstrap-token',
    method: 'get'
  })
}

/**
 * 创建 Local Edition 的首个管理员，成功后返回可直接使用的登录结果。
 */
export function setupFirstAdmin(data) {
  return request({
    url: '/api/v1/auth/setup/admin',
    method: 'post',
    data
  }).then(response => mapResponseData(response, normalizeUser))
}

/**
 * Restore the current identity from the Bearer Token.
 */
export function getCurrentUser() {
  return request({
    url: '/api/v1/auth/me',
    method: 'get'
  }).then(response => mapResponseData(response, normalizeUser))
}

/**
 * 用户注册
 * @param {Object} data - 注册参数
 * @param {string} data.username - 用户名
 * @param {string} data.password - 密码
 * @param {string} [data.email] - 邮箱
 * @param {string} [data.phone] - 手机号
 * @returns {Promise<{code: number, message: string, data: string}>} 注册结果，data 为新用户 ID
 */
export function register(data) {
  return request({
    url: '/api/v1/auth/register',
    method: 'post',
    data
  }).then(response => mapResponseData(response, normalizeUser))
}

export function getAdminUsers(params = {}) {
  return request({
    url: '/api/v1/auth/admin/users',
    method: 'get',
    params: normalizePageParams(params)
  }).then(response => mapResponseData(response, data => normalizePageResponse(data, normalizeUser)))
}

export function createAdminUser(data) {
  return request({ url: '/api/v1/auth/admin/users', method: 'post', data })
}

export function updateAdminUser(userId, data) {
  return request({ url: `/api/v1/auth/admin/users/${userId}`, method: 'put', data })
}

export function setAdminUserEnabled(userId, enabled) {
  return request({
    url: `/api/v1/auth/admin/users/${userId}/${enabled ? 'enable' : 'disable'}`,
    method: 'post'
  }).then(response => mapResponseData(response, normalizeUser))
}

/** 查询管理员操作日志；只由 ADMIN 页面调用，响应字段由适配层严格收敛。 */
export function getAuditLogs(params = {}) {
  return request({
    url: '/api/v1/auth/admin/audit-logs',
    method: 'get',
    params: normalizePageParams({ pageSize: 20, ...params })
  }).then(response => mapResponseData(
    response,
    data => normalizePageResponse(data, normalizeAuditLog)
  ))
}

export function getProfile(userId) {
  return request({ url: `/api/v1/auth/${userId}/profile`, method: 'get' })
    .then(response => mapResponseData(response, normalizeUser))
}

export function updateProfile(userId, data) {
  return request({ url: `/api/v1/auth/${userId}/profile`, method: 'put', data })
}

export function changePassword(userId, data) {
  return request({ url: `/api/v1/auth/${userId}/change-password`, method: 'post', data })
}

// ============================================
// Type Definitions (JSDoc)
// ============================================

/**
 * @typedef {Object} LoginResult
 * @property {string} token - Bearer Token
 * @property {number} expiresIn - 有效期（秒）
 * @property {string} userId - 用户ID
 * @property {string} username - 用户名
 * @property {string} role - 用户角色（ADMIN/OPERATOR）
 */

/**
 * @typedef {Object} UserInfo
 * @property {string} id - 用户ID
 * @property {string} username - 用户名
 * @property {string} [email] - 邮箱
 * @property {string} [phone] - 手机号
 * @property {string} [avatar] - 头像URL
 * @property {string} createdAt - 创建时间
 * @property {string} updatedAt - 更新时间
 */

export const resetUserPassword = (userId, data) => request({
  url: `/api/v1/auth/admin/users/${userId}/reset-password`, method: 'post', data
})
export const logoutSession = () => request({ url: '/api/v1/auth/logout', method: 'post' })
export const getLoginSessions = userId => request({
  url: userId ? `/api/v1/auth/admin/users/${userId}/sessions` : '/api/v1/auth/sessions', method: 'get'
})
export const revokeLoginSession = (id, userId) => request({
  url: userId ? `/api/v1/auth/admin/users/${userId}/sessions/${id}/revoke` : `/api/v1/auth/sessions/${id}/revoke`, method: 'post'
})
export const revokeOtherSessions = () => request({ url: '/api/v1/auth/sessions/revoke-others', method: 'post' })
export const revokeUserSessions = userId => request({ url: `/api/v1/auth/admin/users/${userId}/sessions/revoke-all`, method: 'post' })
