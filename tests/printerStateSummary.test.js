import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPrinterStateSummary, capturePrinterStateSummary, mergePrinterStateRecords } from '../src/utils/printerStateSummary.js'
import { normalizePrinter, normalizePrinterDetail, resolveEffectivePrinterStatus } from '../src/utils/dataAdapters.js'

const serverTime = '2026-11-05T08:00:00Z'
const summary = overrides => ({
  modelVersion: 2, localPrinterId: '42', serverTime, observedAt: serverTime, stale: false,
  monitorEnabled: true, connectionStatus: 'ONLINE', status: 'PRINTING',
  progress: 0, toolTemperature: 0, toolTarget: 210, bedTemperature: 60, bedTarget: 60,
  filename: 'sample.gcode', taskSource: 'EXTERNAL', executionId: 'execution-id', ...overrides
})

test('摘要优先于冲突的旧状态，真实零值保留且本地占用不变', () => {
  const row = capturePrinterStateSummary({ id: '42', status: 'IDLE', progress: 80,
    currentJobId: 'reserved-job', isSafeToPrint: false, stateSummary: summary() }, 1000)
  const value = applyPrinterStateSummary(row, row.id, 1000)
  assert.equal(value.effectiveStatus, 'PRINTING')
  assert.equal(value.progress, 0)
  assert.equal(value.extruder.temperature, 0)
  assert.equal(value.currentJobId, 'reserved-job')
  assert.equal(value.isSafeToPrint, false)
  assert.equal(value.status, 'IDLE')
  assert.equal(applyPrinterStateSummary(row, row.id, 31000).progress, 0)
})

test('使用服务端时间及本地接收间隔判断过期，重复读取不续期', () => {
  const row = capturePrinterStateSummary({ id: '42', stateSummary: summary() }, 1000)
  const value = applyPrinterStateSummary(capturePrinterStateSummary(row, 20000), '42', 31001)
  assert.equal(value._stateSummaryReceivedAt, 1000)
  assert.equal(value.effectiveStatus, 'UNKNOWN')
  for (const key of ['progress', 'toolTemperature', 'bedTemperature', 'filename', 'executionId']) assert.equal(value[key], null)
  assert.equal(value.extruder.temperature, null)
  assert.equal(value.taskSource, 'UNKNOWN')
})

test('跨设备、未知版本、空摘要和错误时间拒绝回退到旧实时值', () => {
  for (const invalid of [null, summary({ localPrinterId: '43' }), summary({ modelVersion: 3 }),
    summary({ serverTime: 'invalid' }), summary({ observedAt: '2026-11-05T08:00:06Z' }),
    summary({ monitorEnabled: false }), summary({ stale: true })]) {
    const row = capturePrinterStateSummary({ id: '42', progress: 80, toolTemperature: 200, stateSummary: invalid }, 1000)
    const value = applyPrinterStateSummary(row, '42', 1000)
    assert.equal(value.effectiveStatus, 'UNKNOWN')
    assert.equal(value.progress, null)
    assert.equal(value.toolTemperature, null)
  }
  const offline = capturePrinterStateSummary({ id: '42', stateSummary: summary({ connectionStatus: 'OFFLINE' }) }, 1000)
  assert.equal(applyPrinterStateSummary(offline, '42', 1000).effectiveStatus, 'OFFLINE')
})

test('列表与聚合详情使用同一摘要，缺摘要的旧服务端仍可兼容', () => {
  const printer = { id: 42, status: 'IDLE', stateSummary: summary() }
  assert.equal(normalizePrinter(printer).effectiveStatus, 'PRINTING')
  const detail = normalizePrinterDetail({ printer, realtimeStatus: { state: 'idle', progress: 95,
    stateSummary: summary() }, currentJob: { id: 7 } })
  assert.equal(detail.realtimeStatus.progress, 0)
  assert.equal(detail.currentJob.id, '7')
  assert.equal(resolveEffectivePrinterStatus(normalizePrinter({ id: 42, status: 'IDLE' })), 'IDLE')
})

test('REST 与 WebSocket 交错时优先较新的摘要，合并旧字段不会延长接收时间', () => {
  const recent = capturePrinterStateSummary({ id: '42', stateSummary: summary() }, 1000)
  const older = capturePrinterStateSummary({ id: '42', stateSummary: summary({
    serverTime: '2026-11-05T07:59:59Z', progress: 95, status: 'PAUSED'
  }) }, 2000)
  for (const row of [mergePrinterStateRecords(recent, older), mergePrinterStateRecords(older, recent),
    mergePrinterStateRecords(recent, { progress: 95 })]) {
    assert.equal(applyPrinterStateSummary(row, '42', 2000).progress, 0)
    assert.equal(row._stateSummaryReceivedAt, 1000)
  }
  assert.equal(mergePrinterStateRecords(recent, { stateSummary: null }).stateSummary, null)
})
