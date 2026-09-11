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

test('filters job history by keyword, printer and time while returning completedAt', async () => {
  setupSession()
  const filtered = await request('POST', '/api/v1/print-jobs/page', {
    pageNum: 1,
    pageSize: 10,
    keyword: 'enclosure',
    printerId: 405,
    startTime: '2026-09-02T00:00:00',
    endTime: '2026-09-03T00:00:00'
  }, headers)

  assert.equal(filtered.data.total, 1)
  assert.equal(filtered.data.records[0].id, '1002')
  assert.equal(filtered.data.records[0].printerId, '405')
  assert.equal('endedAt' in filtered.data.records[0], false)

  const completed = await request('POST', '/api/v1/print-jobs/page', {
    pageNum: 1,
    pageSize: 10,
    status: 'COMPLETED'
  }, headers)
  assert.equal(completed.data.records[0].completedAt, '2026-09-02T14:35:00')
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
