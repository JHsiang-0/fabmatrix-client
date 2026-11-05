import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
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

class RuntimeFakeWebSocket {
  static instances = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = RuntimeFakeWebSocket.CONNECTING
    this.listeners = new Map()
    RuntimeFakeWebSocket.instances.push(this)
    queueMicrotask(() => this.open())
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set()
    handlers.add(handler)
    this.listeners.set(type, handlers)
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler)
  }

  emit(type, event = {}) {
    this.listeners.get(type)?.forEach(handler => handler(event))
  }

  open() {
    this.readyState = RuntimeFakeWebSocket.OPEN
    this.emit('open', { type: 'open' })
  }

  message(message) {
    this.emit('message', { data: JSON.stringify(message) })
  }

  serverClose(code = 1006, reason = 'network') {
    this.readyState = RuntimeFakeWebSocket.CLOSED
    this.emit('close', { code, reason, target: this })
  }

  close(code = 1000, reason = '') {
    if (this.readyState === RuntimeFakeWebSocket.CLOSED) return
    this.readyState = RuntimeFakeWebSocket.CLOSED
    this.emit('close', { code, reason, target: this })
  }
}

const memoryStorage = () => {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  }
}

let viteServer
let service
let originalAdapter
let useGridStore
let useDeviceStore
let useRealtimeStore
let useJobStore
let useUserStore
let request
let router
let getRequestLockKey

test.before(async () => {
  viteServer = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    plugins: [vue()],
    resolve: { alias: { '@': path.resolve(root, 'src') } },
    server: { middlewareMode: true, hmr: false }
  })
  ;({ default: request, getRequestLockKey, service } = await viteServer.ssrLoadModule('/src/utils/request.js'))
  ;({ default: router } = await viteServer.ssrLoadModule('/src/router/index.js'))
  ;({ useUserStore } = await viteServer.ssrLoadModule('/src/stores/user.js'))
  ;({ useGridStore } = await viteServer.ssrLoadModule('/src/stores/printer/gridStore.js'))
  ;({ useDeviceStore } = await viteServer.ssrLoadModule('/src/stores/printer/deviceStore.js'))
  ;({ useRealtimeStore } = await viteServer.ssrLoadModule('/src/stores/printer/realtimeStore.js'))
  ;({ useJobStore } = await viteServer.ssrLoadModule('/src/stores/jobStore.js'))
  originalAdapter = service.defaults.adapter
})

test.after(async () => {
  service.defaults.adapter = originalAdapter
  await viteServer.close()
})

