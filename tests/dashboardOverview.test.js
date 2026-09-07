import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const dashboardSource = fs.readFileSync(new URL('../src/views/Dashboard.vue', import.meta.url), 'utf8')
const farmDashboardSource = fs.readFileSync(new URL('../src/components/FarmDashboard.vue', import.meta.url), 'utf8')
const fullscreenSource = fs.readFileSync(new URL('../src/views/FullscreenDashboard.vue', import.meta.url), 'utf8')
const deviceStoreSource = fs.readFileSync(new URL('../src/stores/printer/deviceStore.js', import.meta.url), 'utf8')
const gridStoreSource = fs.readFileSync(new URL('../src/stores/printer/gridStore.js', import.meta.url), 'utf8')
const detailsPanelSource = fs.readFileSync(new URL('../src/components/DashboardDetailsPanel.vue', import.meta.url), 'utf8')

test('工作台只使用真实设备和任务契约并覆盖核心统计', () => {
  assert.match(dashboardSource, /getPrinterList\(\{ pageNum: 1, pageSize: 100 \}\)/)
  assert.match(dashboardSource, /jobStore\.refresh\(\)/)
  assert.match(dashboardSource, /getJobPage\(\{ pageNum: 1, pageSize: 100, status: 'FAILED' \}\)/)
  assert.match(dashboardSource, /status: 'COMPLETED'/)
  assert.match(dashboardSource, /status: 'CANCELLED'/)
  assert.match(dashboardSource, /近 7 日任务趋势/)
  assert.match(dashboardSource, /活动任务进度/)
  assert.match(dashboardSource, /暂无打印机设备/)
  assert.doesNotMatch(dashboardSource, /Math\.random\(/)
})

test('工作台不把缺失任务进度伪造成零值', () => {
  assert.match(dashboardSource, /进度未上报/)
  assert.match(dashboardSource, /v-if="hasProgress\(job\)"/)
})

test('全屏看板覆盖快照恢复、实时断线、全屏能力和缩放场景', () => {
  assert.match(fullscreenSource, /snapshotLoading/)
  assert.match(fullscreenSource, /snapshotError/)
  assert.match(fullscreenSource, /noDevices/)
  assert.match(fullscreenSource, /realtimeNotice/)
  assert.match(fullscreenSource, /retrySnapshot/)
  assert.match(fullscreenSource, /fullscreenSupported/)
  assert.match(fullscreenSource, /event\.key === 'Escape'/)
  assert.match(fullscreenSource, /addEventListener\('resize'/)
})

test('设备 Store 暴露真实快照错误供全屏页原位重试', () => {
  assert.match(deviceStoreSource, /const error = ref\(null\)/)
  assert.match(deviceStoreSource, /error\.value = requestError/)
})

test('WebSocket 断开时看板使用 REST 设备快照统计并保留未布局设备', () => {
  assert.match(gridStoreSource, /useDeviceStore/)
  assert.match(gridStoreSource, /deviceStore\.rawDeviceList\.forEach/)
  assert.match(gridStoreSource, /realtimeStatusMap\.get\(String\(device\.id\)\)/)
  assert.match(deviceStoreSource, /rawDeviceList\.value = records/)
  assert.match(deviceStoreSource, /typeof device\.gridRow !== 'number'/)
})

test('看板信息卡片不使用固定高度裁剪内容', () => {
  assert.match(detailsPanelSource, /min-height: 152px/)
  assert.match(detailsPanelSource, /height: auto/)
  assert.match(detailsPanelSource, /overflow: visible/)
  assert.match(detailsPanelSource, /flex: 1 1 auto/)
})

test('实时告警中的重连按钮与提示文字保持同排右对齐', () => {
  assert.match(farmDashboardSource, /class="dashboard-realtime-alert"/)
  assert.match(farmDashboardSource, /<template #default>\s*<span class="dashboard-alert__message">\{\{ realtimeNotice \}\}/)
  assert.match(farmDashboardSource, /dashboard-realtime-alert :deep\(\.t-alert__message\)/)
  assert.match(farmDashboardSource, /dashboard-realtime-alert :deep\(\.t-alert__operation\)/)
})
