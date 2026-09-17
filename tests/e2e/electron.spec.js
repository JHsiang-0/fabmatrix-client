import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright'
import { expect, test } from '@playwright/test'
import { isFeatureEnabled } from '../../src/config/features.js'

const E2E_DESKTOP_URL = 'http://127.0.0.1:5177'
const batchDispatchEnabled = isFeatureEnabled('batchDispatch')

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

test('Electron desktop-mock 启动、登录、路由和全屏看板冒烟', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fabmatrix-electron-e2e-'))
  const electronApp = await electron.launch({
    args: [path.resolve('.')],
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: '1',
      FARM_ELECTRON_E2E: '1',
      FARM_ELECTRON_E2E_USER_DATA: userDataDir,
      FARM_ELECTRON_DEV_SERVER_URL: E2E_DESKTOP_URL
    }
  })

  try {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveTitle(/FabMatrix Desktop/)

    const mainRuntime = await page.evaluate(() => window.farmDesktop.getRuntimeInfo())
    expect(mainRuntime.appId).toBe('com.jiadong3d.fabmatrix.client')
    expect(mainRuntime.isPackaged).toBe(false)
    expect(mainRuntime.rendererMode).toBe('dev-server')
    expect(mainRuntime.rendererSource).toBe(E2E_DESKTOP_URL)
    expect(mainRuntime.userDataPath).toContain('fabmatrix-electron-e2e-')
    expect(mainRuntime.window.minSize).toEqual([800, 560])
    expect(mainRuntime.window.maxSize).toEqual([1200, 760])

    const rendererRuntime = await page.evaluate(() => window.__FARM_RUNTIME_DIAGNOSTICS__?.())
    expect(rendererRuntime).toEqual({
      mode: 'desktop-mock',
      baseUrl: '/',
      useMock: true,
      apiBaseUrl: 'http://localhost:28081',
      wsUrl: 'ws://localhost:28081/ws/farm-status'
    })

    await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible()
    await expect(page.getByRole('banner', { name: '应用标题栏' })).toContainText('嘉东三维联动3D打印机实时控制系统')
    await expect(page.getByText('Mock 调试账号请使用系统中已有的用户名和密码', { exact: true })).toHaveCount(0)
    const connectionButton = page.getByRole('button', { name: '配置服务器地址', exact: true })
    await expect(connectionButton).toBeVisible()
    await expect(connectionButton).toHaveAttribute('title', '配置服务器地址')
    await expect(connectionButton.locator('svg')).toHaveCount(1)
    await expect(page.locator('.login-page .logo-mark')).toHaveCount(0)
    const rightSectionBox = await page.locator('.right-section').boundingBox()
    const connectionButtonBox = await connectionButton.boundingBox()
    const leftSectionBox = await page.locator('.left-section').boundingBox()
    const footerBox = await page.locator('.left-section .login-footer').boundingBox()
    expect(rightSectionBox).not.toBeNull()
    expect(connectionButtonBox).not.toBeNull()
    expect(leftSectionBox).not.toBeNull()
    expect(footerBox).not.toBeNull()
    expect(connectionButtonBox.x + connectionButtonBox.width).toBeGreaterThanOrEqual(rightSectionBox.x + rightSectionBox.width - 96)
    expect(connectionButtonBox.y + connectionButtonBox.height).toBeGreaterThanOrEqual(rightSectionBox.y + rightSectionBox.height - 96)
    expect(footerBox.x + footerBox.width).toBeLessThanOrEqual(leftSectionBox.x + leftSectionBox.width + 1)
    const loginMetrics = await page.locator('.login-page').evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    }))
    expect(loginMetrics.scrollHeight).toBeLessThanOrEqual(loginMetrics.clientHeight + 1)
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1:5177\/#\/dashboard/)
    await expect(page.getByRole('heading', { name: '概览仪表盘' })).toBeVisible()
    await expect(page.locator('.app-sidebar .app-brand')).toBeVisible()
    const sidebarBrandBox = await page.locator('.app-sidebar .app-brand').boundingBox()
    const appHeaderBox = await page.locator('.app-header').boundingBox()
    expect(sidebarBrandBox).not.toBeNull()
    expect(appHeaderBox).not.toBeNull()
    expect(Math.abs(sidebarBrandBox.y - appHeaderBox.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(sidebarBrandBox.height - appHeaderBox.height)).toBeLessThanOrEqual(1)

    for (const size of [[800, 560], [1024, 640], [1200, 760]]) {
      await electronApp.evaluate(({ BrowserWindow }, nextSize) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(nextSize[0], nextSize[1])
      }, size)
      await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual(size)

      const windowMetrics = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth
      }))
      expect(windowMetrics.documentWidth).toBeLessThanOrEqual(windowMetrics.width + 1)
    }

    await page.getByRole('button', { name: '设备看板', exact: true }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1:5177\/#\/dashboard\/fullscreen/)
    await expect(page.getByRole('banner', { name: '应用标题栏' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '嘉东三维联动打印机实时控制系统' })).toBeVisible()
    await page.getByRole('button', { name: '退出全屏', exact: true }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1:5177\/#\/printers/)
    await expect(page.getByRole('banner', { name: '应用标题栏' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '打印机管理' })).toBeVisible()
    await expect(page.getByRole('button', { name: '删除打印机' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '详情', exact: true })).toHaveCount(0)
    await page.locator('.printer-table .t-table__body tr').first().click()
    await expect(page.getByText('设备信息', { exact: true })).toBeVisible()
    await expect(page.getByText('Printer_C0DA - 详细信息', { exact: true })).toBeVisible()
    await expect(page.locator('.printer-detail-drawer')).not.toContainText('undefined')
    const drawerMetrics = await page.locator('.printer-detail-drawer .t-drawer__body').evaluate(element => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY
    }))
    expect(drawerMetrics.scrollHeight).toBeGreaterThan(drawerMetrics.clientHeight)
    expect(['auto', 'scroll']).toContain(drawerMetrics.overflowY)
    await page.getByRole('button', { name: '关闭打印机详情', exact: true }).click()
    await expect(page.getByText('设备信息', { exact: true })).toHaveCount(0)

    await page.goto(`${E2E_DESKTOP_URL}/#/server-connection`)
    await expect(page.getByRole('heading', { name: '连接生产服务器' })).toBeVisible()
    await expect(page.getByRole('button', { name: '测试', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '保存并连接', exact: true })).toBeVisible()

    await page.goto(`${E2E_DESKTOP_URL}/#/files`)
    await expect(page.getByRole('heading', { name: '文件库' })).toBeVisible()
    await expect(page.locator('.file-library-main')).toBeVisible()
    await expect(page.locator('.file-library-sidebar')).toBeVisible()
    await expect(page.locator('.file-folder-tree')).toBeVisible()
    const defaultFolderCandidates = page.locator('.file-folder-tree .t-tree__label').filter({ hasText: /^我的文件夹$/ })
    await expect(defaultFolderCandidates.first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.file-table-view')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('radio', { name: '列表视图', exact: true }).locator('..')).toBeVisible()
    const fileWorkspaceMetrics = await page.evaluate(() => {
      const main = document.querySelector('.file-library-main')
      const toolbarCard = document.querySelector('.file-library-toolbar-card')
      const resultsCard = document.querySelector('.file-library-table-card')
      const tableView = document.querySelector('.file-table-view')
      const table = document.querySelector('.file-table-view .t-table__content')
      const toolbarStyle = toolbarCard ? getComputedStyle(toolbarCard) : null
      const resultsStyle = resultsCard ? getComputedStyle(resultsCard) : null
      const toolbarRect = toolbarCard?.getBoundingClientRect()
      const resultsRect = resultsCard?.getBoundingClientRect()
      const pagination = document.querySelector('.file-library-pagination')
      return {
        mainHeight: main?.clientHeight || 0,
        tableHeight: table?.clientHeight || 0,
        tableOverflow: table ? getComputedStyle(table).overflowY : '',
        toolbarBackground: toolbarStyle?.backgroundColor || '',
        toolbarBorder: toolbarStyle?.borderTopWidth || '',
        tableBorder: resultsStyle?.borderTopWidth || '',
        tableRadius: resultsStyle?.borderTopLeftRadius || '',
        separated: toolbarRect && resultsRect ? resultsRect.top - toolbarRect.bottom : 0,
        toolbarIsMainChild: toolbarCard?.parentElement === main,
        tableIsMainChild: resultsCard?.parentElement === main,
        tableViewIsResultsChild: resultsCard?.contains(tableView) === true,
        paginationIsMainChild: pagination?.parentElement === main
      }
    })
    expect(fileWorkspaceMetrics.mainHeight).toBeGreaterThan(0)
    expect(fileWorkspaceMetrics.tableHeight).toBeGreaterThan(0)
    expect(['auto', 'scroll']).toContain(fileWorkspaceMetrics.tableOverflow)
    expect(fileWorkspaceMetrics.toolbarBackground).not.toBe('rgba(0, 0, 0, 0)')
    expect(fileWorkspaceMetrics.toolbarBorder).toBe('1px')
    expect(fileWorkspaceMetrics.tableBorder).toBe('1px')
    expect(fileWorkspaceMetrics.tableRadius).not.toBe('0px')
    expect(fileWorkspaceMetrics.separated).toBeGreaterThanOrEqual(8)
    expect(fileWorkspaceMetrics.toolbarIsMainChild).toBe(true)
    expect(fileWorkspaceMetrics.tableIsMainChild).toBe(true)
    expect(fileWorkspaceMetrics.tableViewIsResultsChild).toBe(true)
    expect(fileWorkspaceMetrics.paginationIsMainChild).toBe(true)
    await page.getByRole('button', { name: '新建文件夹', exact: true }).first().click()
    await expect(page.locator('.t-dialog__header-content').filter({ hasText: '新建文件夹' })).toBeVisible()
    await page.getByRole('button', { name: '取消', exact: true }).last().click()
    await expect(page.locator('.t-dialog__header-content').filter({ hasText: '新建文件夹' })).not.toBeVisible()
    await page.getByRole('button', { name: '上传', exact: true }).first().click()
    await expect(page.locator('.t-dialog__header-content').filter({ hasText: '批量上传切片文件' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.t-dialog__header-content').filter({ hasText: '批量上传切片文件' })).not.toBeVisible()
    const firstFolderName = '产品样件'
    const treeFolder = page.locator('.file-folder-tree .t-tree__label').filter({ hasText: firstFolderName }).first()
    await expect(treeFolder).toBeVisible()
    await treeFolder.click()
    await expect(page.locator('.file-library-filter-form .t-breadcrumb')).toHaveCount(0)
    let gearboxFile = null
    for (const folderCandidate of await defaultFolderCandidates.all()) {
      await folderCandidate.click()
      await expect(page.locator('.file-table-view .t-loading__overlay')).toBeHidden({ timeout: 10000 })
      const candidateFile = page.getByText('gearbox.gcode', { exact: true })
      if (await candidateFile.isVisible()) {
        gearboxFile = candidateFile
        break
      }
    }
    expect(gearboxFile, '未找到包含 gearbox.gcode 的默认文件夹').not.toBeNull()
    await expect(gearboxFile).toBeVisible({ timeout: 10000 })
    const gearboxBox = await gearboxFile.boundingBox()
    const contextClick = { x: 24, y: 16 }
    await gearboxFile.click({ button: 'right', position: contextClick })
    const detailMenuItem = page.getByText('查看详情', { exact: true })
    await expect(detailMenuItem).toBeVisible()
    const detailMenuBox = await detailMenuItem.boundingBox()
    const clickPoint = { x: gearboxBox.x + contextClick.x, y: gearboxBox.y + contextClick.y }
    const menuBox = await page.locator('.t-dropdown__menu:visible').last().boundingBox()
    expect(Math.abs(detailMenuBox.x - (gearboxBox.x + contextClick.x))).toBeLessThan(120)
    expect(menuBox).not.toBeNull()
    expect(menuBox.x).toBeGreaterThanOrEqual(0)
    expect(menuBox.y).toBeGreaterThanOrEqual(0)
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual((await page.evaluate(() => window.innerWidth)) + 1)
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual((await page.evaluate(() => window.innerHeight)) + 1)
    expect(Math.abs(clickPoint.x - menuBox.x)).toBeLessThan(160)
    await detailMenuItem.click()
    await expect(page.getByRole('button', { name: '关闭文件详情', exact: true })).toBeVisible()
    await expect(page.getByText('切片摘要', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '关闭文件详情', exact: true }).click()
    await page.getByRole('button', { name: '打印', exact: true }).first().click()
    await expect(page.getByText('创建打印任务', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '取消', exact: true }).last().click()
  } finally {
    await electronApp.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})

test('Electron TC-008 三尺寸历史整行详情可达且 FAILED 重试会刷新队列', async () => {
  test.setTimeout(180000)
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fabmatrix-electron-tc008-e2e-'))
  const electronApp = await electron.launch({
    args: [path.resolve('.')],
    env: {
      ...process.env,
      FARM_ELECTRON_E2E: '1',
      FARM_ELECTRON_E2E_USER_DATA: userDataDir,
      FARM_ELECTRON_DEV_SERVER_URL: E2E_DESKTOP_URL
    }
  })

  try {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(jobs => window.__FARM_RESET_MOCK__({ jobs }), createTc008HistoryJobs())
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1:5177\/#\/dashboard/)

    for (const size of [[800, 560], [1024, 640], [1200, 760]]) {
      await electronApp.evaluate(({ BrowserWindow }, nextSize) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(nextSize[0], nextSize[1])
      }, size)
      await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual(size)
      await page.evaluate(() => { window.location.hash = '#/tasks/history' })
      await expect(page).toHaveURL(/127\.0\.0\.1:5177\/#\/tasks\/history/)
      await expect(page.getByRole('heading', { name: '打印历史记录', exact: true })).toBeVisible()

      const table = page.locator('.history-management-table')
      const tableContent = table.locator('.t-table__content')
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
          scrollTop: element.scrollTop
        }
      })
      if (size[0] <= 1024) expect(tableStart.scrollWidth).toBeGreaterThan(tableStart.clientWidth)
      else expect(tableStart.scrollWidth).toBeGreaterThanOrEqual(tableStart.clientWidth)
      expect(tableStart.scrollHeight).toBeGreaterThan(tableStart.clientHeight)
      expect(tableStart.scrollLeft).toBe(0)
      expect(tableStart.scrollTop).toBe(0)
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
      await expect(table.locator('.t-table__body tr').last()).toBeVisible()

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
      const drawerEnd = await drawerBody.evaluate(element => {
        element.scrollTop = 0
        const start = element.scrollTop
        const maxScrollTop = element.scrollHeight - element.clientHeight
        element.scrollTop = element.scrollHeight
        return {
          start,
          scrollTop: element.scrollTop,
          maxScrollTop,
          overflowY: getComputedStyle(element).overflowY
        }
      })
      expect(drawerEnd.start).toBe(0)
      if (drawerEnd.maxScrollTop > 0) {
        expect(drawerEnd.scrollTop).toBeGreaterThan(0)
        expect(drawerEnd.scrollTop).toBeGreaterThanOrEqual(drawerEnd.maxScrollTop - 1)
      } else {
        expect(drawerEnd.scrollTop).toBe(0)
      }
      expect(['auto', 'scroll']).toContain(drawerEnd.overflowY)
      await expect(page.getByText('尝试次数', { exact: true })).toBeVisible()
      await retryButton.click()
      await expect(retryButton).toBeDisabled()
      await expect(retryButton).toHaveClass(/t-is-loading/)
      const successMessage = page.getByText(/已创建重试任务 #(\d+)/).first()
      await expect(successMessage).toBeVisible()
      const retryId = (await successMessage.textContent()).match(/#(\d+)/)?.[1]
      expect(retryId).toBeTruthy()
      await page.getByRole('button', { name: '关闭任务详情', exact: true }).click()
      await page.evaluate(() => { window.location.hash = '#/tasks/queue' })
      await expect(page).toHaveURL(/127\.0\.0\.1:5177\/#\/tasks\/queue/)
      await expect(page.locator('.job-queue-table .t-table__body tr').filter({ hasText: `#${retryId}` })).toBeVisible()
      const viewportMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth
      }))
      expect(viewportMetrics.documentWidth).toBeLessThanOrEqual(viewportMetrics.viewportWidth + 1)
    }
  } finally {
    await electronApp.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})

