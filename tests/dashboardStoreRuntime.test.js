import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { guardDashboardRouteLeave } from '../src/utils/dashboardRouteGuard.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const limits = {
  minRows: 1,
  maxRows: 30,
  minColumns: 1,
  maxColumns: 60,
  maxCells: 1800,
  maxAisles: 20,
  minAisleSize: 48,
  maxAisleSize: 240
}
const layout = (version, rowCount = 4) => ({
  rowCount,
  columnCount: 12,
  aisles: [{ id: 'default-column-aisle', axis: 'COLUMN', afterIndex: 7, label: '过道', size: 100 }],
  version,
  limits,
  updatedAt: `2026-09-11T10:0${version}:00`
})
const page = records => ({ records, total: records.length, pageNum: 1, pageSize: 100, pages: records.length ? 1 : 0 })
const axiosResponse = (config, data) => ({
  data: { code: 200, message: '操作成功', data, timestamp: 1789092000000 },
  status: 200,
  statusText: 'OK',
  headers: {},
  config
})
const unauthorized = config => {
  const error = new Error('Unauthorized')
  error.config = config
  error.response = {
    status: 401,
    statusText: 'Unauthorized',
    data: { code: 401, message: '登录已过期', data: null, timestamp: 1789092000000 },
    headers: {},
    config
  }
  return error
}
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const waitFor = async predicate => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await new Promise(resolve => setImmediate(resolve))
  }
  throw new Error('等待 Store 请求超时')
}

let viteServer
let service
let originalAdapter
let useGridStore
let useDeviceStore
let useRealtimeStore
let useUserStore
let request
let router

test.before(async () => {
  viteServer = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    plugins: [vue()],
    resolve: { alias: { '@': path.resolve(root, 'src') } },
    server: { middlewareMode: true, hmr: false }
  })
  ;({ default: request, service } = await viteServer.ssrLoadModule('/src/utils/request.js'))
  ;({ default: router } = await viteServer.ssrLoadModule('/src/router/index.js'))
  ;({ useUserStore } = await viteServer.ssrLoadModule('/src/stores/user.js'))
  ;({ useGridStore } = await viteServer.ssrLoadModule('/src/stores/printer/gridStore.js'))
  ;({ useDeviceStore } = await viteServer.ssrLoadModule('/src/stores/printer/deviceStore.js'))
  ;({ useRealtimeStore } = await viteServer.ssrLoadModule('/src/stores/printer/realtimeStore.js'))
  originalAdapter = service.defaults.adapter
})

test.after(async () => {
  service.defaults.adapter = originalAdapter
  await viteServer.close()
})

test('真实 grid Pinia Store 取消过期草稿后重载布局和设备并清空全部草稿', async () => {
  setActivePinia(createPinia())
  let serverLayout = layout(1)
  let layoutRequests = 0
  let printerRequests = 0
  service.defaults.adapter = async config => {
    if (config.url === '/api/v1/dashboard-layout') {
      layoutRequests += 1
      return axiosResponse(config, serverLayout)
    }
    if (config.url === '/api/v1/printers/page') {
      printerRequests += 1
      return axiosResponse(config, page([{ id: '9007199254740993', name: '最新设备', gridRow: 1, gridCol: 1 }]))
    }
    throw new Error(`未处理测试路由: ${config.url}`)
  }

  const grid = useGridStore()
  const realtime = useRealtimeStore()
  const devices = useDeviceStore()
  await grid.loadLayout()
  grid.startLayoutEdit()
  grid.updateLayoutDraft({ rowCount: 5 })
  grid.setPositionDraft([{ printerId: '9007199254740993', gridRow: 2, gridCol: 2 }])
  serverLayout = layout(2, 6)
  realtime.layoutVersion = 2
  await nextTick()

  assert.equal(grid.layoutConflict?.reason, 'STALE_DRAFT')
  await grid.cancelLayoutEdit()
  assert.equal(grid.layoutSnapshot.version, 2)
  assert.equal(grid.layoutSnapshot.rowCount, 6)
  assert.equal(grid.layoutDraft, null)
  assert.equal(grid.draftBaseVersion, null)
  assert.deepEqual(grid.positionDraft, [])
  assert.equal(devices.rawDeviceList[0].id, '9007199254740993')
  assert.equal(layoutRequests, 2)
  assert.equal(printerRequests, 1)
})

