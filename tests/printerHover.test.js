import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('../src/views/PrinterManage.vue', import.meta.url), 'utf8')

test('printer management enables TDesign table hover feedback', () => {
  assert.match(source, /<TdTable[\s\S]*?hover[\s\S]*?@row-click="handleRowClick"/)
  assert.match(source, /\.printer-management-table :deep\(\.t-table__body tr:hover > td\)/)
  assert.match(source, /background: var\(--td-bg-color-container-hover\)/)
  assert.match(source, /box-shadow: inset 3px 0 var\(--td-brand-color-6\)/)
})

test('printer management keeps a consistent hover treatment for grid cards', () => {
  assert.match(source, /class="printer-grid-card"\s*role="button"\s*tabindex="0"/)
  assert.match(source, /\.printer-grid-card:hover\s*\{[\s\S]*background: var\(--td-bg-color-container-hover\)/)
  assert.match(source, /\.printer-grid-card:focus-visible\s*\{[\s\S]*outline: 2px solid var\(--td-brand-color-6\)/)
})
