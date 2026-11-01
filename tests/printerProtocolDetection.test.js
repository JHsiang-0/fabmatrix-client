import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

test('管理员模拟探测并添加设备时由后端判定协议', async () => {
  resetMockState()
  mockState.sessions['test-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  const headers = { Authorization: 'Bearer test-admin' }
  const rrf = mockState.printers.find(printer => printer.firmwareType === 'RRF')
  const response = await mockRequest({ method: 'post', url: '/api/v1/printers/detect-protocol', headers,
    data: { ipAddress: rrf.ipAddress } })
  assert.equal(response.data.firmwareType, 'RRF')
  await mockRequest({ method: 'post', url: '/api/v1/printers/add-detected', headers,
    data: { name: 'test printer', ipAddress: rrf.ipAddress, firmwareType: 'KLIPPER' } })
  assert.equal(mockState.printers.at(-1).firmwareType, 'RRF')
})
