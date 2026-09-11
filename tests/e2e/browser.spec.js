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
  } finally {
    await context.close()
  }
})
