import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const headerSource = fs.readFileSync(new URL('../src/components/DashboardHeader.vue', import.meta.url), 'utf8')
const farmDashboardSource = fs.readFileSync(new URL('../src/components/FarmDashboard.vue', import.meta.url), 'utf8')

test('看板头部使用指定品牌图标和标题', () => {
  assert.match(headerSource, /src="\/icon\.png"/)
  assert.match(headerSource, /嘉东__联动3D打印实时控制系统/)
  assert.doesNotMatch(headerSource, /PrintIcon/)
})

test('看板头部区域按钮支持 TDesign 下拉切换并向父级派发事件', () => {
  assert.match(headerSource, /<t-dropdown[\s\S]*:options="workshopOptions"[\s\S]*@click="handleWorkshopChange"/)
  assert.match(headerSource, /<t-button[\s\S]*aria-label="切换区域"/)
  assert.match(headerSource, /defineEmits\(\['refresh', 'workshop-change'\]\)/)
  assert.match(headerSource, /emit\('workshop-change', nextWorkshop\)/)
})

test('看板提供预置区域并在切换后更新当前区域和用户反馈', () => {
  assert.match(farmDashboardSource, /:workshop-options="workshopOptions"/)
  assert.match(farmDashboardSource, /@workshop-change="handleWorkshopChange"/)
  assert.match(farmDashboardSource, /3F-二号车间/)
  assert.match(farmDashboardSource, /workshopName\.value = nextWorkshop/)
  assert.match(farmDashboardSource, /message\.success\(`已切换至\$\{nextWorkshop\}`\)/)
})
