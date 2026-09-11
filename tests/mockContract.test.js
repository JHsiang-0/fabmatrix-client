import test from 'node:test'
import assert from 'node:assert/strict'
import { createMockPage, createMockSuccess, MockRequestError } from '../src/mock/factory.js'
import { MOCK_ERROR_SCENARIOS, resolveMockErrorScenario } from '../src/mock/scenarios.js'
import { toPublicFile, toPublicJob, toPublicPrinter, toPublicSemanticIds } from '../src/mock/server.js'
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

test('sanitizes public mock DTOs while preserving the readable job summary contract', () => {
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
    machineNumber: 'A-01',
    creatorUsername: 'admin',
    operatorUsername: 'operator',
    materialType: 'PLA',
    nozzleSize: 0.4,
    endedAt: '2026-09-04T10:00:00',
    completedAt: '2026-09-04T10:00:00'
  }), {
    id: '1',
    fileId: '2',
    status: 'COMPLETED',
    fileName: 'private.gcode',
    printerName: 'Printer-1',
    machineNumber: 'A-01',
    creatorUsername: 'admin',
    operatorUsername: 'operator',
    materialType: 'PLA',
    nozzleSize: 0.4,
    completedAt: '2026-09-04T10:00:00'
  })
})

test('supports deterministic initialized and uninitialized mock seeds', () => {
  resetMockState({ initialized: false })
  assert.equal(mockState.users.length, 0)
  resetMockState()
  assert.equal(mockState.users.length > 0, true)
})

test('Mock semantic ID boundary keeps values above 2^53 as strings without changing numeric fields', () => {
  const largeId = '9007199254740993'
  const response = toPublicSemanticIds({
    printerId: largeId,
    currentJobId: largeId,
    jobId: largeId,
    conflicts: [largeId, 403],
    progress: 35.5,
    fileSize: 123456,
    layoutVersion: 7,
    timestamp: 1700000000000
  })

  assert.equal(response.printerId, largeId)
  assert.equal(response.currentJobId, largeId)
  assert.equal(response.jobId, largeId)
  assert.deepEqual(response.conflicts, [largeId, '403'])
  assert.equal(response.progress, 35.5)
  assert.equal(response.fileSize, 123456)
  assert.equal(response.layoutVersion, 7)
  assert.equal(response.timestamp, 1700000000000)
})

test('Mock recursively preserves object conflicts and generated IDs as decimal strings', () => {
  const largeId = '9007199254740993'
  const response = toPublicSemanticIds({
    conflicts: [{ printerId: largeId, gridRow: 4, nested: { jobId: largeId } }]
  })
  assert.equal(response.conflicts[0].printerId, largeId)
  assert.equal(response.conflicts[0].nested.jobId, largeId)
  assert.equal(response.conflicts[0].gridRow, 4)
})