test('待改密账号直接调用实时 Store 时不创建连接和业务请求', async () => {
  setActivePinia(createPinia())
  const user = useUserStore()
  user.token = 'synthetic-temporary-session'
  user.userInfo = { id: '2', role: 'OPERATOR', mustChangePassword: true }
  let socketAttempts = 0
  let businessRequests = 0
  service.defaults.adapter = async () => {
    businessRequests += 1
    throw new Error('待改密账号不应发起业务请求')
  }
  const realtime = useRealtimeStore()
  realtime.connectWs({ webSocketFactory: () => { socketAttempts += 1 } })
  await nextTick()
  assert.equal(socketAttempts, 0)
  assert.equal(businessRequests, 0)
  assert.equal(realtime.wsConnectionState, 'CLOSED')
  assert.equal(user.token, 'synthetic-temporary-session')
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

test('真实 job Pinia Store 活动页越界只补请求最后有效页，未知 WS 任务不插入当前页', async () => {
  setActivePinia(createPinia())
  const requests = []
  service.defaults.adapter = config => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    requests.push(body)
    const isOutOfRange = Number(body.pageNum) === 4
    return Promise.resolve(axiosResponse(config, {
      records: isOutOfRange ? [] : [{ id: 'page-job-1', status: 'PRINTING', updatedAt: '2026-09-11T10:00:00' }],
      total: 25,
      pageNum: isOutOfRange ? 4 : 3,
      pageSize: 10,
      pages: 3
    }))
  }

  const jobs = useJobStore()
  await jobs.fetchActive({ pageNum: 4, pageSize: 10 })
  assert.equal(requests.length, 2)
  assert.equal(requests[0].pageNum, 4)
  assert.equal(requests[1].pageNum, 3)
  assert.equal(jobs.activePage, 3)
  assert.equal(jobs.activeTotal, 25)
  assert.deepEqual(jobs.activeJobs.map(job => job.id), ['page-job-1'])

  const unknown = jobs.applyRealtimeJobStatus({ data: { jobId: 'cross-page-job', status: 'PRINTING' } })
  assert.equal(unknown, null)
  assert.deepEqual(jobs.activeJobs.map(job => job.id), ['page-job-1'])
  assert.equal(jobs.activeTotal, 25)
})

test('真实 job Pinia Store 收敛完整迁移、终态失效和未知任务合并刷新', async () => {
  setActivePinia(createPinia())
  let queueReads = 0
  let activeReads = 0
  let serverStatus = 'QUEUED'
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/print-jobs/queue') {
      queueReads += 1
      const records = serverStatus === 'QUEUED'
        ? [{ id: 'job-1', status: 'QUEUED', fileName: 'rest.gcode' }]
        : []
      return Promise.resolve(axiosResponse(config, records))
    }
    if (config.url === '/api/v1/print-jobs/page') {
      activeReads += 1
      const records = ['ASSIGNED', 'UPLOADING', 'READY', 'PRINTING', 'PAUSED', 'RECONCILING'].includes(serverStatus)
        ? [{ id: 'job-1', status: serverStatus, fileName: 'rest.gcode' }]
        : []
      return Promise.resolve(axiosResponse(config, {
        records, total: records.length, pageNum: 1, pageSize: 10, pages: records.length ? 1 : 0
      }))
    }
    throw new Error(`未处理测试路由: ${config.url}`)
  }

  const jobs = useJobStore()
  await jobs.fetchQueue()
  await jobs.fetchActive()
  const emit = async (sequence, status) => {
    serverStatus = status
    jobs.queueRealtimeJobStatus({
      eventId: `job-event-${sequence}`,
      sequence,
      timestamp: 1789092000000 + sequence,
      data: { jobId: 'job-1', status, progress: sequence * 10 }
    })
    await new Promise(resolve => setImmediate(resolve))
  }

  await emit(1, 'ASSIGNED')
  assert.equal(jobs.activeJobs[0].fileName, 'rest.gcode')
  await emit(2, 'PRINTING')
  await emit(3, 'COMPLETED')
  assert.deepEqual(jobs.queueJobs, [])
  assert.deepEqual(jobs.activeJobs, [])
  assert.deepEqual(jobs.terminalJobs, [])
  assert.equal(jobs.activeTotal, 0)
  assert.equal(jobs.historyInvalidationVersion, 1)

  jobs.queueRealtimeJobStatus({
    eventId: 'unknown-job-event', sequence: 4, data: { jobId: 'unknown-job', status: 'PRINTING' }
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(jobs.queueJobs.some(job => job.id === 'unknown-job'), false)
  assert.equal(queueReads, 4)
  assert.equal(activeReads, 4)

  jobs.queueRealtimeJobStatus({
    eventId: 'unknown-terminal-event', sequence: 5, data: { jobId: 'history-only-job', status: 'COMPLETED' }
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(jobs.historyInvalidationVersion, 2)

  jobs.queueRealtimeJobStatus({
    eventId: 'iso-timestamp-event', data: {
      jobId: 'iso-history-only-job', status: 'FAILED', updatedAt: '2026-09-12T10:00:00Z'
    }
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(jobs.historyInvalidationVersion, 3)
})

test('真实 job Pinia Store 只接受最新活动页响应', async () => {
  setActivePinia(createPinia())
  const requests = []
  service.defaults.adapter = config => {
    const operation = deferred()
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    requests.push({ ...operation, body, config })
    return operation.promise
  }

  const jobs = useJobStore()
  const first = jobs.fetchActive({ pageNum: 1, pageSize: 10 })
  await waitFor(() => requests.length === 1)
  const second = jobs.fetchActive({ pageNum: 2, pageSize: 10 })
  await waitFor(() => requests.length === 2)

  requests[1].resolve(axiosResponse(requests[1].config, {
    records: [{ id: 'new-page', status: 'PRINTING' }], total: 20, pageNum: 2, pageSize: 10, pages: 2
  }))
  await second
  requests[0].resolve(axiosResponse(requests[0].config, {
    records: [{ id: 'old-page', status: 'PRINTING' }], total: 20, pageNum: 1, pageSize: 10, pages: 2
  }))
  await first

  assert.equal(jobs.activePage, 2)
  assert.deepEqual(jobs.activeJobs.map(job => job.id), ['new-page'])
})

test('跨集合迁移不向非第一页满页插入残缺行并由 REST 校准 total', async () => {
  setActivePinia(createPinia())
  const existingPage = Array.from({ length: 10 }, (_, index) => ({
    id: `active-${index + 1}`, status: 'PRINTING', fileName: `active-${index + 1}.gcode`
  }))
  const refreshRequests = []
  let refreshing = false
  service.defaults.adapter = config => {
    if (!refreshing && config.url === '/api/v1/print-jobs/queue') {
      return Promise.resolve(axiosResponse(config, [{ id: 'queue-job', status: 'QUEUED', fileName: 'queued.gcode' }]))
    }
    if (!refreshing && config.url === '/api/v1/print-jobs/page') {
      return Promise.resolve(axiosResponse(config, {
        records: existingPage, total: 21, pageNum: 2, pageSize: 10, pages: 3
      }))
    }
    const operation = deferred()
    refreshRequests.push({ ...operation, config })
    return operation.promise
  }

  const jobs = useJobStore()
  await jobs.fetchQueue()
  await jobs.fetchActive({ pageNum: 2, pageSize: 10 })
  refreshing = true
  jobs.queueRealtimeJobStatus({
    eventId: 'queue-to-active', sequence: 1, timestamp: 100,
    data: { jobId: 'queue-job', status: 'ASSIGNED', progress: 0 }
  })
  await waitFor(() => refreshRequests.length === 2)

  assert.equal(jobs.queueJobs.some(job => job.id === 'queue-job'), false)
  assert.equal(jobs.activeJobs.length, 10)
  assert.equal(jobs.activeJobs.some(job => job.id === 'queue-job'), false)
  assert.equal(jobs.activePage, 2)
  assert.equal(jobs.activeTotal, 22)

  const queueRequest = refreshRequests.find(request => request.config.url.endsWith('/queue'))
  const activeRequest = refreshRequests.find(request => request.config.url.endsWith('/page'))
  queueRequest.resolve(axiosResponse(queueRequest.config, []))
  activeRequest.resolve(axiosResponse(activeRequest.config, {
    records: [{ id: 'queue-job', status: 'ASSIGNED', fileName: 'queued.gcode' }, ...existingPage.slice(0, 9)],
    total: 22, pageNum: 2, pageSize: 10, pages: 3
  }))
  await waitFor(() => jobs.activeJobs.some(job => job.id === 'queue-job'))
  assert.equal(jobs.activeJobs.length, 10)
  assert.equal(jobs.activeTotal, 22)
  assert.equal(jobs.activeJobs[0].fileName, 'queued.gcode')
})

test('活动任务离开非第一页后立即移除并由分页回退恢复有效页', async () => {
  setActivePinia(createPinia())
  const refreshRequests = []
  let refreshing = false
  service.defaults.adapter = config => {
    if (!refreshing && config.url === '/api/v1/print-jobs/queue') {
      return Promise.resolve(axiosResponse(config, []))
    }
    if (!refreshing && config.url === '/api/v1/print-jobs/page') {
      return Promise.resolve(axiosResponse(config, {
        records: [{ id: 'last-on-page', status: 'PRINTING', fileName: 'last.gcode' }],
        total: 11, pageNum: 2, pageSize: 10, pages: 2
      }))
    }
    const operation = deferred()
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    refreshRequests.push({ ...operation, config, body })
    return operation.promise
  }

  const jobs = useJobStore()
  await jobs.fetchQueue()
  await jobs.fetchActive({ pageNum: 2, pageSize: 10 })
  refreshing = true
  jobs.queueRealtimeJobStatus({
    eventId: 'active-to-terminal', sequence: 1, timestamp: 100,
    data: { jobId: 'last-on-page', status: 'COMPLETED', progress: 100 }
  })
  await waitFor(() => refreshRequests.length === 2)
  assert.deepEqual(jobs.activeJobs, [])
  assert.deepEqual(jobs.terminalJobs, [])
  assert.equal(jobs.activeTotal, 10)
  assert.equal(jobs.historyInvalidationVersion, 1)

  const queueRequest = refreshRequests.find(request => request.config.url.endsWith('/queue'))
  const activePageTwo = refreshRequests.find(request => request.config.url.endsWith('/page'))
  queueRequest.resolve(axiosResponse(queueRequest.config, []))
  activePageTwo.resolve(axiosResponse(activePageTwo.config, {
    records: [], total: 10, pageNum: 2, pageSize: 10, pages: 1
  }))
  await waitFor(() => refreshRequests.length === 3)
  const activePageOne = refreshRequests[2]
  const pageOneRecords = Array.from({ length: 10 }, (_, index) => ({
    id: `page-one-${index}`, status: 'PRINTING', fileName: `page-one-${index}.gcode`
  }))
  activePageOne.resolve(axiosResponse(activePageOne.config, {
    records: pageOneRecords, total: 10, pageNum: 1, pageSize: 10, pages: 1
  }))
  await waitFor(() => jobs.activePage === 1 && jobs.activeJobs.length === 10)
  assert.equal(jobs.activeTotal, 10)
})

test('恢复基线淘汰旧 overlay 且保留恢复期间到达的新事件', async () => {
  setActivePinia(createPinia())
  const activeRequests = []
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/print-jobs/queue') return Promise.resolve(axiosResponse(config, []))
    if (config.url === '/api/v1/print-jobs/page') {
      const operation = deferred()
      activeRequests.push({ ...operation, config })
      return operation.promise
    }
    throw new Error(`未处理测试路由: ${config.url}`)
  }

  const jobs = useJobStore()
  const initial = jobs.fetchActive()
  await waitFor(() => activeRequests.length === 1)
  activeRequests[0].resolve(axiosResponse(activeRequests[0].config, {
    records: [{ id: 'race-job', status: 'PRINTING', fileName: 'race.gcode' }],
    total: 1, pageNum: 1, pageSize: 10, pages: 1
  }))
  await initial
  jobs.applyRealtimeJobStatus({
    eventId: 'old-overlay', sequence: 1, timestamp: 100,
    data: { jobId: 'race-job', status: 'PAUSED', progress: 40 }
  })
  assert.equal(jobs.activeJobs[0].status, 'PAUSED')

  jobs.beginRealtimeRecovery()
  const recovery = jobs.refresh()
  await waitFor(() => activeRequests.length === 2)
  jobs.applyRealtimeJobStatus({
    eventId: 'during-recovery', sequence: 1, timestamp: 200,
    data: { jobId: 'race-job', status: 'READY', progress: 60 }
  })
  activeRequests[1].resolve(axiosResponse(activeRequests[1].config, {
    records: [{ id: 'race-job', status: 'PRINTING', fileName: 'race.gcode' }],
    total: 1, pageNum: 1, pageSize: 10, pages: 1
  }))
  await recovery
  assert.equal(jobs.activeJobs[0].status, 'READY')
  assert.equal(jobs.activeJobs[0].progress, 60)

  jobs.beginRealtimeRecovery()
  const cleanRecovery = jobs.refresh()
  await waitFor(() => activeRequests.length === 3)
  activeRequests[2].resolve(axiosResponse(activeRequests[2].config, {
    records: [{ id: 'race-job', status: 'PRINTING', fileName: 'race.gcode' }],
    total: 1, pageNum: 1, pageSize: 10, pages: 1
  }))
  await cleanRecovery
  assert.equal(jobs.activeJobs[0].status, 'PRINTING')
})

test('普通 queue 和 active REST 响应收敛请求前的同集合 overlay', async () => {
  setActivePinia(createPinia())
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/print-jobs/queue') {
      return Promise.resolve(axiosResponse(config, [
        { id: 'queued-overlay', status: 'QUEUED', progress: 0, fileName: 'queue-rest.gcode' }
      ]))
    }
    if (config.url === '/api/v1/print-jobs/page') {
      return Promise.resolve(axiosResponse(config, {
        records: [{ id: 'active-overlay', status: 'PRINTING', progress: 20, fileName: 'active-rest.gcode' }],
        total: 1, pageNum: 1, pageSize: 10, pages: 1
      }))
    }
    throw new Error(`未处理测试路由: ${config.url}`)
  }

  const jobs = useJobStore()
  await jobs.fetchQueue()
  await jobs.fetchActive()
  jobs.applyRealtimeJobStatus({
    eventId: 'queued-old-overlay', sequence: 1, timestamp: 100,
    data: { jobId: 'queued-overlay', status: 'QUEUED', progress: 40 }
  })
  jobs.applyRealtimeJobStatus({
    eventId: 'active-old-overlay', sequence: 2, timestamp: 101,
    data: { jobId: 'active-overlay', status: 'PAUSED', progress: 50 }
  })
  assert.equal(jobs.queueJobs[0].progress, 40)
  assert.equal(jobs.activeJobs[0].status, 'PAUSED')

  await jobs.fetchQueue()
  await jobs.fetchActive()

  assert.equal(jobs.queueJobs[0].progress, 0)
  assert.equal(jobs.activeJobs[0].status, 'PRINTING')
  assert.equal(jobs.activeJobs[0].progress, 20)
})

test('普通详情 REST 响应收敛详情缓存中的请求前 overlay', async () => {
  setActivePinia(createPinia())
  let detailReads = 0
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/print-jobs/detail-overlay') {
      detailReads += 1
      return Promise.resolve(axiosResponse(config, {
        id: 'detail-overlay', status: 'PRINTING', progress: 30,
        fileName: detailReads === 1 ? 'initial.gcode' : 'authoritative.gcode'
      }))
    }
    throw new Error(`未处理测试路由: ${config.url}`)
  }

  const jobs = useJobStore()
  await jobs.fetchJobDetail('detail-overlay')
  jobs.applyRealtimeJobStatus({
    eventId: 'detail-old-overlay', sequence: 1, timestamp: 100,
    data: { jobId: 'detail-overlay', status: 'PAUSED', progress: 70 }
  })
  assert.equal(jobs.jobDetails.get('detail-overlay').status, 'PAUSED')

  const detail = await jobs.fetchJobDetail('detail-overlay')

  assert.equal(detail.status, 'PRINTING')
  assert.equal(detail.progress, 30)
  assert.equal(jobs.jobDetails.get('detail-overlay').fileName, 'authoritative.gcode')
})

