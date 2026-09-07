import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const dashboardSource = fs.readFileSync(new URL('../src/views/Dashboard.vue', import.meta.url), 'utf8')
const fullscreenSource = fs.readFileSync(new URL('../src/views/FullscreenDashboard.vue', import.meta.url), 'utf8')
const deviceStoreSource = fs.readFileSync(new URL('../src/stores/printer/deviceStore.js', import.meta.url), 'utf8')
const appSource = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')

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

test('实时连接由应用根部按认证路由统一维护', () => {
  assert.match(appSource, /isProtectedRoute/)
  assert.match(appSource, /watch\(\s*\[isProtectedRoute, \(\) => userStore\.token\]/)
  assert.match(appSource, /realtimeStore\.connectWs\(\)/)
  assert.match(appSource, /realtimeStore\.disconnectWs\(\)/)
})
