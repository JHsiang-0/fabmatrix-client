import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const printerSource = fs.readFileSync(new URL('../src/views/PrinterManage.vue', import.meta.url), 'utf8')
const drawerSource = fs.readFileSync(new URL('../src/components/device/DeviceDetailDrawer.vue', import.meta.url), 'utf8')
const taskSource = fs.readFileSync(new URL('../src/components/TaskDetailDrawer.vue', import.meta.url), 'utf8')
const realtimeSource = fs.readFileSync(new URL('../src/stores/printer/realtimeStore.js', import.meta.url), 'utf8')

const request = (method, url, data, headers, params) => mockRequest({
  method,
  url,
  data,
  headers,
  params
})

const unwrap = response => {
  assert.equal(response.code, 200)
  return response.data
}

const adminHeaders = { Authorization: 'Bearer printer-monitor-admin' }
const operatorHeaders = { Authorization: 'Bearer printer-monitor-operator' }

test.beforeEach(() => {
  resetMockState()
  mockState.sessions['printer-monitor-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.sessions['printer-monitor-operator'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
})

test.afterEach(() => resetMockState())

test('打印机监控契约支持列表、详情、单台和批量配置并校验权限', async () => {
  const page = unwrap(await request('GET', '/api/v1/printers/page', undefined, adminHeaders, { pageNum: 1, pageSize: 10 }))
  assert.equal(page.records.length > 0, true)
  assert.equal('status' in page.records[0], true)
  assert.equal('connectionStatus' in page.records[0], true)
  assert.equal('monitorEnabled' in page.records[0], true)
  assert.equal('lastKnownStatus' in page.records[0], true)

  const initial = unwrap(await request('GET', '/api/v1/printers/403/monitor', undefined, adminHeaders))
  assert.equal(initial.printerId, 403)
  assert.equal(typeof initial.monitorEnabled, 'boolean')
  assert.equal(['ONLINE', 'OFFLINE', 'UNKNOWN'].includes(initial.connectionStatus), true)

  const updated = unwrap(await request(
    'PUT',
    '/api/v1/printers/403/monitor',
    { monitorEnabled: false },
    adminHeaders
  ))
  assert.equal(updated.monitorEnabled, false)

  const batch = unwrap(await request(
    'PUT',
    '/api/v1/printers/monitor/batch',
    { printerIds: [403, 404], monitorEnabled: true },
    adminHeaders
  ))
  assert.deepEqual(batch, { updatedCount: 2, monitorEnabled: true })

  await assert.rejects(
    request('PUT', '/api/v1/printers/403/monitor', { monitorEnabled: false }, operatorHeaders),
    error => error.response.status === 403
  )
  await assert.rejects(
    request('PUT', '/api/v1/printers/monitor/batch', { printerIds: [], monitorEnabled: true }, adminHeaders),
    error => error.response.status === 400
  )
})

test('RECONCILING 任务支持人工核对并在重新排队时解除打印机绑定', async () => {
  const job = mockState.jobs.find(item => item.id === 1001)
  const printer = mockState.printers.find(item => item.id === 403)
  job.status = 'RECONCILING'
  job.printerId = printer.id
  printer.currentJobId = job.id
  printer.status = 'PRINTING'

  const result = unwrap(await request(
    'POST',
    `/api/v1/print-jobs/${job.id}/reconcile`,
    { result: 'QUEUED', reason: '现场确认模型未完整打印，重新排队' },
    adminHeaders
  ))

  assert.equal(result.status, 'QUEUED')
  assert.equal(result.printerId, null)
  assert.equal(printer.currentJobId, null)
  assert.equal(printer.status, 'IDLE')
})

test('监控和人工核对界面保留业务状态与通信状态的独立语义', () => {
  assert.match(printerSource, /connectionStatus/)
  assert.match(printerSource, /monitorEnabled/)
  assert.match(printerSource, /lastCommunicationError/)
  assert.match(printerSource, /updatePrinterMonitorBatch/)
  assert.match(drawerSource, /当前状态[\s\S]*businessStatus/)
  assert.match(drawerSource, /监控与通信/)
  assert.match(drawerSource, /currentJobStatus === 'RECONCILING'/)
  assert.match(taskSource, /设备状态无法自动确认，请人工核对打印结果。/)
  assert.match(taskSource, /reconcilePrintJob|@reconcile|reconcileLoading/)
  assert.match(realtimeSource, /COMMUNICATION_HEALTH/)
  assert.match(realtimeSource, /businessStatus/)
  assert.match(realtimeSource, /PRINTER_OFFLINE/)
  assert.match(realtimeSource, /refreshPrinterSnapshot/)
})
