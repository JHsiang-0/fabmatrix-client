import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { createLatestRequestGuard } from '../src/utils/latestRequestGuard.js'

const source = fs.readFileSync(new URL('../src/views/PrinterManage.vue', import.meta.url), 'utf8')
const printerApiSource = fs.readFileSync(new URL('../src/api/printer.js', import.meta.url), 'utf8')
const discoverySource = fs.readFileSync(new URL('../src/utils/printerDiscovery.js', import.meta.url), 'utf8')
const dashboardSource = fs.readFileSync(new URL('../src/components/FarmDashboard.vue', import.meta.url), 'utf8')
const unallocatedSource = fs.readFileSync(new URL('../src/components/UnallocatedPrinterDrawer.vue', import.meta.url), 'utf8')
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

test('UI-006 打印机中心移除重复未分配入口，未分配设备迁移到看板', () => {
  assert.doesNotMatch(source, /getUnallocatedPrinters/)
  assert.doesNotMatch(source, /unallocatedDialogVisible|unallocatedPrinters|openUnallocatedDialog/)
  assert.doesNotMatch(source, /未分配设备/)
  assert.match(dashboardSource, /@click="openUnallocatedDrawer"/)
  assert.match(dashboardSource, /<unallocated-printer-drawer/)
  assert.match(unallocatedSource, /getUnallocatedPrinters/)
  assert.match(unallocatedSource, /unwrapPrinters/)
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
  assert.match(source, /<StatusTag domain="printer" :status="scope\.row\.effectiveStatus" \/>/)
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

test('打印机机器编号是独立自定义字段并支持管理员原位编辑', () => {
  assert.match(source, /v-if="isAdmin && editingMachineNumberId === scope\.row\.id"/)
  assert.match(source, /@click\.stop="startMachineNumberEdit\(scope\.row\)"/)
  assert.match(source, /const MACHINE_NUMBER_PATTERN = \/\^\[A-Za-z0-9_-\]\*\$\//)
  assert.match(source, /machineNumber: machineNumber \|\| null/)
  assert.match(source, /<t-form-item label="机器编号" name="machineNumber"/)
  assert.match(source, /仅支持字母、数字、下划线和短横线/)
  assert.doesNotMatch(dashboardSource, /machineNumber:\s*targetSlotLabel\.value/)
  assert.match(dashboardSource, /positionChanges/)
})

test('UI-006 扫描使用右侧 Drawer、纵向列表和独立发现状态', () => {
  assert.match(source, /<t-radio-group v-model="form\.firmwareType" variant="default-filled" size="medium"/)
  assert.match(source, /<t-radio-button value="RRF">RRF<\/t-radio-button>/)
  assert.match(source, /<t-radio-button value="KLIPPER">Klipper<\/t-radio-button>/)
  assert.match(source, /<t-drawer[\s\S]*class="printer-scan-drawer"[\s\S]*header="扫描局域网设备"/)
  assert.doesNotMatch(source, /class="printer-scan-dialog"|const scanColumns = \[/)
  assert.match(source, /printer-scan-drawer__list/)
  assert.match(source, /printer-scan-card__primary/)
  assert.match(source, /printer-scan-card__meta/)
  assert.match(source, /getDiscoveryStatus/)
  assert.match(source, /getDiscoveryStats/)
  assert.match(discoverySource, /UNKNOWN_MAC/)
  assert.match(source, /scanSelectionIndeterminate/)
  assert.match(source, /已选择 \{\{ selectedDevices\.length \}\} 台/)
  assert.match(source, /getFirmwareLabel\(device\.firmwareType\)/)
})

test('UI-007 扫描网段使用可访问的三段输入并把扫描按钮移出 suffix', () => {
  assert.match(source, /const subnetSegments = ref\(\['192', '168', '0'\]\)/)
  assert.match(source, /v-for="\(segment, index\) in subnetSegments"/)
  assert.match(source, /inputmode="numeric"/)
  assert.match(source, /maxlength="3"/)
  assert.match(source, /:aria-label="`网段第\$\{index \+ 1\}段`"/)
  assert.match(source, /class="printer-scan-subnet-separator" aria-hidden="true">\.<\/span>/)
  assert.match(source, /class="printer-scan-subnet-button"[\s\S]*@click="handleScan"/)
  assert.doesNotMatch(source, /#suffix/)
  assert.match(source, /const isValidSubnetSegment = segment =>/)
  assert.match(source, /0–255 的整数/)
  assert.match(source, /const subnet = `\$\{subnetSegments\.value\.join\('\.'\)\}`/)
  assert.match(source, /scanPrinters\(subnet\)/)
  assert.match(source, /const scanSubnetRangeLabel = computed\(\(\) => subnetIsValid\.value/)
  assert.match(source, /`范围 \$\{subnetSegments\.value\.join\('\.'\)\}\.1 – \$\{subnetSegments\.value\.join\('\.'\)\}\.254`/)
  assert.match(source, /isScanning\.value \|\| isBatchAdding\.value/)
})

test('UI-009 扫描网段标题、范围 Tag 和操作行分层布局', () => {
  assert.match(source, /class="printer-scan-subnet-heading"[\s\S]*class="printer-scan-subnet-title">扫描网段<\/span>[\s\S]*class="printer-scan-subnet-range"/)
  assert.match(source, /class="printer-scan-subnet-range"[\s\S]*size="small"[\s\S]*theme="default"[\s\S]*variant="light"/)
  assert.match(source, /:aria-label="scanSubnetRangeLabel"[\s\S]*:title="scanSubnetRangeLabel"/)
  assert.match(source, /范围待校验/)
  assert.match(source, /class="printer-scan-subnet-section"[\s\S]*flex-direction: column/)
  assert.match(source, /\.printer-scan-subnet-heading[\s\S]*align-items: center/)
  assert.match(source, /\.printer-scan-subnet-control[\s\S]*align-items: center[\s\S]*justify-content: flex-start/)
  assert.match(source, /\.printer-scan-subnet-button[\s\S]*margin-left: auto/)
  assert.match(source, /\.printer-scan-subnet-separator[\s\S]*flex: 0 0 12px[\s\S]*width: 12px[\s\S]*height: var\(--td-comp-size-m\)/)
  assert.match(source, /class="printer-scan-subnet-button"[\s\S]*size="medium"/)
  assert.match(source, /class="printer-scan-subnet-hint printer-scan-subnet-hint--error"[\s\S]*role="alert"[\s\S]*aria-live="polite"[\s\S]*\{\{ subnetValidationMessage \}\}/)
  assert.match(source, /\.printer-scan-subnet-hint[\s\S]*text-align: left/)
  assert.doesNotMatch(source, /scanSubnetHint/)
  assert.match(source, /@media \(max-width: 768px\)[\s\S]*\.printer-scan-subnet-button \{[\s\S]*flex: 0 0 auto;[\s\S]*width: auto;/)
})

test('UI-010 扫描抽屉移除表单 gutter 并让分割线和结果区承担布局', () => {
  assert.doesNotMatch(source, /<t-form class="printer-scan-drawer__form">/)
  assert.doesNotMatch(source, /<t-form-item class="printer-scan-subnet-form-item">/)
  assert.doesNotMatch(source, /printer-scan-subnet-form-item|printer-scan-drawer__form/)
  assert.match(source, /<t-divider class="printer-scan-drawer__divider"\s*\/>/)
  assert.match(source, /<div class="printer-scan-drawer__result-region">[\s\S]*v-if="isScanning"[\s\S]*v-else-if="scanError"[\s\S]*v-else-if="hasScanned && !scanResults\.length"[\s\S]*v-else-if="scanResults\.length"[\s\S]*v-else class="printer-scan-drawer__empty"/)
  assert.match(source, /\.printer-scan-drawer__result-region[\s\S]*flex: 1 1 auto;[\s\S]*min-height: 0;/)
  assert.match(source, /\.printer-scan-drawer__state[\s\S]*flex: 1 1 auto;[\s\S]*align-items: center[\s\S]*justify-content: center/)
  assert.match(source, /\.printer-scan-drawer__empty[\s\S]*flex: 1 1 auto;[\s\S]*align-items: center[\s\S]*justify-content: center/)
  assert.match(source, /<t-empty v-else class="printer-scan-drawer__empty" description="输入网段后开始扫描" \/>/)
  assert.match(source, /<t-empty v-else-if="hasScanned && !scanResults\.length" class="printer-scan-drawer__empty" description="该网段未发现设备">/)
})

test('UI-006 看板未分配 Drawer 覆盖角色、错误重试、关闭和设备字段', () => {
  assert.match(unallocatedSource, /header="未分配设备"/)
  assert.match(unallocatedSource, /:close-btn="true"/)
  assert.match(unallocatedSource, /正在加载未分配设备/)
  assert.match(unallocatedSource, /暂无未分配设备/)
  assert.match(unallocatedSource, /未分配设备加载失败，请重试/)
  assert.match(unallocatedSource, /@click="loadPrinters"/)
  assert.match(unallocatedSource, /机器编号/)
  assert.match(unallocatedSource, /IP 地址/)
  assert.match(unallocatedSource, /状态/)
  assert.match(unallocatedSource, /进入布局编辑/)
  assert.match(unallocatedSource, /当前账号可以查看未分配设备，但没有布局编辑或绑定设备权限/)
  assert.match(unallocatedSource, /emit\('enter-layout-edit'\)/)
  assert.doesNotMatch(unallocatedSource, /function requestLayoutEdit\(\) \{\s*closeDrawer\(\)/)
  assert.match(unallocatedSource, /createLatestRequestGuard/)
  assert.match(unallocatedSource, /const guard = requestGuard/)
  assert.match(unallocatedSource, /guard\.isCurrent\(requestId\)/)
  assert.match(unallocatedSource, /flush: 'sync'/)
  assert.match(unallocatedSource, /onBeforeUnmount/)
  assert.match(dashboardSource, /canManageLayout = computed\(\(\) => userStore\.isAdmin\)/)
  assert.match(dashboardSource, /function enterLayoutEditFromUnallocated\(\)/)
  assert.match(dashboardSource, /点击空槽位选择并绑定设备/)
})

test('UI-005 扫描 API 使用独立超时且不改变全局请求配置', () => {
  assert.match(printerApiSource, /export function scanPrinters\(subnet, options = \{\}\)/)
  assert.match(printerApiSource, /timeout: 30_000/)
  assert.match(printerApiSource, /data => Array\.isArray\(data\) \? data : \[\]/)
  assert.match(printerApiSource, /export function getUnallocatedPrinters\(\)/)
  assert.match(printerApiSource, /const records = Array\.isArray\(data\) \? data : data\?\.records/)
  assert.match(source, /suggestedName: device\.suggestedName \|\| ''/)
  assert.match(source, /payload\.macAddress = device\.macAddress/)
  assert.match(source, /payload\.apiKey = device\.apiKey/)
  assert.match(source, /applyBatchUpsertResult/)
  assert.match(source, /selectedScanKeys\.value = batchOutcome\.failedKeys/)
  assert.match(source, /if \(hasFailures\) \{[\s\S]*return/)
  assert.match(source, /printer-scan-card__failure-reason/)
  assert.doesNotMatch(source, /payload\.name|name: device\.name|device\.name \|\| device\.suggestedName/)
  assert.match(printerApiSource, /devices\[\]\.suggestedName/)
})

test('UI-006 打印机搜索使用局部 TDesign borderless 填充输入框并保持实时防抖', () => {
  assert.match(source, /class="printer-management-filter__search"[\s\S]*borderless/)
  assert.match(source, /\.printer-management-filter__search :deep\(\.t-input\)/)
  assert.match(source, /background: var\(--app-surface-muted\)/)
  assert.match(source, /@input="scheduleKeywordSearch"/)
  assert.doesNotMatch(source, /查询按钮|搜索按钮/)
})

test('打印机详情抽屉以概览和历史双标签压缩信息并固定底部操作', () => {
  assert.match(detailSource, /return deviceName \? `\$\{deviceName\} - 详细信息` : '打印机详情'/)
  assert.match(detailSource, /v-model:visible="drawerVisible"/)
  assert.match(detailSource, /aria-label="关闭打印机详情"/)
  assert.match(detailSource, /formatDateTime/)
  assert.match(detailSource, /class="printer-detail-drawer__content/)
  assert.match(detailSource, /<t-tabs v-model:value="activeDetailTab"/)
  assert.match(detailSource, /<t-tab-panel value="overview" label="设备概览">/)
  assert.match(detailSource, /<t-tab-panel v-if="showAnalytics" value="history" label="历史统计">/)
  assert.match(detailSource, /\.printer-detail-drawer :deep\(\.t-drawer__body\)[\s\S]*overflow: hidden/)
  assert.match(detailSource, /\.printer-detail-drawer__overview[\s\S]*overflow-y: auto/)
  assert.match(detailSource, /class="printer-detail-drawer__footer"/)
  assert.doesNotMatch(detailSource, /label="后台监控"|label="设备名称"/)
  assert.match(source, /:show-analytics="true"/)
  assert.match(source, /@analytics-open="handleAnalyticsOpen"/)
  assert.match(source, /const handleAnalyticsOpen = \(\) =>/)
  assert.match(source, /:action-loading="detailActionLoading"/)
  assert.match(source, /@action="handlePrinterAction"/)
  assert.match(source, /@emergency-stop="handleEmergencyStop"/)
  assert.match(source, /const handlePrinterAction = async \(action, printer\) =>/)
  assert.match(source, /const handleEmergencyStop = async printer =>/)
  assert.match(detailSource, /'is-single-panel': !showAnalytics/)
  assert.match(detailSource, /\.printer-detail-drawer__tabs\.is-single-panel/)
  assert.doesNotMatch(detailSource, /undefined - 详细信息/)
  assert.match(detailSource, /props\.device\?\.machineNumber \|\| '未设置'/)
  assert.doesNotMatch(detailSource, /device\.machineNumber \|\| `#\$\{device\.id\}`/)
  assert.match(detailSource, /isRrfDevice \? '打开 DWC' : '打开 Mainsail'/)
  assert.match(detailSource, /const deviceConsoleUrl = computed/)
  assert.match(detailSource, /confirmSafe\(jobId, props\.device\.id\)/)
  assert.match(printerApiSource, /data: \{ jobId, printerId \}/)
})

test('打印机详情使用紧凑状态主题卡和独立设备信息卡并统一底部操作', () => {
  assert.match(detailSource, /:class="`is-\$\{currentStateClass\}`"/)
  assert.match(detailSource, /printer-detail-drawer__status-main/)
  assert.match(detailSource, /printer-detail-drawer__device-info-grid/)
  assert.match(detailSource, /aria-labelledby="printer-device-info-title"/)
  const statusCardStart = detailSource.indexOf('class="printer-detail-drawer__status-card"')
  const statusCardEnd = detailSource.indexOf('</section>', statusCardStart)
  const deviceInfoStart = detailSource.indexOf('aria-labelledby="printer-device-info-title"')
  assert.equal(deviceInfoStart > statusCardEnd, true)
  assert.match(detailSource, /label: 'MAC 地址'/)
  assert.match(detailSource, /label: '当前耗材'/)
  assert.match(detailSource, /label: '看板位置'/)
  assert.match(detailSource, /\.printer-detail-drawer__device-info-grid[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(detailSource, /\.printer-detail-drawer__device-info-item[\s\S]*background: var\(--app-surface-muted\)/)
  assert.match(detailSource, /\.printer-detail-drawer__status-card\.is-idle[\s\S]*--td-success-color-1/)
  assert.match(detailSource, /\.printer-detail-drawer__status-card\.is-printing[\s\S]*--td-brand-color-1/)
  assert.doesNotMatch(detailSource, /printer-detail-drawer__device-descriptions/)
  assert.match(detailSource, /<Refresh \/>刷新状态/)
  assert.match(detailSource, /v-if="canEmergencyStop"/)
  assert.match(detailSource, /\.printer-detail-drawer :deep\(\.t-drawer__footer\)[\s\S]*border-top:/)
  assert.match(detailSource, /\.printer-detail-drawer__footer[\s\S]*border-top: 0/)
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

test('UI-006 未分配请求关闭并重开后只允许新代次写回', () => {
  let guard = createLatestRequestGuard()
  const firstGuard = guard
  const firstRequest = firstGuard.begin()

  firstGuard.invalidate()
  guard = createLatestRequestGuard()
  const reopenedRequest = guard.begin()

  assert.equal(firstGuard.isCurrent(firstRequest), false)
  assert.equal(guard.isCurrent(reopenedRequest), true)
  guard.invalidate()
  assert.equal(guard.isCurrent(reopenedRequest), false)
})
