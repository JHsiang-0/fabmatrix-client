import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { isSetupConflict, resolveSetupStatus, SETUP_MODE } from '../src/utils/setupStatus.js'

const userApiSource = await readFile(new URL('../src/api/user.js', import.meta.url), 'utf8')

test('setupAvailable=true locks the first-admin setup mode', () => {
  assert.deepEqual(resolveSetupStatus({
    data: { initialized: false, setupAvailable: true }
  }), {
    mode: SETUP_MODE.SETUP,
    statusError: false
  })
})

test('setupAvailable=false keeps normal login available', () => {
  assert.deepEqual(resolveSetupStatus({
    data: { initialized: true, setupAvailable: false }
  }), {
    mode: SETUP_MODE.LOGIN,
    statusError: false
  })
})

test('a failed setup status check fails open to normal login', () => {
  assert.deepEqual(resolveSetupStatus({ failed: true }), {
    mode: SETUP_MODE.LOGIN,
    statusError: true
  })
})

test('setup conflicts are detected for normalized HTTP or business errors', () => {
  assert.equal(isSetupConflict({ status: 409 }), true)
  assert.equal(isSetupConflict({ code: 409 }), true)
  assert.equal(isSetupConflict({ response: { status: 409 } }), true)
  assert.equal(isSetupConflict({ status: 400, code: 400 }), false)
})

test('首次管理员初始化通过本机 bootstrap 契约获取一次性凭据', () => {
  assert.match(userApiSource, /getFirstAdminBootstrapToken/)
  assert.match(userApiSource, /\/api\/v1\/auth\/setup\/bootstrap-token/)
})
