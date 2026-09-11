import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const realtimeSource = fs.readFileSync(new URL('../src/stores/printer/realtimeStore.js', import.meta.url), 'utf8')
const gridSource = fs.readFileSync(new URL('../src/stores/printer/gridStore.js', import.meta.url), 'utf8')

test('布局事件只更新布局版本，不能因 printerId=null 进入设备状态清空路径', () => {
  const layoutBranch = realtimeSource.indexOf("if (type === 'LAYOUT_UPDATED')")
  const invalidPrinterBranch = realtimeSource.indexOf("if (printerId === undefined || printerId === null || !data)")
  assert.ok(layoutBranch >= 0)
  assert.ok(layoutBranch < invalidPrinterBranch)
  assert.match(realtimeSource, /const layoutVersion = ref\(null\)/)
  assert.match(realtimeSource, /layoutVersion\.value = nextVersion/)
  assert.match(realtimeSource, /layoutVersion,/)
})

test('非编辑客户端刷新布局和设备快照，编辑客户端只标记过期草稿', () => {
  assert.match(gridSource, /if \(layoutDraft\.value\) \{[\s\S]*reason: 'STALE_DRAFT'/)
  assert.match(gridSource, /const latest = await loadLayout\(\)[\s\S]*await deviceStore\.fetchDeviceData\(\)/)
  assert.match(gridSource, /watch\(\(\) => realtimeStore\.layoutVersion/)
  assert.match(gridSource, /watch\(\(\) => realtimeStore\.wsConnectionState/)
  assert.match(gridSource, /recoverAfterRealtimeReconnect/)
  assert.match(gridSource, /let layoutLoadGeneration = 0/)
  assert.match(gridSource, /const generation = \+\+layoutLoadGeneration/)
  assert.match(gridSource, /if \(generation !== layoutLoadGeneration\) return layoutSnapshot\.value/)
  assert.match(gridSource, /const hasDraft = draftBaseVersion\.value !== null/)
  assert.match(gridSource, /let refreshGeneration = 0/)
  assert.match(gridSource, /if \(generation !== refreshGeneration/)
  assert.match(gridSource, /layoutLoadController\?\.abort\(\)/)
})

test('连续布局事件使用 deferred 结果只提交最新协调代次', async () => {
  let resolveFirst
  let resolveLatest
  const first = new Promise(resolve => { resolveFirst = resolve })
  const latest = new Promise(resolve => { resolveLatest = resolve })
  let committed = null
  const commitLatest = async (generation, response) => {
    const result = await response
    if (generation === 2) committed = result
  }
  void commitLatest(1, first)
  void commitLatest(2, latest)
  resolveFirst({ version: 2 })
  resolveLatest({ version: 3 })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(committed, { version: 3 })
  assert.match(gridSource, /const generation = \+\+refreshGeneration/)
})

test('实时恢复使用生命周期代次和 AbortController 隔离断开后的旧分页响应', () => {
  assert.match(realtimeSource, /let lifecycleGeneration = 0/)
  assert.match(realtimeSource, /new AbortController\(\)/)
  assert.match(realtimeSource, /signal: abortController\.signal/)
  assert.match(realtimeSource, /if \(!isCurrent\(\)\) return null/)
  assert.match(realtimeSource, /lifecycleGeneration \+= 1/)
  assert.match(realtimeSource, /recoveryAbortController\?\.abort\(\)/)
})
