import assert from 'node:assert/strict'
import test from 'node:test'
import { compactStatusHistory } from '../src/utils/statusHistory.js'

test('连续相同状态和文件合并为一个可读状态段', () => {
  const result = compactStatusHistory([
    { id: 3, status: 'PRINTING', rawState: 'processing', filename: 'demo.gcode', progress: 12, recordedAt: '2026-09-15 10:02:00' },
    { id: 2, status: 'PRINTING', rawState: 'processing', filename: 'demo.gcode', progress: 10, recordedAt: '2026-09-15 10:01:00' },
    { id: 1, status: 'IDLE', rawState: 'idle', filename: 'demo.gcode', progress: 10, recordedAt: '2026-09-15 10:00:00' }
  ])

  assert.equal(result.length, 2)
  assert.equal(result[0].sampleCount, 2)
  assert.equal(result[0].earliestProgress, 10)
  assert.equal(result[0].latestProgress, 12)
  assert.equal(result[0].earliestRecordedAt, '2026-09-15 10:01:00')
  assert.equal(result[0].latestRecordedAt, '2026-09-15 10:02:00')
})

test('文件或错误信息变化时保留独立历史节点', () => {
  const result = compactStatusHistory([
    { id: 3, status: 'PRINTING', filename: 'second.gcode', systemMessage: '', recordedAt: '3' },
    { id: 2, status: 'PRINTING', filename: 'first.gcode', systemMessage: 'warning', recordedAt: '2' },
    { id: 1, status: 'PRINTING', filename: 'first.gcode', systemMessage: '', recordedAt: '1' }
  ])

  assert.equal(result.length, 3)
})
