import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const farmDashboardSource = fs.readFileSync(new URL('../src/components/FarmDashboard.vue', import.meta.url), 'utf8')

test('全屏看板使用打印机统计卡片替代旧详情卡片', () => {
  assert.doesNotMatch(farmDashboardSource, /DashboardDetailsPanel|dashboard-details-panel/)
  assert.match(farmDashboardSource, /class="stat-grid"/)
  assert.match(farmDashboardSource, /v-for="stat in statCards"/)
  assert.match(farmDashboardSource, /label: '打印机总数'/)
  assert.match(farmDashboardSource, /label: '正在打印'/)
  assert.match(farmDashboardSource, /label: '空闲打印机'/)
  assert.match(farmDashboardSource, /label: '异常设备'/)
})

test('全屏看板统计卡片复用实时状态并支持状态跳转', () => {
  assert.match(farmDashboardSource, /store\.statusCounts/)
  assert.match(farmDashboardSource, /PRINTER_STATE\.PRINTING/)
  assert.match(farmDashboardSource, /PRINTER_STATE\.STANDBY/)
  assert.match(farmDashboardSource, /PRINTER_STATE\.UNKNOWN/)
  assert.match(farmDashboardSource, /query: \{ status: PRINTER_STATUS\.PRINTING \}/)
  assert.match(farmDashboardSource, /query: \{ status: PRINTER_STATUS\.IDLE \}/)
  assert.match(farmDashboardSource, /@keydown\.enter\.prevent/)
  assert.match(farmDashboardSource, /@keydown\.space\.prevent/)
})

test('全屏看板统计卡片在窄屏下切换为单列', () => {
  assert.match(farmDashboardSource, /@media \(max-width: 1100px\)[\s\S]*\.stat-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)/)
  assert.match(farmDashboardSource, /@media \(max-width: 520px\)[\s\S]*\.stat-grid[\s\S]*grid-template-columns: 1fr/)
})
