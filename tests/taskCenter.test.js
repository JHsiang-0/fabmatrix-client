import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const queueSource = fs.readFileSync(new URL('../src/views/JobQueue.vue', import.meta.url), 'utf8')
const historySource = fs.readFileSync(new URL('../src/views/JobHistory.vue', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('../src/components/TaskDetailDrawer.vue', import.meta.url), 'utf8')

test('任务中心按队列和活动任务分区，不把队列结果当作全部活动任务', () => {
  assert.match(queueSource, /getJobQueue|fetchQueue/)
  assert.match(queueSource, /fetchActive/)
  assert.match(queueSource, /ACTIVE_JOB_STATUSES|activePageData/)
  assert.match(queueSource, /任务创建完成|部分任务未创建成功/)
})

test('任务创建只提交正式字段并提供幂等多份结果', () => {
  assert.match(queueSource, /getFileTree\(\)/)
  assert.match(queueSource, /createPrintJob\(\{/)
  assert.match(queueSource, /fileId: createTaskForm\.value\.fileId/)
  assert.match(queueSource, /idempotencyKey: `\$\{createTaskBatchKey\.value\}-\$\{index\}`/)
  assert.doesNotMatch(queueSource, /materialType: createTaskForm|nozzleSize: createTaskForm/)
  assert.match(queueSource, /retryFailedTaskCreations/)
})

test('任务中心动作受正式状态限制且历史查询不发送未定义 keyword', () => {
  assert.match(queueSource, /handlePause/)
  assert.match(queueSource, /handleResume/)
  assert.match(queueSource, /pausePrinter\(job\.printerId\)/)
  assert.match(queueSource, /resumePrinter\(job\.printerId\)/)
  assert.match(queueSource, /\['QUEUED', 'ASSIGNED', 'UPLOADING', 'READY', 'PRINTING', 'PAUSED', 'RECONCILING'\]/)
  assert.doesNotMatch(historySource, /params\.keyword|queryForm\.keyword/)
  assert.match(historySource, /hasValue\(scope\.row\.progress\)/)
})

test('任务详情只展示后端任务字段并对缺失值使用占位', () => {
  assert.match(detailSource, /发起用户 ID/)
  assert.match(detailSource, /现场操作员 ID/)
  assert.match(detailSource, /已知时间线/)
  assert.match(detailSource, /formatDateTime\(task\.startedAt\)/)
  assert.match(detailSource, /v-if="hasValue\(task\.progress\)"/)
  assert.doesNotMatch(detailSource, /task\.progress \|\| 0/)
})

test('任务中心使用统一工作区并让详情 Drawer 受控关闭', () => {
  assert.match(queueSource, /class="job-panel"/)
  assert.match(historySource, /<QueryToolbar class="history-filter-toolbar"/)
  assert.doesNotMatch(queueSource + historySource + detailSource, /job-panel-card|class="history-card"/)
  assert.match(detailSource, /v-model:visible="drawerVisible"/)
  assert.match(detailSource, /aria-label="关闭任务详情"/)
})

test('任务中心视觉适配保留 TDesign 分区、表格反馈和详情核对布局', () => {
  assert.match(queueSource, /class="[^"]*job-queue-page/)
  assert.match(queueSource, /class="job-queue-tabs"/)
  assert.match(queueSource, /class="job-queue-table job-table"/)
  assert.match(queueSource, /class="job-queue-inline-error mb-3"/)
  assert.match(queueSource, /class="job-queue-pagination flex justify-center mt-4"/)
  assert.match(queueSource, /task-action-group/)
  assert.match(queueSource, /\bhover\b/)

  assert.match(historySource, /class="[^"]*job-history-page/)
  assert.match(historySource, /class="history-content"/)
  assert.match(historySource, /class="history-table-wrapper"/)
  assert.match(historySource, /class="history-table history-management-table"/)
  assert.match(historySource, /class="history-pagination-footer mt-4 flex justify-center px-4"/)
  assert.match(historySource, /history-inline-error/)
  assert.match(historySource, /\bhover\b/)

  assert.match(detailSource, /class="task-detail-drawer__descriptions"/)
  assert.match(detailSource, /task-detail-drawer__reconcile-actions/)
  assert.match(detailSource, /:maxlength="255"/)
  assert.match(detailSource, /COMPLETED.*FAILED.*CANCELLED.*QUEUED/s)
})

test('任务核对仍有重复提交保护并刷新任务、队列和打印机状态', () => {
  assert.match(queueSource, /reconcileSubmitting\.value \|\| !job \|\| job\.status !== 'RECONCILING'/)
  assert.match(queueSource, /reconcilePrintJob\(job\.id, payload\)/)
  assert.match(queueSource, /jobStore\.refresh\(\)/)
  assert.match(queueSource, /realtimeStore\.refreshPrinterSnapshot\(\)/)
  assert.match(historySource, /reconcileSubmitting\.value \|\| !job \|\| job\.status !== 'RECONCILING'/)
  assert.match(historySource, /reconcilePrintJob\(job\.id, payload\)/)
  assert.match(historySource, /fetchData\(\)/)
})
