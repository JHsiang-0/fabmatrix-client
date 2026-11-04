import assert from 'node:assert/strict'
import test from 'node:test'
import { readPrinterModel, isModelCurrent, modelMeasurement, printerModelGroups, printerModelSummary } from '../src/utils/printerModel.js'
import { createPrinterModelLoader } from '../src/utils/printerModelLoader.js'
import { printerModelFixture } from './fixtures/printerModel.js'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

test('模型校验区分未采集、不支持版本和其他设备，避免错误关联', () => {
  const data = printerModelFixture()
  assert.equal(readPrinterModel(data, '403'), data)
  assert.equal(readPrinterModel({ ...data, model: null }, 403).model, null)
  assert.throws(() => readPrinterModel(data, 404), /身份/)
  data.model.modelVersion = 99
  assert.throws(() => readPrinterModel(data, 403), /版本/)
  assert.throws(() => readPrinterModel({}, 403), /格式/)
})

test('按设备连接、监控、响应和采样时间判断新鲜度', () => {
  const data = printerModelFixture()
  const now = Date.parse(data.serverTime)
  assert.equal(isModelCurrent(data, now), true)
  assert.equal(isModelCurrent(data, now + 30001), false)
  assert.equal(isModelCurrent(data, now - 5001), false)
  data.model.observation.connection.monitorEnabled = false
  assert.equal(isModelCurrent(data, now), false)
  data.model.observation.connection.monitorEnabled = true
  data.model.observation.connection.status = 'OFFLINE'
  assert.equal(isModelCurrent(data, now), false)
})

test('测量保留零、false和不支持，并逐字段拒绝旧数据和不安全整数', () => {
  const data = printerModelFixture()
  const zero = data.model.observation.heaters[0].currentC
  const options = { current: true, now: Date.parse(data.serverTime) }
  assert.equal(modelMeasurement(zero, { ...options, unit: ' °C' }), '0 °C')
  assert.equal(modelMeasurement({ ...zero, value: false }, options), '否')
  assert.equal(modelMeasurement({ ...zero, quality: 'UNSUPPORTED', value: null }, options), '不支持')
  assert.equal(modelMeasurement({ ...zero, observedAt: '2000-01-01T00:00:00Z' }, options), '数据过期')
  assert.equal(modelMeasurement({ ...zero, value: Number.MAX_SAFE_INTEGER + 1 }, { ...options, integer: true }), '无效数据')
})

test('多通道、执行依据和历史结果完整展示；离线时不显示旧测量为当前状态', () => {
  const data = printerModelFixture()
  const now = Date.parse(data.serverTime)
  let groups = printerModelGroups(data, now)
  assert.equal(groups.filter(group => group.label.startsWith('加热器')).length, 2)
  assert.ok(JSON.stringify(groups).includes('文件位置推算'))
  assert.ok(JSON.stringify(groups).includes('已取消'))
  data.stale = true
  groups = printerModelGroups(data, now)
  assert.ok(JSON.stringify(groups).includes('数据过期'))
  assert.ok(JSON.stringify(groups).includes('已取消'))
  assert.equal(JSON.stringify(groups).includes('210 °C'), false)
})

test('详情摘要采用新模型状态和进度；未知进度不变成零，离线不保留打印中', () => {
  const data = printerModelFixture()
  const now = Date.parse(data.serverTime)
  assert.equal(printerModelSummary(data, now).status, 'PRINTING')
  assert.equal(printerModelSummary(data, now).progress, 0)
  data.model.observation.currentExecution.progressPercent.quality = 'UNAVAILABLE'
  assert.equal(printerModelSummary(data, now).progress, null)
  data.model.observation.connection.status = 'OFFLINE'
  assert.equal(printerModelSummary(data, now).status, 'OFFLINE')
  assert.equal(printerModelSummary(data, now).filename, '')
})

test('设备切换及关闭使忽略 abort 的旧响应失效；同一设备不重叠请求', async () => {
  const pending = []
  const states = []
  const scheduled = []
  const loader = createPrinterModelLoader({
    fetchModel: (id, options) => new Promise((resolve, reject) => pending.push({ id, options, resolve, reject })),
    onChange: state => states.push(state), schedule: (fn, delay) => { scheduled.push({ fn, delay }); return 1 }, cancelSchedule: () => {}
  })
  loader.start('403')
  await loader.refresh()
  assert.equal(pending.length, 1)
  loader.start('404')
  assert.equal(pending[0].options.signal.aborted, true)
  pending[1].resolve('new-model')
  await new Promise(resolve => setImmediate(resolve))
  pending[0].resolve('old-model')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(states.at(-1).data, 'new-model')
  assert.equal(scheduled.at(-1).delay, 5000)
  loader.stop()
  assert.equal(states.at(-1).data, null)
})

test('刷新失败清空旧值并退避；会话失效后不发布响应、不继续轮询', async () => {
  let active = true
  let rejectRequest
  const states = []
  const schedules = []
  const loader = createPrinterModelLoader({ fetchModel: () => new Promise((resolve, reject) => { rejectRequest = reject }),
    onChange: state => states.push(state), isActive: () => active,
    schedule: (fn, delay) => schedules.push(delay), cancelSchedule: () => {} })
  loader.start(403)
  rejectRequest(new Error('连接失败'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(states.at(-1).data, null)
  assert.equal(states.at(-1).error, '连接失败')
  assert.deepEqual(schedules, [30000])
  loader.start(403)
  active = false
  rejectRequest(new Error('old-session'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(states.some(state => state.error === 'old-session'), false)
  loader.stop()
})

test('Mock 模型读取遵循三个岗位和认证；无采样不伪造设备数据', async () => {
  resetMockState()
  try {
    for (const role of ['ADMIN', 'OPERATOR', 'VIEWER']) {
      mockState.users[0].role = role
      mockState.sessions['model-test'] = { userId: mockState.users[0].id, role, tokenVersion: mockState.users[0].tokenVersion || 0 }
      const response = await mockRequest({ method: 'get', url: '/api/v1/printers/403/model', headers: { Authorization: 'Bearer model-test' } })
      assert.equal(response.data.model, null)
      assert.equal(response.data.stale, true)
    }
    await assert.rejects(mockRequest({ method: 'get', url: '/api/v1/printers/403/model' }), /未登录/)
  } finally { resetMockState() }
})
