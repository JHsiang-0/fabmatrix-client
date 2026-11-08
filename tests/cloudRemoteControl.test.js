import test from 'node:test'
import assert from 'node:assert/strict'
import { createRemoteControlPolicy, initialRemoteControlPolicy, REMOTE_CONTROL_ACTION_LABELS } from '../src/utils/cloudRemoteControl.js'

const actions = Object.keys(REMOTE_CONTROL_ACTION_LABELS)
const initial = () => ({ remoteEnabled: false, unifiedControlSupported: true, authorizationVersion: 1,
  requiresReauthorization: false, supportedActions: [...actions], revision: 1 })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture({ initialPolicy = initial(), ...overrides } = {}) {
  const state = initialRemoteControlPolicy()
  const writes = []
  let saved = { ...initialPolicy }
  const controller = createRemoteControlPolicy({ state, read: async () => ({ ...saved }),
    write: async value => { writes.push(value); saved = { ...saved, ...value, requiresReauthorization: false, revision: value.revision + 1 }; return { ...saved } },
    current: () => true, scope: () => 'gateway:1', canChange: () => true, confirm: async () => {}, ...overrides })
  return { state, writes, ...controller }
}

test('one catalog authorization writes only the master, consent version and checked revision', async () => {
  const f = fixture(); await f.load(); assert.equal(f.state.policy.remoteEnabled, false)
  await f.change(true)
  assert.deepEqual(f.writes, [{ remoteEnabled: true, authorizationVersion: 1, revision: 1 }])
  assert.equal(f.state.policy.remoteEnabled, true); assert.equal(f.state.policy.revision, 2)
  assert.deepEqual(f.state.policy.supportedActions, actions)
})

test('cancel and readonly authority never write', async () => {
  const f = fixture({ confirm: async () => { throw 'cancel' } }); await f.load(); await f.change(true)
  assert.equal(f.writes.length, 0)
  const viewer = fixture({ canChange: () => false }); await viewer.load(); await viewer.change(true)
  assert.equal(viewer.writes.length, 0)
})

test('disable is immediate; pending confirmation cannot submit twice or toggle another setting', async () => {
  let confirms = 0; const wait = deferred()
  const f = fixture({ confirm: () => { confirms++; return wait.promise } }); await f.load()
  await f.change(false); assert.equal(confirms, 0)
  const pending = f.change(true); await f.change(true); await f.change(false); wait.resolve(); await pending
  assert.equal(confirms, 1); assert.equal(f.writes.length, 2)
  assert.equal(f.state.policy.remoteEnabled, true)
})

test('confirmation describes the exact catalog, cancellation and independence from reporting', async () => {
  const f = fixture({ confirm: async (body, title) => {
    assert.equal(title, '允许远程控制')
    for (const label of Object.values(REMOTE_CONTROL_ACTION_LABELS)) assert.ok(body.includes(label))
    assert.match(body, /取消打印不可恢复/); assert.match(body, /不影响数据上报/)
  } }); await f.load(); await f.change(true)
  assert.equal(f.writes.length, 1)
})

test('legacy pause and temperature flags never grant the new master', async () => {
  for (const old of [{ enabled: true, revision: 1 }, { enabled: true, temperatureEnabled: true, temperatureSupported: true, revision: 1 }]) {
    const f = fixture({ initialPolicy: old }); await f.load(); await f.change(true)
    assert.equal(f.state.policy.remoteEnabled, false); assert.equal(f.state.supported, false)
    assert.equal(f.writes.length, 0); assert.match(f.state.error, /升级/)
  }
  const f = fixture({ initialPolicy: { ...initial(), enabled: true, temperatureEnabled: true } }); await f.load()
  assert.equal(f.state.policy.remoteEnabled, false)
})

test('legacy configuration requires explicit new consent before enabling all controls', async () => {
  const f = fixture({ initialPolicy: { ...initial(), requiresReauthorization: true } }); await f.load()
  assert.equal(f.state.policy.remoteEnabled, false); await f.change(true)
  assert.equal(f.state.policy.remoteEnabled, true); assert.equal(f.state.policy.requiresReauthorization, false)
})

