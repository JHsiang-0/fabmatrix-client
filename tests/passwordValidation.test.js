import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../src/utils/password.js'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

test('password validation accepts any non-whitespace password in the inclusive 6-20 character range', () => {
  assert.equal(isValidPassword('12345'), false)
  assert.equal(isValidPassword('123456'), true)
  assert.equal(isValidPassword('12345678901234567890'), true)
  assert.equal(isValidPassword('123456789012345678901'), false)
  assert.equal(isValidPassword('abcdef'), true)
  assert.equal(isValidPassword('ABCDEF'), true)
  assert.equal(isValidPassword('      '), false)
  assert.equal(isValidPassword('     a'), true)
  assert.equal(PASSWORD_MIN_LENGTH, 6)
  assert.equal(PASSWORD_MAX_LENGTH, 20)
})

test('Mock login and first-admin setup accept non-whitespace boundary passwords without character-class rules', async () => {
  resetMockState()
  mockState.users[0].password = '123456'

  const sixCharacterLogin = await mockRequest({
    method: 'POST',
    url: '/api/v1/auth/login',
    data: { username: 'admin', password: '123456' }
  })
  assert.equal(typeof sixCharacterLogin.data.token, 'string')

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
      data: { username: 'admin', password: '1'.repeat(5) }
    }),
    error => error.response.status === 400
  )

  await assert.rejects(
    mockRequest({
      method: 'POST',
      url: '/api/v1/auth/login',
      data: { username: 'admin', password: '1'.repeat(21) }
    }),
    error => error.response.status === 400
  )

  await assert.rejects(
    mockRequest({
      method: 'POST',
      url: '/api/v1/auth/login',
      data: { username: 'admin', password: '       ' }
    }),
    error => error.response.status === 400
  )

  resetMockState({ initialized: false })
  const setup = await mockRequest({
    method: 'POST',
    url: '/api/v1/auth/setup/admin',
    data: { username: 'admin', password: 'abcdef', confirmPassword: 'abcdef' }
  })
  assert.equal(setup.data.role, 'ADMIN')
})

test('Mock auth paths use the same non-whitespace length rule and keep confirmation checks', async () => {
  resetMockState()
  const adminHeaders = { Authorization: 'Bearer password-validation-admin' }
  mockState.sessions['password-validation-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }

  await assert.rejects(
    mockRequest({
      method: 'POST',
      url: '/api/v1/auth/register',
      data: { username: 'short-user', password: '12345', confirmPassword: '12345' },
      headers: adminHeaders
    }),
    error => error.response.status === 400
  )

  const created = await mockRequest({
    method: 'POST',
    url: '/api/v1/auth/register',
    data: { username: 'length-user', password: '123456', confirmPassword: '654321' },
    headers: adminHeaders
  }).catch(error => error)
  assert.equal(created.response.status, 400)

  const valid = await mockRequest({
    method: 'POST',
    url: '/api/v1/auth/register',
    data: { username: 'length-user', password: 'abcdef', confirmPassword: 'abcdef' },
    headers: adminHeaders
  })
  const userId = valid.data
  const userToken = 'password-validation-user'
  mockState.sessions[userToken] = { userId, username: 'length-user', role: 'OPERATOR' }

  await assert.rejects(
    mockRequest({
      method: 'POST',
      url: `/api/v1/auth/${userId}/change-password`,
      data: { oldPassword: 'abcdef', newPassword: '12345', confirmPassword: '12345' },
      headers: { Authorization: `Bearer ${userToken}` }
    }),
    error => error.response.status === 400
  )

  await assert.rejects(
    mockRequest({
      method: 'POST',
      url: `/api/v1/auth/${userId}/change-password`,
      data: { oldPassword: 'abcdef', newPassword: '      ', confirmPassword: '      ' },
      headers: { Authorization: `Bearer ${userToken}` }
    }),
    error => error.response.status === 400
  )

  await assert.rejects(
    mockRequest({
      method: 'POST',
      url: `/api/v1/auth/${userId}/change-password`,
      data: { oldPassword: 'abcdef', newPassword: '123456', confirmPassword: '654321' },
      headers: { Authorization: `Bearer ${userToken}` }
    }),
    error => error.response.status === 500
  )

  const changed = await mockRequest({
    method: 'POST',
    url: `/api/v1/auth/${userId}/change-password`,
    data: { oldPassword: 'abcdef', newPassword: '123456', confirmPassword: '123456' },
    headers: { Authorization: `Bearer ${userToken}` }
  })
  assert.equal(changed.data, null)
})
