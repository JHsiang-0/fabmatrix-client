import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const request = (method, url, data, headers) => mockRequest({ method, url, data, headers })
const headers = { Authorization: 'Bearer job-history-session' }

function setupSession() {
  resetMockState()
  mockState.sessions['job-history-session'] = { userId: 1, username: 'admin', role: 'ADMIN' }
}

test('filters job history by terminal status, file, printer and completed time', async () => {
  setupSession()
  const filtered = await request('POST', '/api/v1/print-jobs/page', {
    pageNum: 1,
    pageSize: 10,
    statuses: ['COMPLETED', 'FAILED', 'CANCELLED'],
    fileName: ' calibration ',
    userId: 2,
    timeField: 'COMPLETED_AT',
    startTime: '2026-09-02T00:00:00',
    endTime: '2026-09-03T00:00:00'
  }, headers)

  assert.equal(filtered.data.total, 1)
  assert.equal(filtered.data.records[0].id, '1004')
  assert.equal(filtered.data.records[0].printerId, null)
  assert.equal('endedAt' in filtered.data.records[0], false)

  const completed = await request('POST', '/api/v1/print-jobs/page', {
    pageNum: 1,
    pageSize: 10,
    statuses: ['COMPLETED', 'FAILED', 'CANCELLED'],
    timeField: 'COMPLETED_AT'
  }, headers)
  assert.equal(completed.data.records[0].completedAt, '2026-09-02T14:35:00')
})

test('mock history page rejects mixed or unknown statuses and sorts completedAt null last', async () => {
  setupSession()
  await assert.rejects(
    request('POST', '/api/v1/print-jobs/page', {
      pageNum: 1,
      pageSize: 10,
      statuses: []
    }, headers),
    error => error.response.status === 400
  )
  await assert.rejects(
    request('POST', '/api/v1/print-jobs/page', {
      pageNum: 1,
      pageSize: 10,
      status: 'COMPLETED',
      statuses: ['FAILED']
    }, headers),
    error => error.response.status === 400
  )
  await assert.rejects(
    request('POST', '/api/v1/print-jobs/page', {
      pageNum: 1,
      pageSize: 10,
      status: 'NOT_A_STATUS'
    }, headers),
    error => error.response.status === 400
  )

  mockState.jobs = [
    { id: 5001, fileId: 20, userId: 1, status: 'FAILED', createdAt: '2026-09-11T10:00:00', completedAt: '2026-09-11T12:00:00' },
    { id: 5002, fileId: 20, userId: 1, status: 'COMPLETED', createdAt: '2026-09-11T10:00:00', completedAt: null },
    { id: 5003, fileId: 20, userId: 1, status: 'CANCELLED', createdAt: '2026-09-11T10:00:00', completedAt: '2026-09-11T11:00:00' }
  ]
  const sorted = await request('POST', '/api/v1/print-jobs/page', {
    pageNum: 1,
    pageSize: 10,
    statuses: ['COMPLETED', 'FAILED', 'CANCELLED'],
    timeField: 'COMPLETED_AT'
  }, headers)
  assert.deepEqual(sorted.data.records.map(job => job.id), ['5001', '5003', '5002'])

  mockState.files.push({ id: 99, originalName: 'literal%_name.gcode' })
  mockState.jobs.push({
    id: 5004,
    fileId: 99,
    userId: 1,
    status: 'FAILED',
    createdAt: '2026-09-11T10:00:00',
    completedAt: '2026-09-11T09:00:00'
  })
  const escapedFileName = await request('POST', '/api/v1/print-jobs/page', {
    pageNum: 1,
    pageSize: 10,
    status: 'FAILED',
    fileName: '%_',
    timeField: 'COMPLETED_AT'
  }, headers)
  assert.deepEqual(escapedFileName.data.records.map(job => job.id), ['5004'])
})

test('mock trims fileName before enforcing its length limit', async () => {
  setupSession()
  const trimmed = await request('POST', '/api/v1/print-jobs/page', {
    pageNum: 1,
    pageSize: 10,
    status: 'PRINTING',
    fileName: ' '.repeat(255) + 'gearbox.gcode'
  }, headers)
  assert.deepEqual(trimmed.data.records.map(job => job.id), ['1001'])

  await assert.rejects(
    request('POST', '/api/v1/print-jobs/page', {
      pageNum: 1,
      pageSize: 10,
      fileName: 'x'.repeat(256)
    }, headers),
    error => error.response.status === 400
  )
})

test('enforces legal recovery and priority actions for job history', async () => {
  setupSession()
  await request('POST', '/api/v1/print-jobs/1005/retry', undefined, headers)
  assert.equal(mockState.jobs.find(job => job.id === 1005).status, 'QUEUED')
  assert.equal(mockState.jobs.find(job => job.id === 1005).printerId, null)

  await request('PUT', '/api/v1/print-jobs/1003/priority', { priority: 100 }, headers)
  assert.equal(mockState.jobs.find(job => job.id === 1003).priority, 100)

  await assert.rejects(
    request('POST', '/api/v1/print-jobs/1004/retry', undefined, headers),
    error => error.response.status === 422
  )
})

test('rejects an inverted history time range', async () => {
  setupSession()
  await assert.rejects(
    request('POST', '/api/v1/print-jobs/page', {
      pageNum: 1,
      pageSize: 10,
      startTime: '2026-09-03T00:00:00',
      endTime: '2026-09-02T00:00:00'
    }, headers),
    error => error.response.status === 400
  )
})
