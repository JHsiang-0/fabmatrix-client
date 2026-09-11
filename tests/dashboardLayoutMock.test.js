import assert from 'node:assert/strict'
import test from 'node:test'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'
import { createMockWebSocketStream } from '../src/mock/websocket.js'

const adminHeaders = { Authorization: 'Bearer layout-admin' }
const operatorHeaders = { Authorization: 'Bearer layout-operator' }
const request = (method, data, headers = adminHeaders) => mockRequest({
  method,
  url: '/api/v1/dashboard-layout',
  data,
  headers
})
const positionsRequest = data => mockRequest({
  method: 'PUT',
  url: '/api/v1/printers/positions',
  data,
  headers: adminHeaders
})

const saveBody = overrides => ({
  expectedVersion: mockState.dashboardLayout.version,
  rowCount: 4,
  columnCount: 12,
  aisles: mockState.dashboardLayout.aisles,
  overflowPolicy: 'REJECT',
  positionChanges: [],
  ...overrides
})

test.beforeEach(() => {
  resetMockState()
  mockState.sessions['layout-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.sessions['layout-operator'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
})

test.afterEach(() => resetMockState())

test('Mock 布局资源区分读权限和 ADMIN 写权限，并支持版本冲突', async () => {
  const read = await request('GET')
  assert.equal(read.data.version, 1)
  await assert.rejects(() => request('PUT', saveBody({ rowCount: 5 }), operatorHeaders), error => {
    assert.equal(error.response.status, 403)
    return true
  })
  await assert.rejects(() => request('PUT', saveBody({ expectedVersion: 99 }), adminHeaders), error => {
    assert.equal(error.response.status, 409)
    assert.equal(error.response.data.data.reason, 'VERSION_CONFLICT')
    return true
  })
})

test('Mock 布局保存校验原子性、缩容 REJECT/UNALLOCATE 和槽位冲突', async () => {
  const before = JSON.stringify({ layout: mockState.dashboardLayout, printers: mockState.printers })
  await assert.rejects(() => request('PUT', saveBody({ rowCount: 1, columnCount: 1, aisles: [] })), error => {
    assert.equal(error.response.status, 422)
    assert.equal(error.response.data.data.reason, 'OUT_OF_BOUNDS')
    return true
  })
  assert.equal(JSON.stringify({ layout: mockState.dashboardLayout, printers: mockState.printers }), before)

  const saved = await request('PUT', saveBody({
    rowCount: 1,
    columnCount: 1,
    aisles: [],
    overflowPolicy: 'UNALLOCATE'
  }))
  assert.equal(saved.data.layout.version, 2)
  assert.equal(mockState.printers.find(printer => printer.id === 404).gridRow, null)

  resetMockState()
  mockState.sessions['layout-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  await assert.rejects(() => request('PUT', saveBody({
    positionChanges: [{ printerId: 405, gridRow: 1, gridCol: 1 }]
  })), error => {
    assert.equal(error.response.status, 409)
    assert.equal(error.response.data.data.reason, 'SLOT_CONFLICT')
    return true
  })
})

test('Mock 布局保存向多个客户端广播 LAYOUT_UPDATED 且不伪造打印机状态', async () => {
  const previousWindow = globalThis.window
  globalThis.window = { setInterval, clearInterval }
  const eventsA = []
  const eventsB = []
  const streamA = createMockWebSocketStream({ onMessage: event => eventsA.push(event) })
  const streamB = createMockWebSocketStream({ onMessage: event => eventsB.push(event) })
  await request('PUT', saveBody({ rowCount: 5 }))
  const eventA = eventsA.find(event => event.type === 'LAYOUT_UPDATED')
  const eventB = eventsB.find(event => event.type === 'LAYOUT_UPDATED')
  assert.equal(eventA?.data?.layoutVersion, 2)
  assert.equal(eventA?.stateSource, undefined)
  assert.equal(eventA?.layoutVersion, undefined)
  assert.equal(eventA?.eventId, eventB?.eventId)
  assert.equal(eventA?.sequence, eventB?.sequence)
  assert.equal(eventB?.data?.stateSource, 'LAYOUT')
  streamA.close()
  streamB.close()
  globalThis.window = previousWindow
})

