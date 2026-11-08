import test from 'node:test'
import assert from 'node:assert/strict'
import { createRemotePausePolicy, initialRemotePausePolicy } from '../src/utils/cloudRemoteControl.js'

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture({ initialPolicy = { enabled: false, revision: 1 }, ...overrides } = {}) {
  const state = initialRemotePausePolicy()
  const writes = []
  let saved = { ...initialPolicy }
  const controller = createRemotePausePolicy({ state, read: async () => ({ ...saved }), write: async value => { writes.push(value); saved = { ...saved, ...value, revision: value.revision + 1 }; return { ...saved } }, current: () => true, scope: () => 'gateway:1', canChange: () => true, confirm: async () => {}, ...overrides })
  return { state, writes, ...controller }
}

test('local authorization is loaded independently and enable sends the checked revision', async () => {
  const f = fixture(); await f.load(); assert.equal(f.state.policy.enabled, false)
  await f.change(true)
  assert.deepEqual(f.writes, [{ enabled: true, revision: 1 }])
  assert.deepEqual(f.state.policy, { enabled: true, revision: 2 })
})
test('cancel and readonly authority never write', async () => {
  const f = fixture({ confirm: async () => { throw 'cancel' } }); await f.load(); await f.change(true)
  assert.equal(f.writes.length, 0)
  const viewer = fixture({ canChange: () => false }); await viewer.load(); await viewer.change(true)
  assert.equal(viewer.writes.length, 0)
})
test('disable is immediate without confirmation, double enable cannot submit twice', async () => {
  let confirms = 0
  const wait = deferred()
  const f = fixture({ confirm: () => { confirms++; return wait.promise } }); await f.load()
  await f.change(false); assert.equal(confirms, 0)
  const pending = f.change(true); await f.change(true); wait.resolve(); await pending
  assert.equal(confirms, 1); assert.equal(f.writes.length, 2)
})
test('CAS conflict refreshes authoritative state without automatically repeating the write', async () => {
  let reads = 0; let writes = 0
  const f = fixture({ read: async () => ({ enabled: false, revision: ++reads }), write: async () => { writes++; throw { status: 409 } } })
  await f.load(); await f.change(true)
  assert.equal(writes, 1); assert.equal(f.state.policy.revision, 2); assert.match(f.state.error, /重新确认/)
})
test('old server and malformed policy fail closed', async () => {
  const old = fixture({ read: async () => { throw { status: 404 } } }); await old.load(); await old.change(true)
  assert.equal(old.state.supported, false); assert.match(old.state.error, /升级/); assert.equal(old.writes.length, 0)
  const bad = fixture({ read: async () => ({ enabled: 'false', revision: -1 }) }); await bad.load()
  assert.equal(bad.state.policy, null)
})
test('session or binding changes invalidate pending confirmation and late responses', async () => {
  const wait = deferred(); let scope = 'first'
  const f = fixture({ scope: () => scope, confirm: () => wait.promise }); await f.load()
  const pending = f.change(true); scope = 'second'; wait.resolve(); await pending
  assert.equal(f.writes.length, 0)
  const response = deferred(); let active = true
  const late = fixture({ current: () => active, write: () => response.promise }); await late.load()
  const changing = late.change(false); active = false; late.clear(); response.resolve({ enabled: true, revision: 3 }); await changing
  assert.equal(late.state.policy, null)
})
test('lost write result never assumes success or silently retries', async () => {
  let attempts = 0
  const f = fixture({ write: async () => { attempts++; throw new Error('timeout') } }); await f.load(); await f.change(true)
  assert.equal(attempts, 1); assert.equal(f.state.policy, null); assert.match(f.state.error, /刷新/)
})

