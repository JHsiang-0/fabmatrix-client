import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

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
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
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

test.before(async () => {
  viteServer = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    plugins: [vue()],
    resolve: { alias: { '@': path.resolve(root, 'src') } },
    server: { middlewareMode: true }
  })
  ;({ service } = await viteServer.ssrLoadModule('/src/utils/request.js'))
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