test('Mock 请求内重复目标槽位返回 400/DUPLICATE_SLOT 且不改变状态', async () => {
  const before = JSON.stringify({ layout: mockState.dashboardLayout, printers: mockState.printers })
  await assert.rejects(() => request('PUT', saveBody({
    positionChanges: [
      { printerId: 403, gridRow: 1, gridCol: 3 },
      { printerId: 404, gridRow: 1, gridCol: 3 }
    ]
  })), error => {
    assert.equal(error.response.status, 400)
    assert.equal(error.response.data.data.reason, 'DUPLICATE_SLOT')
    assert.deepEqual(error.response.data.data.conflicts, ['403', '404'])
    return true
  })
  assert.equal(JSON.stringify({ layout: mockState.dashboardLayout, printers: mockState.printers }), before)
})

test('Mock HTTP/WS 路由保留大 ID 字符串并保持布局事件仅使用 data', async () => {
  const largeId = '9007199254740993'
  const printer = mockState.printers.find(item => String(item.id) === '403')
  printer.id = largeId
  const previousWindow = globalThis.window
  globalThis.window = { setInterval, clearInterval }
  const events = []
  const stream = createMockWebSocketStream({ onMessage: event => events.push(event) })
  const saved = await request('PUT', saveBody({
    positionChanges: [{ printerId: largeId, gridRow: 4, gridCol: 12 }]
  }))
  assert.equal(saved.data.changedPositions[0].printerId, largeId)
  const event = events.find(item => item.type === 'LAYOUT_UPDATED')
  assert.equal(event?.data?.layoutVersion, 2)
  assert.equal(event?.layoutVersion, undefined)
  stream.close()
  globalThis.window = previousWindow
})

test('旧 positions 路由复用布局原子校验、回滚和版本事件且保留 null 响应', async () => {
  const before = JSON.stringify({ layout: mockState.dashboardLayout, printers: mockState.printers })
  const assertRolledBack = () => {
    assert.equal(JSON.stringify({ layout: mockState.dashboardLayout, printers: mockState.printers }), before)
  }

  await assert.rejects(() => positionsRequest([
    { id: '408', gridRow: 4, gridCol: 12 },
    { id: '999999', gridRow: 4, gridCol: 11 }
  ]), error => {
    assert.equal(error.response.status, 404)
    return true
  })
  assertRolledBack()

  await assert.rejects(() => positionsRequest([
    { id: '407', gridRow: 4, gridCol: 12 },
    { id: '408', gridRow: 4, gridCol: 12 }
  ]), error => {
    assert.equal(error.response.status, 400)
    assert.equal(error.response.data.data.reason, 'DUPLICATE_SLOT')
    return true
  })
  assertRolledBack()

  await assert.rejects(() => positionsRequest([
    { id: '408', gridRow: 5, gridCol: 1 }
  ]), error => {
    assert.equal(error.response.status, 400)
    return true
  })
  assertRolledBack()

  const previousWindow = globalThis.window
  globalThis.window = { setInterval, clearInterval }
  const events = []
  const stream = createMockWebSocketStream({ onMessage: event => events.push(event) })
  const response = await positionsRequest([{ id: '408', gridRow: 4, gridCol: 12 }])
  assert.equal(response.data, null)
  assert.equal(mockState.dashboardLayout.version, 2)
  assert.equal(mockState.printers.find(printer => String(printer.id) === '408').gridRow, 4)
  assert.equal(events.find(event => event.type === 'LAYOUT_UPDATED')?.data?.layoutVersion, 2)
  stream.close()
  globalThis.window = previousWindow
})

test('旧 positions 路由只接受 1-100 项数组，非法请求不改版本且不发布局事件', async () => {
  const previousWindow = globalThis.window
  globalThis.window = { setInterval, clearInterval }
  const events = []
  const stream = createMockWebSocketStream({ onMessage: event => events.push(event) })
  const before = JSON.stringify({ layout: mockState.dashboardLayout, printers: mockState.printers })
  const invalidBodies = [
    [],
    null,
    { id: '408', gridRow: 4, gridCol: 12 },
    Array.from({ length: 101 }, (_, index) => ({ id: String(index + 1), gridRow: null, gridCol: null }))
  ]

  for (const body of invalidBodies) {
    await assert.rejects(() => positionsRequest(body), error => {
      assert.equal(error.response.status, 400)
      assert.equal(error.response.data.code, 400)
      return true
    })
    assert.equal(JSON.stringify({ layout: mockState.dashboardLayout, printers: mockState.printers }), before)
  }
  assert.equal(mockState.dashboardLayout.version, 1)
  assert.equal(events.some(event => event.type === 'LAYOUT_UPDATED'), false)
  stream.close()
  globalThis.window = previousWindow
})
