import test from 'node:test'
import assert from 'node:assert/strict'
import { createRemotePausePolicy, initialRemotePausePolicy } from '../src/utils/cloudRemoteControl.js'

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture(overrides = {}) {
  const state = initialRemotePausePolicy()
  const writes = []
  const controller = createRemotePausePolicy({ state, read: async () => ({ enabled: false, revision: 1 }), write: async value => { writes.push(value); return { ...value, revision: value.revision + 1 } }, current: () => true, scope: () => 'gateway:1', canChange: () => true, confirm: async () => {}, ...overrides })
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
