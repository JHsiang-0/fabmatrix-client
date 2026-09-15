import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDateTime, formatTime } from '../src/utils/formatters.js'

test('空日期时间显示占位符而不是 Unix 纪元时间', () => {
  for (const value of [null, undefined, '', '   ']) {
    assert.equal(formatDateTime(value), '-')
    assert.equal(formatTime(value), '-')
  }
})

test('有效的后端 LocalDateTime 继续按 Asia/Shanghai 展示', () => {
  assert.equal(formatDateTime('2026-09-15T12:34:56'), '2026-09-15 12:34:56')
  assert.equal(formatTime('2026-09-15T12:34:56'), '12:34:56')
})
