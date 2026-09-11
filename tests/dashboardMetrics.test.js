import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { buildFarmDateRange, buildSevenDayJobTrend, buildStatusSummary, formatFarmLocalDateTime } from '../src/utils/dashboardMetrics.js'
import { fetchAllPageRecords } from '../src/utils/jobPagination.js'

test('状态看板区分离线未知并计算状态占比', () => {
  const summary = buildStatusSummary({ PRINTING: 2, UNKNOWN: 1 })
  assert.equal(summary.total, 3)
  assert.equal(summary.items.find(item => item.key === 'PRINTING').percent, 67)
  assert.equal(summary.items.find(item => item.key === 'UNKNOWN').label, '离线/未知')
})

test('历史趋势只统计最近七天且使用真实任务时间字段', () => {
  const trend = buildSevenDayJobTrend([
    { id: 1, completedAt: '2026-09-05T10:00:00Z' },
    { id: 2, createdAt: '2026-09-01T10:00:00Z' },
    { id: 3, createdAt: '2026-08-20T10:00:00Z' }
  ], '2026-09-05T12:00:00Z')
  assert.equal(trend.length, 7)
  assert.equal(trend.at(-1).count, 1)
  assert.equal(trend.reduce((sum, item) => sum + item.count, 0), 2)
})

test('历史趋势按 Asia/Shanghai 日历分桶，不受浏览器本地时区或 UTC 日界影响', () => {
  const trend = buildSevenDayJobTrend([
    { id: 1, completedAt: '2026-09-11T00:30:00' },
    { id: 2, completedAt: '2026-09-11T07:59:59' },
    { id: 3, completedAt: '2026-09-10T16:30:00Z' },
    { id: 4, completedAt: '2026-09-10T15:59:59Z' }
  ], '2026-09-10T16:30:00Z')

  assert.equal(trend.at(-1).key, '2026-09-11')
  assert.equal(trend.at(-1).count, 3)
  assert.equal(trend.at(-2).key, '2026-09-10')
  assert.equal(trend.at(-2).count, 1)
})

test('无偏移 local datetime 直接读取上海字段并支持空格/T与1至9位小数秒', () => {
  const trend = buildSevenDayJobTrend([
    { completedAt: '2026-09-11 00:30:00.1' },
    { completedAt: '2026-09-11T07:59:59.123456789' }
  ], '2026-09-11T12:00:00.999999999')

  assert.equal(formatFarmLocalDateTime('2026-09-11 00:30:00.123456789'), '2026-09-11T00:30:00')
  assert.equal(trend.at(-1).count, 2)
})

test('非上海浏览器时区也不改变无偏移 local datetime 的日历字段', () => {
  const moduleUrl = new URL('../src/utils/dashboardMetrics.js', import.meta.url).href
  const script = `import { buildSevenDayJobTrend } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(buildSevenDayJobTrend([{ completedAt: '2026-09-11 00:30:00.123' }], '2026-09-11 12:00:00.999')))`
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    encoding: 'utf8',
    env: { ...process.env, TZ: 'America/Los_Angeles' }
  })
  const trend = JSON.parse(output)
  assert.equal(trend.at(-1).key, '2026-09-11')
  assert.equal(trend.at(-1).count, 1)
})

test('Dashboard 查询区间按 Asia/Shanghai 生成 local datetime，不依赖浏览器时区', () => {
  const reference = new Date('2026-09-10T16:30:45Z')
  assert.equal(formatFarmLocalDateTime(reference), '2026-09-11T00:30:45')
  assert.deepEqual(buildFarmDateRange(reference), {
    startTime: '2026-09-05T00:30:45',
    endTime: '2026-09-11T00:30:45'
  })
})

test('历史趋势受控分页拉取全部终态结果并聚合跨页同日数据', async () => {
  const calls = []
  const pageRecords = [
    Array.from({ length: 100 }, (_, id) => ({ id, completedAt: '2026-09-10T12:00:00' })),
    Array.from({ length: 100 }, (_, id) => ({ id: id + 100, completedAt: '2026-09-10T13:00:00' })),
    Array.from({ length: 5 }, (_, id) => ({ id: id + 200, completedAt: '2026-09-11T00:30:00' }))
  ]
  const records = await fetchAllPageRecords(async params => {
    calls.push(params.pageNum)
    return {
      data: { records: pageRecords[params.pageNum - 1], total: 205, pageNum: params.pageNum, pageSize: 100, pages: 3 }
    }
  }, {
    pageNum: 1,
    pageSize: 100,
    statuses: ['COMPLETED', 'FAILED', 'CANCELLED'],
    timeField: 'COMPLETED_AT'
  })

  assert.deepEqual(calls, [1, 2, 3])
  assert.equal(records.length, 205)
  const trend = buildSevenDayJobTrend(records, '2026-09-11T00:30:00')
  assert.equal(trend.at(-1).count, 5)
  assert.equal(trend.at(-2).count, 200)
})

test('历史趋势分页遇到异常 total/pages 时只保守保留首请求', async () => {
  const calls = []
  const records = await fetchAllPageRecords(async params => {
    calls.push(params.pageNum)
    return { data: { records: [{ id: 1 }], total: Infinity, pages: Infinity } }
  }, { pageNum: 1, pageSize: 100 })

  assert.deepEqual(calls, [1])
  assert.equal(records.length, 1)
})

test('历史趋势分页超过1000页上限时显式失败而不静默截断', async () => {
  let calls = 0
  await assert.rejects(
    () => fetchAllPageRecords(async () => {
      calls += 1
      return { data: { records: [], total: 100001, pageSize: 100, pages: 1001 } }
    }, { pageSize: 100 }),
    /超过 1000 页上限/
  )
  assert.equal(calls, 1)
})