test('Electron App Shell 在三个桌面窗口尺寸下保持单一滚动模型', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fabmatrix-electron-shell-e2e-'))
  const electronApp = await electron.launch({
    args: [path.resolve('.')],
    env: {
      ...process.env,
      FARM_ELECTRON_E2E: '1',
      FARM_ELECTRON_E2E_USER_DATA: userDataDir,
      FARM_ELECTRON_DEV_SERVER_URL: E2E_DESKTOP_URL
    }
  })

  try {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
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
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1:5177\/#\/dashboard/)

    for (const size of [[800, 560], [1024, 640], [1200, 760]]) {
      await electronApp.evaluate(({ BrowserWindow }, nextSize) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(nextSize[0], nextSize[1])
      }, size)
      await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual(size)

      const layoutMetrics = await page.evaluate(() => {
        const getMetrics = selector => {
          const element = document.querySelector(selector)
          if (!element) return null
          const style = getComputedStyle(element)
          return {
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            overflowY: style.overflowY,
            overflowX: style.overflowX
          }
        }

        return {
          body: getMetrics('body'),
          shell: getMetrics('.app-shell'),
          mainLayout: getMetrics('.app-main-layout'),
          content: getMetrics('.app-content'),
          contentView: getMetrics('.app-content__view'),
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth
        }
      })

      expect(layoutMetrics.documentWidth).toBeLessThanOrEqual(layoutMetrics.viewportWidth + 1)
      expect(layoutMetrics.body.overflowY).toBe('hidden')
      expect(layoutMetrics.shell.scrollHeight).toBeLessThanOrEqual(layoutMetrics.shell.clientHeight + 1)
      expect(layoutMetrics.mainLayout.scrollHeight).toBeLessThanOrEqual(layoutMetrics.mainLayout.clientHeight + 1)
      expect(layoutMetrics.contentView.overflowY).toBe('auto')
      expect(layoutMetrics.contentView.clientHeight).toBeGreaterThan(0)
    }

    await page.goto(`${E2E_DESKTOP_URL}/#/dashboard/fullscreen`)
    await expect(page.locator('.fullscreen-dashboard')).toBeVisible()
    await expect(page.locator('.fullscreen-dashboard .dashboard-header h1')).toBeVisible()
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(800, 560)
    })
    await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([800, 560])
    const gridMetrics = await page.locator('.fullscreen-dashboard .grid-map-scroll').evaluate(element => ({
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight
    }))
    expect(gridMetrics.scrollWidth).toBeGreaterThan(gridMetrics.clientWidth)
    expect(gridMetrics.scrollHeight).toBeGreaterThan(gridMetrics.clientHeight)
    expect(gridMetrics.documentWidth).toBeLessThanOrEqual(801)
    expect(gridMetrics.documentHeight).toBeLessThanOrEqual(561)

    await page.goto(`${E2E_DESKTOP_URL}/#/printers`)
    await expect(page.getByRole('heading', { name: '打印机管理' })).toBeVisible()
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(800, 560)
    })
    await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([800, 560])

    const printerTableContent = page.locator('.printer-table .t-table__content').first()
    await printerTableContent.hover()
    await page.mouse.wheel(0, 500)
    await expect.poll(() => printerTableContent.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  } finally {
    await electronApp.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})

