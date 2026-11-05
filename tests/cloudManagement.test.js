import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCloudManagement,
  createManagementState,
  cloudManagementError,
} from '../src/utils/cloudManagement.js'
import { createCloudSession } from '../src/utils/cloudSession.js'

const sessionState = () => ({
  apiUrl: 'https://cloud.example',
  token: 'synthetic-session',
  user: { id: 'owner' },
  organizationId: 'org',
  farmId: 'farm',
  organizations: [{ id: 'org', role: 'OWNER' }],
})
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('overview preserves server-wide totals and encodes resource paths', async () => {
  const session = sessionState()
  session.farmId = 'farm / encoded'
  const calls = []
  const api = {
    request: async (...args) => {
      calls.push(args)
      return { name: 'Farm', summary: { totalDevices: 125 } }
    },
  }
  const vm = createCloudManagement(api, session)
  assert.equal(await vm.load(), true)
  assert.equal(vm.state.detail.summary.totalDevices, 125)
  assert.equal(calls[0][3], '/api/v1/farms/farm%20%2F%20encoded/overview')
  assert.equal(calls[0][1], 'synthetic-session')
})

test('canceling a page prevents a late overview from overwriting another section', async () => {
  const pending = deferred(),
    session = sessionState()
  const vm = createCloudManagement(
    {
      request: async (url, token, method, path) =>
        path.endsWith('overview') ? pending.promise : [],
    },
    session,
  )
  const first = vm.load()
  vm.cancel()
  await vm.load('members')
  pending.resolve({ name: 'Old overview' })
  assert.equal(await first, false)
  assert.equal(vm.state.detail, null)
  assert.deepEqual(vm.state.rows, [])
})

test('late binding tickets are discarded after scope change and errors clear private data', async () => {
  const pending = deferred(),
    session = sessionState(),
    state = createManagementState()
  const api = { request: () => pending.promise }
  const vm = createCloudManagement(api, session, state)
  const first = vm.mutate('post', '/api/v1/farms/farm/gateways', { name: 'test' }, { ticket: true })
  session.farmId = 'other'
  vm.cancel()
  pending.resolve({ bindingToken: 'synthetic-once-only' })
  assert.equal(await first, false)
  assert.equal(state.ticket, null)
  state.rows = [{ username: 'private' }]
  state.detail = { name: 'private' }
  api.request = async () => {
    throw { status: 409, code: 'FARM_NOT_EMPTY' }
  }
  assert.equal(await vm.mutate('delete', '/farm'), false)
  assert.match(state.error, /网关或成员授权/)
  assert.deepEqual(state.rows, [])
  assert.equal(state.detail, null)
  assert.equal(cloudManagementError({ message: 'secret-token' }).includes('secret-token'), false)
})

test('401 invalidates cloud management while scope refresh preserves valid selection', async () => {
  let invalidated = false
  const vm = createCloudManagement(
    {
      request: async () => {
        throw { status: 401 }
      },
    },
    sessionState(),
    createManagementState(),
    () => {
      invalidated = true
    },
  )
  await vm.load()
  assert.equal(invalidated, true)
  const state = { ...sessionState(), farms: [] }
  const api = {
    request: async (url, token, method, path) =>
      path === '/api/v1/organizations'
        ? [{ id: 'org', name: 'Renamed', role: 'VIEWER' }]
        : [{ id: 'farm', name: 'Renamed farm' }],
  }
  const session = createCloudSession(api, state)
  assert.equal(await session.refreshScopes(), true)
  assert.equal(state.organizations[0].role, 'VIEWER')
  assert.equal(state.farmId, 'farm')
  api.request = async (url, token, method, path) =>
    path === '/api/v1/organizations' ? state.organizations : []
  await session.refreshScopes()
  assert.equal(state.farmId, '')
  assert.deepEqual(state.printers, [])
})

test('temporary password login restricts organization requests until password is changed', async () => {
  const calls = []
  const api = {
    login: async () => ({ accessToken: 'synthetic-temp', user: { mustChangePassword: true } }),
    request: async (...args) => {
      calls.push(args)
      return { success: true }
    },
  }
  const session = createCloudSession(api)
  assert.equal(await session.login('https://cloud.example', 'new-member', 'temporary'), true)
  assert.equal(calls.length, 0)
  assert.equal(await session.changeRequiredPassword('temporary', 'replacement'), true)
  assert.equal(calls[0][3], '/api/v1/auth/password')
  assert.equal(session.state.token, '')
})
