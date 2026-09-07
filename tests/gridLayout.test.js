import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createGridConfig,
  getDefaultGridConfig,
  getOutOfBoundsDevices,
  getPhysicalColumn,
  getPhysicalRow,
  getVisualColumns,
  getVisualRows
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

test('行过道不会改变设备物理行坐标', () => {
  const config = createGridConfig({
    rowCount: 3,
    columnCount: 2,
    aisles: [{ axis: 'row', afterIndex: 1, label: '横向过道', size: 80 }]
  })
  const rows = getVisualRows(config)

  assert.deepEqual(rows.map(row => row.type), ['device', 'aisle', 'device', 'device'])
  assert.equal(getPhysicalRow(1, config), 1)
  assert.equal(getPhysicalRow(2, config), null)
  assert.equal(getPhysicalRow(3, config), 2)
  assert.equal(rows[1].label, '横向过道')
})

test('行列过道可以同时存在且分别统计视觉尺寸', () => {
  const config = createGridConfig({
    rowCount: 2,
    columnCount: 3,
    aisles: [
      { axis: 'row', afterIndex: 1 },
      { axis: 'column', afterIndex: 2 }
    ]
  })

  assert.equal(config.TOTAL_ROWS, 3)
  assert.equal(config.TOTAL_COLS, 4)
  assert.equal(getVisualRows(config).length, 3)
  assert.equal(getVisualColumns(config).length, 4)
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
