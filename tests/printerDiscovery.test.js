import assert from 'node:assert/strict'
import test from 'node:test'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'
import { REQUEST_TIMEOUT } from '../src/utils/constants.js'
import {
  applyBatchUpsertResult,
  createScanDeviceKey,
  getDiscoveryStats,
  getDiscoveryStatus
} from '../src/utils/printerDiscovery.js'

test('设备批量导入使用独立长超时，避免服务端成功后前端误报失败', () => {
  assert.equal(REQUEST_TIMEOUT.DEVICE_BATCH, 120_000)
})

test('扫描发现状态分别统计 NEW、EXISTING 和 UNKNOWN_MAC', () => {
  const devices = [
    { status: 'NEW' },
    { discoveryStatus: 'EXISTING' },
    { discoveryState: 'UNKNOWN_MAC' },
    { status: '未登记枚举' }
  ]

  assert.deepEqual(getDiscoveryStats(devices), {
    total: 4,
    newCount: 1,
    existingCount: 1,
    unknownCount: 2
  })
  assert.equal(getDiscoveryStatus({ status: 'UNKNOWN-MAC' }).code, 'UNKNOWN_MAC')
})

test('批量逐项结果按 index、IP、MAC 顺序匹配并只保留失败项待重试', () => {
  const scanDevices = [
    { scanKey: createScanDeviceKey({ ipAddress: '192.168.0.10', macAddress: 'AA-BB' }, 0), ipAddress: '192.168.0.10', macAddress: 'AA-BB' },
    { scanKey: createScanDeviceKey({ ipAddress: '192.168.0.11', macAddress: 'CC-DD' }, 1), ipAddress: '192.168.0.11', macAddress: 'CC-DD' },
    { scanKey: createScanDeviceKey({ ipAddress: '192.168.0.12', macAddress: 'EE-FF' }, 2), ipAddress: '192.168.0.12', macAddress: 'EE-FF' }
  ]
  const result = applyBatchUpsertResult(scanDevices, scanDevices, {
    failedCount: 2,
    items: [
      { index: 0, ipAddress: '不匹配但 index 优先', success: true, reason: '处理成功' },
      { ipAddress: '192.168.0.11', success: false, reason: 'IP 匹配失败原因' },
      { macAddress: 'EE:FF', success: false, reason: 'MAC 匹配失败原因' }
    ]
  })

  assert.deepEqual(result.succeededKeys, [scanDevices[0].scanKey])
  assert.deepEqual(result.failedKeys, [scanDevices[1].scanKey, scanDevices[2].scanKey])
  assert.equal(result.devices[1].batchResult.reason, 'IP 匹配失败原因')
  assert.equal(result.devices[2].batchResult.reason, 'MAC 匹配失败原因')
})

test('Mock 批量导入返回正式逐项结果并支持部分失败', async () => {
  resetMockState({
    batchAddFailures: [{ ipAddress: '192.168.0.91', reason: '设备认证失败，请检查 API Key' }]
  })
  mockState.sessions['batch-upsert-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }

  try {
    const response = await mockRequest({
      method: 'POST',
      url: '/api/v1/printers/batch-add',
      headers: { Authorization: 'Bearer batch-upsert-admin' },
      data: [
        { ipAddress: '192.168.0.90', macAddress: 'AA:BB:CC:DD:EE:90', firmwareType: 'KLIPPER', isNewDevice: true, suggestedName: '成功设备' },
        { ipAddress: '192.168.0.91', macAddress: 'AA:BB:CC:DD:EE:91', firmwareType: 'RRF', isNewDevice: false, suggestedName: '失败设备' }
      ]
    })

    assert.equal(response.data.totalCount, 2)
    assert.equal(response.data.insertedCount, 1)
    assert.equal(response.data.updatedCount, 0)
    assert.equal(response.data.failedCount, 1)
    assert.deepEqual(response.data.items[1], {
      index: 1,
      ipAddress: '192.168.0.91',
      macAddress: 'AA:BB:CC:DD:EE:91',
      success: false,
      reason: '设备认证失败，请检查 API Key'
    })
  } finally {
    resetMockState()
  }
})