test('普通 REST 请求期间到达的 WS overlay 不被响应覆盖', async () => {
  setActivePinia(createPinia())
  const pending = deferred()
  let deferActive = false
  service.defaults.adapter = config => {
    if (config.url !== '/api/v1/print-jobs/page') {
      throw new Error(`未处理测试路由: ${config.url}`)
    }
    if (deferActive) return pending.promise
    return Promise.resolve(axiosResponse(config, {
      records: [{ id: 'concurrent-overlay', status: 'PRINTING', progress: 10, fileName: 'race.gcode' }],
      total: 1, pageNum: 1, pageSize: 10, pages: 1
    }))
  }

  const jobs = useJobStore()
  await jobs.fetchActive()
  deferActive = true
  const refresh = jobs.fetchActive()
  jobs.applyRealtimeJobStatus({
    eventId: 'during-rest-overlay', sequence: 1, timestamp: 100,
    data: { jobId: 'concurrent-overlay', status: 'PAUSED', progress: 80 }
  })
  pending.resolve(axiosResponse({ url: '/api/v1/print-jobs/page' }, {
    records: [{ id: 'concurrent-overlay', status: 'PRINTING', progress: 20, fileName: 'race.gcode' }],
    total: 1, pageNum: 1, pageSize: 10, pages: 1
  }))
  await refresh

  assert.equal(jobs.activeJobs[0].status, 'PAUSED')
  assert.equal(jobs.activeJobs[0].progress, 80)
})

