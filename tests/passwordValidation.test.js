import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../src/utils/password.js'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

test('password validation accepts only the inclusive 7-20 character length range', () => {
  assert.equal(isValidPassword('123456'), false)
  assert.equal(isValidPassword('1234567'), true)
  assert.equal(isValidPassword('12345678901234567890'), true)
  assert.equal(isValidPassword('123456789012345678901'), false)
  assert.equal(isValidPassword('abcdefg'), true)
  assert.equal(isValidPassword('ABCDEFG'), true)
  assert.equal(PASSWORD_MIN_LENGTH, 7)
  assert.equal(PASSWORD_MAX_LENGTH, 20)
})

test('Mock login and first-admin setup accept length-only boundary passwords', async () => {
  resetMockState()
  mockState.users[0].password = '1234567'

  const sevenCharacterLogin = await mockRequest({
    method: 'POST',
    url: '/api/v1/auth/login',
    data: { username: 'admin', password: '1234567' }
  })
  assert.equal(typeof sevenCharacterLogin.data.token, 'string')

  mockState.users[0].password = '1'.repeat(20)
  const twentyCharacterLogin = await mockRequest({
    method: 'POST',
    url: '/api/v1/auth/login',
    data: { username: 'admin', password: '1'.repeat(20) }
  })
  assert.equal(typeof twentyCharacterLogin.data.token, 'string')

  await assert.rejects(
    mockRequest({
      method: 'POST',
      url: '/api/v1/auth/login',
      data: { username: 'admin', password: '1'.repeat(21) }
    }),
    error => error.response.status === 400
  )

  resetMockState({ initialized: false })
  const setup = await mockRequest({
    method: 'POST',
    url: '/api/v1/auth/setup/admin',
    data: { username: 'admin', password: 'abcdefg', confirmPassword: 'abcdefg' }
  })
  assert.equal(setup.data.role, 'ADMIN')
})

test('Mock auth paths use the same length-only rule and keep confirmation checks', async () => {
  resetMockState()
  const adminHeaders = { Authorization: 'Bearer password-validation-admin' }
  mockState.sessions['password-validation-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }

  await assert.rejects(
    mockRequest({
      method: 'POST',
      url: '/api/v1/auth/register',
      data: { username: 'short-user', password: '123456', confirmPassword: '123456' },
      headers: adminHeaders
    }),
    error => error.response.status === 400
  )

  const created = await mockRequest({
    method: 'POST',
    url: '/api/v1/auth/register',
    data: { username: 'length-user', password: '1234567', confirmPassword: '7654321' },
    headers: adminHeaders
  }).catch(error => error)
  assert.equal(created.response.status, 400)

  const valid = await mockRequest({
    method: 'POST',
    url: '/api/v1/auth/register',
    data: { username: 'length-user', password: '1234567', confirmPassword: '1234567' },
    headers: adminHeaders
  })
  const userId = valid.data
  const userToken = 'password-validation-user'
  mockState.sessions[userToken] = { userId, username: 'length-user', role: 'OPERATOR' }

  await assert.rejects(
    mockRequest({
      method: 'POST',
      url: `/api/v1/auth/${userId}/change-password`,
      data: { oldPassword: '1234567', newPassword: '123456', confirmPassword: '123456' },
      headers: { Authorization: `Bearer ${userToken}` }
    }),
    error => error.response.status === 422
  )

  const changed = await mockRequest({
    method: 'POST',
    url: `/api/v1/auth/${userId}/change-password`,
    data: { oldPassword: '1234567', newPassword: 'abcdefg', confirmPassword: 'abcdefg' },
    headers: { Authorization: `Bearer ${userToken}` }
  })
  assert.equal(changed.data, null)
})
