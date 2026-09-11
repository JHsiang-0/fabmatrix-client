import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const request = (method, url, data, headers, params) => mockRequest({ method, url, data, headers, params })
const headers = { Authorization: 'Bearer printer-analytics-session' }

function setupSession() {
  resetMockState()
  mockState.sessions['printer-analytics-session'] = { userId: 1, username: 'admin', role: 'ADMIN' }
}

test('returns paginated printer history in reverse recorded order', async () => {
  setupSession()
  const response = await request(
    'GET',
    '/api/v1/printers/403/history',
    undefined,
    headers,
    { pageNum: 1, pageSize: 1 }
  )

  assert.equal(response.data.total, 2)
  assert.equal(response.data.records.length, 1)
  assert.equal(response.data.records[0].printerId, '403')
  assert.equal(response.data.records[0].status, 'PRINTING')
  assert.equal(response.data.records[0].recordedAt, '2026-09-02T17:10:30')
  assert.equal(response.data.pageSize, 1)
})

test('calculates statistics from associated jobs and excludes incomplete durations', async () => {
  setupSession()
  const response = await request('GET', '/api/v1/printers/403/statistics', undefined, headers)

  assert.deepEqual(response.data, {
    printerId: '403',
    from: null,
    to: null,
    totalJobs: 1,
    completedJobs: 0,
    failedJobs: 0,
    cancelledJobs: 0,
    activeJobs: 1,
    successRate: 0,
    totalPrintSeconds: 0,
    averagePrintSeconds: 0
  })
})

test('applies createdAt time ranges and validates printer analytics parameters', async () => {
  setupSession()
  const filtered = await request(
    'GET',
    '/api/v1/printers/403/statistics',
    undefined,
    headers,
    { from: '2026-09-03T00:00:00', to: '2026-09-04T00:00:00' }
  )
  assert.equal(filtered.data.totalJobs, 0)
  assert.equal(filtered.data.from, '2026-09-03T00:00:00')
  assert.equal(filtered.data.to, '2026-09-04T00:00:00')

  await assert.rejects(
    request('GET', '/api/v1/printers/0/history', undefined, headers),
    error => error.response.status === 400
  )
  await assert.rejects(
    request(
      'GET',
      '/api/v1/printers/403/statistics',
      undefined,
      headers,
      { from: '2026-09-04T00:00:00', to: '2026-09-03T00:00:00' }
    ),
    error => error.response.status === 400
  )
})
