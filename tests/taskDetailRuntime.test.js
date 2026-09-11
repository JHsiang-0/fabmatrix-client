import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const root = fileURLToPath(new URL('..', import.meta.url))
const axiosResponse = (config, data) => ({
  data: { code: 200, message: '操作成功', data, timestamp: 1789092000000 },
  status: 200,
  statusText: 'OK',
  headers: {},
  config
})

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
  throw new Error('等待详情请求超时')
}

let viteServer
let service
let useJobStore

test.before(async () => {
  viteServer = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    plugins: [vue()],
    resolve: { alias: { '@': path.resolve(root, 'src') } },
    server: { middlewareMode: true, hmr: false }
  })
  ;({ service } = await viteServer.ssrLoadModule('/src/utils/request.js'))
  ;({ useJobStore } = await viteServer.ssrLoadModule('/src/stores/jobStore.js'))
})

test.after(async () => {
  await viteServer.close()
})

test('不同任务快速切换时旧详情响应不会覆盖最新详情、缓存或错误状态', async () => {
  setActivePinia(createPinia())
  const requests = new Map()
  service.defaults.adapter = config => {
    const pending = deferred()
    requests.set(String(config.url).split('/').at(-1), { ...pending, config })
    return pending.promise
  }

  const store = useJobStore()
  const first = store.fetchJobDetail('1001')
  const second = store.fetchJobDetail('1002')
  await waitFor(() => requests.size === 2)

  requests.get('1001').resolve(axiosResponse(requests.get('1001').config, {
    id: '1001',
    fileId: '20',
    status: 'PRINTING',
    fileName: '旧任务.gcode'
  }))
  assert.equal(await first, null)
  assert.equal(store.detailLoading, true)
  assert.equal(store.jobDetails.has('1001'), false)

  requests.get('1002').resolve(axiosResponse(requests.get('1002').config, {
    id: '1002',
    fileId: '21',
    status: 'PAUSED',
    fileName: '最新任务.gcode'
  }))
  const detail = await second
  assert.equal(detail.fileName, '最新任务.gcode')
  assert.equal(store.jobDetails.get('1002').fileName, '最新任务.gcode')
  assert.equal(store.jobDetails.has('1001'), false)
  assert.equal(store.detailError, null)
  assert.equal(store.detailLoading, false)

  const lateSuccess = store.fetchJobDetail('1003')
  await waitFor(() => requests.has('1003'))
  store.invalidateJobDetailRequest()
  const currentSuccess = store.fetchJobDetail('1004')
  await waitFor(() => requests.has('1004'))
  requests.get('1003').resolve(axiosResponse(requests.get('1003').config, {
    id: '1003',
    fileId: '22',
    status: 'QUEUED',
    fileName: '关闭后到达.gcode'
  }))
  assert.equal(await lateSuccess, null)
  assert.equal(store.jobDetails.has('1003'), false)
  assert.equal(store.detailError, null)
  assert.equal(store.detailLoading, true)
  requests.get('1004').resolve(axiosResponse(requests.get('1004').config, {
    id: '1004',
    fileId: '23',
    status: 'PRINTING',
    fileName: '当前任务.gcode'
  }))
  assert.equal((await currentSuccess).fileName, '当前任务.gcode')
  assert.equal(store.detailLoading, false)

  const lateFailure = store.fetchJobDetail('1005')
  await waitFor(() => requests.has('1005'))
  store.invalidateJobDetailRequest()
  const currentFailure = store.fetchJobDetail('1006')
  await waitFor(() => requests.has('1006'))
  requests.get('1005').reject(new Error('关闭后的旧详情失败'))
  assert.equal(await lateFailure, null)
  assert.equal(store.jobDetails.has('1005'), false)
  assert.equal(store.detailError, null)
  assert.equal(store.detailLoading, true)
  requests.get('1006').resolve(axiosResponse(requests.get('1006').config, {
    id: '1006',
    fileId: '24',
    status: 'PAUSED',
    fileName: '当前任务-失败分支.gcode'
  }))
  assert.equal((await currentFailure).fileName, '当前任务-失败分支.gcode')
  assert.equal(store.detailError, null)
  assert.equal(store.detailLoading, false)
})
