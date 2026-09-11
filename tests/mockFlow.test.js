import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const request = (method, url, data, headers) => mockRequest({ method, url, data, headers })

test('runs the P0 Mock printer and job contract through a legal lifecycle', async () => {
  resetMockState()
  const sessionKey = ['flow', 'test', 'session'].join('-')
  mockState.sessions[sessionKey] = { userId: 1, username: 'admin', role: 'ADMIN' }
  const headers = { Authorization: `Bearer ${sessionKey}` }

  const detail = await request('GET', '/api/v1/printers/404', undefined, headers)
  assert.equal(detail.data.id, '404')

  const filePage = await request('POST', '/api/v1/print-files/page', {
    pageNum: 1,
    pageSize: 100,
    parentId: null
  }, headers)
  assert.equal(filePage.data.pages >= 1, true)
  const uploaded = await request('POST', '/api/v1/print-files/upload', {
    file: { name: 'mock-flow.gcode', size: 128 },
    parentId: null
  }, headers)
  const uploadedFileId = uploaded.data.id
  const download = await request('GET', `/api/v1/print-files/${uploadedFileId}/download`, undefined, headers)
  assert.match(download.data, /^data:text\/plain/)
  await request('DELETE', `/api/v1/print-files/${uploadedFileId}`, undefined, headers)

  const queued = await request('POST', '/api/v1/print-jobs', {
    fileId: 22,
    priority: 70
  }, headers)
  const queuedId = queued.data
  assert.equal((await request('GET', `/api/v1/print-jobs/${queuedId}`, undefined, headers)).data.status, 'QUEUED')
  await request('PUT', `/api/v1/print-jobs/${queuedId}/priority`, { priority: 80 }, headers)

  const assigned = await request('POST', '/api/v1/print-jobs/safe/assign', {
    jobId: queuedId,
    printerId: 404
  }, headers)
  assert.equal(assigned.data, null)

  const confirmed = await request('POST', '/api/v1/print-jobs/safe/confirm', {
    printerId: 404
  }, headers)
  assert.equal(confirmed.data.isSafeToPrint, true)

  const requeueJob = await request('POST', '/api/v1/print-jobs', {
    fileId: 22,
    priority: 10,
    printerId: 408
  }, headers)
  assert.equal((await request('GET', `/api/v1/print-jobs/${requeueJob.data}`, undefined, headers)).data.status, 'ASSIGNED')
  await request('POST', `/api/v1/print-jobs/${requeueJob.data}/requeue`, undefined, headers)
  assert.equal((await request('GET', `/api/v1/print-jobs/${requeueJob.data}`, undefined, headers)).data.status, 'QUEUED')

  await request('POST', '/api/v1/control/403/emergency-stop', undefined, headers)
  assert.equal((await request('GET', '/api/v1/print-jobs/1001', undefined, headers)).data.status, 'RECONCILING')

  await request('POST', '/api/v1/print-jobs/1005/retry', undefined, headers)
  assert.equal((await request('GET', '/api/v1/print-jobs/1005', undefined, headers)).data.status, 'QUEUED')

  const started = await request('POST', '/api/v1/print-jobs/safe/start', {
    jobId: queuedId,
    action: 'START_PRINT'
  }, headers)
  assert.equal(started.data, null)

  await request('POST', '/api/v1/control/404/pause', undefined, headers)
  assert.equal((await request('GET', `/api/v1/print-jobs/${queuedId}`, undefined, headers)).data.status, 'PAUSED')
  await request('POST', '/api/v1/control/404/resume', undefined, headers)
  await request('POST', '/api/v1/control/404/cancel', undefined, headers)
  assert.equal((await request('GET', `/api/v1/print-jobs/${queuedId}`, undefined, headers)).data.status, 'CANCELLED')
})
