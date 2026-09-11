import test from 'node:test'
import assert from 'node:assert/strict'
import { createMockPage, createMockSuccess, MockRequestError } from '../src/mock/factory.js'
import { MOCK_ERROR_SCENARIOS, resolveMockErrorScenario } from '../src/mock/scenarios.js'
import { toPublicFile, toPublicJob, toPublicPrinter } from '../src/mock/server.js'
import { mockState, resetMockState } from '../src/mock/data.js'

test('creates the unified mock envelope and paginated response', () => {
  const response = createMockSuccess({ ok: true })
  assert.deepEqual(response, {
    code: 200,
    message: '操作成功',
    data: { ok: true },
    timestamp: response.timestamp
  })

  assert.deepEqual(createMockPage([1, 2, 3], { pageNum: 2, pageSize: 2 }), {
    records: [3],
    total: 3,
    pageNum: 2,
    pageSize: 2,
    pages: 2
  })
})

test('keeps HTTP and business codes in mock error envelopes', () => {
  const error = new MockRequestError(422, 10002, '模拟设备忙碌', { retryable: true })
  assert.equal(error.response.status, 422)
  assert.deepEqual(error.response.data, {
    code: 10002,
    message: '模拟设备忙碌',
    data: { retryable: true },
    timestamp: error.response.data.timestamp
  })
  assert.deepEqual(resolveMockErrorScenario({ params: { mockError: '503' } }), MOCK_ERROR_SCENARIOS['503'])
  assert.deepEqual(resolveMockErrorScenario({ headers: { 'X-Mock-Error': '400' } }), MOCK_ERROR_SCENARIOS['400'])
})

test('sanitizes public mock DTOs to the backend contracts', () => {
  const file = toPublicFile({
    id: 1,
    folder: false,
    safeName: 'private.gcode',
    fileUrl: 'data:text/plain,private',
    rustfsKey: 'private-key',
    apiKey: 'private-api-key',
    isFolder: 0,
    estimatedSeconds: 60,
    estTime: 60,
    filamentLength: 1.2
  })
  assert.deepEqual(file, {
    id: '1',
    folder: false,
    estTime: 60,
    filamentLength: 1.2
  })

  assert.deepEqual(toPublicPrinter({
    id: 1,
    status: 'IDLE',
    apiKey: 'private-api-key',
    currentJobStatus: 'PRINTING',
    currentJobFileName: 'private.gcode'
  }), {
    id: '1',
    status: 'IDLE'
  })

  assert.deepEqual(toPublicJob({
    id: 1,
    fileId: 2,
    status: 'COMPLETED',
    fileName: 'private.gcode',
    printerName: 'Printer-1',
    materialType: 'PLA',
    nozzleSize: 0.4,
    endedAt: '2026-09-04T10:00:00',
    completedAt: '2026-09-04T10:00:00'
  }), {
    id: '1',
    fileId: '2',
    status: 'COMPLETED',
    completedAt: '2026-09-04T10:00:00'
  })
})

test('supports deterministic initialized and uninitialized mock seeds', () => {
  resetMockState({ initialized: false })
  assert.equal(mockState.users.length, 0)
  resetMockState()
  assert.equal(mockState.users.length > 0, true)
})
