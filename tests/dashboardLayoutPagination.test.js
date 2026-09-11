import assert from 'node:assert/strict'
import test from 'node:test'
import { collectAllPages } from '../src/utils/pagination.js'

test('聚合全部打印机分页，超过100台时请求后续页', async () => {
  const calls = []
  const pages = new Map([
    [2, { data: { pageNum: 2, pageSize: 100, pages: 2, total: 101, records: [{ id: 101 }] } }]
  ])
  const first = { data: { pageNum: 1, pageSize: 100, pages: 2, total: 101, records: Array.from({ length: 100 }, (_, id) => ({ id })) } }
  const records = await collectAllPages(async (pageNum, pageSize) => {
    calls.push([pageNum, pageSize])
    return pages.get(pageNum)
  }, first)
  assert.deepEqual(calls, [[2, 100]])
  assert.equal(records.length, 101)
})
