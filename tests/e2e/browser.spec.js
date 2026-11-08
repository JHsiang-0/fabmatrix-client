import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { readXlsx } from '../helpers/xlsxReadback.js'
import { isFeatureEnabled } from '../../src/config/features.js'
import { printerModelFixture } from '../fixtures/printerModel.js'

const batchDispatchEnabled = isFeatureEnabled('batchDispatch')

test('打印机列表优先统一摘要，停监后清理运行状态并保留设备行', async ({ page }) => {
  await login(page)
  await page.evaluate(async () => {
    const { mockState } = await import('/src/mock/data.js')
    const printer = mockState.printers.find(item => String(item.id) === '403')
    printer.status = 'IDLE'
    printer.stateSummary = {
      modelVersion: 2, localPrinterId: '403', serverTime: new Date().toISOString(),
      observedAt: new Date().toISOString(), stale: false, monitorEnabled: true,
      connectionStatus: 'ONLINE', status: 'PAUSED', progress: 0, toolTemperature: 0
    }
  })
  await openSidebarItem(page, 1280, '打印机管理')
  const row = page.locator('.printer-table-row').filter({ hasText: 'Printer_C0DA' })
  await expect(row.locator('.printer-management-print-status')).toHaveText('已暂停')
  await expect(row.locator('.printer-management-connection-indicator')).toHaveText('在线')
  await page.evaluate(async () => {
    const { mockState } = await import('/src/mock/data.js')
    mockState.printers.find(item => String(item.id) === '403').stateSummary.monitorEnabled = false
  })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(row.locator('.printer-management-print-status')).toHaveText('未知')
  await expect(row.locator('.printer-management-connection-indicator')).toHaveText('未知')
  await expect(row).toContainText('未启用')
})

test('设备概览按场景展示温度与打印，次要数据分层且离线清理旧值', async ({ page }) => {
  await login(page)
  const fixture = printerModelFixture('403')
  fixture.model.observation.currentExecution.source = 'FARM'
  await page.evaluate(async fixture => {
    const { mockState } = await import('/src/mock/data.js')
    Object.assign(mockState.printers.find(item => String(item.id) === '403'), {
      canonicalModel: fixture.model, modelStale: false, firmwareType: 'RRF'
    })
  }, fixture)
  await openSidebarItem(page, 1280, '打印机管理')
  await page.locator('.printer-table-row').filter({ hasText: 'Printer_C0DA' }).locator('td').nth(2).click()
  const panel = page.getByRole('region', { name: '设备运行状态' })
  const drawer = page.locator('.printer-detail-drawer')
  await expect(panel.getByText('0 °C', { exact: true })).toBeVisible()
  await expect(panel.getByText('23.4 °C', { exact: true })).toBeVisible()
  await expect(panel.getByText('00:00:12', { exact: true })).toBeVisible()
  await expect(panel.getByText('00:02:00', { exact: true })).toBeVisible()
  await expect(panel.getByText('已取消', { exact: true })).toBeVisible()
  await expect(panel.getByText('总层数', { exact: true })).toHaveCount(0)
  await expect(panel.getByText('模型身份与采样', { exact: true })).toHaveCount(0)
  await expect(panel.getByText('模型风扇', { exact: true })).not.toBeVisible()
  await expect(drawer.getByText('监控与通信', { exact: true })).not.toBeVisible()
  await page.mouse.move(0, 0)
  await page.screenshot({ path: 'test-results/printer-overview-desktop.png', fullPage: true, animations: 'disabled' })

  await panel.getByText('更多运行信息', { exact: true }).click()
  await expect(panel.getByText('模型风扇', { exact: true })).toBeVisible()
  await expect(panel.getByText('断料检测', { exact: true })).toBeVisible()
  await expect(panel.getByText('否', { exact: true }).first()).toBeVisible()
  await panel.getByText('更多运行信息', { exact: true }).click()
  await drawer.locator('.t-tabs__nav').getByText('设备信息', { exact: true }).click()
  await expect(drawer.getByText('监控与通信', { exact: true })).toBeVisible()
  await expect(drawer.getByText('192.168.1.80', { exact: true })).toBeVisible()
  await expect(panel).not.toBeVisible()
  await page.screenshot({ path: 'test-results/printer-device-settings.png', fullPage: true, animations: 'disabled' })
  await drawer.locator('.t-tabs__nav').getByText('设备概览', { exact: true }).click()
  await expect(panel.getByText('23.4 °C', { exact: true })).toBeVisible()

  await page.evaluate(async () => {
    const { mockState } = await import('/src/mock/data.js')
    const printer = mockState.printers.find(item => String(item.id) === '403')
    printer.modelStale = true
    printer.canonicalModel.observation.connection.status = 'OFFLINE'
  })
  await panel.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(panel.getByText('当前数据不可用', { exact: true })).toBeVisible()
  await expect(panel.getByText('0 °C', { exact: true })).toHaveCount(0)
  await expect(panel.getByRole('region', { name: '打印信息' })).toHaveCount(0)
  await expect(panel.getByText('已取消', { exact: true })).toBeVisible()
  await expect(drawer.locator('.printer-detail-drawer__status-card')).toContainText('离线')
  await expect(drawer.locator('.printer-detail-drawer__progress-summary')).toHaveCount(0)
  await page.setViewportSize({ width: 800, height: 560 })
  await panel.getByText('当前数据不可用', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/printer-overview-compact.png', fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(panel).toBeVisible()
  expect(await drawer.locator('.printer-detail-drawer__overview').first().evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: 'test-results/printer-overview-mobile.png', fullPage: true, animations: 'disabled' })
  await page.evaluate(async () => {
    const { mockState } = await import('/src/mock/data.js')
    mockState.printers.find(item => String(item.id) === '403').canonicalModel.modelVersion = 99
  })
  await panel.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(panel.getByText('设备状态加载失败', { exact: true })).toBeVisible()
  await expect(panel.getByText('已取消', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '关闭打印机详情', exact: true }).click()
  await expect(panel).not.toBeVisible()
})

const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 1920, height: 855 }
]

const pages = [
  { label: '概览仪表盘', path: '/dashboard', text: '概览仪表盘' },
  { label: '打印机管理', path: '/printers', text: '打印机管理' },
  { label: '文件库', path: '/files', text: '文件库' },
  { label: '任务队列', path: '/tasks/queue', text: '生产调度队列' },
  { label: '打印历史', path: '/tasks/history', text: '打印历史记录' },
  { label: '批量派发', path: '/batch-dispatch', text: '批量手动派发', feature: 'batchDispatch' },
  { label: '用户管理', path: '/users', text: '用户管理' },
  { label: '操作日志', path: '/audit-logs', text: '操作日志' },
  { label: '云端连接', path: '/settings/cloud-connection', text: '管理当前生产服务器的云端数据上报' },
  { label: '个人中心', path: '/profile', text: '个人资料' }
].filter(item => !item.feature || isFeatureEnabled(item.feature))

const parentLabels = {
  概览仪表盘: '工作台',
  打印机管理: '打印机',
  文件库: '文件',
  任务队列: '任务',
  打印历史: '任务',
  批量派发: '批量派发',
  用户管理: '管理中心',
  操作日志: '管理中心',
  云端连接: '设置',
  个人中心: '个人中心'
}

const login = async page => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible()
  await page.getByLabel('用户名', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('Admin123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: '概览仪表盘' })).toBeVisible()
}

const loginAs = async (page, username, password) => {
  await page.goto('/login')
  await page.getByLabel('用户名', { exact: true }).fill(username)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: '概览仪表盘' })).toBeVisible()
}

for (const width of [375, 1280]) {
  test(`本地产品边界：${width}px 在云服务不可达时登录与设备页面可用`, async ({ page }) => {
    const remoteRequests = []
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
        remoteRequests.push(url.origin)
        await route.abort()
      } else await route.continue()
    })
    await page.setViewportSize({ width, height: 812 })
    await login(page)
    await expect(page.getByRole('button', { name: '云端管理', exact: true })).toHaveCount(0)
    await expect(page.getByText('云端平台', { exact: true })).toHaveCount(0)
    await openSidebarItem(page, width, '打印机管理')
    await expect(page.getByRole('heading', { name: '打印机管理', exact: true })).toBeVisible()
    await expect(page.locator('.printer-table tbody tr').first()).toBeVisible()
    expect(remoteRequests).toEqual([])
  })
}

test('云端连接：二维码等待手机确认、取消、完成后仍由本地管理员开启上报', async ({ page }) => {
  await login(page)
  await openSidebarItem(page, 1280, '云端连接')
  await page.getByRole('button', { name: '手机扫码配对', exact: true }).click()
  const dialog = page.locator('.t-dialog:visible')
  await dialog.getByPlaceholder('https://cloud.example.com').fill('https://cloud.example.test')
  await dialog.getByPlaceholder('ssl://mqtt.example.com:8883').fill('ssl://mqtt.example.test:8883')
  await dialog.getByRole('button', { name: '生成配对二维码' }).click()
  await expect(dialog.getByText('核对编号：56789012')).toBeVisible()
  await expect(dialog.locator('canvas, svg').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/cloud-pairing-qr.png', fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(dialog.getByText('核对编号：56789012')).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 812 })
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('fmc_pa_')
  await dialog.getByRole('button', { name: '取消配对', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '生成配对二维码' })).toBeVisible()
  await dialog.getByRole('button', { name: '生成配对二维码' }).click()
  await expect(dialog.getByText('核对编号：56789012')).toBeVisible()
  await page.evaluate(async () => {
    const { mockState } = await import('/src/mock/data.js')
    mockState.cloudPairing.state = 'COMPLETED'
  })
  await expect(dialog).toHaveCount(0, { timeout: 10000 })
  await expect(page.getByText('扫码农场', { exact: true })).toBeVisible()
  await expect(page.getByLabel('启用云端数据上报', { exact: true })).toHaveAttribute('aria-checked', 'false')
})

test('云端连接：管理员绑定后核对归属、开启关闭和解绑，绑定码不落客户端存储', async ({ page }) => {
  await login(page)
  await openSidebarItem(page, 1280, '云端连接')
  await expect(page.getByRole('heading', { name: '云端连接', exact: true })).toBeVisible()
  const toggle = page.getByLabel('启用云端数据上报', { exact: true })
  await expect(toggle).toBeDisabled()
  await page.getByRole('button', { name: '绑定云网关', exact: true }).click()
  const dialog = page.locator('.t-dialog:visible')
  const ticket = 'fmc_b_' + 'b'.repeat(43)
  await dialog.getByLabel('云服务地址', { exact: true }).locator('input').fill('https://cloud.example.test')
  await dialog.getByLabel('MQTT TLS 地址', { exact: true }).locator('input').fill('ssl://mqtt.example.test:8883')
  await dialog.getByLabel('一次性绑定码', { exact: true }).locator('input').fill(ticket)
  await dialog.getByRole('button', { name: '确认绑定', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('测试组织', { exact: true })).toBeVisible()
  await expect(page.getByText('测试农场', { exact: true })).toBeVisible()
  await expect(toggle).toBeEnabled()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('在线', { exact: true })).toBeVisible()
  await toggle.click()
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText('现场网关', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/cloud-connection-bound-1280.png', fullPage: true, animations: 'disabled' })
  const persisted = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(persisted).not.toContain(ticket)
  await page.getByRole('button', { name: '解除绑定', exact: true }).click()
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.getByRole('button', { name: '绑定云网关', exact: true })).toBeVisible()
  await expect(toggle).toBeDisabled()
  await page.evaluate(async () => {
    const { mockState } = await import('/src/mock/data.js')
    for (const action of ['CLOUD_BIND', 'CLOUD_ENABLE', 'CLOUD_DISABLE', 'CLOUD_UNBIND']) {
      if (!mockState.auditLogs.some(item => item.action === action)) throw new Error('缺少审计 ' + action)
    }
  })
})

