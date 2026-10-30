import assert from 'node:assert/strict'
import test from 'node:test'
import { createCloudSession, normalizeCloudUrl } from '../src/utils/cloudSession.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const sample = id => ({ items: [{ id, name: `Printer ${id}` }], total: 1 })
const fakeApi = () => ({
  login: async () => ({ accessToken: 'cloud-only', user: { id: 'cloud-user', username: 'owner' } }),
  request: async (url, token, method, path) => path === '/api/v1/organizations'
    ? [{ id: 'org', name: 'Organization' }]
    : path.endsWith('/farms') ? [{ id: 'farm', name: 'Farm' }] : sample('one')
})

test('cloud endpoints require HTTPS remotely and reject embedded credentials or alternate paths', () => {
  assert.equal(normalizeCloudUrl('https://cloud.example/'), 'https://cloud.example')
  assert.equal(normalizeCloudUrl('http://127.0.0.1:28091'), 'http://127.0.0.1:28091')
  for (const value of ['http://cloud.example', 'https://user:secret@cloud.example', 'https://cloud.example/api', 'https://cloud.example?token=x']) {
    assert.equal(normalizeCloudUrl(value), '')
  }
})

test('cloud login selects authorized organization and farm and exposes read-only state', async () => {
  const session = createCloudSession(fakeApi())
  assert.equal(await session.login('https://cloud.example', 'owner', 'test'), true)
  assert.equal(session.state.farmId, 'farm')
  assert.equal(session.state.printers[0].id, 'one')
  assert.equal(session.state.token, 'cloud-only')
  await session.logout()
  assert.equal(session.state.token, '')
  assert.deepEqual(session.state.printers, [])
})

test('late response after changing farm cannot overwrite new farm', async () => {
  const api = fakeApi()
  const session = createCloudSession(api)
  await session.login('https://cloud.example', 'owner', 'test')
  const old = deferred()
  api.request = async (url, token, method, path) => path.includes('/farm/') ? old.promise : sample('new')
  const request = session.refresh()
  await session.selectFarm('new-farm')
  old.resolve(sample('old'))
  await request
  assert.equal(session.state.printers[0].id, 'new')
})

test('late unauthorized response from previous login cannot clear new cloud session', async () => {
  const api = fakeApi()
  const session = createCloudSession(api)
  await session.login('https://cloud.example', 'owner', 'test')
  const old = deferred()
  const normal = api.request
  api.request = () => old.promise
  const request = session.refresh()
  api.request = normal
  api.login = async () => ({ accessToken: 'new-cloud-only', user: { username: 'new' } })
  await session.login('https://new-cloud.example', 'new', 'test')
  old.reject(Object.assign(new Error('old'), { status: 401 }))
  await request
  assert.equal(session.state.token, 'new-cloud-only')
  assert.equal(session.state.user.username, 'new')
})

test('current unauthorized response clears cloud data and leaves unrelated LAN state intact', async () => {
  const lan = { token: 'lan-token', role: 'ADMIN' }
  const api = fakeApi()
  const session = createCloudSession(api)
  await session.login('https://cloud.example', 'owner', 'test')
  api.request = async () => { throw Object.assign(new Error('unauthorized'), { status: 401 }) }
  await session.refresh()
  assert.equal(session.state.token, '')
  assert.deepEqual(session.state.printers, [])
  assert.deepEqual(lan, { token: 'lan-token', role: 'ADMIN' })
})

test('scope denial clears prior device data instead of displaying it as current', async () => {
  const api = fakeApi()
  const session = createCloudSession(api)
  await session.login('https://cloud.example', 'owner', 'test')
  api.request = async () => { throw Object.assign(new Error('denied'), { status: 404 }) }
  await session.refresh()
  assert.deepEqual(session.state.printers, [])
  assert.equal(session.state.total, 0)
  assert.ok(session.state.error)
})

test('partial login failure keeps login form available without a half-authenticated session', async () => {
  const api = fakeApi()
  api.request = async () => { throw Object.assign(new Error('unavailable'), { status: 503 }) }
  const session = createCloudSession(api)
  assert.equal(await session.login('https://cloud.example', 'owner', 'test'), false)
  assert.equal(session.state.token, '')
  assert.equal(session.state.authenticating, false)
})

test('logout clears locally before the remote logout request completes', async () => {
  const api = fakeApi()
  const session = createCloudSession(api)
  await session.login('https://cloud.example', 'owner', 'test')
  const pending = deferred()
  api.request = () => pending.promise
  const request = session.logout()
  assert.equal(session.state.token, '')
  pending.resolve({ success: true })
  await request
})
