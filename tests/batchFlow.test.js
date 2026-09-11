import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const request = (method, url, data, headers) => mockRequest({ method, url, data, headers })
const headers = { Authorization: 'Bearer batch-flow-session' }
const publicOwnerHeaders = { Authorization: 'Bearer batch-public-owner' }
const publicConfirmerHeaders = { Authorization: 'Bearer batch-public-confirmer' }

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

  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: [preview.data.items[0].itemId],
    confirmationToken: preview.data.confirmationToken
  }, publicConfirmerHeaders)
  assert.equal(confirmed.data.items[0].success, true)
  assert.equal(confirmed.data.items[0].job.userId, '3')
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
    error => error.response.status === 403
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

  const confirmRequest = {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: preview.data.items.filter(item => item.canExecute).map(item => item.itemId),
    confirmationToken: preview.data.confirmationToken
  }
  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', confirmRequest, headers)
  assert.equal(confirmed.data.planStatus, 'CONFIRMED')
  assert.equal(confirmed.data.items.every(item => item.success), true)
  assert.deepEqual(confirmed.data.items.map(item => item.status), ['ASSIGNED', 'ASSIGNED'])
  assert.equal(mockState.jobs.length, initialJobCount + 2)

  const repeated = await request('POST', '/api/v1/print-jobs/batch/confirm', confirmRequest, headers)
  assert.equal(repeated.data.idempotent, true)
  assert.equal(repeated.data.repeated, true)
  assert.deepEqual(repeated.data.items.map(item => item.jobId), confirmed.data.items.map(item => item.jobId))
  assert.equal(mockState.jobs.length, initialJobCount + 2)
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

  assert.equal(confirmed.data.planStatus, 'PARTIAL_SUCCESS')
  assert.deepEqual(confirmed.data.items.map(item => item.success), [true, false])
  assert.equal(confirmed.data.items[1].errorCode, 'PRINTER_BUSY')
  assert.equal(confirmed.data.items[1].retryable, true)
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
    error => error.response.status === 409
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
  assert.equal(retried.data.items[0].success, true)
  assert.equal(mockState.jobs.length, initialJobCount + 2)
})