test('云端连接：远程暂停单独授权，取消无写入，关闭不改变上报', async ({ page }) => {
  await login(page)
  await page.evaluate(async () => {
    const { mockState } = await import('/src/mock/data.js')
    Object.assign(mockState.cloudConnection, { bound: true, gatewayId: 'mock-gateway', enabled: true })
  })
  await openSidebarItem(page, 1280, '云端连接')
  const toggle = page.getByLabel('允许远程暂停', { exact: true })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(page.getByText('允许具有此农场操作权限的云账号暂停当前打印？此授权与数据上报分别管理。', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.locator('.t-dialog:visible')).toHaveCount(0)
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.focus()
  await toggle.press('Enter')
  await page.locator('.t-dialog:visible').getByRole('button', { name: '确定', exact: true }).click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByLabel('启用云端数据上报', { exact: true })).toHaveAttribute('aria-checked', 'true')
})

test('云端连接：温度授权独立确认，关闭不影响暂停和上报，旧Server保持只读', async ({ page }) => {
  await login(page)
  await page.evaluate(async () => {
    const { mockState } = await import('/src/mock/data.js')
    Object.assign(mockState.cloudConnection, { bound: true, gatewayId: 'mock-gateway', enabled: true })
    Object.assign(mockState.cloudRemoteControl, { enabled: false, temperatureEnabled: false, temperatureSupported: true })
  })
  await openSidebarItem(page, 1280, '云端连接')
  const temperature = page.getByLabel('允许远程温度设置', { exact: true })
  const pause = page.getByLabel('允许远程暂停', { exact: true })
  const reporting = page.getByLabel('启用云端数据上报', { exact: true })
  await expect(temperature).toHaveAttribute('aria-checked', 'false')
  await temperature.click()
  await expect(page.locator('.t-dialog:visible')).toContainText('0°C 会关闭对应加热器')
  await page.locator('.t-dialog:visible').getByRole('button', { name: '取消', exact: true }).click()
  await expect(temperature).toHaveAttribute('aria-checked', 'false')
  await temperature.click()
  await page.locator('.t-dialog:visible').getByRole('button', { name: '确定', exact: true }).click()
  await expect(temperature).toHaveAttribute('aria-checked', 'true')
  await expect(pause).toHaveAttribute('aria-checked', 'false')
  await pause.click()
  await page.locator('.t-dialog:visible').getByRole('button', { name: '确定', exact: true }).click()
  await expect(pause).toHaveAttribute('aria-checked', 'true')
  await temperature.click()
  await expect(temperature).toHaveAttribute('aria-checked', 'false')
  await expect(pause).toHaveAttribute('aria-checked', 'true')
  await expect(reporting).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.t-dialog:visible')).toHaveCount(0)
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(temperature).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/cloud-temperature-permission-375.png', fullPage: true, animations: 'disabled' })
  await page.evaluate(async () => {
    const { mockState } = await import('/src/mock/data.js')
    delete mockState.cloudRemoteControl.temperatureSupported
    delete mockState.cloudRemoteControl.temperatureEnabled
  })
  await page.getByRole('button', { name: '刷新状态', exact: true }).click()
  await expect(temperature).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText('当前 Server 尚不支持远程温度设置，请先升级。', { exact: true })).toBeVisible()
  await expect(pause).toHaveAttribute('aria-checked', 'true')
})

test('云端连接：操作员入口隐藏且直接路由拒绝，窄屏管理员配置可用', async ({ page }) => {
  await loginAs(page, 'operator', 'Operator123')
  await expect(page.getByText('云端连接', { exact: true })).toHaveCount(0)
  await page.evaluate(async () => (await import('/src/router/index.js')).default.push('/settings/cloud-connection'))
  await expect(page).toHaveURL(/\/403/)
  await page.evaluate(async () => (await import('/src/stores/user.js')).useUserStore().logout())
  await page.setViewportSize({ width: 375, height: 812 })
  await login(page)
  await openSidebarItem(page, 375, '云端连接')
  await page.getByRole('button', { name: '绑定云网关', exact: true }).click()
  await expect(page.getByLabel('一次性绑定码', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/cloud-connection-binding-375.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.getByLabel('一次性绑定码', { exact: true })).toHaveCount(0)
})

test('本地产品边界：旧云路由进入404并保留现场会话，连接页展示本地配置', async ({ page }) => {
  await login(page)
  const session = await page.evaluate(() => window.localStorage.getItem('farm-ui-session') || window.sessionStorage.getItem('farm-ui-session'))
  for (const path of ['/cloud', '/cloud/manage']) {
    await page.evaluate(async path => (await import('/src/router/index.js')).default.push(path), path)
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.getByText('页面不存在', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '返回工作台', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  }
  expect(await page.evaluate(() => window.localStorage.getItem('farm-ui-session') || window.sessionStorage.getItem('farm-ui-session'))).toBe(session)
  await page.evaluate(async () => (await import('/src/router/index.js')).default.push('/server-connection'))
  await expect(page.getByRole('button', { name: '云端只读看板', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '保存并连接', exact: true })).toBeVisible()
})

test('打印历史导出独立筛选 Excel 和 PDF 全部分页，保持列表条件并可窄屏下载', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(() => window.__FARM_RESET_MOCK__({ jobs: Array.from({ length: 25 }, (_, index) => ({
    id: 10000 + index, fileId: index % 2 ? 21 : 20, userId: 1, status: 'COMPLETED', progress: 100,
    completedAt: '2026-10-08T12:00:00', createdAt: '2026-10-08T10:00:00'
  })) }))
  await page.getByLabel('用户名', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('Admin123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await openSidebarItem(page, 1280, '打印历史')
  await expect(page.getByRole('button', { name: '导出历史', exact: true })).toBeEnabled()
  await page.getByPlaceholder('请输入文件名', { exact: true }).fill('gearbox')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page.locator('.history-pagination-footer__summary')).toContainText('13')
  await page.getByPlaceholder('请输入文件名', { exact: true }).fill('尚未查询的条件')
  await page.getByRole('button', { name: '导出历史', exact: true }).click()
  const dialog = page.locator('.t-dialog').filter({ hasText: '导出打印历史' })
  await expect(dialog.getByPlaceholder('包含文件名，不限请留空')).toHaveValue('gearbox')
  await expect(dialog).not.toContainText('13 条')
  await dialog.getByPlaceholder('包含文件名，不限请留空').fill('enclosure')
  await dialog.getByRole('button', { name: '使用列表筛选', exact: true }).click()
  await expect(dialog.getByPlaceholder('包含文件名，不限请留空')).toHaveValue('gearbox')
  await dialog.getByPlaceholder('包含文件名，不限请留空').fill('enclosure')
  const pageRequests = await mockRequestCount(page, 'POST /api/v1/print-jobs/page')
  const excelDownload = page.waitForEvent('download')
  await dialog.getByRole('button', { name: '下载文件', exact: true }).click()
  const excel = await excelDownload
  expect(excel.suggestedFilename()).toBe('打印历史（Mock）.xlsx')
  const excelBytes = await readFile(await excel.path())
  expect([...excelBytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 3, 4])
  const book = readXlsx(excelBytes)
  expect(book.activeTab).toBe(0)
  expect(book.sheets.map(sheet => sheet.name)).toEqual(['明细', '汇总'])
  expect(book.sheets[0].rows[0]).toHaveLength(13)
  expect(book.sheets[0].rows).toHaveLength(13)
  expect(book.sheets[0].rows.some(row => row[0] === '10023')).toBe(true)
  expect(book.sheets[0].rows.some(row => row[0] === '10024')).toBe(false)
  const payload = await page.evaluate(() => window.__FARM_GET_LAST_HISTORY_EXPORT_PAYLOAD__())
  expect(payload).toEqual({ format: 'XLSX', statuses: ['COMPLETED', 'FAILED', 'CANCELLED'], fileName: 'enclosure' })
  expect(await mockRequestCount(page, 'POST /api/v1/print-jobs/page')).toBe(pageRequests)
  await expect(page.locator('.history-pagination-footer__summary')).toContainText('13')
  await expect(page.getByPlaceholder('请输入文件名', { exact: true })).toHaveValue('尚未查询的条件')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: '导出历史', exact: true }).click()
  await expect(dialog.getByPlaceholder('包含文件名，不限请留空')).toHaveValue('gearbox')
  await dialog.getByRole('button', { name: '清空筛选', exact: true }).click()
  await expect(dialog.getByPlaceholder('包含文件名，不限请留空')).toHaveValue('')
  await dialog.getByRole('button', { name: '使用列表筛选', exact: true }).click()
  await dialog.getByPlaceholder('包含文件名，不限请留空').fill('enclosure')
  await dialog.getByText('PDF（.pdf）', { exact: true }).click()
  await assertNoViewportOverflow(page)
  const pdfDownload = page.waitForEvent('download')
  await dialog.getByRole('button', { name: '下载文件', exact: true }).click()
  const pdf = await pdfDownload
  expect(pdf.suggestedFilename()).toBe('打印历史（Mock）.pdf')
  const pdfText = (await readFile(await pdf.path())).toString()
  expect(pdfText).toMatch(/^%PDF-1\.4/)
  expect(pdfText).toContain('12 records')
  expect(pdfText).toContain('#10023')
})

