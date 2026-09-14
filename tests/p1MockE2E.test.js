import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { createMockWebSocketStream, publishMockWebSocketEvent } from '../src/mock/websocket.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const request = (method, url, data, headers, params) => mockRequest({
  method,
  url,
  data,
  headers,
  params
})

const assertSuccessEnvelope = response => {
  assert.deepEqual(Object.keys(response).sort(), ['code', 'data', 'message', 'timestamp'])
  assert.equal(response.code, 200)
  assert.equal(typeof response.message, 'string')
  assert.equal(typeof response.timestamp, 'number')
  return response.data
}

const assertPage = page => {
  assert.deepEqual(Object.keys(page).sort(), ['pageNum', 'pageSize', 'pages', 'records', 'total'])
  assert.equal(Number.isInteger(page.pageNum), true)
  assert.equal(Number.isInteger(page.pageSize), true)
  assert.equal(Number.isInteger(page.pages), true)
  assert.equal(Number.isInteger(page.total), true)
  assert.equal(Array.isArray(page.records), true)
}

const assertPublicFile = file => {
  assert.equal('safeName' in file, false)
  assert.equal('fileUrl' in file, false)
  assert.equal('rustfsKey' in file, false)
  assert.equal(typeof file.id === 'number' || typeof file.id === 'string', true)
}

const assertPublicJob = job => {
  assert.equal('fileName' in job, true)
  assert.equal('printerName' in job, true)
  assert.equal('machineNumber' in job, true)
  assert.equal('creatorUsername' in job, true)
  assert.equal('operatorUsername' in job, true)
  assert.equal('materialType' in job, true)
  assert.equal('nozzleSize' in job, true)
  assert.equal(job.fileName === null || typeof job.fileName === 'string', true)
  assert.equal(job.printerName === null || typeof job.printerName === 'string', true)
  assert.equal(job.machineNumber === null || typeof job.machineNumber === 'string', true)
  assert.equal(job.creatorUsername === null || typeof job.creatorUsername === 'string', true)
  assert.equal(job.operatorUsername === null || typeof job.operatorUsername === 'string', true)
  assert.equal('endedAt' in job, false)
  assert.equal(typeof job.id, 'string')
  assert.equal(typeof job.status, 'string')
}

