import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const gridMapSource = fs.readFileSync(new URL('../src/components/grid/GridMap.vue', import.meta.url), 'utf8')
const gridCellSource = fs.readFileSync(new URL('../src/components/grid/GridCell.vue', import.meta.url), 'utf8')

test('GridMap passes row, column, and cross aisle axes to GridCell', () => {
  assert.match(gridMapSource, /:aisle-axis="getAisleAxis\(rowIndex, colIndex\)"/)
  assert.match(gridMapSource, /if \(rowIsAisle && columnIsAisle\) return 'cross'/)
  assert.match(gridMapSource, /if \(rowIsAisle\) return 'row'/)
  assert.match(gridMapSource, /if \(columnIsAisle\) return 'column'/)
})

test('GridCell renders both directional markers for a cross aisle', () => {
  assert.match(gridCellSource, /aisleAxis === 'row' \|\| aisleAxis === 'cross'/)
  assert.match(gridCellSource, /aisleAxis === 'column' \|\| aisleAxis === 'cross'/)
  assert.match(gridCellSource, /repeating-linear-gradient\(\s*to right/)
  assert.match(gridCellSource, /repeating-linear-gradient\(\s*to bottom/)
})

test('GridCell aisle root follows its CSS Grid track', () => {
  assert.match(gridCellSource, /class="[^"]*w-full h-full min-w-0 min-h-0 overflow-hidden[^"]*"/)
  assert.doesNotMatch(gridCellSource, /min-h-\[60px\]|sm:min-h-\[80px\]|lg:min-h-\[100px\]/)
})
