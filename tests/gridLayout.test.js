import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createGridConfig,
  getDefaultGridConfig,
  getOutOfBoundsDevices,
  getPhysicalColumn,
  getVisualColumns
} from '../src/utils/gridLayout.js'
import { formatRowLabel } from '../src/utils/formatters.js'

test('默认布局兼容原有四行十二列和单个过道', () => {
  const config = getDefaultGridConfig()
  assert.equal(config.ROWS, 4)
  assert.equal(config.COLS, 12)
  assert.equal(config.TOTAL_COLS, 13)
  assert.deepEqual(config.aisles.map(aisle => aisle.afterColumn), [7])
})

test('自定义多个过道后可正确生成视觉列和物理列映射', () => {
  const config = createGridConfig({
    rowCount: 2,
    columnCount: 6,
    aisles: [
      { afterColumn: 2, label: '主过道' },
      { afterColumn: 5, label: '侧过道' }
    ]
  })
  const columns = getVisualColumns(config)

  assert.equal(config.TOTAL_COLS, 8)
  assert.deepEqual(columns.map(column => column.type), [
    'device', 'device', 'aisle', 'device', 'device', 'device', 'aisle', 'device'
  ])
  assert.equal(getPhysicalColumn(3, config), null)
  assert.equal(getPhysicalColumn(4, config), 3)
  assert.equal(getPhysicalColumn(8, config), 6)
})

test('减少行列时识别超出新范围的设备', () => {
  const config = createGridConfig({ rowCount: 2, columnCount: 3, aisles: [] })
  const devices = [
    { id: 1, gridRow: 1, gridCol: 3 },
    { id: 2, gridRow: 3, gridCol: 1 },
    { id: 3, gridRow: null, gridCol: null }
  ]

  assert.deepEqual(getOutOfBoundsDevices(devices, config).map(device => device.id), [2])
})

test('自定义行数超过二十六行时继续生成有效行标签', () => {
  assert.equal(formatRowLabel(26), 'Z')
  assert.equal(formatRowLabel(27), 'AA')
})