test('真实 grid Pinia Store 的连续手动刷新只提交最新布局并只拉取一次设备', async () => {
  setActivePinia(createPinia())
  const layoutRequests = []
  let printerRequests = 0
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/dashboard-layout') {
      const request = deferred()
      layoutRequests.push({ ...request, signal: config.signal, config })
      return request.promise
    }
    if (config.url === '/api/v1/printers/page') {
      printerRequests += 1
      return Promise.resolve(axiosResponse(config, page([{ id: '408', name: '最新设备', gridRow: 4, gridCol: 12 }])))
    }
    return Promise.reject(new Error(`未处理测试路由: ${config.url}`))
  }

  const grid = useGridStore()
  const firstRefresh = grid.refreshLayout()
  await waitFor(() => layoutRequests.length === 1)
  const latestRefresh = grid.refreshLayout()
  await waitFor(() => layoutRequests.length === 2)
  assert.equal(layoutRequests[0].signal.aborted, true)
  layoutRequests[1].resolve(axiosResponse(layoutRequests[1].config, layout(3, 7)))
  await latestRefresh
  layoutRequests[0].resolve(axiosResponse(layoutRequests[0].config, layout(2, 5)))
  await firstRefresh

  assert.equal(grid.layoutSnapshot.version, 3)
  assert.equal(grid.layoutSnapshot.rowCount, 7)
  assert.equal(printerRequests, 1)
})

test('真实 device Pinia Store 的旧设备请求被取消后不能覆盖最新结果', async () => {
  setActivePinia(createPinia())
  const requests = []
  service.defaults.adapter = config => {
    const request = deferred()
    requests.push({ ...request, signal: config.signal, config })
    return request.promise
  }

  const devices = useDeviceStore()
  const firstFetch = devices.fetchDeviceData()
  await waitFor(() => requests.length === 1)
  const latestFetch = devices.fetchDeviceData()
  await waitFor(() => requests.length === 2)
  assert.equal(requests[0].signal.aborted, true)
  requests[1].resolve(axiosResponse(requests[1].config, page([
    { id: '9007199254740995', name: '新快照', gridRow: 2, gridCol: 2 }
  ])))
  await latestFetch
  requests[0].resolve(axiosResponse(requests[0].config, page([
    { id: '9007199254740994', name: '旧快照', gridRow: 1, gridCol: 1 }
  ])))
  await firstFetch

  assert.deepEqual(devices.rawDeviceList.map(device => device.id), ['9007199254740995'])
  assert.equal(devices.version, 1)
})

