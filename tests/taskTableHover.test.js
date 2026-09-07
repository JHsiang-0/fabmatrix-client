import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const queueSource = fs.readFileSync(new URL('../src/views/JobQueue.vue', import.meta.url), 'utf8')
const historySource = fs.readFileSync(new URL('../src/views/JobHistory.vue', import.meta.url), 'utf8')

test('task queue enables hover feedback for pending and active tables', () => {
  assert.equal((queueSource.match(/<TdTable/g) || []).length >= 2, true)
  assert.equal((queueSource.match(/\shover/g) || []).length >= 2, true)
  assert.match(queueSource, /\.job-queue-table :deep\(\.t-table__body tr:hover > td\)/)
  assert.match(queueSource, /box-shadow: inset 3px 0 var\(--app-primary\)/)
})

test('print history enables TDesign table hover feedback', () => {
  assert.match(historySource, /<TdTable[\s\S]*?class="history-table"[\s\S]*?hover/)
  assert.match(historySource, /\.history-table :deep\(\.t-table__body tr:hover > td\)/)
  assert.match(historySource, /background: var\(--app-surface-hover\)/)
})

test('task queue cards keep the same hover language as tables', () => {
  assert.match(queueSource, /\.job-card:hover\s*\{[\s\S]*background: var\(--app-surface-hover\)/)
  assert.match(queueSource, /\.job-card:hover\s*\{[\s\S]*box-shadow: var\(--app-shadow\)/)
})