const temperaturePolicy = { enabled: false, temperatureEnabled: false, temperatureSupported: true, revision: 1 }
test('temperature permission is separate and omitted fields preserve the other permission', async () => {
  const f = fixture({ initialPolicy: temperaturePolicy }); await f.load()
  await f.changeTemperature(true)
  assert.deepEqual(f.writes[0], { temperatureEnabled: true, revision: 1 })
  assert.equal(f.state.policy.enabled, false); assert.equal(f.state.policy.temperatureEnabled, true)
  await f.change(true)
  assert.deepEqual(f.writes[1], { enabled: true, revision: 2 })
  assert.equal(f.state.policy.temperatureEnabled, true)
  await f.changeTemperature(false)
  assert.deepEqual(f.writes[2], { temperatureEnabled: false, revision: 3 })
  assert.equal(f.state.policy.enabled, true); assert.equal(f.state.policy.temperatureEnabled, false)
})
test('legacy or malformed temperature capability never grants temperature permission', async () => {
  const old = fixture(); await old.load(); await old.changeTemperature(true)
  assert.equal(old.writes.length, 0); assert.equal(old.state.policy.temperatureEnabled, undefined)
  for (const invalid of [
    { ...temperaturePolicy, temperatureEnabled: 'true' },
    { ...temperaturePolicy, temperatureSupported: false, temperatureEnabled: true },
    { ...temperaturePolicy, temperatureSupported: 1 }
  ]) {
    const bad = fixture({ initialPolicy: invalid }); await bad.load(); await bad.changeTemperature(true)
    assert.equal(bad.state.policy, null); assert.equal(bad.writes.length, 0)
  }
})
test('temperature enable confirmation can cancel and concurrent changes cannot bypass it', async () => {
  const wait = deferred(); let confirms = 0
  const f = fixture({ initialPolicy: temperaturePolicy, confirm: async (message, title) => { confirms++; assert.match(title, /温度/); assert.match(message, /0°C/); return wait.promise } })
  await f.load(); const pending = f.changeTemperature(true)
  await f.change(true); await f.changeTemperature(true)
  wait.resolve(); await pending
  assert.equal(confirms, 1); assert.equal(f.writes.length, 1); assert.equal(f.state.policy.enabled, false)
  const canceled = fixture({ initialPolicy: temperaturePolicy, confirm: async () => { throw 'cancel' } })
  await canceled.load(); await canceled.changeTemperature(true)
  assert.equal(canceled.writes.length, 0); assert.equal(canceled.state.policy.temperatureEnabled, false)
})
test('temperature readonly, binding changes and CAS conflicts never replay authorization', async () => {
  const readonly = fixture({ initialPolicy: temperaturePolicy, canChange: () => false })
  await readonly.load(); await readonly.changeTemperature(true); assert.equal(readonly.writes.length, 0)
  let scope = 'first'; const wait = deferred()
  const rebound = fixture({ initialPolicy: temperaturePolicy, scope: () => scope, confirm: () => wait.promise })
  await rebound.load(); const pending = rebound.changeTemperature(true); scope = 'second'; wait.resolve(); await pending
  assert.equal(rebound.writes.length, 0)
  let reads = 0; let attempts = 0
  const conflict = fixture({ read: async () => ({ ...temperaturePolicy, revision: ++reads }), write: async () => { attempts++; throw { status: 409 } } })
  await conflict.load(); await conflict.changeTemperature(true)
  assert.equal(attempts, 1); assert.equal(conflict.state.policy.revision, 2); assert.match(conflict.state.error, /重新确认/)
})
test('temperature lost write response and account exit remain fail closed', async () => {
  let attempts = 0
  const lost = fixture({ initialPolicy: temperaturePolicy, write: async () => { attempts++; throw new Error('timeout') } })
  await lost.load(); await lost.changeTemperature(true)
  assert.equal(attempts, 1); assert.equal(lost.state.policy, null)
  let active = true; const wait = deferred()
  const late = fixture({ initialPolicy: temperaturePolicy, current: () => active, write: () => wait.promise })
  await late.load(); const pending = late.changeTemperature(true); active = false; late.clear()
  wait.resolve({ ...temperaturePolicy, temperatureEnabled: true, revision: 2 }); await pending
  assert.equal(late.state.policy, null)
})