test('打印历史 PDF 导出超限显示业务错误且不下载假文件，取消生成不会下载', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(() => window.__FARM_RESET_MOCK__({ jobs: Array.from({ length: 1001 }, (_, index) => ({
    id: 20000 + index, fileId: 20, userId: 1, status: 'COMPLETED', completedAt: '2026-10-08T12:00:00'
  })) }))
  await page.getByLabel('用户名', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('Admin123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await openSidebarItem(page, 1280, '打印历史')
  const downloads = []
  page.on('download', download => downloads.push(download))
  await page.getByRole('button', { name: '导出历史', exact: true }).click()
  const dialog = page.locator('.t-dialog').filter({ hasText: '导出打印历史' })
  await dialog.getByText('PDF（.pdf）', { exact: true }).click()
  await dialog.getByRole('button', { name: '下载文件', exact: true }).click()
  await expect(page.locator('.t-message').filter({ hasText: '导出最多支持 1000 条记录，请缩小时间范围' })).toBeVisible()
  expect(downloads).toHaveLength(0)
  await dialog.getByText('Excel（.xlsx）', { exact: true }).click()
  await dialog.getByRole('button', { name: '下载文件', exact: true }).click()
  await dialog.getByRole('button', { name: '取消导出', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.waitForTimeout(250)
  expect(downloads).toHaveLength(0)
})

test('操作员打印历史导出可用且只下载本人记录，不显示创建人筛选', async ({ page }) => {
  await loginAs(page, 'operator', 'Operator123')
  await openSidebarItem(page, 1280, '打印历史')
  await expect(page.getByText('创建人', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '导出历史', exact: true }).click()
  const dialog = page.locator('.t-dialog').filter({ hasText: '导出打印历史' })
  await expect(dialog.getByText('创建人', { exact: true })).toHaveCount(0)
  const downloadEvent = page.waitForEvent('download')
  await dialog.getByRole('button', { name: '下载文件', exact: true }).click()
  const content = (await readFile(await (await downloadEvent).path())).toString()
  expect(content).toContain('1004')
  expect(content).not.toContain('1005')
  expect(await page.evaluate(() => window.__FARM_GET_LAST_HISTORY_EXPORT_PAYLOAD__())).not.toHaveProperty('userId')
})

test('管理员导出可独立筛选创建人，历史设备 ID 校验失败不会请求或下载', async ({ page }) => {
  await login(page)
  await openSidebarItem(page, 1280, '打印历史')
  await page.getByRole('button', { name: '导出历史', exact: true }).click()
  const dialog = page.locator('.t-dialog').filter({ hasText: '导出打印历史' })
  await dialog.getByPlaceholder('搜索设备名称、机台号或输入 ID').fill('-1')
  await dialog.getByRole('button', { name: '下载文件', exact: true }).click()
  await expect(dialog).toContainText('打印机 ID 必须为有效正整数')
  expect(await mockRequestCount(page, 'POST /api/v1/print-jobs/history/export')).toBe(0)
  await dialog.getByRole('button', { name: '清空筛选', exact: true }).click()
  await dialog.getByPlaceholder('搜索设备名称、机台号或输入 ID').fill('Printer_C0DA')
  await page.getByText(/Printer_C0DA · .*（403）/).last().click()
  await expect(dialog.getByPlaceholder('搜索设备名称、机台号或输入 ID')).toHaveValue('403')
  await dialog.getByRole('button', { name: '清空筛选', exact: true }).click()
  await dialog.getByPlaceholder('全部创建人', { exact: true }).click()
  await page.getByText('operator（2）', { exact: true }).last().click()
  await dialog.getByText('失败', { exact: true }).click()
  await dialog.getByText('已取消', { exact: true }).click()
  await dialog.getByPlaceholder('开始时间', { exact: true }).fill('2026-09-02 00:00:00')
  await dialog.getByPlaceholder('结束时间', { exact: true }).fill('2026-09-03 23:59:58')
  await dialog.getByPlaceholder('结束时间', { exact: true }).press('Tab')
  await expect(dialog).toContainText('实际范围：2026-09-02 00:00:00 至 2026-09-03 23:59:58')
  await dialog.getByPlaceholder('结束时间', { exact: true }).fill('2026-09-03 23:59:59')
  await dialog.getByPlaceholder('结束时间', { exact: true }).press('Enter')
  await expect(dialog).toContainText('实际范围：2026-09-02 00:00:00 至 2026-09-03 23:59:59')
  const downloadEvent = page.waitForEvent('download')
  await dialog.getByRole('button', { name: '下载文件', exact: true }).click()
  const book = readXlsx(await readFile(await (await downloadEvent).path()))
  expect(book.sheets[0].rows).toHaveLength(2)
  expect(book.sheets[0].rows[1][0]).toBe('1004')
  expect(await page.evaluate(() => window.__FARM_GET_LAST_HISTORY_EXPORT_PAYLOAD__())).toMatchObject({ userId: '2', statuses: ['COMPLETED'], startTime: '2026-09-02T00:00:00', endTime: '2026-09-03T23:59:59' })
  await expect(page.locator('.history-pagination-footer__summary')).toContainText('3')
})

test('设备 IP 同步独立于普通刷新，展示地址变化并刷新列表，窄屏可关闭', async ({ page }) => {
  await login(page)
  await openSidebarItem(page, 1280, '打印机管理')
  await expect(page.getByRole('heading', { name: '打印机管理' })).toBeVisible()
  await expect.poll(() => mockRequestCount(page, 'GET /api/v1/printers/page')).toBeGreaterThan(0)
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  expect(await mockRequestCount(page, 'POST /api/v1/printers/rediscover')).toBe(0)
  await page.getByRole('button', { name: '同步设备 IP', exact: true }).click()
  const drawer = page.locator('.printer-ip-sync-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('192.168.1.0/24')
  const before = await mockRequestCount(page, 'GET /api/v1/printers/page')
  await drawer.getByRole('button', { name: '开始同步', exact: true }).click()
  await expect(drawer.getByRole('button', { name: '正在同步', exact: true })).toBeDisabled()
  await expect.poll(() => mockRequestCount(page, 'POST /api/v1/printers/rediscover')).toBe(1)
  await expect(drawer).toContainText('地址同步完成')
  await expect(drawer).toContainText('192.168.1.81 → 192.168.1.181')
  await expect.poll(() => mockRequestCount(page, 'GET /api/v1/printers/page')).toBeGreaterThan(before)
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(drawer.getByRole('button', { name: '关闭', exact: true })).toBeVisible()
  await assertNoViewportOverflow(page)
  await drawer.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(drawer).toBeHidden()
})

test('手动新增设备时自动检测协议并在更换地址后重新检测', async ({ page }) => {
  await login(page)
  await openSidebarItem(page, 1280, '打印机管理')
  await page.getByRole('button', { name: '新增打印机', exact: true }).click()
  const dialog = page.locator('.t-dialog:visible')
  await expect(dialog.getByRole('button', { name: '确定', exact: true })).toBeDisabled()
  await dialog.getByPlaceholder('例：Klipper-01').fill('检测测试设备')
  const address = dialog.getByPlaceholder('例：192.168.1.10')
  await address.fill('192.168.1.99')
  await expect(dialog).toContainText('已识别：Klipper')
  await expect(dialog.getByRole('button', { name: '确定', exact: true })).toBeEnabled()
  await address.fill('192.168.1.')
  await expect(dialog.getByRole('button', { name: '确定', exact: true })).toBeDisabled()
  await address.fill('192.168.1.98')
  await expect(dialog).toContainText('已识别：Klipper')
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(await mockRequestCount(page, 'POST /api/v1/printers/add-detected')).toBe(1)
})

test('管理员批量删除展示确认和逐台结果', async ({ page }) => {
  await login(page)
  await openSidebarItem(page, 1280, '打印机管理')
  for (const name of ['Printer_C0DA', 'Printer_A12F']) {
    const row = page.locator('.printer-table tbody tr').filter({ hasText: name })
    await row.getByRole('checkbox').locator('..').click({ force: true })
    await expect(row.getByRole('checkbox')).toBeChecked()
  }
  await page.getByRole('button', { name: '批量删除 (2)' }).click()
  const confirmation = page.locator('.t-dialog:visible').filter({ hasText: '批量删除设备' })
  await expect(confirmation).toContainText('Printer_C0DA')
  await expect(confirmation).toContainText('Printer_A12F')
  await expect(confirmation).toContainText('请先到现场确认设备没有独立打印')
  await confirmation.getByRole('button', { name: '确认删除' }).click()
  const result = page.locator('.t-dialog:visible').filter({ hasText: '批量删除结果' })
  await expect(result).toContainText('成功 1 台，失败 1 台')
  await expect(result).toContainText('Printer_C0DA')
  await expect(result).toContainText('Printer_A12F')
})

test('操作员看不到设备 IP 同步入口，也不发起后台同步查询', async ({ page }) => {
  await loginAs(page, 'operator', 'Operator123')
  await openSidebarItem(page, 1280, '打印机管理')
  await expect(page.getByRole('heading', { name: '打印机管理' })).toBeVisible()
  await expect(page.getByRole('button', { name: /同步设备 IP/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /批量删除/ })).toHaveCount(0)
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  expect(await mockRequestCount(page, 'GET /api/v1/printers/rediscover')).toBe(0)
})

const openSidebarItem = async (page, width, label) => {
  const sidebar = page.locator('.app-sidebar')
  const targetPath = pages.find(item => item.label === label)?.path
  if (targetPath && new URL(page.url()).pathname === targetPath) {
    return sidebar
  }
  if (width <= 768) {
    const menuButton = page.getByRole('button', { name: /展开菜单|收起菜单/ }).first()
    const isOpen = await sidebar.evaluate(element => element.classList.contains('app-sidebar--mobile-open'))
    if (!isOpen) {
      await menuButton.click()
      await expect(sidebar).toHaveClass(/app-sidebar--mobile-open/)
    }
  }
  let menuItem = sidebar.locator('.t-submenu__item:visible').filter({ hasText: label }).first()
  if (!(await menuItem.count())) {
    const submenuTitle = sidebar.locator('.t-submenu > .t-menu__item:visible').filter({ hasText: parentLabels[label] }).first()
    await expect(submenuTitle).toBeVisible()
    await submenuTitle.click()
    menuItem = sidebar.locator('.t-submenu__item:visible').filter({ hasText: label }).first()
  }
  await expect(menuItem).toBeVisible()
  await menuItem.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }))
  await page.waitForTimeout(300)
  const menuItemBox = await menuItem.boundingBox()
  expect(menuItemBox).not.toBeNull()
  await page.mouse.click(menuItemBox.x + menuItemBox.width / 2, menuItemBox.y + menuItemBox.height / 2)
  return sidebar
}

const assertNoViewportOverflow = async page => {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }))
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
}

const createTc008HistoryJobs = () => Array.from({ length: 12 }, (_, index) => {
  const failed = index === 5
  const minute = String(59 - index).padStart(2, '0')
  return {
    id: failed ? 1005 : 5000 + index,
    fileId: 20,
    printerId: 403,
    userId: 1,
    operatorId: 2,
    priority: failed ? 10 : 0,
    idempotencyKey: null,
    status: failed ? 'FAILED' : 'COMPLETED',
    progress: failed ? 42 : 100,
    startedAt: `2026-09-12T09:${minute}:00`,
    completedAt: `2026-09-12T10:${minute}:00`,
    errorReason: failed ? '喷头温度异常，请核对现场状态后重试。'.repeat(18) : null,
    fileNameSnapshot: 'gearbox.gcode',
    printerNameSnapshot: 'Printer_C0DA',
    machineNumberSnapshot: 'A-01',
    creatorUsernameSnapshot: 'admin',
    operatorUsernameSnapshot: 'operator',
    retryOfJobId: null,
    rootJobId: failed ? 1005 : 5000 + index,
    attemptNumber: 1,
    createdAt: `2026-09-12T08:${minute}:00`,
    updatedAt: `2026-09-12T10:${minute}:00`
  }
})

