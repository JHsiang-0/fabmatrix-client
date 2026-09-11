import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const request = (method, url, data, headers) => mockRequest({ method, url, data, headers })
const headers = { Authorization: 'Bearer batch-flow-session' }
const publicOwnerHeaders = { Authorization: 'Bearer batch-public-owner' }
const publicConfirmerHeaders = { Authorization: 'Bearer batch-public-confirmer' }
const dispatchPlanItemVoKeys = [
  'attemptCount', 'canExecute', 'fileId', 'fileName', 'itemId', 'jobId',
  'message', 'printerId', 'printerName', 'printerStatus', 'reasonCode',
  'recoveryAction', 'retryable', 'sourceItemId', 'sourcePlanId', 'status'
]

function assertDispatchPlanItemVO(item) {
  assert.deepEqual(Object.keys(item).sort(), dispatchPlanItemVoKeys)
  assert.equal('success' in item, false)
  assert.equal('errorCode' in item, false)
  assert.equal('job' in item, false)
}

function setupSession() {
  resetMockState()
  mockState.users.push({
    id: 3,
    username: 'third-user',
    password: 'Third123',
    role: 'OPERATOR',
    email: null,
    phone: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  })
  mockState.sessions['batch-flow-session'] = { userId: 1, username: 'admin', role: 'ADMIN' }
}

test('allows an operator to create and confirm its own plan containing another users public file', async () => {
  resetMockState()
  mockState.users.push({
    id: 3,
    username: 'third-user',
    password: 'Third123',
    role: 'OPERATOR',
    email: null,
    phone: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  })
  mockState.sessions['batch-public-owner'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
  mockState.sessions['batch-public-confirmer'] = { userId: 3, username: 'third-user', role: 'OPERATOR' }

  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [24],
    printerIds: [404],
    strategy: 'ONE_TO_ONE',
    action: 'QUEUE'
  }, publicConfirmerHeaders)
  assert.equal(preview.data.items[0].canExecute, true)
  assertDispatchPlanItemVO(preview.data.items[0])

  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: [preview.data.items[0].itemId],
    confirmationToken: preview.data.confirmationToken
  }, publicConfirmerHeaders)
  assert.equal(confirmed.data.items[0].status, 'ASSIGNED')
  assertDispatchPlanItemVO(confirmed.data.items[0])
  assert.equal(mockState.jobs.find(job => String(job.id) === confirmed.data.items[0].jobId).userId, 3)
})

test('rejects a different operator from confirming the public-file owners plan', async () => {
  resetMockState()
  mockState.users.push({
    id: 3,
    username: 'third-user',
    password: 'Third123',
    role: 'OPERATOR',
    email: null,
    phone: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  })
  mockState.sessions['batch-public-owner'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
  mockState.sessions['batch-public-confirmer'] = { userId: 3, username: 'third-user', role: 'OPERATOR' }

  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [24],
    printerIds: [404],
    strategy: 'ONE_TO_ONE',
    action: 'QUEUE'
  }, publicOwnerHeaders)

  await assert.rejects(
    request('POST', '/api/v1/print-jobs/batch/confirm', {
      planId: preview.data.planId,
      version: preview.data.version,
      itemIds: [preview.data.items[0].itemId],
      confirmationToken: preview.data.confirmationToken
    }, publicConfirmerHeaders),
    error => error.response.status === 403 && error.response.data.code === 403
  )
  assert.equal(mockState.jobs.length, 6)
})

