import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  calculateExpiresAt,
  createAuthSession,
  isSessionExpired,
  normalizeAuthIdentity,
  refreshAuthSession
} from '../src/utils/authSession.js'

const requestSource = fs.readFileSync(new URL('../src/utils/request.js', import.meta.url), 'utf8')
const realtimeStoreSource = fs.readFileSync(new URL('../src/stores/printer/realtimeStore.js', import.meta.url), 'utf8')
const mockSource = fs.readFileSync(new URL('../src/mock/index.js', import.meta.url), 'utf8')

test('normalizes login identity and keeps Long IDs as strings', () => {
  const identity = normalizeAuthIdentity({
    userId: 9007199254740993n,
    username: 'operator',
    role: 'operator'
  })

  assert.deepEqual(identity, {
    userId: '9007199254740993',
    id: '9007199254740993',
    username: 'operator',
    role: 'OPERATOR'
  })
})

test('creates an expiring session from LoginResult expiresIn seconds', () => {
  const session = createAuthSession({
    token: 'token-value',
    expiresIn: 604800,
    userId: 7,
    username: 'admin',
    role: 'ADMIN'
  }, 1_000)

  assert.equal(session.token, 'token-value')
  assert.equal(session.expiresIn, 604800)
  assert.equal(session.expiresAt, 604801000)
  assert.equal(isSessionExpired(session.expiresAt, 604800999), false)
  assert.equal(isSessionExpired(session.expiresAt, 604801000), true)
  assert.equal(calculateExpiresAt('invalid', 1_000), null)
})

test('rejects unknown roles or incomplete login responses', () => {
  assert.equal(normalizeAuthIdentity({ id: 1, username: 'x', role: 'CUSTOMER' }), null)
  assert.equal(createAuthSession({ token: 'token', expiresIn: 60, userId: 1, username: 'x' }), null)
  assert.equal(createAuthSession({ token: 'token', expiresIn: 0, userId: 1, username: 'x', role: 'ADMIN' }), null)
})

test('refreshes the stored session from the trusted /auth/me profile', () => {
  const session = {
    token: 'token-value',
    expiresIn: 60,
    expiresAt: 61_000,
    userInfo: { userId: '1', id: '1', username: 'stale', role: 'OPERATOR' }
  }
  const refreshed = refreshAuthSession(session, {
    id: 1,
    username: 'admin',
    role: 'ADMIN',
    email: 'admin@farm.local'
  })

  assert.equal(refreshed.userInfo.username, 'admin')
  assert.equal(refreshed.userInfo.role, 'ADMIN')
  assert.equal(refreshed.userInfo.email, 'admin@farm.local')
  assert.equal(refreshed.token, 'token-value')
  assert.equal(refreshAuthSession(session, { id: 1, username: 'x', role: 'CUSTOMER' }), null)
})

test('clears the local session when the WebSocket reports policy invalidation', () => {
  assert.match(realtimeStoreSource, /Number\(event\?\.code\) === 1008/)
  assert.match(realtimeStoreSource, /userStore\.logout\(\)/)
  assert.match(realtimeStoreSource, /router\.push\(\{ name: 'login' \}\)/)
  assert.ok(requestSource.indexOf('userStore.logout()') < requestSource.indexOf("router.push({ name: 'login' })"))
})

test('Mock auth checks the current role and session version before route permissions', () => {
  const sessionBranch = mockSource.slice(mockSource.indexOf('const requireSession'), mockSource.indexOf('const getPath'))
  assert.ok(sessionBranch.indexOf('session.role !== user.role') < sessionBranch.indexOf('roles.length > 0'))
  assert.match(sessionBranch, /tokenVersion/)
  assert.match(mockSource, /user\.tokenVersion = Number\(user\.tokenVersion \|\| 0\) \+ 1/)
})