test('真实 grid Pinia Store 保存未完成时路由守卫拒绝放弃，完成后恢复导航', async () => {
  setActivePinia(createPinia())
  const pendingSave = deferred()
  let saveConfig
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/dashboard-layout' && config.method === 'get') {
      return Promise.resolve(axiosResponse(config, layout(1)))
    }
    if (config.url === '/api/v1/dashboard-layout' && config.method === 'put') {
      saveConfig = config
      return pendingSave.promise
    }
    return Promise.reject(new Error(`未处理测试路由: ${config.method} ${config.url}`))
  }

  const grid = useGridStore()
  await grid.loadLayout()
  grid.startLayoutEdit()
  grid.updateLayoutDraft({ rowCount: 5 })
  const savePromise = grid.saveLayoutDraft()
  await waitFor(() => grid.layoutSaving)

  let confirmCount = 0
  let clearCount = 0
  const notices = []
  const blocked = await guardDashboardRouteLeave({
    to: { name: 'files', path: '/files' },
    isSaving: () => grid.layoutSaving,
    isAuthenticated: () => true,
    hasUnsavedChanges: () => Boolean(grid.layoutDraft),
    confirmDiscard: async () => { confirmCount += 1 },
    clearEditingState: () => { clearCount += 1 },
    notifySaving: content => notices.push(content)
  })
  assert.equal(blocked, false)
  assert.equal(confirmCount, 0)
  assert.equal(clearCount, 0)
  assert.deepEqual(notices, ['保存中请稍候'])
  assert.equal(grid.layoutDraft.rowCount, 5)

  pendingSave.resolve(axiosResponse(saveConfig, {
    layout: layout(2, 5),
    changedPositions: [],
    unallocatedPrinters: []
  }))
  await savePromise
  assert.equal(grid.layoutSaving, false)
  const allowed = await guardDashboardRouteLeave({
    to: { name: 'files', path: '/files' },
    isSaving: () => grid.layoutSaving,
    isAuthenticated: () => true,
    hasUnsavedChanges: () => Boolean(grid.layoutDraft),
    confirmDiscard: async () => { confirmCount += 1 },
    clearEditingState: () => { clearCount += 1 },
    notifySaving: content => notices.push(content)
  })
  assert.equal(allowed, true)
  assert.equal(confirmCount, 0)
  assert.equal(clearCount, 1)
})

test('旧会话 deferred 保存成功与 cleanup 不能覆盖快速重登后的新草稿', async () => {
  setActivePinia(createPinia())
  const pendingSave = deferred()
  let saveConfig
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/dashboard-layout' && config.method === 'get') {
      return Promise.resolve(axiosResponse(config, layout(1)))
    }
    if (config.url === '/api/v1/dashboard-layout' && config.method === 'put') {
      saveConfig = config
      return pendingSave.promise
    }
    return Promise.reject(new Error(`未处理测试路由: ${config.method} ${config.url}`))
  }

  const grid = useGridStore()
  await grid.loadLayout()
  grid.startLayoutEdit()
  const oldOwner = grid.draftOwner
  grid.updateLayoutDraft({ rowCount: 5 })
  const oldSave = grid.saveLayoutDraft([], 'REJECT', oldOwner)
  await waitFor(() => grid.layoutSaving)
  assert.equal(grid.layoutSavingOwner, oldOwner)

  // 模拟旧组件离开后快速重新登录，新组件基于当前快照开启独立草稿。
  grid.startLayoutEdit()
  const newOwner = grid.draftOwner
  grid.updateLayoutDraft({ rowCount: 7 })
  grid.setPositionDraft([{ printerId: '408', gridRow: 4, gridCol: 12 }])
  assert.notEqual(newOwner, oldOwner)

  pendingSave.resolve(axiosResponse(saveConfig, {
    layout: layout(2, 5),
    changedPositions: [],
    unallocatedPrinters: []
  }))
  const result = await oldSave
  assert.equal(result.operationApplied, false)
  assert.equal(grid.layoutSnapshot.version, 1)
  assert.equal(grid.layoutDraft.rowCount, 7)
  assert.equal(grid.draftOwner, newOwner)
  assert.deepEqual(grid.positionDraft, [{ printerId: '408', gridRow: 4, gridCol: 12 }])
  assert.equal(grid.discardLayoutEdit(oldOwner), false)
  assert.equal(grid.layoutDraft.rowCount, 7)
  assert.equal(grid.layoutSaving, false)
  assert.equal(grid.layoutSavingOwner, null)
})