test('previews without creating jobs or occupying printers, then confirms all items once', async () => {
  setupSession()
  const initialJobCount = mockState.jobs.length
  const initialPrinterJobIds = [mockState.printers.find(printer => printer.id === 404).currentJobId, mockState.printers.find(printer => printer.id === 408).currentJobId]
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [20, 22],
    printerIds: [404, 408],
    strategy: 'ONE_TO_ONE',
    action: 'START_AFTER_CONFIRM'
  }, headers)

  assert.equal(mockState.jobs.length, initialJobCount)
  assert.deepEqual([mockState.printers.find(printer => printer.id === 404).currentJobId, mockState.printers.find(printer => printer.id === 408).currentJobId], initialPrinterJobIds)
  assert.equal(preview.data.items.every(item => item.canExecute), true)
  preview.data.items.forEach(assertDispatchPlanItemVO)

  const confirmRequest = {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: preview.data.items.filter(item => item.canExecute).map(item => item.itemId),
    confirmationToken: preview.data.confirmationToken
  }
  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', confirmRequest, headers)
  assert.deepEqual(Object.keys(confirmed.data).sort(), ['items', 'planId', 'repeated', 'status'])
  assert.equal(confirmed.data.status, 'COMPLETED')
  confirmed.data.items.forEach(assertDispatchPlanItemVO)
  assert.equal(confirmed.data.items.every(item => ['ASSIGNED', 'UPLOADING', 'READY', 'SUCCEEDED'].includes(item.status)), true)
  assert.deepEqual(confirmed.data.items.map(item => item.status), ['ASSIGNED', 'ASSIGNED'])
  assert.equal(mockState.jobs.length, initialJobCount + 2)
  confirmed.data.items.forEach(item => {
    assert.equal(item.attemptCount, 1)
    const job = mockState.jobs.find(candidate => String(candidate.id) === item.jobId)
    const file = mockState.files.find(candidate => String(candidate.id) === item.fileId)
    const printer = mockState.printers.find(candidate => String(candidate.id) === item.printerId)
    assert.equal(job.fileNameSnapshot, file.originalName)
    assert.equal(job.creatorUsernameSnapshot, 'admin')
    assert.equal(job.printerNameSnapshot, printer.name)
    assert.equal(job.machineNumberSnapshot, printer.machineNumber)
    assert.equal(job.rootJobId, job.id)
    assert.equal(job.attemptNumber, 1)
    assert.equal(job.operatorUsernameSnapshot, null)
  })

  const repeated = await request('POST', '/api/v1/print-jobs/batch/confirm', confirmRequest, headers)
  assert.deepEqual(Object.keys(repeated.data).sort(), ['items', 'planId', 'repeated', 'status'])
  assert.equal(repeated.data.repeated, true)
  repeated.data.items.forEach(assertDispatchPlanItemVO)
  assert.deepEqual(repeated.data.items.map(item => item.jobId), confirmed.data.items.map(item => item.jobId))
  assert.equal(mockState.jobs.length, initialJobCount + 2)
})

test('batch UPLOAD_ONLY creates a READY task without an operator snapshot', async () => {
  setupSession()
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [22],
    printerIds: [404],
    strategy: 'ONE_TO_ONE',
    action: 'UPLOAD_ONLY'
  }, headers)
  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: [preview.data.items[0].itemId],
    confirmationToken: preview.data.confirmationToken
  }, headers)

  const jobId = confirmed.data.items[0].jobId
  const job = mockState.jobs.find(candidate => String(candidate.id) === jobId)
  assert.equal(confirmed.data.items[0].status, 'READY')
  assert.equal(confirmed.data.items[0].attemptCount, 1)
  assertDispatchPlanItemVO(confirmed.data.items[0])
  assert.equal(job.status, 'READY')
  assert.equal(job.operatorId, null)
  assert.equal(job.operatorUsernameSnapshot, null)
})

test('returns per-item partial failure when confirmation finds a printer occupied', async () => {
  setupSession()
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [20, 22],
    printerIds: [404],
    strategy: 'ROUND_ROBIN',
    action: 'START_AFTER_CONFIRM'
  }, headers)
  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: preview.data.items.map(item => item.itemId),
    confirmationToken: preview.data.confirmationToken
  }, headers)

  assert.equal(confirmed.data.status, 'PARTIAL_FAILED')
  confirmed.data.items.forEach(assertDispatchPlanItemVO)
  assert.deepEqual(confirmed.data.items.map(item => item.status), ['ASSIGNED', 'RETRYABLE'])
  assert.equal(confirmed.data.items[0].attemptCount, 1)
  assert.equal(confirmed.data.items[1].reasonCode, 'PRINTER_STATE_CHANGED')
  assert.equal(confirmed.data.items[1].retryable, true)
})

test('stores the Java resource fingerprint internally without exposing it in the preview VO', async () => {
  setupSession()
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [20],
    printerIds: [404],
    strategy: 'ONE_TO_ONE',
    action: 'QUEUE'
  }, headers)

  const plan = mockState.batchPlans.find(item => item.planId === preview.data.planId)
  assert.match(plan.items[0].resourceFingerprint, /^[0-9a-f]{64}$/)
  assert.equal('resourceFingerprint' in preview.data.items[0], false)
  assertDispatchPlanItemVO(preview.data.items[0])
})

test('returns FILE_NOT_FOUND as a non-retryable item failure when the preview file becomes a folder', async () => {
  setupSession()
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [20],
    printerIds: [404],
    strategy: 'ONE_TO_ONE',
    action: 'QUEUE'
  }, headers)
  const file = mockState.files.find(item => item.id === 20)
  file.folder = true
  file.isFolder = 1

  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: [preview.data.items[0].itemId],
    confirmationToken: preview.data.confirmationToken
  }, headers)

  const [item] = confirmed.data.items
  assertDispatchPlanItemVO(item)
  assert.equal(item.status, 'FAILED')
  assert.equal(item.reasonCode, 'FILE_NOT_FOUND')
  assert.equal(item.attemptCount, 0)
  assert.equal(item.retryable, false)
  assert.equal(item.jobId, null)
  assert.equal(mockState.jobs.length, 6)
})