test('JobStore 拒绝重复、乱序及无 sequence 对有序事件的覆盖', async () => {
  setActivePinia(createPinia())
  service.defaults.adapter = config => Promise.resolve(axiosResponse(config,
    config.url.endsWith('/queue') ? [] : {
      records: [{ id: 'ordered-job', status: 'PRINTING', progress: 10 }],
      total: 1, pageNum: 1, pageSize: 10, pages: 1
    }))
  const jobs = useJobStore()
  await jobs.fetchActive()

  jobs.applyRealtimeJobStatus({
    eventId: 'ordered-10', sequence: 10, timestamp: 100,
    data: { jobId: 'ordered-job', status: 'PAUSED', progress: 20 }
  })
  jobs.applyRealtimeJobStatus({
    eventId: 'ordered-10', sequence: 11, timestamp: 110,
    data: { jobId: 'ordered-job', status: 'PRINTING', progress: 30 }
  })
  jobs.applyRealtimeJobStatus({
    eventId: 'ordered-9', sequence: 9, timestamp: 120,
    data: { jobId: 'ordered-job', status: 'PRINTING', progress: 40 }
  })
  jobs.applyRealtimeJobStatus({
    eventId: 'unordered-newer-time', timestamp: 1000,
    data: { jobId: 'ordered-job', status: 'PRINTING', progress: 50 }
  })

  assert.equal(jobs.activeJobs[0].status, 'PAUSED')
  assert.equal(jobs.activeJobs[0].progress, 20)
})