test('旧会话 deferred 保存失败与 finally 不能污染新草稿错误状态', async () => {
  setActivePinia(createPinia())
  const pendingSave = deferred()
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/dashboard-layout' && config.method === 'get') {
      return Promise.resolve(axiosResponse(config, layout(1)))
    }
    if (config.url === '/api/v1/dashboard-layout' && config.method === 'put') return pendingSave.promise
    return Promise.reject(new Error(`未处理测试路由: ${config.method} ${config.url}`))
  }

  const grid = useGridStore()
  await grid.loadLayout()
  grid.startLayoutEdit()
  const oldOwner = grid.draftOwner
  grid.updateLayoutDraft({ rowCount: 5 })
  const oldSave = grid.saveLayoutDraft([], 'REJECT', oldOwner).catch(error => error)
  await waitFor(() => grid.layoutSaving)
  grid.startLayoutEdit()
  const newOwner = grid.draftOwner
  grid.updateLayoutDraft({ rowCount: 8 })

  const canceled = new Error('旧会话请求已取消')
  canceled.code = 'ERR_CANCELED'
  pendingSave.reject(canceled)
  assert.equal(await oldSave, canceled)
  assert.equal(grid.layoutDraft.rowCount, 8)
  assert.equal(grid.draftOwner, newOwner)
  assert.equal(grid.layoutError, null)
  assert.equal(grid.layoutConflict, null)
  assert.equal(grid.layoutSaving, false)
  assert.equal(grid.layoutSavingOwner, null)
})

const authenticate = (userStore, token) => {
  userStore.token = token
  userStore.userInfo = { id: '1', username: 'admin', role: 'ADMIN' }
  userStore.restoreState = 'authenticated'
}

test('旧会话请求的 401 只 reject，不清除或跳转快速重登后的新会话', async () => {
  setActivePinia(createPinia())
  const userStore = useUserStore()
  authenticate(userStore, 'old-session-secret')
  await router.push('/printers')
  const pending = []
  service.defaults.adapter = config => new Promise((resolve, reject) => {
    pending.push({ config, resolve, reject })
  })

  const originalConsoleError = console.error
  const errorLogs = []
  console.error = (...args) => errorLogs.push(args)
  try {
    const resultPromise = request({ url: '/api/v1/session-race/old', method: 'get', dedupe: false })
      .catch(error => error)
    await waitFor(() => pending.length === 1)
    authenticate(userStore, 'new-session-secret')
    pending[0].reject(unauthorized(pending[0].config))
    const error = await resultPromise
    await new Promise(resolve => setImmediate(resolve))

    assert.equal(error.context, 'unauthorized')
    assert.equal(error.toastShown, false)
    assert.equal(userStore.token, 'new-session-secret')
    assert.equal(userStore.isAuthenticated, true)
    assert.equal(router.currentRoute.value.path, '/printers')
    assert.equal(Object.prototype.hasOwnProperty.call(error.config || {}, 'headers'), false)
    assert.equal(JSON.stringify(errorLogs).includes('old-session-secret'), false)
    assert.equal(JSON.stringify(errorLogs).includes('new-session-secret'), false)
  } finally {
    console.error = originalConsoleError
  }
})

test('当前会话请求的 401 正常清除认证并导航登录页', async () => {
  setActivePinia(createPinia())
  const userStore = useUserStore()
  authenticate(userStore, 'current-session-secret')
  await router.push('/printers')
  const originalRouterPush = router.push
  const navigations = []
  router.push = target => {
    navigations.push(target)
    return Promise.resolve()
  }
  const pending = []
  service.defaults.adapter = config => new Promise((resolve, reject) => {
    pending.push({ config, resolve, reject })
  })

  const originalConsoleError = console.error
  const errorLogs = []
  console.error = (...args) => errorLogs.push(args)
  try {
    const resultPromise = request({ url: '/api/v1/session-race/current', method: 'get', dedupe: false })
      .catch(error => error)
    await waitFor(() => pending.length === 1)
    pending[0].reject(unauthorized(pending[0].config))
    const error = await resultPromise

    assert.equal(error.context, 'unauthorized')
    assert.equal(error.toastShown, true)
    assert.equal(userStore.token, '')
    assert.equal(userStore.isAuthenticated, false)
    assert.deepEqual(navigations, [{ name: 'login' }])
    assert.equal(Object.prototype.hasOwnProperty.call(error.response?.config || {}, 'headers'), false)
    assert.equal(JSON.stringify(errorLogs).includes('current-session-secret'), false)
  } finally {
    console.error = originalConsoleError
    router.push = originalRouterPush
  }
})