test('returns RETRYABLE PRINTER_STATE_CHANGED when the printer is no longer available', async () => {
  setupSession()
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [20],
    printerIds: [404],
    strategy: 'ONE_TO_ONE',
    action: 'QUEUE'
  }, headers)
  const printer = mockState.printers.find(item => item.id === 404)
  printer.status = 'PRINTING'
  printer.currentJobId = 1001

  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: [preview.data.items[0].itemId],
    confirmationToken: preview.data.confirmationToken
  }, headers)

  const [item] = confirmed.data.items
  assertDispatchPlanItemVO(item)
  assert.equal(item.status, 'RETRYABLE')
  assert.equal(item.reasonCode, 'PRINTER_STATE_CHANGED')
  assert.equal(item.attemptCount, 0)
  assert.equal(item.retryable, true)
  assert.equal(item.jobId, null)
})

test('returns RETRYABLE RESOURCE_CHANGED when a preview resource fingerprint changes', async () => {
  setupSession()
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [20],
    printerIds: [404],
    strategy: 'ONE_TO_ONE',
    action: 'QUEUE'
  }, headers)
  const printer = mockState.printers.find(item => item.id === 404)
  printer.updatedAt = '2026-09-12T12:00:00'

  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: [preview.data.items[0].itemId],
    confirmationToken: preview.data.confirmationToken
  }, headers)

  const [item] = confirmed.data.items
  assertDispatchPlanItemVO(item)
  assert.equal(item.status, 'RETRYABLE')
  assert.equal(item.reasonCode, 'RESOURCE_CHANGED')
  assert.equal(item.attemptCount, 0)
  assert.equal(item.message, '预览后文件或打印机资源已变化，请重新预览')
  assert.equal(item.retryable, true)
  assert.equal(item.jobId, null)
})

test('rejects a token mismatch and an expired plan without creating a job', async () => {
  setupSession()
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [22],
    printerIds: [404],
    strategy: 'ONE_TO_ONE',
    action: 'QUEUE'
  }, headers)
  const confirmRequest = {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: preview.data.items.map(item => item.itemId),
    confirmationToken: 'wrong-token'
  }
  await assert.rejects(
    request('POST', '/api/v1/print-jobs/batch/confirm', confirmRequest, headers),
    error => error.response.status === 403
  )

  const plan = mockState.batchPlans.find(item => item.planId === preview.data.planId)
  plan.expiresAt = new Date(Date.now() - 1).toISOString()
  confirmRequest.confirmationToken = preview.data.confirmationToken
  await assert.rejects(
    request('POST', '/api/v1/print-jobs/batch/confirm', confirmRequest, headers),
    error => error.response.status === 409 && error.response.data.message.includes('过期')
  )
  assert.equal(mockState.jobs.length, 6)
})

test('creates an idempotent recovery preview for retryable confirmation failures', async () => {
  setupSession()
  const initialJobCount = mockState.jobs.length
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [20, 22],
    printerIds: [404],
    strategy: 'ROUND_ROBIN',
    action: 'QUEUE'
  }, headers)
  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: preview.data.items.map(item => item.itemId),
    confirmationToken: preview.data.confirmationToken
  }, headers)
  const failed = confirmed.data.items.find(item => item.retryable)
  assert.ok(failed)
  assert.equal(failed.jobId, null)

  const printer = mockState.printers.find(item => item.id === 404)
  printer.status = 'IDLE'
  printer.currentJobId = null
  const retryRequest = {
    sourcePlanId: preview.data.planId,
    sourceItemIds: [failed.itemId],
    retryKey: `retry:${preview.data.planId}:${failed.itemId}`
  }
  const retryPreview = await request('POST', '/api/v1/print-jobs/batch/retry-preview', retryRequest, headers)
  assert.notEqual(retryPreview.data.planId, preview.data.planId)
  assert.equal(retryPreview.data.items[0].sourcePlanId, preview.data.planId)
  assert.equal(retryPreview.data.items[0].sourceItemId, failed.itemId)
  assert.equal(retryPreview.data.items[0].retryable, false)

  const repeated = await request('POST', '/api/v1/print-jobs/batch/retry-preview', retryRequest, headers)
  assert.equal(repeated.data.planId, retryPreview.data.planId)
  assert.equal(repeated.data.confirmationToken, retryPreview.data.confirmationToken)

  const retried = await request('POST', '/api/v1/print-jobs/batch/confirm', {
    planId: retryPreview.data.planId,
    version: retryPreview.data.version,
    itemIds: retryPreview.data.items.filter(item => item.canExecute).map(item => item.itemId),
    confirmationToken: retryPreview.data.confirmationToken
  }, headers)
  assert.equal(retried.data.items[0].status, 'ASSIGNED')
  assertDispatchPlanItemVO(retried.data.items[0])
  assert.equal(mockState.jobs.length, initialJobCount + 2)
})
