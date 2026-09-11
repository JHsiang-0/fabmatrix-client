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
  const queuedDetail = (await request('GET', `/api/v1/print-jobs/${queuedId}`, undefined, headers)).data
  assert.equal(queuedDetail.status, 'QUEUED')
  assert.equal(queuedDetail.fileNameSnapshot, queuedDetail.fileName)
  assert.equal(queuedDetail.rootJobId, queuedId)
  assert.equal(queuedDetail.attemptNumber, 1)
  await request('PUT', `/api/v1/print-jobs/${queuedId}/priority`, { priority: 80 }, headers)

  const assigned = await request('POST', '/api/v1/print-jobs/safe/assign', {
    jobId: queuedId,
    printerId: 404
  }, headers)
  assert.equal(assigned.data, null)
  const assignedDetail = (await request('GET', `/api/v1/print-jobs/${queuedId}`, undefined, headers)).data
  assert.equal(assignedDetail.printerNameSnapshot, assignedDetail.printerName)
  assert.equal(assignedDetail.machineNumberSnapshot, assignedDetail.machineNumber)

  const confirmed = await request('POST', '/api/v1/print-jobs/safe/confirm', {
    printerId: 404
  }, headers)
  assert.equal(confirmed.data, null)
  const confirmedPrinter = (await request('GET', '/api/v1/printers/404', undefined, headers)).data
  assert.equal(confirmedPrinter.isSafeToPrint, true)

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

  const retry = await request('POST', '/api/v1/print-jobs/1005/retry', undefined, headers)
  assert.equal(typeof retry.data, 'string')
  assert.equal((await request('GET', '/api/v1/print-jobs/1005', undefined, headers)).data.status, 'FAILED')
  assert.equal((await request('GET', `/api/v1/print-jobs/${retry.data}`, undefined, headers)).data.status, 'QUEUED')

  const started = await request('POST', '/api/v1/print-jobs/safe/start', {
    jobId: queuedId,
    action: 'START_PRINT'
  }, headers)
  assert.equal(started.data, null)
  const printingDetail = (await request('GET', `/api/v1/print-jobs/${queuedId}`, undefined, headers)).data
  assert.equal(printingDetail.status, 'PRINTING')
  assert.equal(printingDetail.operatorUsernameSnapshot, 'admin')

  await request('POST', '/api/v1/control/404/pause', undefined, headers)
  assert.equal((await request('GET', `/api/v1/print-jobs/${queuedId}`, undefined, headers)).data.status, 'PAUSED')
  await request('POST', '/api/v1/control/404/resume', undefined, headers)
  await request('POST', '/api/v1/control/404/cancel', undefined, headers)
  assert.equal((await request('GET', `/api/v1/print-jobs/${queuedId}`, undefined, headers)).data.status, 'CANCELLED')
})

test('rejects the deprecated assign endpoint with 410 without changing Mock state', async () => {
  resetMockState()
  const sessionKey = ['legacy', 'assign', 'test', 'session'].join('-')
  mockState.sessions[sessionKey] = { userId: 1, username: 'admin', role: 'ADMIN' }
  const headers = { Authorization: `Bearer ${sessionKey}` }
  const job = mockState.jobs.find(item => String(item.id) === '1003')
  const printer = mockState.printers.find(item => String(item.id) === '404')
  const jobBefore = { ...job }
  const printerBefore = { ...printer }

  for (const query of ['', '?printerId=404', '?printerId=not-a-number', '?printerId=']) {
    await assert.rejects(
      request('POST', `/api/v1/print-jobs/${job.id}/assign${query}`, undefined, headers),
      error => error.response.status === 410 && error.response.data.code === 410
    )
  }

  assert.deepEqual(job, jobBefore)
  assert.deepEqual(printer, printerBefore)
})