test('终态成员离开历史集合时使历史失效并通过 REST 进入队列', async () => {
  setActivePinia(createPinia())
  let queued = false
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/print-jobs/history-job') {
      return Promise.resolve(axiosResponse(config, { id: 'history-job', status: 'FAILED', fileName: 'failed.gcode' }))
    }
    if (config.url === '/api/v1/print-jobs/queue') {
      return Promise.resolve(axiosResponse(config, queued
        ? [{ id: 'history-job', status: 'QUEUED', fileName: 'failed.gcode' }]
        : []))
    }
    if (config.url === '/api/v1/print-jobs/page') {
      return Promise.resolve(axiosResponse(config, { records: [], total: 0, pageNum: 1, pageSize: 10, pages: 0 }))
    }
    throw new Error(`未处理测试路由: ${config.url}`)
  }
  const jobs = useJobStore()
  await jobs.fetchJobDetail('history-job')
  queued = true
  jobs.queueRealtimeJobStatus({
    eventId: 'failed-to-queued', sequence: 1, timestamp: 100,
    data: { jobId: 'history-job', status: 'QUEUED' }
  })
  await waitFor(() => jobs.queueJobs.some(job => job.id === 'history-job'))
  assert.equal(jobs.historyInvalidationVersion, 1)
  assert.equal(jobs.queueJobs[0].fileName, 'failed.gcode')
})

test('sequence gap 恢复仅在 printer、queue、active 同代成功后清除 stale', async () => {
  setActivePinia(createPinia())
  const previousWindow = globalThis.window
  const previousRaf = globalThis.requestAnimationFrame
  const previousCancelRaf = globalThis.cancelAnimationFrame
  globalThis.window = {
    location: { protocol: 'http:', host: 'farm.test' },
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage()
  }
  globalThis.requestAnimationFrame = callback => setImmediate(callback)
  globalThis.cancelAnimationFrame = handle => clearImmediate(handle)
  RuntimeFakeWebSocket.instances.length = 0
  const printerRecovery = deferred()
  const queueRecovery = deferred()
  const activeRecovery = deferred()
  let recovering = false
  service.defaults.adapter = config => {
    if (!recovering && config.url === '/api/v1/print-jobs/queue') return Promise.resolve(axiosResponse(config, []))
    if (!recovering && config.url === '/api/v1/print-jobs/page') {
      return Promise.resolve(axiosResponse(config, { records: [], total: 0, pageNum: 1, pageSize: 10, pages: 0 }))
    }
    if (config.url === '/api/v1/printers/page') return printerRecovery.promise
    if (config.url === '/api/v1/print-jobs/queue') return queueRecovery.promise
    if (config.url === '/api/v1/print-jobs/page') return activeRecovery.promise
    throw new Error(`未处理测试路由: ${config.url}`)
  }

  const realtime = useRealtimeStore()
  const user = useUserStore()
  user.token = 'gap-token'
  user.userInfo = { id: '1', role: 'OPERATOR' }
  try {
    realtime.connectWs({ webSocketFactory: url => new RuntimeFakeWebSocket(url) })
    await waitFor(() => realtime.wsConnectionState === 'OPEN')
    const socket = RuntimeFakeWebSocket.instances[0]
    socket.message({ version: '1', type: 'SNAPSHOT', eventId: 'snapshot-1', sequence: 1, timestamp: 1, data: { printers: [] } })
    recovering = true
    socket.message({
      version: '1', type: 'PRINTER_STATUS', eventId: 'gap-3', sequence: 3, timestamp: 3,
      printerId: '403', data: { status: 'IDLE' }
    })
    await waitFor(() => realtime.isRecovering)
    assert.equal(realtime.isRealtimeStale, true)
    socket.message({ version: '1', type: 'SNAPSHOT', eventId: 'snapshot-4', sequence: 4, timestamp: 4, data: { printers: [] } })
    assert.equal(realtime.isRealtimeStale, true)

    printerRecovery.resolve(axiosResponse({ url: '/api/v1/printers/page' }, page([{ id: '403', status: 'IDLE' }])))
    await waitFor(() => queueRecovery.resolve && realtime.isRecovering)
    queueRecovery.resolve(axiosResponse({ url: '/api/v1/print-jobs/queue' }, []))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(realtime.isRealtimeStale, true)
    activeRecovery.resolve(axiosResponse({ url: '/api/v1/print-jobs/page' }, {
      records: [], total: 0, pageNum: 1, pageSize: 10, pages: 0
    }))
    await waitFor(() => !realtime.isRecovering)
    assert.equal(realtime.isRealtimeStale, false)
  } finally {
    realtime.disconnectWs()
    globalThis.window = previousWindow
    globalThis.requestAnimationFrame = previousRaf
    globalThis.cancelAnimationFrame = previousCancelRaf
  }
})