for (const viewport of viewports) {
  test(`四视口逐页检查业务界面 ${viewport.width}px`, async ({ browser }, testInfo) => {
    test.setTimeout(120000)
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.addInitScript(() => {
      Object.defineProperty(document.documentElement, 'requestFullscreen', {
        configurable: true,
        value: () => Promise.resolve()
      })
    })

    try {
      await login(page)
      await assertNoViewportOverflow(page)
      await page.screenshot({ path: testInfo.outputPath(`login-${viewport.width}.png`) })

      for (const item of pages) {
        await openSidebarItem(page, viewport.width, item.label)
        await expect(page).toHaveURL(new RegExp(`${item.path.replaceAll('/', '\\/')}$`))
        await expect(page.locator('.app-content')).toContainText(item.text)
        await expect(page.getByRole('button', { name: '消息通知', exact: true })).toBeVisible()
        await assertNoViewportOverflow(page)
        await page.screenshot({ path: testInfo.outputPath(`${item.path.slice(1).replaceAll('/', '-')}-${viewport.width}.png`) })
      }

      await openSidebarItem(page, viewport.width, '概览仪表盘')
      if (viewport.width <= 768) {
        const closeNavButton = page.getByRole('button', { name: '关闭导航菜单', exact: true })
        if (await closeNavButton.isVisible()) await closeNavButton.click()
      }
      if (viewport.width > 768) {
        await page.getByRole('button', { name: '设备看板', exact: true }).click()
        await expect(page).toHaveURL(/\/dashboard\/fullscreen$/)
        await expect(page.getByRole('heading', { name: '嘉东三维联动打印机实时控制系统' })).toBeVisible()
        await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible()
        await assertNoViewportOverflow(page)
        await page.screenshot({ path: testInfo.outputPath(`dashboard-fullscreen-${viewport.width}.png`) })
      }
    } finally {
      await context.close()
    }
  })
}

test('当前版本隐藏批量派发入口且直接访问返回404', async ({ browser }) => {
  test.skip(batchDispatchEnabled, 'batchDispatch 已开启时运行业务流程 E2E')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await page.goto('/batch-dispatch')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.getByText('页面不存在', { exact: true })).toBeVisible()
    await login(page)
    await expect(page.locator('.app-sidebar').getByText('批量派发', { exact: true })).toHaveCount(0)
    await page.goto('/batch-dispatch')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.getByText('页面不存在', { exact: true })).toBeVisible()
  } finally {
    await context.close()
  }
})

const mockRequestCount = (page, requestKey) => page.evaluate(key => {
  const debug = window.__FARM_GET_MOCK_DEBUG__?.()
  return debug?.requestCounts?.[key] || 0
}, requestKey)

const batchConfirmRequest = request => request.method() === 'POST'
  && new URL(request.url()).pathname === '/api/v1/print-jobs/batch/confirm'

const batchConfirmDialog = page => page.locator('.t-dialog:visible').filter({ hasText: '确认批量派发' })

const isMockBrowser = page => page.evaluate(() => typeof window.__FARM_RESET_MOCK__ === 'function')

const mockBatchConfirmRequestCount = page => mockRequestCount(page, 'POST /api/v1/print-jobs/batch/confirm')

const expectMockBatchConfirmRequestCount = async (page, expected) => {
  expect(await isMockBrowser(page)).toBe(true)
  await expect.poll(() => mockBatchConfirmRequestCount(page)).toBe(expected)
}

const confirmBatchFromDialog = async (page, dialog) => {
  const resultPromise = page.getByText(/执行完成：计划状态 COMPLETED/).waitFor({ state: 'visible' })
  const confirmClickPromise = dialog.getByRole('button', { name: '确认执行', exact: true }).click()
  if (await isMockBrowser(page)) {
    await Promise.all([resultPromise, confirmClickPromise])
    return
  }
  const responsePromise = page.waitForResponse(response => batchConfirmRequest(response.request()), { timeout: 5000 })
  await Promise.all([responsePromise, resultPromise, confirmClickPromise])
}

test('批量派发页面完成真实预览确认流程', async ({ browser }) => {
  test.skip(!batchDispatchEnabled, 'batchDispatch 未开启')
  test.setTimeout(120000)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await login(page)
    await openSidebarItem(page, 1440, '批量派发')
    await page.getByRole('checkbox', { name: /gearbox\.gcode/ }).check({ force: true })
    await page.getByRole('checkbox', { name: /^bracket\.gcode个人/ }).check({ force: true })
    await page.getByRole('checkbox', { name: /Printer_A12F/ }).check({ force: true })
    await page.getByRole('button', { name: '下一步：配置策略', exact: true }).click()
    await page.getByRole('button', { name: '生成派发预览', exact: true }).click()
    await expect(page.getByText('无副作用预览', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /确认执行（\d+项）/ }).click()
    await expectMockBatchConfirmRequestCount(page, 0)
    const dialog = batchConfirmDialog(page)
    await expect(dialog).toHaveCount(1)
    await confirmBatchFromDialog(page, dialog)
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText(/执行完成：计划状态 COMPLETED/)).toBeVisible()
    await expect(page.getByText(/成功 1 项，失败 0 项/)).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '原因码' })).toBeVisible()
    await expect(page.getByRole('button', { name: '再次获取执行结果', exact: true })).toBeVisible()
    await expectMockBatchConfirmRequestCount(page, 1)
  } finally {
    await context.close()
  }
})

const prepareBatchPreview = async page => {
  await page.goto('/login')
  await page.evaluate(() => window.__FARM_RESET_MOCK__())
  await page.getByLabel('用户名', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('Admin123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await openSidebarItem(page, 1440, '批量派发')
  await expect(page.locator('.batch-dispatch-page')).toBeVisible()
  await page.getByRole('checkbox', { name: /gearbox\.gcode/ }).check({ force: true })
  await page.getByRole('checkbox', { name: /Printer_A12F/ }).check({ force: true })
  await page.getByRole('button', { name: '下一步：配置策略', exact: true }).click({ force: true })
  await page.getByRole('button', { name: '生成派发预览', exact: true }).click()
  await expect(page.getByText('无副作用预览', { exact: true })).toBeVisible()
}

test('批量派发组件真实点击先显示一个确认框并只确认一次', async ({ browser }) => {
  test.skip(!batchDispatchEnabled, 'batchDispatch 未开启')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await prepareBatchPreview(page)
    const confirmButton = page.getByRole('button', { name: /确认执行（\d+项）/ })
    await confirmButton.click()
    const dialog = batchConfirmDialog(page)
    await expect(dialog).toHaveCount(1)
    await expectMockBatchConfirmRequestCount(page, 0)

    await confirmBatchFromDialog(page, dialog)
    await expect(page.getByText(/执行完成：计划状态 COMPLETED/)).toBeVisible()
    await expectMockBatchConfirmRequestCount(page, 1)
  } finally {
    await context.close()
  }
})

test('批量派发组件真实点击取消后释放锁并允许再次点击', async ({ browser }) => {
  test.skip(!batchDispatchEnabled, 'batchDispatch 未开启')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await prepareBatchPreview(page)
    const confirmButton = page.getByRole('button', { name: /确认执行（\d+项）/ })
    await confirmButton.click()
    let dialog = batchConfirmDialog(page)
    await expect(dialog).toHaveCount(1)
    await dialog.getByRole('button', { name: '返回检查', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expectMockBatchConfirmRequestCount(page, 0)
    await expect(confirmButton).toBeEnabled()

    await confirmButton.click()
    dialog = batchConfirmDialog(page)
    await expect(dialog).toHaveCount(1)
    await dialog.getByRole('button', { name: '返回检查', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expectMockBatchConfirmRequestCount(page, 0)
  } finally {
    await context.close()
  }
})

test('批量派发组件真实快速双击只显示一个确认框并只确认一次', async ({ browser }) => {
  test.skip(!batchDispatchEnabled, 'batchDispatch 未开启')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await prepareBatchPreview(page)
    const confirmButton = page.getByRole('button', { name: /确认执行（\d+项）/ })
    await confirmButton.dblclick()
    const dialog = batchConfirmDialog(page)
    await expect(dialog).toHaveCount(1)
    await expectMockBatchConfirmRequestCount(page, 0)

    await confirmBatchFromDialog(page, dialog)
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText(/执行完成：计划状态 COMPLETED/)).toBeVisible()
    await expectMockBatchConfirmRequestCount(page, 1)
  } finally {
    await context.close()
  }
})

test('JobQueue 暂停确认只发送一次可观测 Mock 请求', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await page.goto('/login')
    await page.evaluate(() => {
      window.__FARM_RESET_MOCK__()
      window.__FARM_RESET_MOCK_DEBUG__()
    })
    await login(page)
    await openSidebarItem(page, 1440, '任务队列')
    await page.locator('.t-tabs__nav-item').filter({ hasText: '活动任务' }).click()

    const activeRow = page.locator('.t-tab-panel:visible .job-queue-table .t-table__body tr')
      .filter({ hasText: '#1001' })
      .first()
    await expect(activeRow).toBeVisible()
    await activeRow.getByRole('button', { name: '更多', exact: true }).click()
    await page.getByText('暂停打印', { exact: true }).last().click()

    const dialog = page.locator('.t-dialog:visible').filter({ hasText: '暂停打印确认' })
    await expect(dialog).toHaveCount(1)
    await expect.poll(() => mockRequestCount(page, 'POST /api/v1/control/403/pause')).toBe(0)
    await dialog.getByRole('button', { name: '暂停打印', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => mockRequestCount(page, 'POST /api/v1/control/403/pause')).toBe(1)
  } finally {
    await context.close()
  }
})

test('TC-008 任务历史在四个桌面尺寸下铺满表格、整行详情和 FAILED 重试', async ({ browser }) => {
  test.setTimeout(120000)
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()

  try {
    await page.goto('/login')
    await page.evaluate(jobs => window.__FARM_RESET_MOCK__({ jobs }), createTc008HistoryJobs())
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    for (const viewport of [
      { width: 800, height: 560 },
      { width: 1024, height: 640 },
      { width: 1200, height: 760 },
      { width: 1920, height: 855 }
    ]) {
      await page.setViewportSize(viewport)
      await openSidebarItem(page, viewport.width, '打印历史')
      await expect(page.getByRole('heading', { name: '打印历史记录', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '查看任务 #1005 详情', exact: true })).toBeVisible()

      const tableContent = page.locator('.history-management-table .t-table__content')
      await expect(tableContent).toBeVisible()
      const tableStart = await tableContent.evaluate(element => {
        element.scrollLeft = 0
        element.scrollTop = 0
        return {
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
          scrollWidth: element.scrollWidth,
          scrollHeight: element.scrollHeight,
          scrollLeft: element.scrollLeft,
          scrollTop: element.scrollTop,
          overflowX: getComputedStyle(element).overflowX,
          overflowY: getComputedStyle(element).overflowY
        }
      })
      if (viewport.width <= 1024) expect(tableStart.scrollWidth).toBeGreaterThan(tableStart.clientWidth)
      else expect(tableStart.scrollWidth).toBeGreaterThanOrEqual(tableStart.clientWidth)
      if (viewport.width === 1920) expect(Math.abs(tableStart.scrollWidth - tableStart.clientWidth)).toBeLessThanOrEqual(1)
      expect(tableStart.scrollHeight).toBeGreaterThan(tableStart.clientHeight)
      expect(tableStart.scrollLeft).toBe(0)
      expect(tableStart.scrollTop).toBe(0)
      expect(['auto', 'scroll']).toContain(tableStart.overflowX)
      expect(['auto', 'scroll']).toContain(tableStart.overflowY)
      await expect(page.getByRole('columnheader', { name: '任务信息' })).toBeVisible()

      const tableEnd = await tableContent.evaluate(element => {
        element.scrollLeft = element.scrollWidth
        element.scrollTop = element.scrollHeight
        return {
          scrollLeft: element.scrollLeft,
          maxScrollLeft: element.scrollWidth - element.clientWidth,
          scrollTop: element.scrollTop,
          maxScrollTop: element.scrollHeight - element.clientHeight
        }
      })
      expect(tableEnd.scrollLeft).toBeGreaterThanOrEqual(tableEnd.maxScrollLeft - 1)
      expect(tableEnd.scrollTop).toBeGreaterThan(0)
      expect(tableEnd.scrollTop).toBeGreaterThanOrEqual(tableEnd.maxScrollTop - 1)
      await expect(page.getByRole('columnheader', { name: '执行结果' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '操作' })).toHaveCount(0)
      await expect(page.locator('.history-management-table .t-table__body tr').last()).toBeVisible()

      await tableContent.evaluate(element => {
        element.scrollLeft = element.scrollWidth
        element.scrollTop = 0
      })
      const failedRow = page.getByRole('button', { name: '查看任务 #1005 详情', exact: true })
      await failedRow.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }))
      await failedRow.click()
      const drawerBody = page.locator('.task-detail-drawer .t-drawer__body')
      await expect(drawerBody).toBeVisible()
      const retryButton = page.locator('.task-detail-drawer').getByRole('button', { name: '重新排队', exact: true })
      await expect(retryButton).toBeVisible()
      await page.locator('.task-detail-drawer__technical').getByText('技术信息', { exact: true }).click()
      const drawerStart = await drawerBody.evaluate(element => {
        element.scrollTop = 0
        return {
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          scrollTop: element.scrollTop,
          overflowY: getComputedStyle(element).overflowY
        }
      })
      expect(drawerStart.scrollTop).toBe(0)
      expect(['auto', 'scroll']).toContain(drawerStart.overflowY)
      const drawerEnd = await drawerBody.evaluate(element => {
        element.scrollTop = element.scrollHeight
        return {
          scrollTop: element.scrollTop,
          maxScrollTop: element.scrollHeight - element.clientHeight
        }
      })
      if (drawerStart.scrollHeight > drawerStart.clientHeight) {
        expect(drawerEnd.scrollTop).toBeGreaterThan(0)
        expect(drawerEnd.scrollTop).toBeGreaterThanOrEqual(drawerEnd.maxScrollTop - 1)
      } else {
        expect(drawerEnd.scrollTop).toBe(0)
      }
      await expect(page.getByText('尝试次数', { exact: true })).toBeVisible()
      await retryButton.click()
      await expect(retryButton).toBeDisabled()
      await expect(retryButton).toHaveClass(/t-is-loading/)
      const successMessage = page.getByText(/已创建重试任务 #(\d+)/).first()
      await expect(successMessage).toBeVisible()
      const retryId = (await successMessage.textContent()).match(/#(\d+)/)?.[1]
      expect(retryId).toBeTruthy()
      await page.getByRole('button', { name: '关闭任务详情', exact: true }).click()
      await openSidebarItem(page, viewport.width, '任务队列')
      await expect(page.locator('.job-queue-table .t-table__body tr').filter({ hasText: `#${retryId}` })).toBeVisible()
      await openSidebarItem(page, viewport.width, '打印历史')
      await expect(page.getByRole('button', { name: '查看任务 #1005 详情', exact: true })).toBeVisible()
      await assertNoViewportOverflow(page)
    }
  } finally {
    await context.close()
  }
})

