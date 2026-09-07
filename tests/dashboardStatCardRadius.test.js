import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const dashboardSource = fs.readFileSync(new URL('../src/views/Dashboard.vue', import.meta.url), 'utf8')
const farmDashboardSource = fs.readFileSync(new URL('../src/components/FarmDashboard.vue', import.meta.url), 'utf8')

test('dashboard statistic cards use the defined application radius token', () => {
  assert.match(dashboardSource, /\.stat-card\s*\{[\s\S]*border-radius: var\(--app-radius\)/)
  assert.match(farmDashboardSource, /\.stat-card\s*\{[\s\S]*border-radius: var\(--app-radius\)/)
  assert.doesNotMatch(dashboardSource, /--app-radius-medium/)
  assert.doesNotMatch(farmDashboardSource, /--app-radius-medium/)
})
