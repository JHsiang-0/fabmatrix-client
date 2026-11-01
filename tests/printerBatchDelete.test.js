import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

test('批量删除只允许管理员，并对空闲与打印中设备分别返回结果', async () => {
  resetMockState()
  mockState.sessions['batch-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.sessions['batch-operator'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
  const request = token => ({ method: 'post', url: '/api/v1/printers/batch-delete',
    headers: { Authorization: `Bearer ${token}` }, data: { ids: [404, 403] } })
  await assert.rejects(() => mockRequest(request('batch-operator')))
  const response = await mockRequest(request('batch-admin'))
  assert.equal(response.data.deletedCount, 1)
  assert.equal(response.data.failedCount, 1)
  assert.deepEqual(response.data.items.map(item => item.success), [true, false])
  assert.equal(mockState.printers.some(item => item.id === 404), false)
  assert.equal(mockState.printers.some(item => item.id === 403), true)
})
