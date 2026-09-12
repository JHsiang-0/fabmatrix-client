import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright'
import { expect, test } from '@playwright/test'

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
