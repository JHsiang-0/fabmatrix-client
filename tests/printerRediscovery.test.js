import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'
import { createPrinterRediscoverySession, getRediscoveryItemStatus, normalizeRediscoveryResult } from '../src/utils/printerRediscovery.js'

const result = (status, fields = {}) => ({
  scanId: 'sync-1', status, message: '', subnets: ['192.168.1.0/24'],
  scannedAddressCount: 0, updatedCount: 0, unchangedCount: 0, unresolvedCount: 0, items: [], ...fields
})
const response = status => Promise.resolve({ data: result(status) })
const deferred = () => {
  let resolve
  const promise = new Promise(complete => { resolve = complete })
  return { promise, resolve }
}
const harness = (overrides = {}) => {
  const updates = []
  const completions = []
  const errors = []
  const pending = []
  const scheduled = new Map()
  let sequence = 0
  const session = createPrinterRediscoverySession({
    start: () => response('RUNNING'), getStatus: () => response('COMPLETED'), canManage: () => true,
    onUpdate: value => updates.push(value), onComplete: value => completions.push(value),
    onError: error => errors.push(error), onPending: value => pending.push(value),
    schedule: (callback, delay) => {
      assert.equal(delay, 2000)
      scheduled.set(++sequence, callback)
      return sequence
    },
    cancel: id => scheduled.delete(id), ...overrides
  })
  const poll = async () => {
    const [id, callback] = scheduled.entries().next().value
    scheduled.delete(id)
    callback()
    await new Promise(resolve => setImmediate(resolve))
  }
  return { session, updates, completions, errors, pending, scheduled, poll }
}

test('同步结果保留Long字符串ID、各项公开结果，不携带内部凭据', () => {
  const normalized = normalizeRediscoveryResult(result('COMPLETED', {
    scanId: 7, updatedCount: '2', apiKey: 'private',
    items: [{ printerId: '9007199254740993', printerName: '设备A', status: 'CONFLICT', apiKey: 'private', macAddress: 'private' }]
  }))
  assert.equal(normalized.scanId, '7')
  assert.equal(normalized.updatedCount, 2)
  assert.equal(normalized.items[0].printerId, '9007199254740993')
  assert.equal('apiKey' in normalized, false)
  assert.equal('apiKey' in normalized.items[0], false)
  assert.equal('macAddress' in normalized.items[0], false)
  assert.equal(getRediscoveryItemStatus('CONFLICT').theme, 'danger')
  assert.equal(getRediscoveryItemStatus('UNRECOGNIZED').label, '待核对')
  assert.throws(() => normalizeRediscoveryResult(null), /结果无效/)
})

test('同步启动和查询均拒绝操作员，管理员GET无写入，重复POST复用进行中任务', async () => {
  resetMockState()
  mockState.sessions.admin = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.sessions.operator = { userId: 2, username: 'operator', role: 'OPERATOR' }
  const request = (method, role) => mockRequest({ method, url: '/api/v1/printers/rediscover', headers: { Authorization: `Bearer ${role}` } })
  try {
    for (const method of ['GET', 'POST']) await assert.rejects(request(method, 'operator'), error => error.response.status === 403)
    assert.equal((await request('GET', 'admin')).data.status, 'IDLE')
    const printersBefore = JSON.stringify(mockState.printers)
    const first = (await request('POST', 'admin')).data
    const repeated = (await request('POST', 'admin')).data
    assert.equal(first.status, 'RUNNING')
    assert.equal(repeated.scanId, first.scanId)
    assert.equal(JSON.stringify(mockState.printers), printersBefore)
    const count = mockState.printers.length
    const identity = mockState.printers.map(({ id, name, machineNumber, currentJobId, gridRow, gridCol }) => ({ id, name, machineNumber, currentJobId, gridRow, gridCol }))
    mockState.printerRediscoveryStartedAt = Date.now() - 2000
    const completed = (await request('GET', 'admin')).data
    assert.equal(completed.status, 'COMPLETED')
    assert.equal(completed.updatedCount, 1)
    assert.equal(mockState.printers.length, count)
    assert.deepEqual(mockState.printers.map(({ id, name, machineNumber, currentJobId, gridRow, gridCol }) => ({ id, name, machineNumber, currentJobId, gridRow, gridCol })), identity)
    assert.deepEqual((await request('GET', 'admin')).data, completed)
  } finally { resetMockState() }
})