test('CAS conflict refreshes without repeating an authorization write', async () => {
  let reads = 0; let writes = 0
  const f = fixture({ read: async () => ({ ...initial(), revision: ++reads }), write: async () => { writes++; throw { status: 409 } } })
  await f.load(); await f.change(true)
  assert.equal(writes, 1); assert.equal(f.state.policy.revision, 2); assert.match(f.state.error, /重新确认/)
  assert.equal(f.state.busy, false)
})

test('old endpoint and malformed consent fail closed', async () => {
  const old = fixture({ read: async () => { throw { status: 404 } } }); await old.load(); await old.change(true)
  assert.equal(old.state.supported, false); assert.match(old.state.error, /升级/); assert.equal(old.writes.length, 0)
  for (const changes of [{ remoteEnabled: 'false' }, { authorizationVersion: 2 }, { revision: -1 }, { revision: 0 },
    { supportedActions: ['GCODE'] }, { supportedActions: [] }, { supportedActions: ['PAUSE', 'PAUSE'] },
    { requiresReauthorization: 'false' }, { remoteEnabled: true, requiresReauthorization: true }]) {
    const bad = fixture({ initialPolicy: { ...initial(), ...changes } }); await bad.load(); await bad.change(true)
    assert.equal(bad.state.policy, null); assert.equal(bad.writes.length, 0)
  }
})

test('session and binding changes invalidate pending confirmation and late responses', async () => {
  const wait = deferred(); let scope = 'first'
  const f = fixture({ scope: () => scope, confirm: () => wait.promise }); await f.load()
  const pending = f.change(true); scope = 'second'; wait.resolve(); await pending
  assert.equal(f.writes.length, 0)
  const response = deferred(); let active = true
  const late = fixture({ current: () => active, write: () => response.promise }); await late.load()
  const changing = late.change(false); active = false; late.clear(); response.resolve({ ...initial(), remoteEnabled: true, revision: 2 }); await changing
  assert.equal(late.state.policy, null)
})

test('lost write result never assumes success or silently retries', async () => {
  let attempts = 0
  const f = fixture({ write: async () => { attempts++; throw new Error('timeout') } }); await f.load(); await f.change(true)
  assert.equal(attempts, 1); assert.equal(f.state.policy, null); assert.match(f.state.error, /刷新/)
})

test('unapplied, legacy, stale or newly expanded write responses cannot report a grant', async () => {
  for (const response of [{ enabled: true, revision: 2 }, { ...initial(), revision: 2 },
    { ...initial(), remoteEnabled: true }, { ...initial(), remoteEnabled: true, revision: 2, authorizationVersion: 2 }]) {
    let successes = 0
    const f = fixture({ write: async () => response, onSuccess: () => { successes++ } }); await f.load(); await f.change(true)
    assert.equal(successes, 0); assert.equal(f.state.policy, null); assert.match(f.state.error, /刷新/)
  }
  let successes = 0
  const f = fixture({ initialPolicy: { ...initial(), supportedActions: ['PAUSE'] },
    write: async () => ({ ...initial(), remoteEnabled: true, revision: 2 }), onSuccess: () => { successes++ } })
  await f.load(); await f.change(true); assert.equal(successes, 0)
})

test('clearing an old pending request does not release the new operation busy state', async () => {
  const old = deferred(); const next = deferred(); let calls = 0
  const f = fixture({ write: () => (++calls === 1 ? old.promise : next.promise) }); await f.load()
  const first = f.change(false); f.clear(); await f.load(); const second = f.change(true)
  old.resolve({ ...initial(), revision: 2 }); await first
  assert.equal(f.state.busy, true)
  next.resolve({ ...initial(), remoteEnabled: true, revision: 2 }); await second
  assert.equal(f.state.busy, false); assert.equal(f.state.policy.remoteEnabled, true)
})
