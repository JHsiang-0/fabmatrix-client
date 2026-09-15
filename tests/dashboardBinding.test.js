import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeDraftAvailableDevices } from '../src/utils/dashboardBinding.js'

test('布局草稿中刚绑定的设备立即从候选列表移除', () => {
  const result = mergeDraftAvailableDevices(
    [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    [{ id: 1, name: 'A', gridRow: 1, gridCol: 1 }, { id: 2, name: 'B', gridRow: null, gridCol: null }]
  )

  assert.deepEqual(result.map(device => device.id), [2])
})

test('布局草稿中刚解除绑定的设备立即加入候选列表', () => {
  const result = mergeDraftAvailableDevices(
    [{ id: 1, name: 'A' }],
    [{ id: 1, name: 'A', gridRow: null, gridCol: null }, { id: 2, name: 'B', gridRow: null, gridCol: null }]
  )

  assert.deepEqual(result.map(device => device.id), [1, 2])
})

test('半空或异常坐标不作为可绑定设备展示', () => {
  const result = mergeDraftAvailableDevices(
    [{ id: 1, name: 'A' }],
    [{ id: 1, name: 'A', gridRow: 1, gridCol: null }]
  )

  assert.deepEqual(result, [])
})
