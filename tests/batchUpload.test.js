import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getUploadFailureState,
  isBatchUploadSuccess,
  normalizeBatchUploadResult,
  validateBatchUploadSelection
} from '../src/utils/batchUpload.js'

test('validates batch upload count, type, duplicate names, and per-file size', () => {
  const result = validateBatchUploadSelection([
    { name: 'valid.gcode', size: 10 },
    { name: 'duplicate.gcode', size: 10 },
    { name: 'invalid.txt', size: 10 }
  ], ['duplicate.gcode'])

  assert.deepEqual(result.files.map(file => file.name), ['valid.gcode'])
  assert.deepEqual(result.rejected.map(item => item.reason), [
    '当前目录已存在同名文件',
    '文件类型不支持'
  ])

  const oversized = validateBatchUploadSelection([
    { name: 'large.gcode', size: 1024 * 1024 * 1024 + 1 }
  ])
  assert.deepEqual(oversized.files, [])
  assert.equal(oversized.rejected.at(-1).reason, '单个文件大小不能超过 1GB')

  const largeBatch = validateBatchUploadSelection([
    { name: 'first.gcode', size: 600 * 1024 * 1024 },
    { name: 'second.gcode', size: 600 * 1024 * 1024 }
  ])
  assert.equal(largeBatch.files.length, 2)
})

test('normalizes per-file results and keeps retryable failures distinct', () => {
  const result = normalizeBatchUploadResult({
    items: [
      { index: 0, fileId: '9001', fileName: 'ok.gcode', status: 'success' },
      { index: 1, fileName: 'retry.gcode', status: 'failed', errorCode: 503, retryable: true }
    ]
  })

  assert.equal(isBatchUploadSuccess(result.items[0]), true)
  assert.equal(isBatchUploadSuccess(result.items[1]), false)
  assert.equal(result.items[1].retryable, true)
  assert.equal(result.items[1].errorCode, 503)
})

test('normalizes the backend SUCCEEDED status as a successful upload', () => {
  const result = normalizeBatchUploadResult({
    items: [{ index: 0, fileId: '9002', fileName: 'real.gcode', status: 'SUCCEEDED' }]
  })

  assert.equal(result.items[0].status, 'SUCCESS')
  assert.equal(isBatchUploadSuccess(result.items[0]), true)
})

test('only retries known transient upload responses and marks unknown results for refresh', () => {
  for (const status of [408, 429, 500, 503]) {
    const failure = getUploadFailureState({ response: { status } })
    assert.equal(failure.retryable, true)
    assert.equal(failure.requiresRefresh, false)
  }

  for (const status of [400, 401, 403, 413]) {
    const failure = getUploadFailureState({ response: { status } })
    assert.equal(failure.retryable, false)
    assert.equal(failure.requiresRefresh, false)
  }

  const otherKnownFailure = getUploadFailureState({ response: { status: 404 } })
  assert.equal(otherKnownFailure.retryable, false)
  assert.equal(otherKnownFailure.requiresRefresh, false)

  const unknown = getUploadFailureState({ code: 'ECONNABORTED' })
  assert.equal(unknown.retryable, false)
  assert.equal(unknown.requiresRefresh, true)
  assert.match(unknown.message, /刷新.*确认/)
})