test('Electron UI-002 主业务页面在三种窗口尺寸下可达并生成稳定截图', async ({ baseURL }, testInfo) => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fabmatrix-electron-ui002-'))
  const electronApp = await electron.launch({
    args: [path.resolve('.')],
    env: {
      ...process.env,
      FARM_ELECTRON_E2E: '1',
      FARM_ELECTRON_E2E_USER_DATA: userDataDir,
      FARM_ELECTRON_DEV_SERVER_URL: E2E_DESKTOP_URL
    }
  })

  const pages = [
    { key: 'printers', path: '/printers', heading: '打印机管理' },
    { key: 'files', path: '/files', heading: '文件库' },
    { key: 'queue', path: '/tasks/queue', heading: '生产调度队列' },
    { key: 'history', path: '/tasks/history', heading: '打印历史记录' },
    { key: 'batch', path: '/batch-dispatch', heading: '批量手动派发', feature: 'batchDispatch' },
    { key: 'profile', path: '/profile', heading: '个人中心' },
    { key: 'fullscreen', path: '/dashboard/fullscreen', heading: '嘉东三维联动打印机实时控制系统' }
  ].filter(route => !route.feature || isFeatureEnabled(route.feature))

  try {
    expect(baseURL).toBe('http://127.0.0.1:5173')
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.getByLabel('用户名', { exact: true }).fill('admin')
    await page.getByLabel('密码', { exact: true }).fill('Admin123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1:5177\/#\/dashboard/)
    if (batchDispatchEnabled) {
      await expect(page.locator('.app-sidebar').getByText('批量派发', { exact: true })).toHaveCount(1)
    } else {
      await expect(page.locator('.app-sidebar').getByText('批量派发', { exact: true })).toHaveCount(0)
      await page.goto(`${E2E_DESKTOP_URL}/#/batch-dispatch`)
      await expect(page).toHaveURL(/127\.0\.0\.1:5177\/#\/404/)
      await expect(page.getByText('页面不存在', { exact: true })).toBeVisible()
    }

    for (const size of [[800, 560], [1024, 640], [1200, 760]]) {
      await electronApp.evaluate(({ BrowserWindow }, nextSize) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(nextSize[0], nextSize[1])
      }, size)
      await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual(size)

      for (const route of pages) {
        await page.goto(`${E2E_DESKTOP_URL}/#${route.path}`)
        await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible()
        if (route.key === 'files') {
          await expect(page.locator('.file-table-view')).toBeVisible({ timeout: 10000 })
        }
        if (route.key === 'queue') {
          await expect(page.locator('.job-panel')).toBeVisible({ timeout: 10000 })
          await expect(page.getByRole('button', { name: '刷新', exact: true })).toBeEnabled({ timeout: 10000 })
        }
        if (route.key === 'history') await expect(page.locator('.history-workspace')).toBeVisible()
        if (route.key === 'history') {
          await expect(page.getByRole('button', { name: '刷新', exact: true })).toBeEnabled({ timeout: 10000 })
        }
        if (route.key === 'batch') {
          await expect(page.locator('.batch-dispatch-page')).toBeVisible()
          await expect(page.getByRole('button', { name: '刷新资源', exact: true })).toBeEnabled({ timeout: 10000 })
        }
        if (route.key === 'profile') await expect(page.locator('.profile-loading')).toHaveCount(0, { timeout: 10000 })
        await expect(page.locator('.t-message')).toHaveCount(0, { timeout: 10000 })

        const metrics = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth
        }))
        expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
        await page.screenshot({ path: testInfo.outputPath(`${route.key}-${size[0]}x${size[1]}.png`) })
      }
    }
  } finally {
    await electronApp.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})