test('服务器连接页在桌面和移动视口保持可用且拆分地址操作', async ({ browser }) => {
  test.setTimeout(60000)
  for (const viewport of [
    { width: 1920, height: 855 },
    { width: 375, height: 812 }
  ]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    try {
      await page.route('**/actuator/health', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"UP"}' }))
      await page.goto('/server-connection')
      await expect(page.getByRole('heading', { name: '连接生产服务器' })).toBeVisible()
      const hostInput = page.locator('.connection-endpoint-grid__host input')
      const portInput = page.locator('.connection-endpoint-grid input[placeholder="28081"]')
      const wsToggle = page.locator('.connection-ws-label .t-switch')
      const wsProtocol = page.getByLabel('WebSocket 协议').getByRole('textbox', { name: '请选择' })
      const wsInput = page.locator('.connection-ws-address input')
      await expect(hostInput).toBeVisible()
      await expect(portInput).toBeVisible()
      await expect(wsToggle).toBeVisible()
      await expect(wsProtocol).toBeVisible()
      await expect(wsInput).toBeVisible()
      await expect(wsProtocol).toBeDisabled()
      await expect(wsInput).toBeDisabled()
      const wsHeadingBox = await page.locator('.connection-ws-heading').boundingBox()
      const wsInputBox = await page.locator('.connection-ws-input-group').boundingBox()
      expect(wsHeadingBox).not.toBeNull()
      expect(wsInputBox).not.toBeNull()
      expect(wsHeadingBox.y + wsHeadingBox.height).toBeLessThanOrEqual(wsInputBox.y)
      await expect(page.getByText('当前配置', { exact: true })).toBeVisible()
      await expect(page.getByText('LOCAL EDITION', { exact: true })).toBeVisible()
      await expect(page.getByText('嘉东三维管理平台', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '返回登录', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '使用启动配置', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '测试', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '保存并连接', exact: true })).toBeVisible()
      await expect(page.getByText('测试并保存', { exact: true })).toHaveCount(0)
      await assertNoViewportOverflow(page)
      if (viewport.width === 1920) {
        const pageMetrics = await page.locator('.connection-page').evaluate(element => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight
        }))
        expect(pageMetrics.scrollHeight).toBeLessThanOrEqual(pageMetrics.clientHeight + 1)
        await hostInput.fill('http://farm.local/path')
        await portInput.fill('8080')
        await page.getByRole('button', { name: '测试', exact: true }).click()
        await expect(page.getByText('请输入有效的服务器 IP 或主机名，不要包含协议、路径或查询参数')).toBeVisible()
        await hostInput.fill('127.0.0.1')
        await wsToggle.click()
        await expect(wsProtocol).toBeEnabled()
        await expect(wsInput).toBeVisible()
        await expect(wsInput).toBeEnabled()
        await wsInput.fill('127.0.0.1:8080/ws/farm-status')
        await page.getByRole('button', { name: '保存并连接', exact: true }).click()
        await expect(page).toHaveURL(/\/login$/)
        await expect.poll(() => page.evaluate(() => window.localStorage.getItem('fabmatrix.server.connection'))).toContain('ws://127.0.0.1:8080/ws/farm-status')
      }
    } finally {
      await context.close()
    }
  }
})

test('打印机和文件结果区拥有明确的滚动容器', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 855 } })
  const page = await context.newPage()
  try {
    await login(page)
    await openSidebarItem(page, 1920, '打印机管理')
    await expect(page).toHaveURL(/\/printers$/)
    await expect(page.getByRole('heading', { name: '打印机管理' })).toBeVisible()
    await expect(page.getByRole('button', { name: '删除打印机' }).first()).toBeVisible()
    const printerScrollMetrics = await page.locator('.printer-table .t-table__content').first().evaluate(element => {
      const style = getComputedStyle(element)
      return {
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }
    })
    const pageScrollMetrics = await page.locator('.app-content__view').evaluate(element => ({
      overflowY: getComputedStyle(element).overflowY,
      clientHeight: element.clientHeight
    }))
    expect(['auto', 'scroll']).toContain(printerScrollMetrics.overflowX)
    expect(printerScrollMetrics.scrollWidth).toBeLessThanOrEqual(printerScrollMetrics.clientWidth + 1)
    expect(pageScrollMetrics.overflowY).toBe('hidden')
    expect(printerScrollMetrics.clientHeight).toBeGreaterThan(0)
    expect(pageScrollMetrics.clientHeight).toBeGreaterThan(0)

    await openSidebarItem(page, 1920, '文件库')
    await expect(page).toHaveURL(/\/files$/)
    await expect(page.getByRole('heading', { name: '文件库' })).toBeVisible()
    const gridRadio = page.getByRole('radio', { name: '网格视图', exact: true })
    await gridRadio.locator('..').click()
    await expect(gridRadio).toBeChecked()
    await expect(page.locator('.file-grid-view')).toBeVisible()
    const fileScrollMetrics = await page.locator('.file-grid-view').evaluate(element => {
      const style = getComputedStyle(element)
      return {
        overflowY: style.overflowY,
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        parentWidth: element.parentElement?.clientWidth,
        cardWidth: element.querySelector('.file-card')?.getBoundingClientRect().width
      }
    })
    expect(['auto', 'scroll']).toContain(fileScrollMetrics.overflowY)
    expect(fileScrollMetrics.clientHeight).toBeGreaterThan(0)
    const gridColumns = await page.locator('.file-grid-view .file-card').evaluateAll(cards => new Set(
      cards.map(card => Math.round(card.getBoundingClientRect().left))
    ).size)
    expect(gridColumns).toBeGreaterThan(1)
    await assertNoViewportOverflow(page)
  } finally {
    await context.close()
  }
})

