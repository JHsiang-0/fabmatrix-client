import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = relativePath => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
const security = await import('../electron/security.cjs')

test('Electron 安全策略只允许受信任渲染器和 HTTP(S) 外链', () => {
  assert.equal(security.isAllowedRendererUrl(
    'http://127.0.0.1:5176/#/dashboard',
    { mode: 'dev-server', source: 'http://127.0.0.1:5176' }
  ), true)
  assert.equal(security.isAllowedRendererUrl(
    'http://127.0.0.1:5177/#/dashboard',
    { mode: 'dev-server', source: 'http://127.0.0.1:5176' }
  ), false)
  assert.equal(security.isAllowedRendererUrl(
    'file:///C:/FabMatrix/dist/index.html#/dashboard',
    { mode: 'dist-file', source: 'file:///C:/FabMatrix/dist/index.html' }
  ), true)
  assert.equal(security.isAllowedRendererUrl(
    'file:///C:/FabMatrix/secret.html',
    { mode: 'dist-file', source: 'file:///C:/FabMatrix/dist/index.html' }
  ), false)

  assert.equal(security.isAllowedExternalUrl('https://example.com/docs'), true)
  assert.equal(security.isAllowedExternalUrl('http://example.com/docs'), true)
  assert.equal(security.isAllowedExternalUrl('javascript:alert(1)'), false)
  assert.equal(security.isAllowedExternalUrl('https://user:password@example.com/'), false)
  assert.equal(security.isAllowedExternalUrl('file:///C:/secret.txt'), false)
})

test('CSP 在正式构建禁止远程脚本、对象和内联脚本，开发模式保留 HMR 能力', () => {
  const productionCsp = security.getContentSecurityPolicy()
  const developmentCsp = security.getContentSecurityPolicy({ isDevelopment: true })

  assert.match(productionCsp, /script-src 'self'/)
  assert.doesNotMatch(productionCsp, /unsafe-inline.*script|unsafe-eval/)
  assert.match(productionCsp, /object-src 'none'/)
  assert.match(productionCsp, /connect-src[^;]*\b(?:http:|https:|ws:|wss:)/)
  assert.match(developmentCsp, /unsafe-inline/)
  assert.match(developmentCsp, /unsafe-eval/)
  assert.match(developmentCsp, /connect-src[^;]*\bws:/)
})

test('R100-08 运行时、构建和上传边界保持显式', () => {
  const mainSource = read('electron/main.cjs')
  const preloadSource = read('electron/preload.cjs')
  const viteSource = read('vite.config.js')
  const indexSource = read('index.html')
  const mockSource = read('src/mock/index.js')
  const mainRendererSource = read('src/main.js')
  const uploadSource = read('src/views/FileLibrary.vue')
  const batchDispatchSource = read('src/views/BatchDispatch.vue')
  const packageJson = JSON.parse(read('package.json'))
  const mockBuilderConfig = read('electron-builder.mock.yml')

  assert.match(mainSource, /contextIsolation: true/)
  assert.match(mainSource, /nodeIntegration: false/)
  assert.match(mainSource, /sandbox: true/)
  assert.match(mainSource, /will-navigate/)
  assert.match(mainSource, /will-redirect/)
  assert.match(mainSource, /getContentSecurityPolicy/)
  assert.match(mainSource, /onHeadersReceived/)
  assert.match(mainSource, /'Content-Security-Policy': \[policy\]/)
  assert.match(mainSource, /event\?\.sender === mainWindow\.webContents/)
  assert.match(mainSource, /event\?\.senderFrame\?\.url/)
  assert.match(mainSource, /app\.isPackaged \? null : app\.getPath\('userData'\)/)
  assert.match(preloadSource, /contextBridge\.exposeInMainWorld\('farmDesktop'/)
  assert.match(preloadSource, /contextIsolation|isPackaged/)
  assert.match(viteSource, /isExplicitMockMode/)
  assert.match(viteSource, /transformIndexHtml/)
  assert.match(viteSource, /context\.server/)
  assert.match(viteSource, /html\.replace\('__FARM_CONTENT_SECURITY_POLICY__'/)
  assert.match(indexSource, /Content-Security-Policy[^>]*__FARM_CONTENT_SECURITY_POLICY__/)
  assert.match(viteSource, /VITE_USE_MOCK.*!isExplicitMockMode/)
  assert.doesNotMatch(mockSource, /runtimeEnv\.VITE_USE_MOCK === 'true'/)
  assert.match(mainRendererSource, /!window\.farmDesktop\?\.isPackaged[\s\S]*import\.meta\.env\.MODE\.startsWith\('desktop'\)/)
  assert.equal(packageJson.scripts['desktop:build:mock'].includes('electron-builder.mock.yml'), true)
  assert.match(mockBuilderConfig, /appId: com\.jiadong3d\.fabmatrix\.client\.mock/)
  assert.match(mockBuilderConfig, /farmMode: mock/)
  assert.match(mockBuilderConfig, /output: release-mock/)
  assert.match(uploadSource, /const controller = new AbortController\(\)/)
  assert.match(uploadSource, /onBeforeUnmount\(\(\) => \{[\s\S]*cancelUpload\(\)/)
  assert.match(batchDispatchSource, /const controller = new AbortController\(\)/)
  assert.match(batchDispatchSource, /onUnmounted\(\(\) => \{[\s\S]*cancelUpload\(\)/)
  assert.match(batchDispatchSource, /if \(isUnmounted \|\| controller\.signal\.aborted\) return/)
})