test('进行中2秒串行轮询，完成后通知列表刷新且停止轮询', async () => {
  const context = harness()
  await context.session.start()
  await context.session.start()
  assert.equal(context.updates.length, 1)
  assert.equal(context.scheduled.size, 1)
  await context.poll()
  assert.deepEqual(context.updates.map(item => item.status), ['RUNNING', 'COMPLETED'])
  assert.equal(context.completions.length, 1)
  assert.equal(context.scheduled.size, 0)
  assert.deepEqual(context.pending, [true, false, true, false])
})

test('重新进入页面恢复已有RUNNING，完成后刷新，初次查看历史COMPLETED不重复通知', async () => {
  let calls = 0
  const context = harness({ getStatus: () => response(++calls === 1 ? 'RUNNING' : 'COMPLETED') })
  await context.session.resume()
  assert.equal(context.scheduled.size, 1)
  await context.poll()
  assert.equal(context.completions.length, 1)
  await context.session.resume()
  assert.equal(context.completions.length, 1)
  const completed = harness()
  await completed.session.resume()
  assert.equal(completed.completions.length, 0)
})

test('权限失效和卸载取消轮询，不产生后续查询', async () => {
  let permitted = false
  let calls = 0
  const context = harness({ canManage: () => permitted, start: () => { calls++; return response('RUNNING') } })
  await context.session.start()
  assert.equal(calls, 0)
  permitted = true
  await context.session.start()
  context.session.dispose()
  assert.equal(context.scheduled.size, 0)
  await context.session.resume()
  assert.equal(context.updates.length, 1)
})

test('在途响应于卸载后不更新界面，重复点击只发一次启动请求', async () => {
  const pending = deferred()
  let calls = 0
  const context = harness({ start: () => { calls++; return pending.promise } })
  const first = context.session.start()
  await context.session.start()
  assert.equal(calls, 1)
  context.session.dispose()
  pending.resolve({ data: result('RUNNING') })
  await first
  assert.equal(context.updates.length, 0)
  assert.equal(context.scheduled.size, 0)
})

test('查询在途时角色失去管理权限，响应不再写入结果或继续轮询', async () => {
  const pending = deferred()
  let permitted = true
  const context = harness({ canManage: () => permitted, getStatus: () => pending.promise })
  const query = context.session.resume()
  permitted = false
  pending.resolve({ data: result('RUNNING') })
  await query
  assert.equal(context.updates.length, 0)
  assert.equal(context.scheduled.size, 0)
  context.session.dispose()
})

test('服务端FAILED停止轮询且可再次启动，网络错误保留结果并支持重新查询', async () => {
  let calls = 0
  const failed = harness({ getStatus: () => response('FAILED') })
  await failed.session.start()
  await failed.poll()
  assert.equal(failed.updates.at(-1).status, 'FAILED')
  assert.equal(failed.scheduled.size, 0)
  assert.equal(failed.completions.length, 0)
  await failed.session.start()
  assert.equal(failed.updates.at(-1).status, 'RUNNING')
  failed.session.dispose()
  const network = harness({ getStatus: () => ++calls === 1 ? Promise.reject(new Error('网络中断')) : response('COMPLETED') })
  await network.session.start()
  await network.poll()
  assert.equal(network.errors[0].message, '网络中断')
  assert.equal(network.updates.at(-1).status, 'RUNNING')
  assert.equal(network.scheduled.size, 0)
  await network.session.resume()
  assert.equal(network.completions.length, 1)
})

test('打印机页面单独提供ADMIN同步入口，普通刷新只重新获取列表，卸载释放轮询', () => {
  const source = fs.readFileSync(new URL('../src/views/PrinterManage.vue', import.meta.url), 'utf8')
  const drawer = fs.readFileSync(new URL('../src/components/device/PrinterIpSyncDrawer.vue', import.meta.url), 'utf8')
  assert.match(source, /@click="fetchData">\s*刷新/)
  assert.match(source, /v-if="isAdmin"[^>]*@click="ipSyncVisible = true"/)
  assert.match(source, /@completed="handleIpSyncCompleted"/)
  assert.match(source, /const handleIpSyncCompleted[\s\S]*await fetchData\(\)/)
  assert.match(drawer, /onMounted\(resume\)/)
  assert.match(drawer, /onUnmounted\(\(\) => session\.dispose\(\)\)/)
  assert.match(drawer, /canManage: \(\) => props\.isAdmin/)
})
