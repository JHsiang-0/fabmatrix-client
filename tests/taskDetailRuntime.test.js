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
  const promise = new Promise(done => {
    resolve = done
  })
  return { promise, resolve }
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
})