test('runs the repeatable P1 Mock HTTP main flow without automatic dispatch', async () => {
  resetMockState({ batchDispatchEnabled: true })
  mockState.sessions['p1-admin-session'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.sessions['p1-operator-session'] = { userId: 2, username: 'operator', role: 'OPERATOR' }

  const login = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/auth/login',
    { username: 'admin', password: 'Admin123' }
  ))
  assert.equal(typeof login.token, 'string')
  assert.equal(login.expiresIn, 604800)
  assert.equal(login.userId, '1')
  assert.equal(login.role, 'ADMIN')

  const sessionHeaders = { Authorization: `Bearer ${login.token}` }
  const restoredUser = assertSuccessEnvelope(await request(
    'GET',
    '/api/v1/auth/me',
    undefined,
    sessionHeaders
  ))
  assert.equal(restoredUser.id, '1')
  assert.equal(restoredUser.username, 'admin')
  assert.equal(restoredUser.role, 'ADMIN')
  assert.equal('password' in restoredUser, false)

  const fileTree = assertSuccessEnvelope(await request(
    'GET',
    '/api/v1/print-files/tree',
    undefined,
    sessionHeaders
  ))
  const defaultFolder = fileTree.find(folder => (
    folder.folder === true
    && folder.isDefault === true
    && folder.parentId === null
    && folder.userId === restoredUser.id
  ))
  assert.ok(defaultFolder)

  const uploadedFile = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/print-files/upload',
    { file: { name: 'p1-flow.gcode', size: 128 }, parentId: null },
    sessionHeaders
  ))
  assertPublicFile(uploadedFile)
  const uploadedFileId = uploadedFile.id
  assert.equal(uploadedFile.parentId, defaultFolder.id)

  const preview = assertSuccessEnvelope(await request(
    'GET',
    `/api/v1/print-files/${uploadedFileId}/preview`,
    undefined,
    sessionHeaders
  ))
  assert.equal(preview.id, uploadedFileId)
  assert.equal(preview.previewSupported, true)
  assert.equal(preview.filamentLength, 1.8)
  assertPublicFile(preview)

  const download = assertSuccessEnvelope(await request(
    'GET',
    `/api/v1/print-files/${uploadedFileId}/download`,
    undefined,
    sessionHeaders
  ))
  assert.match(download, /^data:text\/plain/)

  const uploadedPage = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/print-files/page',
    { pageNum: 1, pageSize: 10, fileName: 'P1-FLOW', parentId: defaultFolder.id, folder: false },
    sessionHeaders
  ))
  assertPage(uploadedPage)
  assert.equal(uploadedPage.records.some(file => file.id === uploadedFileId), true)
  uploadedPage.records.forEach(assertPublicFile)

  const createdJobId = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/print-jobs',
    { fileId: uploadedFileId, priority: 70 },
    sessionHeaders
  ))
  assert.equal(typeof createdJobId, 'string')
  assert.match(createdJobId, /^\d+$/)

  const queuedJob = assertSuccessEnvelope(await request(
    'GET',
    `/api/v1/print-jobs/${createdJobId}`,
    undefined,
    sessionHeaders
  ))
  assert.equal(queuedJob.status, 'QUEUED')
  assert.equal(queuedJob.printerId, null)
  assertPublicJob(queuedJob)

  const assignedResponse = await request(
    'POST',
    '/api/v1/print-jobs/safe/assign',
    { jobId: String(createdJobId), printerId: '404' },
    sessionHeaders
  )
  assert.equal(assertSuccessEnvelope(assignedResponse), null)
  const assignedJob = assertSuccessEnvelope(await request(
    'GET',
    `/api/v1/print-jobs/${createdJobId}`,
    undefined,
    sessionHeaders
  ))
  assert.equal(assignedJob.id, String(createdJobId))
  assert.equal(assignedJob.printerId, '404')
  assert.equal(assignedJob.status, 'ASSIGNED')

  const safetyConfirmation = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/print-jobs/safe/confirm',
    { printerId: '404' },
    sessionHeaders
  ))
  assert.equal(safetyConfirmation, null)
  const confirmedPrinter = assertSuccessEnvelope(await request(
    'GET',
    '/api/v1/printers/404',
    undefined,
    sessionHeaders
  ))
  assert.equal(confirmedPrinter.isSafeToPrint, true)

  const startedResponse = await request(
    'POST',
    '/api/v1/print-jobs/safe/start',
    { jobId: String(createdJobId), action: 'START_PRINT' },
    sessionHeaders
  )
  assert.equal(assertSuccessEnvelope(startedResponse), null)
  const startedJob = assertSuccessEnvelope(await request(
    'GET',
    `/api/v1/print-jobs/${createdJobId}`,
    undefined,
    sessionHeaders
  ))
  assert.equal(startedJob.status, 'PRINTING')
  assertPublicJob(startedJob)

  assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/control/404/pause',
    undefined,
    sessionHeaders
  ))
  assert.equal((assertSuccessEnvelope(await request(
    'GET',
    `/api/v1/print-jobs/${createdJobId}`,
    undefined,
    sessionHeaders
  ))).status, 'PAUSED')

  assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/control/404/resume',
    undefined,
    sessionHeaders
  ))
  assert.equal((assertSuccessEnvelope(await request(
    'GET',
    `/api/v1/print-jobs/${createdJobId}`,
    undefined,
    sessionHeaders
  ))).status, 'PRINTING')

  assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/control/404/cancel',
    undefined,
    sessionHeaders
  ))
  assert.equal((assertSuccessEnvelope(await request(
    'GET',
    `/api/v1/print-jobs/${createdJobId}`,
    undefined,
    sessionHeaders
  ))).status, 'CANCELLED')

  const initialBatchJobCount = mockState.jobs.length
  const batchPreview = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/print-jobs/batch/preview',
    {
      fileIds: [20, 22],
      printerIds: [408],
      strategy: 'ROUND_ROBIN',
      action: 'START_AFTER_CONFIRM'
    },
    sessionHeaders
  ))
  assert.equal(mockState.jobs.length, initialBatchJobCount)
  assert.equal(mockState.printers.find(printer => printer.id === 408).currentJobId, null)
  assert.equal(batchPreview.items.length, 2)
  assert.equal(batchPreview.items.every(item => item.canExecute), true)

  const batchConfirm = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/print-jobs/batch/confirm',
    {
      planId: batchPreview.planId,
      version: batchPreview.version,
      itemIds: batchPreview.items.map(item => item.itemId),
      confirmationToken: batchPreview.confirmationToken
    },
    sessionHeaders
  ))
  assert.equal(batchConfirm.status, 'PARTIAL_FAILED')
  assert.deepEqual(batchConfirm.items.map(item => item.status), ['ASSIGNED', 'RETRYABLE'])
  assert.equal(batchConfirm.items[0].status, 'ASSIGNED')
  assert.equal(batchConfirm.items[1].reasonCode, 'PRINTER_STATE_CHANGED')
  assert.equal(batchConfirm.items[1].retryable, true)
  assert.equal(mockState.jobs.length, initialBatchJobCount + 1)
  assert.equal(batchConfirm.items[0].fileName, 'gearbox.gcode')
  assert.equal(batchConfirm.items[0].printerName, 'Printer_CLEAN')
  assert.equal(batchConfirm.items[0].printerStatus, 'IDLE')

  const occupiedBatchJobId = batchConfirm.items[0].jobId
  assertSuccessEnvelope(await request(
    'DELETE',
    `/api/v1/print-jobs/${occupiedBatchJobId}`,
    undefined,
    sessionHeaders
  ))
  const failedBatchItem = batchConfirm.items[1]
  const recoveryPreview = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/print-jobs/batch/retry-preview',
    {
      sourcePlanId: batchPreview.planId,
      sourceItemIds: [failedBatchItem.itemId],
      retryKey: `p1-retry:${batchPreview.planId}:${failedBatchItem.itemId}`
    },
    sessionHeaders
  ))
  assert.notEqual(recoveryPreview.planId, batchPreview.planId)
  assert.equal(recoveryPreview.items[0].sourcePlanId, batchPreview.planId)
  assert.equal(recoveryPreview.items[0].sourceItemId, failedBatchItem.itemId)
  assert.equal(recoveryPreview.items[0].canExecute, true)

  const recoveryConfirm = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/print-jobs/batch/confirm',
    {
      planId: recoveryPreview.planId,
      version: recoveryPreview.version,
      itemIds: [recoveryPreview.items[0].itemId],
      confirmationToken: recoveryPreview.confirmationToken
    },
    sessionHeaders
  ))
  assert.equal(recoveryConfirm.items[0].status, 'ASSIGNED')
  assert.equal(recoveryConfirm.items[0].status, 'ASSIGNED')
  assert.equal(mockState.jobs.length, initialBatchJobCount + 2)

  const operatorToken = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/auth/login',
    { username: 'operator', password: 'Operator123' }
  )).token
  const operatorSessionHeaders = { Authorization: `Bearer ${operatorToken}` }
  const disabledUser = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/auth/admin/users/2/disable',
    undefined,
    sessionHeaders
  ))
  assert.equal(disabledUser.enabled, false)
  await assert.rejects(
    request('GET', '/api/v1/auth/me', undefined, operatorSessionHeaders),
    error => error.response.status === 403 && error.response.data.code === 403
  )
  const enabledUser = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/auth/admin/users/2/enable',
    undefined,
    sessionHeaders
  ))
  assert.equal(enabledUser.enabled, true)
  await assert.rejects(
    request('GET', '/api/v1/auth/me', undefined, operatorSessionHeaders),
    error => error.response.status === 401 && error.response.data.code === 401
  )
  const freshOperatorToken = assertSuccessEnvelope(await request(
    'POST',
    '/api/v1/auth/login',
    { username: 'operator', password: 'Operator123' }
  )).token
  assert.equal(assertSuccessEnvelope(await request(
    'GET',
    '/api/v1/auth/me',
    undefined,
    { Authorization: `Bearer ${freshOperatorToken}` }
  )).enabled, true)

  const history = assertSuccessEnvelope(await request(
    'GET',
    '/api/v1/printers/403/history',
    undefined,
    sessionHeaders,
    { pageNum: 1, pageSize: 10 }
  ))
  assertPage(history)
  assert.equal(history.records[0].printerId, '403')
  assert.equal(history.records[0].recordedAt, '2026-09-02T17:10:30')

  const statistics = assertSuccessEnvelope(await request(
    'GET',
    '/api/v1/printers/403/statistics',
    undefined,
    sessionHeaders
  ))
  assert.equal(statistics.printerId, '403')
  assert.equal(statistics.totalJobs, 1)
  assert.equal(statistics.activeJobs, 1)
  assert.equal(statistics.totalPrintSeconds, 0)
  assert.equal(statistics.averagePrintSeconds, 0)

  const originalWindow = globalThis.window
  let timerCallback = null
  let clearedTimer = null
  globalThis.window = {
    setInterval(callback) {
      timerCallback = callback
      return 'p1-ws-timer'
    },
    clearInterval(timer) {
      clearedTimer = timer
    }
  }
  try {
    const events = []
    const stream = createMockWebSocketStream({ onMessage: message => events.push(message) })
    assert.equal(events.length, 1)
    assert.deepEqual(Object.keys(events[0]).sort(), [
      'data',
      'eventId',
      'sequence',
      'timestamp',
      'type',
      'version'
    ])
    assert.equal(events[0].type, 'SNAPSHOT')
    assert.equal(events[0].version, '1')
    assert.equal(events[0].sequence, 1)
    assert.equal(Array.isArray(events[0].data.printers), true)
    assert.equal(events[0].data.printers.length, mockState.printers.length)
    assert.equal('apiKey' in events[0].data.printers[0], false)

    timerCallback()
    assert.equal(events[1].sequence, 2)
    assert.equal(typeof events[1].eventId, 'string')
    assert.equal(events[1].type, 'PRINTER_STATUS')
    stream.close()
    assert.equal(clearedTimer, 'p1-ws-timer')
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('keeps Mock error scenarios aligned with HTTP and business codes', async () => {
  resetMockState()
  const expected = {
    10001: 503,
    10002: 409,
    5003: 503,
    5004: 503
  }

  for (const [code, status] of Object.entries(expected)) {
    await assert.rejects(
      request('GET', '/api/v1/auth/me', undefined, undefined, { mockError: code }),
      error => {
        assert.equal(error.response.status, status)
        assert.deepEqual(Object.keys(error.response.data).sort(), ['code', 'data', 'message', 'timestamp', 'traceId'])
        assert.equal(error.response.data.code, Number(code))
        assert.equal(error.response.data.data, null)
        assert.equal(error.response.data.traceId, error.response.headers['X-Trace-Id'])
        return true
      }
    )
  }
})

test('Mock 写操作按 ADMIN/owner/other 身份广播无打印机 JOB_STATUS', async () => {
  resetMockState()
  mockState.sessions['mock-owner'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
  mockState.sessions['mock-other'] = { userId: 3, username: 'other', role: 'OPERATOR' }
  mockState.sessions['mock-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  const previousWindow = globalThis.window
  globalThis.window = { setInterval, clearInterval }
  const ownerEvents = []
  const otherEvents = []
  const adminEvents = []
  const ownerStream = createMockWebSocketStream({
    identity: mockState.sessions['mock-owner'], onMessage: event => ownerEvents.push(event)
  })
  const otherStream = createMockWebSocketStream({
    identity: mockState.sessions['mock-other'], onMessage: event => otherEvents.push(event)
  })
  const adminStream = createMockWebSocketStream({
    identity: mockState.sessions['mock-admin'], onMessage: event => adminEvents.push(event)
  })

  try {
    const file = mockState.files.find(item => !item.isFolder && Number(item.userId) === 2)
    await request('POST', '/api/v1/print-jobs', {
      fileId: file.id,
      priority: 10
    }, { Authorization: 'Bearer mock-owner' })

    const ownerJob = ownerEvents.find(event => event.type === 'JOB_STATUS')
    const adminJob = adminEvents.find(event => event.type === 'JOB_STATUS')
    assert.equal(ownerJob.eventId, adminJob.eventId)
    assert.equal(ownerJob.data.status, 'QUEUED')
    assert.equal(ownerJob.data.currentJobId, null)
    assert.equal(ownerJob.printerId, null)
    assert.equal('audienceUserId' in ownerJob, false)
    assert.equal(otherEvents.some(event => event.type === 'JOB_STATUS'), false)

    publishMockWebSocketEvent({ type: 'PRINTER_STATUS', printerId: '403', data: { status: 'IDLE' } })
    assert.equal(otherEvents.at(-1).sequence, 2)
  } finally {
    ownerStream.close()
    otherStream.close()
    adminStream.close()
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})
