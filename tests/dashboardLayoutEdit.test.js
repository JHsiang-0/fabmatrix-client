import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/components/FarmDashboard.vue', import.meta.url), 'utf8')

test('ADMIN 布局编辑使用草稿，保存才提交布局资源', () => {
  assert.match(source, /store\.beginLayoutEdit\(\)/)
  assert.match(source, /recordPositionChange\(deviceId, targetSlot\.value\.row, targetSlot\.value\.col\)/)
  assert.match(source, /await store\.saveLayoutDraft\(positionChanges\.value, overflowPolicy\.value\)/)
  assert.doesNotMatch(source, /await store\.updateDevicePositions\(/)
  assert.doesNotMatch(source, /machineNumber: targetSlotLabel\.value/)
})

test('行列使用布局设置弹窗的点击增减并即时写回布局草稿', () => {
  assert.match(source, /@click="openLayoutSettings"/)
  assert.match(source, /adjustLayoutDimension\('rowCount', -1\)/)
  assert.match(source, /adjustLayoutDimension\('columnCount', 1\)/)
  assert.match(source, /store\.updateLayoutDraft\(\{ rowCount, columnCount \}\)/)
  assert.match(source, /v-model:visible="layoutDialogVisible"/)
})

test('缩容前先校验同轴过道，越界时只提示移动或删除且不写入草稿', () => {
  assert.match(source, /const invalidAisles = \(store\.layoutDraft\.aisles \|\| \[\]\)\.filter/)
  assert.match(source, /请先移动或删除对应过道/)
  assert.match(source, /if \(invalidAisles\.length\) \{[\s\S]*message\.warning[\s\S]*return\n {2}\}/)
})

test('编辑工作流覆盖取消确认、缩容下架确认、冲突提示和刷新保护', () => {
  assert.match(source, /取消布局编辑/)
  assert.match(source, /UNALLOCATE/)
  assert.match(source, /error\?\.status \|\| error\?\.code\) === 409/)
  assert.match(source, /error\?\.status \|\| error\?\.code\) === 422/)
  assert.match(source, /beforeunload/)
  assert.match(source, /onBeforeUnmount\(/)
})

test('坐标异常告警提供编辑态撤销和查看态重新加载回退动作', () => {
  assert.match(source, /撤销布局修改/)
  assert.match(source, /重新加载服务端数据/)
  assert.match(source, /class="dashboard-position-alert"/)
  assert.match(source, /dashboard-position-alert__actions/)
})
