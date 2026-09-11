import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/components/FarmDashboard.vue', import.meta.url), 'utf8')
const requestSource = fs.readFileSync(new URL('../src/utils/request.js', import.meta.url), 'utf8')

test('ADMIN 布局编辑使用草稿，保存才提交布局资源', () => {
  assert.match(source, /store\.beginLayoutEdit\(\)/)
  assert.match(source, /recordPositionChange\(deviceId, targetSlot\.value\.row, targetSlot\.value\.col\)/)
  assert.match(source, /await store\.saveLayoutDraft\(positionChanges\.value, overflowPolicy\.value, saveOwner\)/)
  assert.doesNotMatch(source, /await store\.updateDevicePositions\(/)
  assert.doesNotMatch(source, /machineNumber: targetSlotLabel\.value/)
})

test('行列使用单一表单源点击增减，应用时一次写回布局草稿', () => {
  assert.match(source, /@click="openLayoutSettings"/)
  assert.match(source, /adjustLayoutDimension\('rowCount', -1\)/)
  assert.match(source, /adjustLayoutDimension\('columnCount', 1\)/)
  assert.match(source, /store\.updateLayoutDraft\(\{ rowCount, columnCount \}\)/)
  assert.match(source, /const limits = layoutLimits\.value/)
  assert.match(source, /const layout = store\.layoutDraft \|\| store\.layoutSnapshot \|\| layoutForm\.value/)
  assert.match(source, /v-model:visible="layoutDialogVisible"/)
})

test('缩容前先校验同轴过道，越界时只提示移动或删除且不写入草稿', () => {
  assert.match(source, /const invalidAisles = \(store\.layoutDraft\?\.aisles \|\| \[\]\)\.filter/)
  const adjustBody = source.slice(source.indexOf('function adjustLayoutDimension'), source.indexOf('function openAisleDialog'))
  assert.doesNotMatch(adjustBody, /store\.updateLayoutDraft/)
  assert.match(source, /if \(invalidAisles\.length\) \{[\s\S]*message\.error[\s\S]*return\n {2}\}/)
})

test('编辑工作流覆盖取消确认、缩容下架确认、冲突提示和刷新保护', () => {
  assert.match(source, /取消布局编辑/)
  assert.match(source, /UNALLOCATE/)
  assert.match(source, /error\?\.status \|\| error\?\.code\) === 409/)
  assert.match(source, /error\?\.status \|\| error\?\.code\) === 422/)
  assert.match(source, /beforeunload/)
  assert.match(source, /onBeforeUnmount\(/)
})

test('未保存草稿在路由离开时确认，保存中一般导航阻断但认证退出优先', () => {
  assert.match(source, /import \{ onBeforeRouteLeave, useRouter \} from 'vue-router'/)
  assert.match(source, /guardDashboardRouteLeave/)
  assert.match(source, /const hasUnsavedLayoutChanges = computed/)
  assert.match(source, /isSaving: \(\) => ownedLayoutSaving\.value/)
  assert.match(source, /onBeforeRouteLeave\(to => guardDashboardRouteLeave\(\{[\s\S]*to,[\s\S]*isAuthenticated: \(\) => userStore\.isAuthenticated/)
  assert.match(source, /保存中请稍候/)
  assert.match(source, /放弃并离开/)
  assert.match(source, /watch\(canManageLayout,[\s\S]*if \(ownedLayoutSaving\.value\) cleanupAfterSave = true/)
  assert.match(source, /if \(ownedLayoutSaving\.value\) cleanupAfterSave = true[\s\S]*else clearLayoutEditingState\(\)/)
  assert.match(source, /componentUnmounted = true/)
  assert.match(source, /if \(componentUnmounted \|\| !userStore\.isAuthenticated \|\| !canManageLayout\.value\) return/)
  assert.match(source, /finally \{[\s\S]*store\.discardLayoutEdit\(saveOwner\)[\s\S]*cleanupAfterSave = false/)
  assert.match(source, /store\.discardLayoutEdit\(layoutEditOwner\.value\)/)
})

test('401 先清除认证再触发登录导航，使看板守卫进入认证退出分支', () => {
  const unauthorizedBranch = requestSource.slice(
    requestSource.indexOf('const handleUnauthorized'),
    requestSource.indexOf('export const handleRequestError')
  )
  assert.ok(unauthorizedBranch.indexOf('userStore.logout()') < unauthorizedBranch.indexOf("router.push({ name: 'login' })"))
  assert.match(source, /isAuthenticated: \(\) => userStore\.isAuthenticated/)
})

test('手动刷新协调获取布局、设备和历史快照', () => {
  assert.match(source, /Promise\.all\(\[store\.refreshLayout\(\), fetchHistory\(\)\]\)/)
  assert.doesNotMatch(source, /Promise\.all\(\[store\.fetchDeviceData\(\), fetchHistory\(\)\]\)/)
})

test('坐标异常告警提供编辑态撤销和查看态重新加载回退动作', () => {
  assert.match(source, /撤销布局修改/)
  assert.match(source, /重新加载服务端数据/)
  assert.match(source, /class="dashboard-position-alert"/)
  assert.match(source, /dashboard-position-alert__actions/)
})
