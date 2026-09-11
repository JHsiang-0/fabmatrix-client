import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getRealtimeJobCollection,
  getRealtimeJobId,
  getRealtimeJobPatch,
  isRealtimeActiveJobStatus,
  isTerminalJobStatus,
  normalizeRealtimeJobStatus
} from '../src/utils/jobRealtime.js'
import { createMockWebSocketStream, publishMockWebSocketEvent } from '../src/mock/websocket.js'

globalThis.window = {
  setInterval,
  clearInterval
}

test('resolves realtime job IDs in contract order without replacing explicit null', () => {
  assert.equal(getRealtimeJobId({
    jobId: 'message-job',
    currentJobId: 'message-current',
    data: { currentJobId: null, jobId: 'data-job' }
  }), 'data-job')
  assert.equal(getRealtimeJobId({
    jobId: 'message-job',
    data: { currentJobId: null }
  }), null)
  assert.equal(getRealtimeJobId({ currentJobId: 'message-current', data: {} }), 'message-current')
})

test('classifies queue, active and terminal realtime statuses', () => {
  assert.equal(getRealtimeJobCollection('QUEUED'), 'queue')
  assert.equal(getRealtimeJobCollection('PREPARING'), null)
  assert.equal(getRealtimeJobCollection('PRINTING'), 'active')
  assert.equal(getRealtimeJobCollection('COMPLETED'), 'terminal')
  assert.equal(getRealtimeJobCollection('FAILED'), 'terminal')
  assert.equal(isRealtimeActiveJobStatus('CANCELLED'), false)
  assert.equal(isTerminalJobStatus('CANCELLED'), true)
  assert.equal(getRealtimeJobCollection('UNKNOWN'), null)
  assert.equal(normalizeRealtimeJobStatus({ data: { jobId: 'legacy', status: 'PREPARING' } }).status, 'UPLOADING')
})

test('only merges explicit event fields and keeps REST summary fields available', () => {
  const message = {
    sequence: 12,
    data: {
      jobId: 9007199254740993n,
      status: 'PRINTING',
      currentJobId: null,
      progress: 42
    }
  }
  const normalized = normalizeRealtimeJobStatus(message)
  const patch = getRealtimeJobPatch(message, normalized)

  assert.equal(normalized.key, '9007199254740993')
  assert.deepEqual(patch, {
    id: '9007199254740993',
    status: 'PRINTING',
    currentJobId: null,
    progress: 42
  })
  assert.equal(Object.prototype.hasOwnProperty.call(patch, 'fileName'), false)
})

test('Mock filters JOB_STATUS by identity before allocating per-session sequence', () => {
  const owner = []
  const other = []
  const admin = []
  const ownerStream = createMockWebSocketStream({
    identity: { userId: '7', role: 'OPERATOR' }, onMessage: event => owner.push(event)
  })
  const otherStream = createMockWebSocketStream({
    identity: { userId: '8', role: 'OPERATOR' }, onMessage: event => other.push(event)
  })
  const adminStream = createMockWebSocketStream({
    identity: { userId: '1', role: 'ADMIN' }, onMessage: event => admin.push(event)
  })

  publishMockWebSocketEvent({
    type: 'JOB_STATUS',
    printerId: null,
    audienceUserId: '7',
    data: { jobId: 'job-1', currentJobId: null, status: 'COMPLETED' }
  })
  publishMockWebSocketEvent({ type: 'PRINTER_STATUS', printerId: '403', data: { status: 'IDLE' } })

  const ownerJob = owner.find(event => event.type === 'JOB_STATUS')
  const adminJob = admin.find(event => event.type === 'JOB_STATUS')
  assert.equal(ownerJob.eventId, adminJob.eventId)
  assert.equal(ownerJob.sequence, 2)
  assert.equal(adminJob.sequence, 2)
  assert.equal(ownerJob.data.currentJobId, null)
  assert.equal(ownerJob.printerId, null)
  assert.equal(Object.prototype.hasOwnProperty.call(ownerJob, 'audienceUserId'), false)
  assert.equal(other.some(event => event.type === 'JOB_STATUS'), false)
  assert.equal(other.at(-1).type, 'PRINTER_STATUS')
  assert.equal(other.at(-1).sequence, 2)
  ownerStream.close()
  otherStream.close()
  adminStream.close()
})
