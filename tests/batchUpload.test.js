import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isBatchUploadSuccess,
  normalizeBatchUploadResult,
  validateBatchUploadSelection
} from '../src/utils/batchUpload.js'

test('validates batch upload count, type, duplicate names, and total size', () => {
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
    { name: 'large.gcode', size: 250 * 1024 * 1024 + 1 }
  ])
  assert.deepEqual(oversized.files, [])
  assert.equal(oversized.rejected.at(-1).reason, '批量文件总大小不能超过 250MB')
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
