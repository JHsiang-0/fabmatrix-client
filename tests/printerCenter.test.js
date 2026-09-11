import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { createLatestRequestGuard } from '../src/utils/latestRequestGuard.js'

const source = fs.readFileSync(new URL('../src/views/PrinterManage.vue', import.meta.url), 'utf8')
const printerApiSource = fs.readFileSync(new URL('../src/api/printer.js', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('../src/components/device/DeviceDetailDrawer.vue', import.meta.url), 'utf8')
const tableAdapterSource = fs.readFileSync(new URL('../src/components/TdTable.vue', import.meta.url), 'utf8')

test('打印机中心使用正式名称和状态筛选契约', () => {
  assert.match(source, /v-model="keyword"/)
  assert.match(source, /name: keyword\.value\.trim\(\)/)
  assert.match(source, /placeholder="搜索机器名称"/)
  assert.match(source, /@input="scheduleKeywordSearch"/)
  assert.match(source, /setTimeout\(\(\) => \{/)
  assert.match(source, /}, 300\)/)
  assert.match(source, /printerListRequestGuard\.invalidate\(\)/)
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
  assert.doesNotMatch(source, /<t-button[^>]*>\s*详情\s*<\/t-button>/)
  assert.match(source, /@click\.stop="handleEdit\(scope\.row\)"/)
  assert.match(source, /aria-label="删除打印机"[^>]*@click\.stop/)
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
  assert.doesNotMatch(source, /printer-management-status-card/)
  assert.match(source, /<StatusTag domain="printer" :status="scope\.row\.status" \/>/)
  assert.match(source, /printer-management-ellipsis/)
  assert.match(source, /printer-management-table-footer/)
  assert.match(source, /\.printer-management-table :deep\(\.t-table__body tr:hover > td\)/)
  assert.match(source, /@media \(max-width: 768px\)/)
})

test('UI-005 打印机管理压缩字段、固定首尾列并按条件显示批量监控', () => {
  assert.match(source, /v-if="isAdmin && selectedPrinterRows\.length > 0"/)
  assert.match(source, /:selected-row-keys="selectedPrinterIds"/)
  assert.match(source, /<TdTableColumn v-if="isAdmin" type="selection"[^>]*fixed="left"/)
  assert.match(source, /<TdTableColumn label="操作"[^>]*fixed="right"/)
  assert.doesNotMatch(source, /<TdTableColumn prop="id" label="ID"/)
  assert.match(source, /scope\.row\.machineNumber \|\| '-'/)
  assert.doesNotMatch(source, /printer-management-muted">#\{\{ scope\.row\.id \}\}/)
  assert.match(source, /height: 46px/)
  assert.match(source, /table-content-width="1180px"/)
  assert.match(tableAdapterSource, /\{ selectedRowKeys: props\.selectedRowKeys \}/)
  assert.match(tableAdapterSource, /\{ tableContentWidth: props\.tableContentWidth \}/)
})

test('UI-005 协议选择、扫描默认网段和扫描结果限高使用 TDesign 语义', () => {
  assert.match(source, /<t-radio-group v-model="form\.firmwareType" variant="default-filled" size="medium"/)
  assert.match(source, /<t-radio-button value="RRF">RRF<\/t-radio-button>/)
  assert.match(source, /<t-radio-button value="KLIPPER">Klipper<\/t-radio-button>/)
  assert.match(source, /const subnet = ref\('192\.168\.0'\)/)
  assert.match(source, /placeholder="例：192\.168\.0"/)
  assert.match(source, /<div class="printer-scan-results__table">/)
  assert.match(source, /class="printer-scan-dialog"/)
  assert.match(source, /const scanColumns = \[/)
  assert.match(source, /colKey: 'firmwareType', title: '协议'/)
  assert.match(source, /max-height: min\(360px, calc\(100vh - 180px\)\)/)
  assert.match(source, /height: clamp\(140px, calc\(100vh - 370px\), 240px\)/)
  assert.match(source, /max-height: 240px/)
})

test('UI-005 未分配设备按 envelope data 数组稳健解包并保留关闭入口', () => {
  assert.match(source, /const data = response\?\.data \?\? response/)
  assert.match(source, /unallocatedPrinters\.value = Array\.isArray\(data\) \? data : \[\]/)
  assert.match(source, /<t-drawer v-model:visible="unallocatedDialogVisible"[\s\S]*:close-btn="true"/)
  assert.match(source, /@close="unallocatedDialogVisible = false"/)
  const unallocatedColumnsSource = source.split('const unallocatedColumns = [')[1].split(']')[0]
  assert.doesNotMatch(unallocatedColumnsSource, /firmwareType|协议/)
})

test('UI-005 扫描 API 使用独立超时且不改变全局请求配置', () => {
  assert.match(printerApiSource, /export function scanPrinters\(subnet, options = \{\}\)/)
  assert.match(printerApiSource, /timeout: 30_000/)
  assert.match(printerApiSource, /data => Array\.isArray\(data\) \? data : \[\]/)
  assert.match(printerApiSource, /export function getUnallocatedPrinters\(\)/)
  assert.match(printerApiSource, /const records = Array\.isArray\(data\) \? data : data\?\.records/)
  assert.match(source, /\['suggestedName', 'isNewDevice', 'firmwareType', 'apiKey'\]/)
  assert.match(source, /if \(device\[field\] !== undefined && device\[field\] !== null\) payload\[field\] = device\[field\]/)
})

test('打印机详情抽屉标题有稳定回退且详情内容由 Drawer Body 滚动', () => {
  assert.match(detailSource, /return deviceName \? `\$\{deviceName\} - 详细信息` : '打印机详情'/)
  assert.match(detailSource, /v-model:visible="drawerVisible"/)
  assert.match(detailSource, /aria-label="关闭打印机详情"/)
  assert.match(detailSource, /formatDateTime/)
  assert.match(detailSource, /class="printer-detail-drawer__content/)
  assert.match(detailSource, /\.printer-detail-drawer :deep\(\.t-drawer__body\)[\s\S]*overflow-y: auto/)
  assert.doesNotMatch(detailSource, /undefined - 详细信息/)
  assert.match(detailSource, /device\.machineNumber \|\| '-'/)
  assert.doesNotMatch(detailSource, /device\.machineNumber \|\| `#\$\{device\.id\}`/)
})

test('表格适配层保持自然高度并把横向滚动交给 TDesign Table 内容区', () => {
  assert.match(tableAdapterSource, /class="td-table-adapter" :class="attrs\.class" :style="attrs\.style"/)
  assert.match(tableAdapterSource, /\.td-table-adapter[\s\S]*display: block/)
  assert.match(tableAdapterSource, /\.td-table-adapter[\s\S]*overflow: visible/)
  assert.match(tableAdapterSource, /\.td-table-adapter :deep\(\.t-table__content\)[\s\S]*overflow-x: auto/)
})

test('UI-005 最新列表请求守卫只允许最后一次响应提交并控制 loading', async () => {
  const guard = createLatestRequestGuard()
  const deferred = () => {
    let resolve
    const promise = new Promise(resolvePromise => {
      resolve = resolvePromise
    })
    return { promise, resolve }
  }
  const first = deferred()
  const second = deferred()
  let result = null
  let loading = false

  const run = async pending => {
    const requestId = guard.begin()
    loading = true
    try {
      const value = await pending
      if (guard.isCurrent(requestId)) result = value
    } finally {
      if (guard.isCurrent(requestId)) loading = false
    }
  }

  const firstRun = run(first.promise)
  const secondRun = run(second.promise)
  first.resolve('旧搜索结果')
  await firstRun
  assert.equal(result, null)
  assert.equal(loading, true)

  second.resolve('最新搜索结果')
  await secondRun
  assert.equal(result, '最新搜索结果')
  assert.equal(loading, false)

  const afterUnmount = deferred()
  const unmountedRun = run(afterUnmount.promise)
  guard.invalidate()
  afterUnmount.resolve('卸载后的结果')
  await unmountedRun
  assert.equal(result, '最新搜索结果')
  assert.equal(guard.begin(), null)
})
