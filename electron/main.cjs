const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, ipcMain, screen, shell } = require('electron')
const {
  getAllowedDevServerUrl,
  getContentSecurityPolicy,
  isAllowedExternalUrl,
  isAllowedRendererUrl
} = require('./security.cjs')

const getPackagedFarmMode = () => {
  if (!app.isPackaged) return null

  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
    return packageJson.farmMode || null
  } catch {
    return null
  }
}

const FARM_MODE = getPackagedFarmMode()
const APP_ID = FARM_MODE === 'mock'
  ? 'com.jiadong3d.fabmatrix.client.mock'
  : 'com.jiadong3d.fabmatrix.client'
const DEV_SERVER_URL = getAllowedDevServerUrl(process.env.FARM_ELECTRON_DEV_SERVER_URL)
const DIST_INDEX_PATH = path.join(__dirname, '..', 'dist', 'index.html')
const WINDOW_SIZE = {
  minWidth: 800,
  minHeight: 560,
  maxWidth: 1200,
  maxHeight: 760,
  viewportRatio: 0.7
}

let activeRenderer = null

app.setAppUserModelId(APP_ID)

// Playwright Electron smoke runs use an isolated profile so a developer's
// running FabMatrix window cannot steal the single-instance lock.
if (!app.isPackaged && process.env.FARM_ELECTRON_E2E_USER_DATA) {
  app.setPath('userData', process.env.FARM_ELECTRON_E2E_USER_DATA)
}

let mainWindow = null

const shouldUseDistRenderer = () => (
  app.isPackaged
  || (!app.isPackaged && (
    process.env.FARM_ELECTRON_E2E_DIST === '1'
    || process.argv.includes('--farm-dist')
  ))
)

const getPlannedRenderer = () => shouldUseDistRenderer()
  ? { mode: 'dist-file', source: pathToFileURL(DIST_INDEX_PATH).href }
  : { mode: 'dev-server', source: DEV_SERVER_URL }

const getRenderer = () => activeRenderer || getPlannedRenderer()

const getWindowState = () => ({
  isMaximized: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()),
  isFullscreen: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen())
})

const notifyWindowStateChange = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const state = getWindowState()
  mainWindow.webContents.send('farm-window:state-changed', state)
  mainWindow.webContents.send('farm-window:fullscreen-changed', state.isFullscreen)
}

const getRuntimeInfo = () => {
  const contentSize = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow.getContentSize()
    : null

  return {
    appId: APP_ID,
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    rendererMode: getRenderer().mode,
    rendererSource: app.isPackaged ? null : getRenderer().source,
    userDataPath: app.isPackaged ? null : app.getPath('userData'),
    window: {
      contentSize,
      isFullscreen: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()),
      minSize: [WINDOW_SIZE.minWidth, WINDOW_SIZE.minHeight],
      maxSize: [WINDOW_SIZE.maxWidth, WINDOW_SIZE.maxHeight]
    }
  }
}

const isTrustedRendererEvent = event => (
  Boolean(mainWindow)
  && !mainWindow.isDestroyed()
  && event?.sender === mainWindow.webContents
  && isAllowedRendererUrl(event?.senderFrame?.url, getRenderer())
)

const registerWindowIpcHandler = (channel, handler) => {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedRendererEvent(event)) throw new Error('拒绝来自未授权渲染器的 IPC 请求')
    return handler(event, ...args)
  })
}

const openExternalUrl = url => {
  if (!isAllowedExternalUrl(url)) return false
  void shell.openExternal(url).catch(() => {})
  return true
}

const installContentSecurityPolicy = () => {
  const policy = getContentSecurityPolicy({ isDevelopment: !app.isPackaged })
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    {
      urls: [
        'http://127.0.0.1:*/*',
        'http://localhost:*/*',
        'http://[::1]:*/*',
        'file://*/*'
      ]
    },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [policy]
        }
      })
    }
  )
}

