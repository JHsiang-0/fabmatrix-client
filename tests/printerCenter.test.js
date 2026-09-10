import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/views/PrinterManage.vue', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('../src/components/device/DeviceDetailDrawer.vue', import.meta.url), 'utf8')
const tableAdapterSource = fs.readFileSync(new URL('../src/components/TdTable.vue', import.meta.url), 'utf8')

test('打印机中心使用正式名称和状态筛选契约', () => {
  assert.match(source, /v-model="keyword"/)
  assert.match(source, /name: keyword\.value\.trim\(\)/)
  assert.match(source, /Object\.values\(PRINTER_STATUS\)/)
  assert.doesNotMatch(source, /statusFilterConfig = \{[\s\S]*ATTENTION/)
  assert.match(source, /status: activeStatusFilterKey\.value/)
})

test('打印机中心覆盖未分配设备、详情分析和正式控制入口', () => {
  assert.match(source, /getUnallocatedPrinters/)
  assert.match(source, /未分配设备抽屉/)
  assert.match(source, /getPrinterStatusHistory/)
  assert.match(source, /getPrinterStatistics/)
  assert.match(source, /<DeviceDetailDrawer/)
  assert.match(detailSource, /handleAction\('pause'\)/)
  assert.match(detailSource, /handleAction\('resume'\)/)
  assert.match(detailSource, /handleAction\('cancel'\)/)
  assert.match(detailSource, /emergency-stop/)
  assert.match(detailSource, /confirmSafe/)
  assert.match(detailSource, /<t-empty v-else-if="detailError" type="fail"/)
  assert.doesNotMatch(detailSource, /<t-result/)
})

test('打印机删除显示关联任务风险并保留逐项执行状态', () => {
  assert.match(source, /getDeleteMessage/)
  assert.match(source, /deletingIds\.includes\(scope\.row\.id\)/)
  assert.match(source, /删除可能被服务端拒绝/)
})

test('打印机列表使用局部滚动和显式详情入口，不再以绝对定位裁剪内容', () => {
  assert.match(source, /height="100%"/)
  assert.doesNotMatch(source, /calc\(100vh - 320px\)/)
  assert.match(source, /@click\.stop="handleRowClick\(scope\.row\)"/)
  assert.doesNotMatch(source, /printer-manage-card__table[\s\S]*position: absolute/)
  assert.match(source, /printer-manage-card__table[\s\S]*overflow: hidden/)
  assert.match(source, /<t-alert v-if="loadError && tableData\.length"/)
})

test('打印机中心视觉适配保留紧凑筛选、表格反馈和响应式分页', () => {
  assert.match(source, /class="[^"]*printer-manage-page[^"]*"/)
  assert.match(source, /class="printer-management-toolbar-card"/)
  assert.match(source, /<t-radio-group[\s\S]*class="printer-management-tabs"/)
  assert.match(source, /const printerStatusTabs = \[\{ value: '', label: '全部' \}/)
  assert.match(source, /class="printer-management-table printer-table"[\s\S]*hover/)
  assert.match(source, /printer-management-status-card/)
  assert.match(source, /printer-management-ellipsis/)
  assert.match(source, /printer-management-table-footer/)
  assert.match(source, /\.printer-management-table :deep\(\.t-table__body tr:hover > td\)/)
  assert.match(source, /@media \(max-width: 768px\)/)
})

test('打印机详情抽屉标题有稳定回退且详情内容由 Drawer Body 滚动', () => {
  assert.match(detailSource, /return deviceName \? `\$\{deviceName\} - 详细信息` : '打印机详情'/)
  assert.match(detailSource, /v-model:visible="drawerVisible"/)
  assert.match(detailSource, /aria-label="关闭打印机详情"/)
  assert.match(detailSource, /formatDateTime/)
  assert.match(detailSource, /class="printer-detail-drawer__content/)
  assert.match(detailSource, /\.printer-detail-drawer :deep\(\.t-drawer__body\)[\s\S]*overflow-y: auto/)
  assert.doesNotMatch(detailSource, /undefined - 详细信息/)
})

test('表格适配层保持自然高度并把横向滚动交给 TDesign Table 内容区', () => {
  assert.match(tableAdapterSource, /class="td-table-adapter" :class="attrs\.class" :style="attrs\.style"/)
  assert.match(tableAdapterSource, /\.td-table-adapter[\s\S]*display: block/)
  assert.match(tableAdapterSource, /\.td-table-adapter[\s\S]*overflow: visible/)
  assert.match(tableAdapterSource, /\.td-table-adapter :deep\(\.t-table__content\)[\s\S]*overflow-x: auto/)
})
