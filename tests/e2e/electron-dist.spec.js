import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright'
import { expect, test } from '@playwright/test'

test('Electron 正式构建的待改密账号保持改密页且不启动实时业务连接', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fabmatrix-electron-password-e2e-'))
  const electronApp = await electron.launch({
    args: [path.resolve('.')],
    env: {
      ...process.env,
      FARM_ELECTRON_E2E: '1',
      FARM_ELECTRON_E2E_DIST: '1',
      FARM_ELECTRON_E2E_USER_DATA: userDataDir
    }
  })
  try {
    const page = await electronApp.firstWindow()
    const businessRequests = []
    let socketAttempts = 0
    let changedPassword = false
    const identity = {
      userId: '2', username: 'worker', role: 'OPERATOR', mustChangePassword: true
    }
    await page.route('http://**/*', async route => {
      const request = route.request()
      const pathname = new URL(request.url()).pathname
      let data
      if (pathname === '/api/v1/auth/setup/status') data = { initialized: true, setupEnabled: false }
      else if (pathname === '/api/v1/auth/login') {
        data = { ...identity, token: 'synthetic-temporary-session', expiresIn: 3600 }
      } else if (pathname === '/api/v1/auth/me') data = identity
      else if (pathname === '/api/v1/auth/2/change-password') {
        expect(request.postDataJSON()).toEqual({
          oldPassword: 'Temporary1', newPassword: 'Employee1', confirmPassword: 'Employee1'
        })
        changedPassword = true
        data = null
      } else {
        businessRequests.push(pathname)
        await route.fulfill({ status: 403, json: { code: 4031, message: '请先修改临时密码' } })
        return
      }
      await route.fulfill({ json: { code: 200, message: '操作成功', data } })
    })
    await page.routeWebSocket('ws://**/*', socket => {
      socketAttempts += 1
      socket.close({ code: 1008, reason: 'Password change required' })
    })
    await page.reload()
    await page.getByLabel('用户名', { exact: true }).fill('worker')
    await page.getByLabel('密码', { exact: true }).fill('Temporary1')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(/#\/change-password$/)
    await expect(page.getByText('请修改临时密码', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '修改并重新登录' })).toBeEnabled()
    expect(socketAttempts).toBe(0)
    expect(businessRequests).toEqual([])

    await page.reload()
    await expect(page.getByText('请修改临时密码', { exact: true })).toBeVisible()
    expect(socketAttempts).toBe(0)
    expect(businessRequests).toEqual([])
    const fields = page.locator('input[type=password]')
    await fields.nth(0).fill('Temporary1')
    await fields.nth(1).fill('Employee1')
    await fields.nth(2).fill('Employee1')
    await page.getByRole('button', { name: '修改并重新登录' }).click()
    await expect(page).toHaveURL(/#\/login$/)
    expect(changedPassword).toBe(true)
    expect(socketAttempts).toBe(0)
    expect(businessRequests).toEqual([])
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('farm-ui-session'))).toBeNull()
  } finally {
    await electronApp.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})

test('Electron desktop 构建产物加载 dist-file 并保留运行诊断', async () => {
  const distIndexPath = path.resolve('dist/index.html')
  expect(fs.existsSync(distIndexPath)).toBe(true)

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fabmatrix-electron-dist-e2e-'))
  const electronApp = await electron.launch({
    args: [path.resolve('.')],
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: '1',
      FARM_ELECTRON_E2E: '1',
      FARM_ELECTRON_E2E_DIST: '1',
      FARM_ELECTRON_E2E_USER_DATA: userDataDir
    }
  })

  try {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveTitle(/FabMatrix Desktop/)
    await expect(page).toHaveURL(/^file:/)

    const mainRuntime = await page.evaluate(() => window.farmDesktop.getRuntimeInfo())
    expect(mainRuntime.isPackaged).toBe(false)
    expect(mainRuntime.rendererMode).toBe('dist-file')
    expect(mainRuntime.rendererSource).toMatch(/^file:\/\//)
    expect(mainRuntime.userDataPath).toContain('fabmatrix-electron-dist-e2e-')
    expect(mainRuntime.window.minSize).toEqual([800, 560])
    expect(mainRuntime.window.maxSize).toEqual([1200, 760])

    const rendererRuntime = await page.evaluate(() => window.__FARM_RUNTIME_DIAGNOSTICS__?.())
    expect(rendererRuntime).toEqual({
      mode: 'desktop',
      baseUrl: './',
      useMock: false,
      apiBaseUrl: 'http://localhost:28081',
      wsUrl: 'ws://localhost:28081/ws/farm-status'
    })

    await expect(page.getByRole('banner', { name: '应用标题栏' })).toBeVisible()
    await expect(page.getByRole('button', { name: '最小化窗口' })).toBeVisible()
    await expect(page.getByRole('button', { name: '最大化窗口' })).toBeVisible()
    await expect(page.getByRole('button', { name: '关闭窗口' })).toBeVisible()

    await page.getByRole('button', { name: '最大化窗口' }).click()
    await expect.poll(() => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized())).toBe(true)
    await expect(page.getByRole('button', { name: '还原窗口' })).toBeVisible()
    await page.getByRole('button', { name: '还原窗口' }).click()
    await expect.poll(() => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized())).toBe(false)

    for (const [requestedWidth, requestedHeight] of [[800, 560], [1024, 640], [1200, 760], [1920, 1032]]) {
      await electronApp.evaluate(({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(size[0], size[1])
      }, [requestedWidth, requestedHeight])

      await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([requestedWidth, requestedHeight])

      const windowMetrics = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight
      }))
      expect(windowMetrics.width).toBeGreaterThanOrEqual(800)
      expect(windowMetrics.height).toBeGreaterThanOrEqual(560)
      expect(windowMetrics.width).toBeLessThanOrEqual(requestedWidth)
      expect(windowMetrics.height).toBeLessThanOrEqual(requestedHeight)
      expect(windowMetrics.documentWidth).toBeLessThanOrEqual(windowMetrics.width + 1)
      expect(windowMetrics.bodyHeight).toBeLessThanOrEqual(windowMetrics.height + 1)
    }

    await page.screenshot({ path: 'test-results/playwright/electron-dist-titlebar.png' })
  } finally {
    await electronApp.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})
