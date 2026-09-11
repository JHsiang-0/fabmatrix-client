import assert from 'node:assert/strict'
import test from 'node:test'
import {
  analyzeDevicePositions,
  calculateGridFit,
  createGridConfig,
  formatGridRowLabel,
  getDefaultGridConfig,
  getDuplicateDevicePositions,
  getPhysicalColumn,
  getPhysicalRow,
  getVisualColumns,
  getVisualRows,
  GridLayoutValidationError,
  normalizeLayout
} from '../src/utils/gridLayout.js'

const limits = {
  minRows: 1,
  maxRows: 30,
  minColumns: 1,
  maxColumns: 60,
  maxCells: 1800,
  maxAisles: 20,
  minAisleSize: 48,
  maxAisleSize: 240
}

const layout = (rowCount, columnCount, aisles = []) => normalizeLayout({
  rowCount,
  columnCount,
  aisles,
  version: 1,
  limits,
  updatedAt: null
})

test('支持默认、1x1 和 30x60 布局边界', () => {
  const defaultConfig = getDefaultGridConfig()
  assert.equal(defaultConfig.ROWS, 4)
  assert.equal(defaultConfig.TOTAL_COLS, 13)
  assert.equal(layout(1, 1).rowCount, 1)
  assert.equal(layout(30, 60).columnCount, 60)
})

test('视觉轨道支持多个横纵过道和交叉区域，不占用物理坐标', () => {
  const value = layout(4, 12, [
    { id: 'left', axis: 'COLUMN', afterIndex: 0, label: '左', size: 60 },
    { id: 'middle', axis: 'COLUMN', afterIndex: 6, label: '中', size: 100 },
    { id: 'top', axis: 'ROW', afterIndex: 0, label: '上', size: 80 },
    { id: 'cross', axis: 'ROW', afterIndex: 2, label: '横', size: 90 }
  ])
  const config = createGridConfig(value)
  const columns = getVisualColumns(config)
  const rows = getVisualRows(config)
  assert.equal(columns.length, 14)
  assert.equal(rows.length, 6)
  assert.equal(columns[0].type, 'aisle')
  assert.equal(rows[0].type, 'aisle')
  assert.equal(getPhysicalColumn(2, config), 1)
  assert.equal(getPhysicalRow(2, config), 1)
  assert.equal(getPhysicalColumn(8, config), null)
  assert.equal(getPhysicalRow(4, config), null)
  assert.ok(calculateGridFit(config, { width: 800, height: 560 }).scale > 0)
})

test('行标签使用 Excel 风格并覆盖 AA/AD', () => {
  assert.equal(formatGridRowLabel(1), 'A')
  assert.equal(formatGridRowLabel(26), 'Z')
  assert.equal(formatGridRowLabel(27), 'AA')
  assert.equal(formatGridRowLabel(30), 'AD')
  assert.equal(formatGridRowLabel(0), '')
})

test('非法布局输入严格失败，不静默修正同名过道', () => {
  assert.throws(() => layout(0, 12), GridLayoutValidationError)
  assert.throws(() => layout(4, 12, [
    { id: 'same', axis: 'COLUMN', afterIndex: 1, label: 'a', size: 48 },
    { id: 'same', axis: 'COLUMN', afterIndex: 2, label: 'b', size: 48 }
  ]), /过道 ID 重复/)
  assert.throws(() => layout(4, 12, [
    { id: 'a', axis: 'COLUMN', afterIndex: 1, label: 'a', size: 47 }
  ]), /过道数量|48-240/)
})

test('异常坐标、半空坐标和重复槽位进入确定性清单，超过100台不丢失', () => {
  const devices = Array.from({ length: 101 }, (_, index) => ({ id: index + 1, gridRow: null, gridCol: null }))
  devices[0] = { id: 900, name: 'duplicate-a', gridRow: 1, gridCol: 1 }
  devices[1] = { id: 901, name: 'duplicate-b', gridRow: 1, gridCol: 1 }
  devices[2] = { id: 902, gridRow: 2, gridCol: null }
  devices[3] = { id: 903, gridRow: 99, gridCol: 1 }
  const issues = analyzeDevicePositions(devices, getDefaultGridConfig())
  assert.equal(issues.all.length, 101)
  assert.equal(issues.unallocated.length, 97)
  assert.equal(issues.invalid.length, 1)
  assert.equal(issues.outOfBounds.length, 1)
  assert.deepEqual(getDuplicateDevicePositions(devices)[0].devices.map(item => item.id), ['900', '901'])
})
