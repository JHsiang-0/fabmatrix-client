import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'
import { createAuthSession, refreshAuthSession } from '../src/utils/authSession.js'
import { resolveRouteAccess, ROUTE_ACCESS } from '../src/utils/permissions.js'

const call = (method, url, data, token) => mockRequest({ method, url, data, headers: token ? { Authorization: `Bearer ${token}` } : {} })
const login = async (username, password) => (await call('POST', '/api/v1/auth/login', { username, password })).data

test('viewer identity restores and can enter read routes while management remains forbidden', () => {
  const session = createAuthSession({ token: 'test', userId: '2', username: 'view', role: 'VIEWER', expiresIn: 60, mustChangePassword: true })
  assert.equal(session.userInfo.mustChangePassword, true)
  assert.equal(refreshAuthSession(session, { id: '2', username: 'view', role: 'VIEWER', mustChangePassword: false }).userInfo.mustChangePassword, false)
  const base = { token: 'test', role: 'VIEWER', restoreState: 'authenticated', requiresAuth: true }
  assert.equal(resolveRouteAccess({ ...base, path: '/printers', roleRequirements: [['ADMIN', 'OPERATOR', 'VIEWER']] }), ROUTE_ACCESS.ALLOW)
  assert.equal(resolveRouteAccess({ ...base, path: '/users', roleRequirements: [['ADMIN']] }), ROUTE_ACCESS.FORBIDDEN)
})

test('reset invalidates old sessions, temporary password is restricted, and changing it unlocks viewer', async () => {
  resetMockState()
  const admin = await login('admin', 'Admin123')
  const old = await login('operator', 'Operator123')
  await call('POST', '/api/v1/auth/admin/users/2/reset-password', { password: 'Temporary1', confirmPassword: 'Temporary1' }, admin.token)
  await assert.rejects(call('GET', '/api/v1/auth/me', null, old.token), error => error.response.status === 401)
  const temporary = await login('operator', 'Temporary1')
  assert.equal(temporary.mustChangePassword, true)
  await assert.rejects(call('GET', '/api/v1/printers/page', null, temporary.token), error => error.response.data.code === 4031)
  await call('POST', '/api/v1/auth/2/change-password', { oldPassword: 'Temporary1', newPassword: 'Employee1', confirmPassword: 'Employee1' }, temporary.token)
  await assert.rejects(call('GET', '/api/v1/auth/me', null, temporary.token), error => error.response.status === 401)
  mockState.users.find(user => user.id === 2).role = 'VIEWER'
  const viewer = await login('operator', 'Employee1')
  assert.equal(viewer.mustChangePassword, false)
  await call('GET', '/api/v1/printers/page', null, viewer.token)
  await assert.rejects(call('POST', '/api/v1/control/1/pause', {}, viewer.token), error => error.response.status === 403)
})

test('single-session revocation preserves another login and blocks other users from revoking it', async () => {
  resetMockState()
  const first = await login('admin', 'Admin123')
  const second = await login('admin', 'Admin123')
  const employee = await login('operator', 'Operator123')
  const sessions = (await call('GET', '/api/v1/auth/sessions', null, first.token)).data
  assert.equal(sessions.length, 2)
  const other = sessions.find(row => !row.current)
  assert.ok(other)
  await assert.rejects(call('POST', `/api/v1/auth/sessions/${other.id}/revoke`, {}, employee.token), error => error.response.status === 404)
  await call('POST', `/api/v1/auth/sessions/${other.id}/revoke`, {}, first.token)
  await call('GET', '/api/v1/auth/me', null, first.token)
  await assert.rejects(call('GET', '/api/v1/auth/me', null, second.token), error => error.response.status === 401)
  assert.ok(mockState.auditLogs.some(row => row.action === 'SESSION_REVOKE'))
})
