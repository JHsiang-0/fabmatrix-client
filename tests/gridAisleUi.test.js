import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { createGridConfig, getVisualColumns, getVisualRows } from '../src/utils/gridLayout.js'

const gridMapSource = fs.readFileSync(new URL('../src/components/grid/GridMap.vue', import.meta.url), 'utf8')
const gridCellSource = fs.readFileSync(new URL('../src/components/grid/GridCell.vue', import.meta.url), 'utf8')

const config = createGridConfig({
  rowCount: 4,
  columnCount: 5,
  aisles: [
    { id: 'column-aisle', axis: 'COLUMN', afterIndex: 2, label: '纵向过道', size: 100 },
    { id: 'row-aisle', axis: 'ROW', afterIndex: 3, label: '横向过道', size: 80 }
  ],
  version: 1
})

test('GridMap 为横向、纵向过道生成独立视觉轨道并保留物理坐标', () => {
  const columns = getVisualColumns(config)
  const rows = getVisualRows(config)
  assert.deepEqual(columns.filter(entry => entry.type === 'aisle').map(entry => entry.label), ['纵向过道'])
  assert.deepEqual(rows.filter(entry => entry.type === 'aisle').map(entry => entry.label), ['横向过道'])
  assert.equal(columns.filter(entry => entry.type === 'device').length, 5)
  assert.equal(rows.filter(entry => entry.type === 'device').length, 4)
  assert.match(gridMapSource, /:cell-type="getCellType\(row, column\)"/)
  assert.match(gridMapSource, /:aisle-label="getAisleLabel\(row, column\)"/)
  assert.match(gridMapSource, /column\.type === 'aisle' \? `\$\{column\.width\}px`/)
  assert.match(gridMapSource, /row\.type === 'aisle' \? `\$\{row\.height\}px`/)
})

test('交叉过道合并行列标签，GridCell 仅在过道单元显示语义', () => {
  assert.match(gridMapSource, /return `\$\{row\.label\}\/\$\{column\.label\}`/)
  assert.match(gridMapSource, /if \(row\.type === 'aisle' \|\| column\.type === 'aisle'\) return 'aisle'/)
  assert.match(gridCellSource, /v-if="cellType === 'aisle'"/)
  assert.match(gridCellSource, /{{ aisleLabel }}/)
  assert.match(gridCellSource, /v-else-if="cellType === 'empty'"/)
})

test('大布局使用内部双向滚动，过道轨道与表头共用模板', () => {
  assert.match(gridMapSource, /class="grid-map-scroll"/)
  assert.match(gridMapSource, /overflow: auto/)
  assert.match(gridMapSource, /:style="columnTemplateStyle"/)
  assert.match(gridMapSource, /:style="rowTemplateStyle"/)
  assert.match(gridMapSource, /gridTemplateColumns: columnTemplate\.value/)
  assert.match(gridMapSource, /emitDimensionChange\('row', 1\)/)
  assert.match(gridMapSource, /emitDimensionChange\('column', 1\)/)
  assert.doesNotMatch(gridMapSource, /\.grid-map-canvas\.is-edit-mode\s*\{[^}]*padding:/s)
  assert.doesNotMatch(gridMapSource, /repeat\(13, 100px\)|repeat\(4, 120px\)/)
})