test('任务中心通过真实点击打开详情并可用 Escape 关闭', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  try {
    await login(page)
    await openSidebarItem(page, 1440, '任务队列')
    await expect(page.getByRole('heading', { name: '生产调度队列' })).toBeVisible()
    await page.getByRole('button', { name: '详情', exact: true }).first().click()
    await expect(page.getByText('已知时间线', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('已知时间线', { exact: true })).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('TC-005 800x560 任务详情内容区域和技术信息可达', async ({ browser }) => {
  test.setTimeout(60000)
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()
  try {
    await login(page)
    await openSidebarItem(page, 800, '任务队列')
    await expect(page.getByRole('heading', { name: '生产调度队列' })).toBeVisible()
    await page.locator('.t-tabs__nav-item').filter({ hasText: '活动任务' }).click()
    await page.locator('.job-queue-table:visible tbody tr').first().click()

    const drawer = page.locator('.task-detail-drawer')
    await expect(drawer).toContainText('资源与人员')
    const body = drawer.locator('.t-drawer__body')
    const metrics = await body.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY
    }))
    expect(['auto', 'scroll']).toContain(metrics.overflowY)

    await body.evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect(drawer.getByText('技术信息', { exact: true })).toBeVisible()
    await expect(drawer.getByRole('button', { name: '关闭任务详情', exact: true })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('移动端在表格页面通过真实点击打开侧栏并导航', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const page = await context.newPage()
  try {
    await login(page)
    await openSidebarItem(page, 375, '打印历史')
    await expect(page.getByRole('heading', { name: '打印历史记录' })).toBeVisible()
    await openSidebarItem(page, 375, '打印机管理')
    await expect(page).toHaveURL(/\/printers$/)
    await expect(page.getByRole('heading', { name: '打印机管理' })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('800x560 历史表在 3、8 和更多记录下保持内部双向滚动与详情可达', async ({ browser }) => {
  test.setTimeout(120000)
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()

  const createHistoryJobs = count => Array.from({ length: count }, (_, index) => ({
    id: 2000 + index,
    fileId: index % 2 ? 21 : 20,
    printerId: null,
    userId: index % 2 ? 2 : 1,
    operatorId: null,
    priority: 0,
    status: 'COMPLETED',
    progress: 100,
    startedAt: `2026-09-02T${String(10 + index).padStart(2, '0')}:00:00`,
    completedAt: `2026-09-02T${String(10 + index).padStart(2, '0')}:30:00`,
    errorReason: null,
    createdAt: `2026-09-02T${String(9 + index).padStart(2, '0')}:30:00`,
    updatedAt: `2026-09-02T${String(10 + index).padStart(2, '0')}:30:00`
  }))

  try {
    for (const count of [3, 8, 12]) {
      await page.goto('/login')
      await page.evaluate(jobs => window.__FARM_RESET_MOCK__({ jobs }), createHistoryJobs(count))
      await page.getByLabel('用户名', { exact: true }).fill('admin')
      await page.getByLabel('密码', { exact: true }).fill('Admin123')
      await page.getByRole('button', { name: '登录', exact: true }).click()
      await expect(page).toHaveURL(/\/dashboard$/)
      await openSidebarItem(page, 800, '打印历史')
      await expect(page.getByRole('heading', { name: '打印历史记录' })).toBeVisible()

      const table = page.locator('.history-management-table')
      const content = table.locator('.t-table__content').first()
      await expect(content).toBeVisible()
      await expect(table.locator('.t-table__body tr').first()).toBeVisible()

      const metrics = await content.evaluate(element => ({
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        overflowX: getComputedStyle(element).overflowX,
        overflowY: getComputedStyle(element).overflowY
      }))
      expect(metrics.clientWidth).toBeGreaterThan(0)
      expect(metrics.clientHeight).toBeGreaterThan(0)
      expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
      expect(['auto', 'scroll']).toContain(metrics.overflowX)
      expect(['auto', 'scroll']).toContain(metrics.overflowY)

      await content.evaluate(element => {
        element.scrollLeft = element.scrollWidth
        element.scrollTop = element.scrollHeight
      })
      const endMetrics = await content.evaluate(element => ({
        scrollLeft: element.scrollLeft,
        maxScrollLeft: element.scrollWidth - element.clientWidth,
        scrollTop: element.scrollTop,
        maxScrollTop: element.scrollHeight - element.clientHeight
      }))
      expect(endMetrics.scrollLeft).toBeGreaterThanOrEqual(Math.max(0, endMetrics.maxScrollLeft - 1))
      expect(endMetrics.scrollTop).toBeGreaterThanOrEqual(Math.max(0, endMetrics.maxScrollTop - 1))
      await expect(table.locator('.t-table__body tr').last()).toBeVisible()
      await expect(table.locator('.t-table__body tr[role="button"]').last()).toBeVisible()
    }
  } finally {
    await context.close()
  }
})

test('800x560 下 30x60 布局在网格内部滚动并展示保存摘要', async ({ browser }) => {
  test.setTimeout(120000)
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()

  try {
    await page.goto('/login')
    await page.evaluate(() => window.__FARM_RESET_MOCK__({
      dashboardLayout: {
        rowCount: 30,
        columnCount: 60,
        aisles: [],
        version: 1,
        limits: { minRows: 1, maxRows: 30, minColumns: 1, maxColumns: 60, maxCells: 1800, maxAisles: 20, minAisleSize: 48, maxAisleSize: 240 },
        updatedAt: '2026-09-11T00:00:00'
      }
    }))
    await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible()
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: '概览仪表盘' })).toBeVisible()
    await page.getByRole('button', { name: '设备看板', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard\/fullscreen$/)
    await expect(page.getByRole('heading', { name: '嘉东三维联动打印机实时控制系统' })).toBeVisible()
    await page.getByRole('button', { name: '布局设置', exact: true }).click()
    const gridMetrics = await page.locator('.grid-map-scroll').evaluate(element => ({
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    }))
    expect(gridMetrics.scrollWidth).toBeGreaterThan(gridMetrics.clientWidth)
    expect(gridMetrics.scrollHeight).toBeGreaterThan(gridMetrics.clientHeight)
    expect(gridMetrics.documentWidth).toBeLessThanOrEqual(gridMetrics.viewportWidth + 1)
    expect(gridMetrics.documentHeight).toBeLessThanOrEqual(gridMetrics.viewportHeight + 1)

    await page.getByRole('button', { name: '布局设置', exact: true }).click()
    await page.getByRole('button', { name: '减少物理列数', exact: true }).click()
    await page.getByRole('button', { name: '应用', exact: true }).click()
    await page.getByRole('button', { name: '保存布局', exact: true }).click()
    await expect(page.getByText('确认保存布局', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '确认保存', exact: true }).click()
    await expect(page.getByText('布局已保存', { exact: true })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('OPERATOR 看板不显示布局编辑入口', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()
  try {
    await loginAs(page, 'operator', 'Operator123')
    await page.getByRole('button', { name: '设备看板', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard\/fullscreen$/)
    await expect(page.getByRole('button', { name: '布局设置', exact: true })).toHaveCount(0)
    await expect(page.getByText('设备坐标异常', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '未分配设备', exact: true }).click()
    const unallocatedDrawer = page.locator('.t-drawer').filter({ hasText: '未分配设备' }).last()
    await expect(unallocatedDrawer).toBeVisible()
    await expect(unallocatedDrawer).toContainText('只读查看')
    await expect(unallocatedDrawer.getByRole('button', { name: '进入布局编辑', exact: true })).toHaveCount(0)
    await unallocatedDrawer.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(unallocatedDrawer).toBeHidden()
  } finally {
    await context.close()
  }
})

test('UI-006 布局加载失败时未分配 Drawer 保持打开且不虚假进入编辑', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()
  try {
    await page.goto('/login')
    await page.evaluate(() => window.__FARM_RESET_MOCK__())
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.getByRole('button', { name: '设备看板', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard\/fullscreen$/)
    await expect(page.getByRole('button', { name: '查看打印机总数' }).locator('.stat-card__value')).toHaveText(/[1-9]/)
    await page.evaluate(() => window.__FARM_SET_DASHBOARD_LAYOUT_ERROR__({
      status: 503,
      code: 503,
      message: '布局服务暂不可用，请稍后重试'
    }))
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    await page.waitForTimeout(350)
    await page.getByRole('button', { name: '未分配设备', exact: true }).click()
    const unallocatedDrawer = page.locator('.t-drawer').filter({ hasText: '未分配设备' }).last()
    await expect(unallocatedDrawer).toBeVisible()
    await unallocatedDrawer.getByRole('button', { name: '进入布局编辑', exact: true }).click()
    await expect(unallocatedDrawer).toContainText('布局服务暂不可用，请稍后重试')
    await expect(unallocatedDrawer).toBeVisible()
    await expect(page.getByText('点击空槽位选择并绑定设备', { exact: true })).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('UI-006 批量导入部分失败时保留 Drawer、失败选择和逐项原因', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()
  const failureReason = '设备认证失败：API Key 无效，请检查设备管理后台配置后重试'
  try {
    await page.goto('/login')
    await page.evaluate(reason => window.__FARM_RESET_MOCK__({
      batchAddFailures: [{ ipAddress: '192.168.0.94', reason }]
    }), failureReason)
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await openSidebarItem(page, 800, '打印机管理')
    await page.getByRole('button', { name: '扫描局域网设备', exact: true }).click()
    const scanDrawer = page.locator('.t-drawer').filter({ hasText: '扫描局域网设备' })
    await scanDrawer.getByRole('button', { name: '开始扫描', exact: true }).click()
    await expect(scanDrawer).toContainText('10 台新设备，1 台已知设备，1 台未知 MAC')
    await scanDrawer.getByRole('checkbox').first().locator('..').click({ force: true })
    await expect(scanDrawer).toContainText('已选择 12 台')
    await scanDrawer.getByRole('button', { name: /批量导入\/同步/ }).click()

    await expect(scanDrawer).toBeVisible()
    await expect(scanDrawer).toContainText('已选择 1 台')
    const failedCard = scanDrawer.locator('.printer-scan-card').filter({ hasText: '192.168.0.94' })
    await failedCard.scrollIntoViewIfNeeded()
    await expect(failedCard.getByText('导入失败', { exact: true })).toBeVisible()
    await expect(failedCard.locator('.printer-scan-card__failure-reason')).toHaveText(failureReason)
    await expect(failedCard.locator('.printer-scan-card__failure-reason')).toHaveCSS('text-overflow', 'ellipsis')
    const failureMetrics = await failedCard.evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }))
    expect(failureMetrics.scrollWidth).toBeLessThanOrEqual(failureMetrics.clientWidth + 1)
  } finally {
    await context.close()
  }
})

test('UI-007 扫描网段分段输入校验、请求范围和 800x560 布局', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()

  try {
    await page.goto('/login')
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await openSidebarItem(page, 800, '打印机管理')
    await page.getByRole('button', { name: '扫描局域网设备', exact: true }).click()

    const scanDrawer = page.locator('.t-drawer').filter({ hasText: '扫描局域网设备' })
    const subnetInputs = scanDrawer.locator('.printer-scan-subnet-segment input')
    await expect(subnetInputs).toHaveCount(3)
    await expect(subnetInputs.nth(0)).toHaveValue('192')
    await expect(subnetInputs.nth(1)).toHaveValue('168')
    await expect(subnetInputs.nth(2)).toHaveValue('0')
    await expect(scanDrawer.locator('.printer-scan-subnet-range')).toHaveText('范围 192.168.0.1 – 192.168.0.254')
    await expect(scanDrawer.locator('.printer-scan-subnet-button')).toHaveCount(1)
    await expect(scanDrawer.locator('.printer-scan-subnet-segment .t-input__suffix')).toHaveCount(0)

    await subnetInputs.nth(2).fill('7')
    await expect(scanDrawer.locator('.printer-scan-subnet-range')).toHaveText('范围 192.168.7.1 – 192.168.7.254')
    await scanDrawer.getByRole('button', { name: '开始扫描', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.__FARM_GET_LAST_SCAN_SUBNET__())).toBe('192.168.7')

    for (const invalidValue of ['', '-1', '1.2', 'abc', '256']) {
      await subnetInputs.nth(1).fill(invalidValue)
      await expect(scanDrawer.locator('.printer-scan-subnet-range')).toHaveText('范围待校验')
      await expect(scanDrawer.locator('.printer-scan-subnet-hint--error')).toHaveText('第2段请输入 0–255 的整数')
      await scanDrawer.getByRole('button', { name: '开始扫描', exact: true }).click()
      await expect.poll(() => page.evaluate(() => window.__FARM_GET_LAST_SCAN_SUBNET__())).toBe('192.168.7')
    }

    const drawerMetrics = await scanDrawer.locator('.t-drawer__content-wrapper').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      viewportWidth: window.innerWidth
    }))
    expect(drawerMetrics.scrollWidth).toBeLessThanOrEqual(drawerMetrics.clientWidth + 1)
    expect(drawerMetrics.clientWidth).toBeLessThanOrEqual(drawerMetrics.viewportWidth + 1)
  } finally {
    await context.close()
  }
})

test('UI-009 扫描网段标题与操作分层在桌面和窄屏保持可用', async ({ browser }) => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 375, height: 812 }
  ]

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()

    try {
      await page.goto('/login')
      await page.getByLabel('用户名', { exact: true }).fill('admin')
      await page.getByLabel('密码', { exact: true }).fill('Admin123')
      await page.getByRole('button', { name: '登录', exact: true }).click()
      await openSidebarItem(page, viewport.width, '打印机管理')
      await page.getByRole('button', { name: '扫描局域网设备', exact: true }).click()

      const scanDrawer = page.locator('.t-drawer').filter({ hasText: '扫描局域网设备' })
      const metrics = await scanDrawer.evaluate(drawer => {
        const box = element => {
          const rect = element.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }
        const heading = box(drawer.querySelector('.printer-scan-subnet-heading'))
        const title = box(drawer.querySelector('.printer-scan-subnet-title'))
        const range = box(drawer.querySelector('.printer-scan-subnet-range'))
        const control = box(drawer.querySelector('.printer-scan-subnet-control'))
        const segments = [...drawer.querySelectorAll('.printer-scan-subnet-segment')].map(box)
        const button = box(drawer.querySelector('.printer-scan-subnet-button'))
        const body = box(drawer.querySelector('.t-drawer__body'))
        return {
          heading,
          title,
          range,
          control,
          segmentWidths: segments.map(item => item.width),
          segmentCenterY: segments[0]?.y + segments[0]?.height / 2,
          segmentHeight: segments[0]?.height,
          button,
          body,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth
        }
      })

      expect(metrics.segmentWidths.length).toBe(3)
      expect(Math.max(...metrics.segmentWidths) - Math.min(...metrics.segmentWidths)).toBeLessThanOrEqual(1)
      expect(metrics.segmentWidths[0]).toBeGreaterThanOrEqual(56)
      expect(metrics.segmentWidths[0]).toBeLessThanOrEqual(64)
      expect(Math.abs(metrics.heading.x - metrics.control.x)).toBeLessThanOrEqual(1)
      expect(metrics.heading.x).toBeGreaterThanOrEqual(metrics.body.x - 1)
      expect(metrics.heading.x).toBeLessThan(metrics.body.x + metrics.body.width / 2)
      expect(metrics.heading.y).toBeLessThan(metrics.control.y)
      expect(Math.abs(metrics.title.y + metrics.title.height / 2 - (metrics.range.y + metrics.range.height / 2))).toBeLessThanOrEqual(2)
      expect(Math.abs(metrics.button.height - metrics.segmentHeight)).toBeLessThanOrEqual(2)
      expect(Math.abs(metrics.button.y + metrics.button.height / 2 - metrics.segmentCenterY)).toBeLessThanOrEqual(2)
      expect(Math.abs(metrics.button.x + metrics.button.width - (metrics.control.x + metrics.control.width))).toBeLessThanOrEqual(1)
      expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
      expect(metrics.button.width).toBeLessThan(metrics.body.width)
    } finally {
      await context.close()
    }
  }
})

