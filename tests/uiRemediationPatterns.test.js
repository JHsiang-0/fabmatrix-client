import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const pageHeaderSource = read('../src/components/layout/PageHeader.vue')
const queryToolbarSource = read('../src/components/layout/QueryToolbar.vue')
const dataRegionSource = read('../src/components/layout/DataRegion.vue')
const statusTagSource = read('../src/components/StatusTag.vue')
const statusViewSource = read('../src/utils/statusView.js')
const asyncStateSource = read('../src/components/AsyncState.vue')
const dashboardSource = read('../src/views/Dashboard.vue')
const printerSource = read('../src/views/PrinterManage.vue')
const queueSource = read('../src/views/JobQueue.vue')
const historySource = read('../src/views/JobHistory.vue')
const tailwindSource = read('../tailwind.config.js')
const mainSource = read('../src/main.js')

test('公共页面模式通过 TDesign 组件提供唯一结构入口', () => {
  assert.match(pageHeaderSource, /<header class="app-page-header">/)
  assert.match(pageHeaderSource, /<h1 class="app-page-header__title">\{\{ title \}\}<\/h1>/)
  assert.match(queryToolbarSource, /<section class="app-query-toolbar"/)
  assert.match(dataRegionSource, /<section class="app-data-region"/)
  assert.match(statusTagSource, /<t-tag[\s\S]*:theme="status\.theme"/)
})

test('状态视图模型覆盖打印机与任务状态并提供统一图标和描述', () => {
  assert.match(statusViewSource, /printer: \{/)
  assert.match(statusViewSource, /job: \{/)
  assert.match(statusViewSource, /description: source\.description \|\|/)
  assert.match(statusViewSource, /icon: config\.icons\[code\]/)
})

test('业务页面状态标签复用公共 StatusTag', () => {
  assert.match(dashboardSource, /<StatusTag domain="job" :status="job\.status" \/>/)
  assert.match(printerSource, /<StatusTag domain="printer" :status="scope\.row\.printStatus" \/>/)
  assert.match(queueSource, /<StatusTag domain="job" :status="scope\.row\.status" \/>/)
  assert.match(historySource, /<StatusTag domain="job" :status="scope\.row\.status" \/>/)
})

test('异步状态在区域内提供 loading、error、empty 和可恢复操作', () => {
  assert.match(asyncStateSource, /role="status" aria-live="polite"/)
  assert.match(asyncStateSource, /class="async-state__loading"/)
  assert.match(asyncStateSource, /class="async-state__error"/)
  assert.match(asyncStateSource, /class="async-state__empty"/)
  assert.match(asyncStateSource, /@click="\$emit\('retry'\)"/)
})

test('Tailwind 只提供布局辅助并复用 TDesign 语义色，不再加载重复响应式色板', () => {
  assert.match(tailwindSource, /DEFAULT: 'var\(--td-brand-color\)'/)
  assert.match(tailwindSource, /success: 'var\(--td-success-color\)'/)
  assert.match(tailwindSource, /danger: 'var\(--td-error-color\)'/)
  assert.doesNotMatch(tailwindSource, /DEFAULT: '#|success: '#|warning: '#|danger: '#/)
  assert.doesNotMatch(mainSource, /styles\/responsive\.css/)
  assert.equal(fs.existsSync(new URL('../src/styles/responsive.css', import.meta.url)), false)
})
