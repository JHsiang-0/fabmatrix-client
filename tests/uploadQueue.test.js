import assert from 'node:assert/strict'
import test from 'node:test'
import { chunkItems, chunkItemsByBytes, runUploadQueue } from '../src/utils/uploadQueue.js'

test('上传队列按批次切分并限制并发数', async () => {
  assert.deepEqual(chunkItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])

  let active = 0
  let maxActive = 0
  const results = await runUploadQueue([1, 2, 3, 4, 5], async item => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await Promise.resolve()
    active -= 1
    return item * 2
  }, { concurrency: 2 })

  assert.equal(maxActive, 2)
  assert.deepEqual(results.map(result => result.value), [2, 4, 6, 8, 10])
})

test('上传队列按单请求总字节数分组而不是固定文件数', () => {
  const chunks = chunkItemsByBytes([
    { name: 'a', size: 700 },
    { name: 'b', size: 300 },
    { name: 'c', size: 800 },
    { name: 'd', size: 200 }
  ], 1000)

  assert.deepEqual(chunks.map(chunk => chunk.map(file => file.name)), [['a', 'b'], ['c', 'd']])
  assert.deepEqual(chunks.map(chunk => chunk.reduce((total, file) => total + file.size, 0)), [1000, 1000])
})

test('上传队列保留单项失败并支持取消', async () => {
  const results = await runUploadQueue(['ok', 'failed'], async item => {
    if (item === 'failed') throw new Error('服务不可用')
    return item
  })
  assert.equal(results[0].status, 'fulfilled')
  assert.equal(results[1].status, 'rejected')
  assert.equal(results[1].reason.message, '服务不可用')

  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    runUploadQueue(['cancelled'], async () => 'unreachable', { signal: controller.signal }),
    error => error.name === 'AbortError'
  )
})