test('UI-010 扫描抽屉配置区对齐、结果分隔和初始空态居中', async ({ browser }) => {
  const viewports = [
    { width: 800, height: 560 },
    { width: 375, height: 812 }
  ]

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()

    try {
      await page.goto('/login')
      await page.getByLabel('用户名', { exact: true }).fill('admin')
      await page.getByLabel('密码', { exact: true }).fill('Admin123')
      await page.getByRole('button', { name: '登录', exact: true }).click()
      await openSidebarItem(page, viewport.width, '打印机管理')
      await page.getByRole('button', { name: '扫描局域网设备', exact: true }).click()

      const scanDrawer = page.locator('.t-drawer').filter({ hasText: '扫描局域网设备' })
      await expect(scanDrawer.getByText('暂无数据', { exact: true })).toBeVisible()
      const metrics = await scanDrawer.evaluate(drawer => {
        const box = element => {
          const rect = element.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }
        const body = box(drawer.querySelector('.t-drawer__body'))
        const section = box(drawer.querySelector('.printer-scan-subnet-section'))
        const heading = box(drawer.querySelector('.printer-scan-subnet-heading'))
        const control = box(drawer.querySelector('.printer-scan-subnet-control'))
        const firstSegment = box(drawer.querySelector('.printer-scan-subnet-segment'))
        const divider = box(drawer.querySelector('.printer-scan-drawer__divider'))
        const resultRegion = box(drawer.querySelector('.printer-scan-drawer__result-region'))
        const empty = box(drawer.querySelector('.printer-scan-drawer__empty'))
        const footer = box(drawer.querySelector('.t-drawer__footer'))
        const bodyElement = drawer.querySelector('.t-drawer__body')
        const wrapperElement = drawer.querySelector('.t-drawer__content-wrapper')
        return {
          body,
          section,
          heading,
          control,
          firstSegment,
          divider,
          resultRegion,
          empty,
          footer,
          bodyScrollWidth: bodyElement.scrollWidth,
          bodyClientWidth: bodyElement.clientWidth,
          wrapperScrollWidth: wrapperElement.scrollWidth,
          wrapperClientWidth: wrapperElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        }
      })

      const leftEdges = [metrics.heading.x, metrics.control.x, metrics.firstSegment.x]
      expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThanOrEqual(3)
      expect(metrics.heading.x).toBeGreaterThanOrEqual(metrics.body.x)
      expect(metrics.heading.x).toBeLessThan(metrics.body.x + metrics.body.width)
      expect(metrics.divider.y).toBeGreaterThanOrEqual(metrics.section.y + metrics.section.height - 2)
      expect(metrics.divider.y + metrics.divider.height).toBeLessThanOrEqual(metrics.resultRegion.y + 2)
      expect(Math.abs(
        metrics.empty.y + metrics.empty.height / 2
          - (metrics.resultRegion.y + metrics.resultRegion.height / 2)
      )).toBeLessThanOrEqual(16)
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1)
      expect(metrics.wrapperScrollWidth).toBeLessThanOrEqual(metrics.wrapperClientWidth + 1)
      expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
      expect(metrics.footer.y + metrics.footer.height).toBeLessThanOrEqual(metrics.viewportHeight + 1)
      await expect(scanDrawer.getByRole('button', { name: '关闭', exact: true })).toBeVisible()
    } finally {
      await context.close()
    }
  }
})

