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
  assert.match(gridSource, /await loadLayout\(\)[\s\S]*await deviceStore\.fetchDeviceData\(\)/)
  assert.match(gridSource, /watch\(\(\) => realtimeStore\.layoutVersion/)
  assert.match(gridSource, /watch\(\(\) => realtimeStore\.wsConnectionState/)
  assert.match(gridSource, /recoverAfterRealtimeReconnect/)
})
