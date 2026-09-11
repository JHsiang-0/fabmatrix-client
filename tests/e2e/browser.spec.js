import { expect, test } from '@playwright/test'

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
  { label: '批量派发', path: '/batch-dispatch', text: '批量手动派发' },
  { label: '用户管理', path: '/users', text: '用户管理' },
  { label: '操作日志', path: '/audit-logs', text: '操作日志' },
  { label: '个人中心', path: '/profile', text: '个人资料' }
]

const parentLabels = {
  概览仪表盘: '工作台',
  打印机管理: '打印机',
  文件库: '文件',
  任务队列: '任务',
  打印历史: '任务',
  批量派发: '批量派发',
  用户管理: '管理中心',
  操作日志: '管理中心',
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

test('批量派发页面完成真实预览确认流程', async ({ browser }) => {
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
    await page.waitForTimeout(500)
    await expect(page.getByText(/执行完成：计划状态 CONFIRMED/)).toBeVisible()
    await expect(page.getByText(/成功 1 项，失败 0 项/)).toBeVisible()
    await expect(page.getByRole('button', { name: '再次获取执行结果', exact: true })).toBeVisible()
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
      const portInput = page.locator('.connection-endpoint-grid input[placeholder="8080"]')
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
      }
    })
    const pageScrollMetrics = await page.locator('.app-content__view').evaluate(element => ({
      overflowY: getComputedStyle(element).overflowY,
      clientHeight: element.clientHeight
    }))
    expect(['auto', 'scroll']).toContain(printerScrollMetrics.overflowX)
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

test('TC-005 800x560 任务详情使用内部滚动且技术信息可达', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 800, height: 560 } })
  const page = await context.newPage()
  try {
    await login(page)
    await openSidebarItem(page, 800, '任务队列')
    await expect(page.getByRole('heading', { name: '生产调度队列' })).toBeVisible()
    await page.getByText('活动任务', { exact: true }).click()
    await page.locator('.job-queue-table').getByRole('button', { name: '详情', exact: true }).first().click()

    const drawer = page.locator('.task-detail-drawer')
    await expect(drawer).toContainText('资源与人员')
    const body = drawer.locator('.t-drawer__body')
    const metrics = await body.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY
    }))
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
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
      await expect(table.getByRole('button', { name: '详情', exact: true }).last()).toBeVisible()
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

test('UI-006 打印机选择不跨筛选分页且两个抽屉在 800x560 可用', async ({ browser }) => {
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

    const batchButton = page.getByRole('button', { name: /^(启用监控|停用监控) \(\d+\)$/ })
    const firstRowCheckbox = page.locator('.printer-table tbody tr').first().getByRole('checkbox')
    const selectFirstPrinter = async () => {
      await firstRowCheckbox.locator('..').click({ force: true })
      await expect(firstRowCheckbox).toBeChecked()
    }
    await expect(batchButton).toHaveCount(0)
    await selectFirstPrinter()
    await expect(batchButton).toHaveCount(1)

    const idleFilter = page.getByRole('radio', { name: '待机', exact: true })
    await idleFilter.locator('..').click()
    await expect(idleFilter).toBeChecked()
    await expect(batchButton).toHaveCount(0)
    await expect(firstRowCheckbox).not.toBeChecked()
    await page.waitForTimeout(350)

    await selectFirstPrinter()
    await expect(batchButton).toHaveCount(1)
    await page.locator('.printer-management-table-footer .t-pagination__btn-next').click()
    await expect(page.locator('.printer-management-table-footer .t-pagination__number.t-is-current')).toHaveText('2')
    await expect(batchButton).toHaveCount(0)
    await expect(page.locator('.printer-table tbody tr').first().getByRole('checkbox')).not.toBeChecked()

    const mainTableMetrics = await page.locator('.printer-table .t-table__content').first().evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX
    }))
    expect(mainTableMetrics.scrollWidth).toBeGreaterThanOrEqual(1180)
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