test('UI-006 打印机选择跨页保留、筛选清空且两个抽屉在 800x560 可用', async ({ browser }) => {
  test.setTimeout(120000)
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()

  try {
    await page.goto('/login')
    await page.evaluate(() => window.__FARM_RESET_MOCK__({
      printers: Array.from({ length: 25 }, (_, index) => ({
        id: 500 + index,
        name: `UI005_Printer_${String(index + 1).padStart(2, '0')}`,
        machineNumber: index === 0 ? null : `T-${String(index + 1).padStart(2, '0')}`,
        ipAddress: `192.168.0.${index + 10}`,
        macAddress: `AA:BB:CC:00:00:${String(index + 1).padStart(2, '0')}`,
        firmwareType: index % 2 === 0 ? 'KLIPPER' : 'RRF',
        status: 'IDLE',
        monitorEnabled: true,
        isSafeToPrint: false,
        currentJobId: null,
        currentMaterial: 'PLA',
        nozzleSize: 0.4,
        gridRow: index === 0 ? null : Math.floor(index / 6) + 1,
        gridCol: index === 0 ? null : (index % 6) + 1,
        createdAt: '2026-09-11T00:00:00',
        updatedAt: '2026-09-11T00:00:00'
      }))
    }))
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await openSidebarItem(page, 800, '打印机管理')
    await expect(page.getByRole('heading', { name: '打印机管理' })).toBeVisible()

    const firstDeviceRow = page.locator('.printer-table tbody tr').first()
    await firstDeviceRow.getByTitle('点击编辑设备名称').click()
    await firstDeviceRow.getByPlaceholder('设备名称').fill('一号测试设备')
    await firstDeviceRow.getByPlaceholder('设备名称').press('Enter')
    await expect(firstDeviceRow.getByTitle('点击编辑设备名称')).toContainText('一号测试设备')

    await firstDeviceRow.getByTitle('点击编辑机器编号').click()
    await firstDeviceRow.getByPlaceholder('自定义编号').fill('LINE-A_01')
    await page.getByRole('heading', { name: '打印机管理' }).click()
    await expect(firstDeviceRow.getByTitle('点击编辑机器编号')).toContainText('LINE-A_01')
    await page.waitForTimeout(350)
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    await page.waitForTimeout(350)
    await expect(firstDeviceRow.getByTitle('点击编辑设备名称')).toContainText('一号测试设备')
    await expect(firstDeviceRow.getByTitle('点击编辑机器编号')).toContainText('LINE-A_01')

    const batchButton = page.getByRole('button', { name: /^(启用监控|停用监控) \(\d+\)$/ })
    const firstRowCheckbox = page.locator('.printer-table tbody tr').first().getByRole('checkbox')
    const selectFirstPrinter = async () => {
      await firstRowCheckbox.locator('..').click({ force: true })
      await expect(firstRowCheckbox).toBeChecked()
    }
    await expect(batchButton).toHaveCount(0)
    await selectFirstPrinter()
    await expect(batchButton).toHaveCount(1)

    const statusFilter = page.locator('.printer-management-status-filter')
    await statusFilter.click()
    await page.locator('.t-select-option').filter({ hasText: '待机' }).click()
    await expect(statusFilter.getByRole('textbox')).toHaveValue('待机')
    await expect(batchButton).toHaveCount(0)
    await expect(firstRowCheckbox).not.toBeChecked()
    await page.waitForTimeout(350)

    await selectFirstPrinter()
    await expect(batchButton).toHaveCount(1)
    await page.locator('.printer-management-table-footer .t-pagination__btn-next').click()
    await expect(page.locator('.printer-management-table-footer .t-pagination__number.t-is-current')).toHaveText('2')
    await expect(batchButton).toContainText('(1)')
    await expect(page.locator('.printer-table tbody tr').first().getByRole('checkbox')).not.toBeChecked()
    await page.locator('.printer-table tbody tr').first().getByRole('checkbox').locator('..').click({ force: true })
    await expect(batchButton).toContainText('(2)')
    await page.locator('.printer-management-table-footer .t-pagination__btn-prev').click()
    await expect(firstRowCheckbox).toBeChecked()
    await expect(page.getByRole('button', { name: '批量删除 (2)' })).toBeVisible()
    await page.getByRole('button', { name: '批量删除 (2)' }).click()
    const deleteConfirmation = page.locator('.t-dialog:visible').filter({ hasText: '批量删除设备' })
    await expect(deleteConfirmation).toContainText('一号测试设备')
    await expect(deleteConfirmation).toContainText('UI005_Printer_21')
    await deleteConfirmation.getByRole('button', { name: '取消' }).click()
    await page.getByRole('button', { name: '清空选择 (2)' }).click()
    await expect(batchButton).toHaveCount(0)
    await expect(firstRowCheckbox).not.toBeChecked()

    const mainTableMetrics = await page.locator('.printer-table .t-table__content').first().evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX
    }))
    expect(mainTableMetrics.scrollWidth).toBeGreaterThanOrEqual(1170)
    expect(mainTableMetrics.scrollWidth).toBeGreaterThan(mainTableMetrics.clientWidth)
    expect(['auto', 'scroll']).toContain(mainTableMetrics.overflowX)

    await page.getByRole('button', { name: '设备看板', exact: true }).click()
    await expect(page.getByRole('heading', { name: '嘉东三维联动打印机实时控制系统' })).toBeVisible()
    await page.getByRole('button', { name: '未分配设备', exact: true }).click()
    const unallocatedDrawer = page.locator('.t-drawer').filter({ hasText: '未分配设备' }).last()
    await expect(unallocatedDrawer).toBeVisible()
    await expect(unallocatedDrawer).toContainText('IP 地址')
    await unallocatedDrawer.getByRole('button', { name: '进入布局编辑', exact: true }).click()
    await expect(page.getByText('点击空槽位选择并绑定设备', { exact: true })).toBeVisible()
    await expect(unallocatedDrawer).toBeHidden()

    await page.getByText('点击绑定', { exact: true }).first().click()
    const bindDialog = page.locator('.t-dialog').filter({ hasText: /绑定设备至/ }).last()
    await expect(bindDialog).toBeVisible()
    await expect(bindDialog.getByText('一号测试设备', { exact: true })).toBeVisible()
    const bindRowMetrics = await bindDialog.locator('.t-table tbody tr').first().evaluate(element => ({
      height: element.getBoundingClientRect().height,
      cursor: getComputedStyle(element).cursor
    }))
    expect(bindRowMetrics.height).toBeLessThanOrEqual(44)
    expect(bindRowMetrics.cursor).toBe('pointer')
    await bindDialog.getByText('一号测试设备', { exact: true }).click()
    const confirmDialog = page.locator('.t-dialog').filter({ hasText: '确认绑定' }).last()
    await confirmDialog.getByRole('button', { name: '确定', exact: true }).click()
    await expect(bindDialog).toBeHidden()

    await page.getByText('点击绑定', { exact: true }).first().click()
    const reopenedBindDialog = page.locator('.t-dialog').filter({ hasText: /绑定设备至/ }).last()
    await expect(reopenedBindDialog.getByText('一号测试设备', { exact: true })).toHaveCount(0)
    await expect(reopenedBindDialog.getByText('暂无可绑定的设备', { exact: true })).toBeVisible()
    await reopenedBindDialog.locator('.t-dialog__close').click()
    await expect(reopenedBindDialog).toBeHidden()
    await page.getByRole('button', { name: '取消', exact: true }).click()
    const discardDialog = page.locator('.t-dialog').filter({ hasText: '取消布局编辑' }).last()
    await discardDialog.getByRole('button', { name: '放弃修改', exact: true }).click()

    await page.goBack()
    await expect(page.getByRole('heading', { name: '打印机管理' })).toBeVisible()
    await expect(page.getByRole('button', { name: '未分配设备', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '扫描局域网设备', exact: true }).click()
    const scanDrawer = page.locator('.t-drawer').filter({ hasText: '扫描局域网设备' })
    await expect(scanDrawer).toBeVisible()
    await scanDrawer.getByRole('button', { name: '开始扫描', exact: true }).click()
    await expect(scanDrawer.getByText('共扫描到 12 台设备', { exact: false })).toBeVisible()
    await expect(scanDrawer.getByText('协议 Klipper', { exact: true }).first()).toBeVisible()
    await expect(scanDrawer.getByText('协议 RRF', { exact: true }).first()).toBeVisible()
    await expect(scanDrawer.getByText('新', { exact: true }).first()).toBeVisible()
    await expect(scanDrawer.getByText('已知', { exact: true }).first()).toBeVisible()
    await expect(scanDrawer.getByText('未知 MAC', { exact: true }).first()).toBeVisible()
    await expect(scanDrawer).toContainText('10 台新设备，1 台已知设备，1 台未知 MAC')

    const scanScrollMetrics = await scanDrawer.locator('.printer-scan-drawer__list').evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }))
    expect(scanScrollMetrics.scrollHeight).toBeGreaterThan(scanScrollMetrics.clientHeight)
    expect(['auto', 'scroll']).toContain(scanScrollMetrics.overflowY)
    expect(scanScrollMetrics.scrollWidth).toBeLessThanOrEqual(scanScrollMetrics.clientWidth + 1)

    const footerMetrics = await scanDrawer.locator('.t-drawer__footer').evaluate(element => {
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, viewportHeight: window.innerHeight }
    })
    expect(footerMetrics.top).toBeGreaterThanOrEqual(0)
    expect(footerMetrics.bottom).toBeLessThanOrEqual(footerMetrics.viewportHeight)
    await expect(scanDrawer.locator('.t-drawer__footer').getByRole('button', { name: '关闭', exact: true })).toBeVisible()
    await expect(scanDrawer.getByRole('button', { name: /批量导入\/同步/ })).toBeVisible()
    const firstScanCard = scanDrawer.locator('.printer-scan-card').first()
    await firstScanCard.getByRole('checkbox').locator('..').click({ force: true })
    await expect(scanDrawer).toContainText('已选择 1 台')
    await scanDrawer.getByRole('checkbox').first().locator('..').click({ force: true })
    await expect(scanDrawer).toContainText('已选择 12 台')

    await firstScanCard.locator('input').last().fill('编辑后的设备名称')
    await scanDrawer.getByRole('button', { name: /批量导入\/同步/ }).click()
    await expect.poll(() => page.evaluate(() => window.__FARM_GET_LAST_BATCH_ADD_PAYLOAD__())).not.toEqual([])
    const batchPayload = await page.evaluate(() => window.__FARM_GET_LAST_BATCH_ADD_PAYLOAD__())
    expect(batchPayload[0]).toMatchObject({ suggestedName: '编辑后的设备名称' })
    expect(batchPayload[0]).not.toHaveProperty('name')
    expect(Object.keys(batchPayload[0]).sort()).toEqual(['firmwareType', 'ipAddress', 'isNewDevice', 'macAddress', 'suggestedName'].sort())
    await expect(scanDrawer).toBeHidden()
  } finally {
    await context.close()
  }
})


test('账号安全：临时密码必须修改且业务导航不能绕过', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(async () => { const { mockState } = await import('/src/mock/data.js'); Object.assign(mockState.users[1], { username: 'worker', password: 'Temporary1', mustChangePassword: true }) })
  await page.getByLabel('用户名', { exact: true }).fill('worker')
  await page.getByLabel('密码', { exact: true }).fill('Temporary1')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/change-password$/)
  await page.evaluate(async () => (await import('/src/router/index.js')).default.push('/printers'))
  await expect(page).toHaveURL(/\/change-password$/)
  const fields = page.locator('input[type=password]')
  await fields.nth(0).fill('Temporary1')
  await fields.nth(1).fill('Employee1')
  await fields.nth(2).fill('Employee1')
  await page.getByRole('button', { name: '修改并重新登录' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('用户名', { exact: true }).fill('worker')
  await page.getByLabel('密码', { exact: true }).fill('Employee1')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('账号安全：查看员能读取设备和文件但没有生产操作入口', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(async () => { const { mockState } = await import('/src/mock/data.js'); Object.assign(mockState.users[1], { username: 'viewer', password: 'Viewer123', role: 'VIEWER' }) })
  await page.getByLabel('用户名', { exact: true }).fill('viewer')
  await page.getByLabel('密码', { exact: true }).fill('Viewer123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await openSidebarItem(page, 1280, '任务队列')
  await expect(page.getByRole('heading', { name: '生产调度队列' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toHaveCount(0)
  await openSidebarItem(page, 1280, '文件库')
  await expect(page.getByRole('button', { name: '新建文件夹', exact: true })).toHaveCount(0)
  await page.evaluate(async () => (await import('/src/router/index.js')).default.push('/users'))
  await expect(page).toHaveURL(/\/403/)
})

test('账号安全：管理员重置员工密码并查询账号审计和自己的会话', async ({ page }) => {
  await login(page)
  await openSidebarItem(page, 1280, '用户管理')
  const row = page.locator('tr').filter({ hasText: 'operator' }).first()
  await row.getByRole('button', { name: '重置密码' }).click()
  const dialog = page.locator('.t-dialog').filter({ hasText: '重置密码：operator' })
  await dialog.locator('input[type=password]').nth(0).fill('Temporary1')
  await dialog.locator('input[type=password]').nth(1).fill('Temporary1')
  await dialog.getByRole('button', { name: '重置并退出原会话' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(row).toContainText('待改密')
  await openSidebarItem(page, 1280, '操作日志')
  await expect(page.getByText('管理员重置密码', { exact: true }).first()).toBeVisible()
  await openSidebarItem(page, 1280, '个人中心')
  await expect(page.getByText('127.0.0.1（当前会话）', { exact: true })).toBeVisible()
})