const loadRenderer = async () => {
  if (shouldUseDistRenderer()) {
    if (!fs.existsSync(DIST_INDEX_PATH)) {
      throw new Error(`找不到桌面构建入口：${DIST_INDEX_PATH}`)
    }

    await mainWindow.loadFile(DIST_INDEX_PATH)
    activeRenderer = getPlannedRenderer()
    return
  }

  try {
    await mainWindow.loadURL(DEV_SERVER_URL)
    activeRenderer = getPlannedRenderer()
  } catch (error) {
    if (!fs.existsSync(DIST_INDEX_PATH)) throw error

    console.warn('Vite 开发服务器不可用，将回退到本地构建产物:', error.message)
    await mainWindow.loadFile(DIST_INDEX_PATH)
    activeRenderer = { mode: 'dist-file', source: pathToFileURL(DIST_INDEX_PATH).href }
  }
}

const getAppIconPath = () => {
  const candidates = app.isPackaged
    ? [path.join(__dirname, '..', 'dist', 'icon.png')]
    : [
        path.join(__dirname, '..', 'public', 'icon.png'),
        path.join(__dirname, '..', 'dist', 'icon.png')
      ]

  return candidates.find(candidate => fs.existsSync(candidate))
}

registerWindowIpcHandler('farm-window:set-fullscreen', (_event, fullscreen) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false

  mainWindow.setFullScreen(Boolean(fullscreen))
  notifyWindowStateChange()
  return getWindowState().isFullscreen
})

registerWindowIpcHandler('farm-window:get-state', () => getWindowState())

registerWindowIpcHandler('farm-window:minimize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return getWindowState()

  mainWindow.minimize()
  return getWindowState()
})

registerWindowIpcHandler('farm-window:toggle-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return getWindowState()

  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
  notifyWindowStateChange()
  return getWindowState()
})

registerWindowIpcHandler('farm-window:close', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false

  mainWindow.close()
  return true
})

registerWindowIpcHandler('farm-runtime:get-info', () => getRuntimeInfo())

const getWindowSize = () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  return {
    width: clamp(Math.floor(width * WINDOW_SIZE.viewportRatio), WINDOW_SIZE.minWidth, WINDOW_SIZE.maxWidth),
    height: clamp(Math.floor(height * WINDOW_SIZE.viewportRatio), WINDOW_SIZE.minHeight, WINDOW_SIZE.maxHeight)
  }
}

const hasSingleInstanceLock = !app.isPackaged && process.env.FARM_ELECTRON_E2E === '1'
  ? true
  : app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return

    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  const createWindow = async () => {
    const { width, height } = getWindowSize()

    mainWindow = new BrowserWindow({
      width,
      height,
      useContentSize: true,
      minWidth: WINDOW_SIZE.minWidth,
      minHeight: WINDOW_SIZE.minHeight,
      center: true,
      resizable: true,
      frame: false,
      show: false,
      autoHideMenuBar: true,
      icon: getAppIconPath(),
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    installContentSecurityPolicy()

    mainWindow.once('ready-to-show', () => {
      mainWindow.show()
    })

    mainWindow.on('maximize', notifyWindowStateChange)
    mainWindow.on('unmaximize', notifyWindowStateChange)
    mainWindow.on('enter-full-screen', notifyWindowStateChange)
    mainWindow.on('leave-full-screen', notifyWindowStateChange)

    const handleUnauthorizedNavigation = (event, url) => {
      if (isAllowedRendererUrl(url, getRenderer())) return
      event.preventDefault()
      openExternalUrl(url)
    }

    mainWindow.webContents.on('will-navigate', handleUnauthorizedNavigation)
    mainWindow.webContents.on('will-redirect', handleUnauthorizedNavigation)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      openExternalUrl(url)
      return { action: 'deny' }
    })

    await loadRenderer()

    mainWindow.on('closed', () => {
      mainWindow = null
    })
  }

  app.whenReady().then(createWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