test('意外 code 1000、重连恢复失败和原生错误日志均保持安全 stale 语义', async () => {
  setActivePinia(createPinia())
  const previousWindow = globalThis.window
  const previousRaf = globalThis.requestAnimationFrame
  const previousCancelRaf = globalThis.cancelAnimationFrame
  globalThis.window = {
    location: { protocol: 'http:', host: 'farm.test' },
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage()
  }
  globalThis.requestAnimationFrame = callback => setImmediate(callback)
  globalThis.cancelAnimationFrame = handle => clearImmediate(handle)
  RuntimeFakeWebSocket.instances.length = 0
  let reconnecting = false
  let failureMode = 'printer'
  service.defaults.adapter = config => {
    if (config.url === '/api/v1/printers/page' && reconnecting) {
      if (failureMode === 'printer') return Promise.reject(new Error('printer recovery unavailable'))
      return Promise.resolve(axiosResponse(config, page([{ id: '403', status: 'IDLE' }])))
    }
    if (config.url === '/api/v1/print-jobs/queue') {
      if (reconnecting && failureMode === 'job') return Promise.reject(new Error('job recovery unavailable'))
      return Promise.resolve(axiosResponse(config, []))
    }
    if (config.url === '/api/v1/print-jobs/page') {
      return Promise.resolve(axiosResponse(config, { records: [], total: 0, pageNum: 1, pageSize: 10, pages: 0 }))
    }
    throw new Error(`未处理测试路由: ${config.url}`)
  }
  const secret = 'realtime-jwt-secret'
  const captured = []
  const originalConsole = { log: console.log, warn: console.warn, error: console.error }
  console.log = (...args) => captured.push(args)
  console.warn = (...args) => captured.push(args)
  console.error = (...args) => captured.push(args)

  const realtime = useRealtimeStore()
  const user = useUserStore()
  user.token = secret
  user.userInfo = { id: '1', role: 'OPERATOR' }
  try {
    realtime.connectWs({ webSocketFactory: url => new RuntimeFakeWebSocket(url) })
    await waitFor(() => realtime.wsConnectionState === 'OPEN')
    const socket = RuntimeFakeWebSocket.instances[0]
    socket.message({ version: '1', type: 'SNAPSHOT', eventId: 'before-close', sequence: 10, timestamp: 10, data: { printers: [] } })
    assert.equal(realtime.lastSequence, 10)
    socket.emit('error', { target: socket, config: { token: secret } })
    reconnecting = true
    socket.serverClose(1000, `token=${secret}`)
    assert.equal(realtime.isRealtimeStale, true)
    socket.open()
    socket.message({ version: '1', type: 'SNAPSHOT', eventId: 'after-reconnect', sequence: 1, timestamp: 11, data: { printers: [] } })
    assert.equal(realtime.lastSequence, 1)
    assert.equal(realtime.isRealtimeStale, true)
    await waitFor(() => !realtime.isRecovering)
    assert.equal(realtime.isRealtimeStale, true)
    failureMode = 'job'
    await realtime.refreshPrinterSnapshot()
    assert.equal(realtime.isRealtimeStale, true)
    assert.equal(JSON.stringify(captured).includes(secret), false)
    const realtimeLogs = captured.filter(args => /^\[(WebSocket|RealtimeStore)\]/.test(String(args[0])))
    assert.equal(realtimeLogs.flat().some(value => typeof value === 'object' && value !== null), false)
  } finally {
    realtime.disconnectWs()
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    globalThis.window = previousWindow
    globalThis.requestAnimationFrame = previousRaf
    globalThis.cancelAnimationFrame = previousCancelRaf
  }
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
  const canceledResult = await oldSave
  assert.equal(canceledResult.code, 'ERR_CANCELED')
  assert.equal(canceledResult.name, 'CanceledError')
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

const sessionResult = (id, role) => ({
  token: `test-session-${id}`,
  expiresIn: 60,
  userId: id,
  username: `user-${id}`,
  role
})

const setupSessionRuntime = t => {
  const previousWindow = globalThis.window
  const previousConsoleError = console.error
  globalThis.window = {
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage()
  }
  console.error = () => {}
  setActivePinia(createPinia())
  t.after(() => {
    globalThis.window = previousWindow
    console.error = previousConsoleError
  })
  return useUserStore()
}

for (const [oldRole, newRole] of [['ADMIN', 'OPERATOR'], ['OPERATOR', 'ADMIN']]) {
  for (const outcome of ['success', 'unauthorized', 'network']) {
    test(`旧 ${oldRole} 会话恢复 ${outcome} 不污染新 ${newRole} 会话及存储`, async t => {
      const user = setupSessionRuntime(t)
      const pending = deferred()
      let requestConfig
      service.defaults.adapter = config => {
        requestConfig = config
        return pending.promise
      }
      user.userLoginWithResult(sessionResult('old', oldRole), { remember: true })
      const restoring = user.restoreSession()
      await waitFor(() => requestConfig)
      user.logout()
      user.userLoginWithResult(sessionResult('new', newRole))

      if (outcome === 'success') {
        pending.resolve(axiosResponse(requestConfig, { id: 'old', username: 'user-old', role: oldRole }))
      } else {
        pending.reject(outcome === 'unauthorized' ? unauthorized(requestConfig) : new Error('网络断开'))
      }

      assert.equal(await restoring, true)
      assert.equal(user.token, 'test-session-new')
      assert.equal(user.userInfo.userId, 'new')
      assert.equal(user.userInfo.role, newRole)
      assert.equal(user.isAuthenticated, true)
      const saved = JSON.parse(window.sessionStorage.getItem('farm-ui-session'))
      assert.equal(saved.token, user.token)
      assert.equal(saved.userInfo.userId, 'new')
      assert.equal(saved.userInfo.role, newRole)
      assert.equal(window.localStorage.getItem('farm-ui-session'), null)
    })
  }
}

for (const state of ['anonymous', 'expired']) {
  test(`${state} 恢复结束后再次登录能够重新校验身份`, async t => {
    const user = setupSessionRuntime(t)
    if (state === 'expired') {
      user.userLoginWithResult(sessionResult('expired', 'ADMIN'), { remember: true })
      user.expiresAt = Date.now() - 1
    }
    assert.equal(await user.restoreSession(), false)
    let requests = 0
    service.defaults.adapter = config => {
      requests += 1
      return Promise.resolve(axiosResponse(config, { id: 'new', username: 'trusted-name', role: 'OPERATOR' }))
    }
    user.userLoginWithResult(sessionResult('new', 'OPERATOR'))

    assert.equal(await user.restoreSession(), true)
    assert.equal(requests, 1)
    assert.equal(user.userInfo.username, 'trusted-name')
    assert.equal(user.isAuthenticated, true)
  })
}

test('退出后的旧恢复成功响应不能重新建立登录态或存储', async t => {
  const user = setupSessionRuntime(t)
  const pending = deferred()
  let requestConfig
  service.defaults.adapter = config => {
    requestConfig = config
    return pending.promise
  }
  user.userLoginWithResult(sessionResult('old', 'ADMIN'), { remember: true })
  const restoring = user.restoreSession()
  await waitFor(() => requestConfig)
  user.logout()
  pending.resolve(axiosResponse(requestConfig, { id: 'old', username: 'user-old', role: 'ADMIN' }))

  assert.equal(await restoring, false)
  assert.equal(user.token, '')
  assert.equal(user.isAuthenticated, false)
  assert.equal(window.localStorage.getItem('farm-ui-session'), null)
  assert.equal(window.sessionStorage.getItem('farm-ui-session'), null)
})

test('新会话恢复独立请求并去重，旧恢复的 finally 不释放新请求锁', async t => {
  const user = setupSessionRuntime(t)
  const pending = []
  const operations = []
  service.defaults.adapter = config => {
    const operation = deferred()
    pending.push({ ...operation, config })
    return operation.promise
  }
  try {
    user.userLoginWithResult(sessionResult('old', 'ADMIN'))
    operations.push(user.restoreSession())
    await waitFor(() => pending.length === 1)
    user.userLoginWithResult(sessionResult('new', 'OPERATOR'), { remember: true })
    operations.push(user.restoreSession(), user.restoreSession())
    await waitFor(() => pending.length === 2)
    pending[0].resolve(axiosResponse(pending[0].config, { id: 'old', username: 'user-old', role: 'ADMIN' }))
    await new Promise(resolve => setImmediate(resolve))
    operations.push(user.restoreSession())
    await new Promise(resolve => setImmediate(resolve))

    assert.equal(pending.length, 2)
    assert.equal(user.restoreState, 'restoring')
    pending[1].resolve(axiosResponse(pending[1].config, { id: 'new', username: 'trusted-new', role: 'OPERATOR' }))
    assert.deepEqual(await Promise.all(operations), [true, true, true, true])
    assert.equal(user.userInfo.username, 'trusted-new')
    assert.equal(user.userInfo.role, 'OPERATOR')
    assert.equal(JSON.parse(window.localStorage.getItem('farm-ui-session')).userInfo.username, 'trusted-new')

    operations.push(user.restoreSession())
    await waitFor(() => pending.length === 3)
    pending[2].resolve(axiosResponse(pending[2].config, { id: 'new', username: 'refreshed-new', role: 'OPERATOR' }))
    assert.equal(await operations.at(-1), true)
    assert.equal(user.userInfo.username, 'refreshed-new')
  } finally {
    for (const operation of pending) {
      operation.resolve(axiosResponse(operation.config, { id: 'new', username: 'cleanup', role: 'OPERATOR' }))
    }
    await Promise.allSettled(operations)
  }
})

test('当前会话恢复的 401 仍清理两种存储并返回未登录', async t => {
  const user = setupSessionRuntime(t)
  const originalRouterPush = router.push
  const navigations = []
  router.push = target => {
    navigations.push(target)
    return Promise.resolve()
  }
  t.after(() => { router.push = originalRouterPush })
  user.userLoginWithResult(sessionResult('current', 'ADMIN'), { remember: true })
  service.defaults.adapter = config => Promise.reject(unauthorized(config))

  assert.equal(await user.restoreSession(), false)
  assert.equal(user.token, '')
  assert.equal(user.isAuthenticated, false)
  assert.equal(window.localStorage.getItem('farm-ui-session'), null)
  assert.equal(window.sessionStorage.getItem('farm-ui-session'), null)
  assert.deepEqual(navigations, [{ name: 'login' }])
})

for (const logoutFirst of [false, true]) {
  test(`相同 Token 重登${logoutFirst ? '（先退出）' : '（直接登录）'}后旧恢复 401 不清除新会话`, async t => {
    const user = setupSessionRuntime(t)
    const originalRouterPush = router.push
    const navigations = []
    router.push = target => {
      navigations.push(target)
      return Promise.resolve()
    }
    t.after(() => { router.push = originalRouterPush })
    const pending = deferred()
    let requestConfig
    service.defaults.adapter = config => {
      requestConfig = config
      return pending.promise
    }
    user.userLoginWithResult(sessionResult('same', 'OPERATOR'))
    const restoring = user.restoreSession()
    await waitFor(() => requestConfig)
    if (logoutFirst) user.logout()
    user.userLoginWithResult(sessionResult('same', 'OPERATOR'), { remember: true })
    pending.reject(unauthorized(requestConfig))

    assert.equal(await restoring, true)
    assert.equal(user.token, 'test-session-same')
    assert.equal(user.isAuthenticated, true)
    assert.equal(JSON.parse(window.localStorage.getItem('farm-ui-session')).token, user.token)
    assert.deepEqual(navigations, [])
  })
}

test('相同 Token 重登后的 mutation 不复用旧请求，旧清理不释放新请求锁', async t => {
  const user = setupSessionRuntime(t)
  const pending = []
  const operations = []
  service.defaults.adapter = config => {
    const operation = deferred()
    pending.push({ ...operation, config })
    return operation.promise
  }
  const requestConfig = { url: '/api/v1/session-race/same-token', method: 'post', data: { action: 'save' } }
  try {
    user.userLoginWithResult(sessionResult('same', 'OPERATOR'))
    const oldRequest = request(requestConfig)
    operations.push(oldRequest)
    assert.equal(request(requestConfig), oldRequest)
    await waitFor(() => pending.length === 1)
    user.userLoginWithResult(sessionResult('same', 'OPERATOR'))
    const newRequest = request(requestConfig)
    operations.push(newRequest)
    assert.notEqual(newRequest, oldRequest)
    assert.equal(request(requestConfig), newRequest)
    await waitFor(() => pending.length === 2)

    pending[0].resolve(axiosResponse(pending[0].config, { session: 'old' }))
    await oldRequest
    assert.equal(request(requestConfig), newRequest)
    pending[1].resolve(axiosResponse(pending[1].config, { session: 'new' }))
    assert.deepEqual((await newRequest).data, { session: 'new' })
  } finally {
    for (const operation of pending) operation.resolve(axiosResponse(operation.config, null))
    await Promise.allSettled(operations)
  }
})

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

test('真实 Axios 取消错误保留判定语义但移除请求凭据和底层对象', async () => {
  setActivePinia(createPinia())
  const userStore = useUserStore()
  authenticate(userStore, 'cancel-session-secret')
  service.defaults.adapter = config => {
    const canceled = new axios.CanceledError('调用方主动取消', config, { transport: 'secret-request' })
    canceled.response = {
      status: 499,
      statusText: 'Canceled',
      data: null,
      config
    }
    return Promise.reject(canceled)
  }

  const error = await request({
    url: '/api/v1/session-race/cancel',
    method: 'get',
    dedupe: false
  }).catch(reason => reason)

  assert.equal(axios.isAxiosError(error), true)
  assert.equal(axios.isCancel(error), true)
  assert.equal(error.name, 'CanceledError')
  assert.equal(error.code, 'ERR_CANCELED')
  assert.equal(error.message, '调用方主动取消')
  assert.equal(Object.prototype.hasOwnProperty.call(error, 'request'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(error, 'originalError'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(error.config || {}, 'headers'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(error.response?.config || {}, 'headers'), false)
  assert.equal(JSON.stringify(error).includes('cancel-session-secret'), false)
  assert.equal(JSON.stringify(error).includes('secret-request'), false)
})

test('mutation 去重仅复用同一认证 generation，重登后相同请求独立发送', async () => {
  setActivePinia(createPinia())
  const userStore = useUserStore()
  authenticate(userStore, 'dedupe-old-secret')
  const pending = []
  service.defaults.adapter = config => {
    const operation = deferred()
    pending.push({ ...operation, config })
    return operation.promise
  }
  const requestConfig = {
    url: '/api/v1/session-race/dedupe',
    method: 'post',
    data: { action: 'save' }
  }

  const oldRequest = request(requestConfig)
  const oldDuplicate = request(requestConfig)
  assert.equal(oldDuplicate, oldRequest)
  await waitFor(() => pending.length === 1)
  assert.equal(pending[0].config.headers.Authorization, 'Bearer dedupe-old-secret')

  authenticate(userStore, 'dedupe-new-secret')
  const newRequest = request(requestConfig)
  const newDuplicate = request(requestConfig)
  assert.equal(newDuplicate, newRequest)
  assert.notEqual(newRequest, oldRequest)
  await waitFor(() => pending.length === 2)
  assert.equal(pending[1].config.headers.Authorization, 'Bearer dedupe-new-secret')

  pending[0].resolve(axiosResponse(pending[0].config, { session: 'old' }))
  assert.deepEqual((await oldRequest).data, { session: 'old' })
  const duplicateWhileNewPending = request(requestConfig)
  assert.equal(duplicateWhileNewPending, newRequest)
  assert.equal(pending.length, 2)

  pending[1].resolve(axiosResponse(pending[1].config, { session: 'new' }))
  assert.deepEqual((await newRequest).data, { session: 'new' })
  assert.deepEqual((await duplicateWhileNewPending).data, { session: 'new' })
  const lockKey = getRequestLockKey({
    ...requestConfig,
    headers: { Authorization: 'Bearer key-must-not-contain-this-secret' }
  }, 42)
  assert.match(lockKey, /^42:/)
  assert.equal(lockKey.includes('key-must-not-contain-this-secret'), false)
})
