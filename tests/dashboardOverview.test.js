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
  assert.match(dashboardSource, /stat-card--primary/)
  assert.match(dashboardSource, /status-donut/)
  assert.match(dashboardSource, /bottom-grid/)
  assert.match(dashboardSource, /activeJobs\.length/)
  assert.match(dashboardSource, /暂无设备数据/)
  assert.doesNotMatch(dashboardSource, /Math\.random\(/)
})

test('设备状态卡片区分接口错误与暂无设备空态', () => {
  assert.match(dashboardSource, /printerLoadError/)
  assert.match(dashboardSource, /status-state--error/)
  assert.match(dashboardSource, /重新加载/)
  assert.match(dashboardSource, /status-state--empty/)
  assert.match(dashboardSource, /设备状态暂不可用，请检查后端服务或数据库结构/)
  assert.match(dashboardSource, /\.dashboard-grid\s*\{[\s\S]*align-items: start/)
})

test('总览页面填充父级可用内容区域', () => {
  assert.match(dashboardSource, /\.dashboard-page\s*\{[\s\S]*display: flex/)
  assert.match(dashboardSource, /\.dashboard-page\s*\{[\s\S]*flex: 1 1 auto/)
  assert.match(dashboardSource, /\.dashboard-page\s*\{[\s\S]*min-height: 100%/)
})

test('美化总览复用 Electron 的状态归一化和任务状态标签', () => {
  assert.match(dashboardSource, /normalizePrinterStatus/)
  assert.match(dashboardSource, /statusOverviewSegments/)
  assert.match(dashboardSource, /getJobStatusLabel/)
  assert.match(dashboardSource, /getJobStatusType/)
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

test('近七日趋势时间范围保持紧凑单行显示', () => {
  assert.match(detailsPanelSource, /\.dashboard-trend-range[\s\S]*font-size: 11px/)
  assert.match(detailsPanelSource, /\.dashboard-trend-range[\s\S]*line-height: 16px/)
  assert.match(detailsPanelSource, /\.dashboard-trend-range[\s\S]*white-space: nowrap/)
  assert.match(detailsPanelSource, /\.dashboard-trend-range[\s\S]*text-overflow: ellipsis/)
})

test('近七日趋势柱状图保持紧凑高度', () => {
  assert.match(detailsPanelSource, /\.dashboard-trend-day__track[\s\S]*height: 46px/)
})

test('实时告警中的重连按钮与提示文字保持同排右对齐', () => {
  assert.match(farmDashboardSource, /class="dashboard-realtime-alert"/)
  assert.match(farmDashboardSource, /<template #default>\s*<span class="dashboard-alert__message">\{\{ realtimeNotice \}\}/)
  assert.match(farmDashboardSource, /dashboard-realtime-alert :deep\(\.t-alert__message\)/)
  assert.match(farmDashboardSource, /dashboard-realtime-alert :deep\(\.t-alert__operation\)/)
})

test('全屏看板退出按钮使用醒目的 TDesign 主按钮', () => {
  assert.match(fullscreenSource, /<t-button theme="primary" variant="base" size="small"[^>]*>/)
  assert.match(fullscreenSource, /退出全屏/)
})
