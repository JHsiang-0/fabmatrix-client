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
  assert.match(queueSource, /createTaskWarnings/)
  assert.match(queueSource, /confirmMessage\([\s\S]*仍然创建/)
  assert.match(queueSource, /nozzleSize: node\.nozzleSize/)
  assert.match(queueSource, /retryFailedTaskCreations/)
})

test('任务中心动作受正式状态限制且历史查询不发送未定义 keyword', () => {
  assert.match(queueSource, /handlePause/)
  assert.match(queueSource, /handleResume/)
  assert.match(queueSource, /pausePrinter\(job\.printerId\)/)
  assert.match(queueSource, /resumePrinter\(job\.printerId\)/)
  assert.match(queueSource, /activePageData/)
  assert.doesNotMatch(historySource, /params\.keyword|queryForm\.keyword/)
  assert.match(historySource, /hasValue\(scope\.row\.progress\)/)
})

test('活动任务列表为待人工核对任务提供可发现的操作入口', () => {
  assert.match(queueSource, /job\.status === 'RECONCILING'/)
  assert.match(queueSource, /content: '人工核对', value: 'reconcile'/)
  assert.match(queueSource, /case 'reconcile': return openTaskDetail\(job\)/)
})

test('任务详情只展示后端任务字段并对缺失值使用占位', () => {
  assert.match(detailSource, /资源与人员/)
  assert.match(detailSource, /打印机名称/)
  assert.match(detailSource, /机器编号/)
  assert.match(detailSource, /创建人/)
  assert.match(detailSource, /操作员/)
  assert.match(detailSource, /发起用户 ID/)
  assert.match(detailSource, /现场操作员 ID/)
  assert.match(detailSource, /已知时间线/)
  assert.match(detailSource, /formatDateTime\(task\.startedAt\)/)
  assert.match(detailSource, /v-if="hasValue\(task\.progress\)"/)
  assert.doesNotMatch(detailSource, /task\.progress \|\| 0/)
})

test('任务详情标题和技术信息遵循可读优先、默认折叠与长文本安全契约', () => {
  assert.match(detailSource, /<t-tooltip[^>]+task-detail-drawer__name-tooltip/)
  assert.match(detailSource, /detailDisplay\.fileName/)
  assert.match(detailSource, /<StatusTag domain="job" :status="task\.status" \/>/)
  assert.match(detailSource, /<t-collapse[^>]+task-detail-drawer__technical/)
  assert.match(detailSource, /:default-value="\[\]"/)
  assert.match(detailSource, /技术信息/)
  for (const field of ['task.id', 'task.fileId', 'task.printerId', 'task.userId', 'task.operatorId', 'task.retryOfJobId', 'task.rootJobId', 'task.attemptNumber']) {
    assert.match(detailSource, new RegExp(`format(?:Technical)?Value\\(${field}\\)`))
  }
  assert.match(detailSource, /text-overflow: ellipsis/)
  assert.match(detailSource, /overflow-wrap: anywhere/)
  assert.match(detailSource, /\.task-detail-drawer :deep\(\.t-drawer__body\)[\s\S]*overflow-y: auto/)
})

test('任务详情加载、错误、空状态与核对链路均有显式回归护栏', () => {
  const submitSource = detailSource.slice(detailSource.indexOf('const submitReconcile'))
  const reconcilePanelSource = detailSource.slice(
    detailSource.indexOf('class="task-detail-drawer__reconcile-panel"'),
    detailSource.indexOf('<section class="task-detail-drawer__section"')
  )
  assert.match(detailSource, /任务详情加载中/)
  assert.match(detailSource, /v-else-if="error"[^>]*theme="error"/)
  assert.match(detailSource, /description="未选择任务"/)
  assert.match(detailSource, /设备状态无法自动确认，请人工核对打印结果。/)
  assert.match(reconcilePanelSource, /title="设备状态无法自动确认，请人工核对打印结果。"/)
  assert.match(reconcilePanelSource, /现场核对结果/)
  assert.match(reconcilePanelSource, /确认完成/)
  assert.match(reconcilePanelSource, /确认失败/)
  assert.match(reconcilePanelSource, /确认取消/)
  assert.match(reconcilePanelSource, /重新排队/)
  assert.doesNotMatch(reconcilePanelSource, /#operation/)
  assert.match(detailSource, /reconcileLoading/)
  assert.match(detailSource, /validationResult = await reconcileFormRef\.value\?\.validate\(\)/)
  assert.match(detailSource, /validationResult !== true/)
  assert.match(detailSource, /const reason = reconcileForm\.value\.reason\.trim\(\)/)
  assert.match(detailSource, /if \(!reason\)/)
  assert.match(detailSource, /reason\.length > 255/)
  assert.doesNotMatch(detailSource, /max:\s*255/)
  assert.match(detailSource, /reason = reconcileForm\.value\.reason\.trim\(\)[\s\S]*reason\.length > 255/)
  const reasonValidation = submitSource.slice(submitSource.indexOf('const reason'), submitSource.indexOf("emit('reconcile'"))
  assert.ok(reasonValidation.indexOf('.trim()') < reasonValidation.indexOf('reason.length > 255'))
  for (const [rawReason, valid] of [
    [`   ${'x'.repeat(255)}  `, true],
    [` ${'x'.repeat(256)} `, false]
  ]) {
    assert.equal(rawReason.trim().length <= 255, valid)
  }
  assert.match(submitSource, /emit\('reconcile',/)
  assert.doesNotMatch(submitSource, /reconcileDialogVisible\.value = false/)
  assert.match(detailSource, /核对原因最多 255 个字符/)
  assert.match(detailSource, /resetReconcile\(\)/)
  assert.match(detailSource, /watch\(\(\) => props\.task\?\.id/)
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
  for (const source of [queueSource, historySource]) {
    assert.match(source, /const refreshResults = await Promise\.allSettled\(/)
    assert.match(source, /detailResult\.status === 'fulfilled'/)
    assert.match(source, /detailResult\.status === 'rejected'/)
    assert.match(source, /reconcileStale\.value = true/)
    assert.match(source, /catch \(error\)[\s\S]*refreshReconcileContext\(job\)/)
  }
  assert.match(queueSource, /reconcileSubmitting\.value \|\| reconcileStale\.value \|\| !job \|\| job\.status !== 'RECONCILING'/)
  assert.match(queueSource, /reconcilePrintJob\(job\.id, payload\)/)
  assert.match(queueSource, /Promise\.allSettled\([\s\S]*jobStore\.fetchQueue\(\)[\s\S]*jobStore\.fetchActive\(\)[\s\S]*refreshPrinterSnapshot\(\)/)
  assert.match(queueSource, /待派发任务列表刷新失败，请稍后手动刷新/)
  assert.match(queueSource, /活动任务列表刷新失败，请稍后手动刷新/)
  assert.match(queueSource, /打印机状态刷新失败，请稍后手动刷新看板/)
  assert.match(queueSource, /reconcileStale\.value = true/)
  assert.match(queueSource, /jobStore\.invalidateJobDetailRequest\(\)/)
  assert.match(queueSource, /realtimeStore\.refreshPrinterSnapshot\(\)/)
  assert.match(historySource, /reconcileSubmitting\.value \|\| reconcileStale\.value \|\| !job \|\| job\.status !== 'RECONCILING'/)
  assert.match(historySource, /reconcilePrintJob\(job\.id, payload\)/)
  assert.match(historySource, /fetchData\(\{ rethrow: true \}\)/)
  assert.match(historySource, /待派发任务列表刷新失败，请稍后手动刷新/)
  assert.match(historySource, /活动任务列表刷新失败，请稍后手动刷新/)
  assert.match(historySource, /打印机状态刷新失败，请稍后手动刷新看板/)
})

test('TC-006 历史失效合并刷新并拒绝旧分页响应覆盖', () => {
  assert.match(historySource, /historyRequestGuard = createLatestRequestGuard\(\)/)
  assert.match(historySource, /historyRequestGuard\.isCurrent\(requestId\)/)
  assert.match(historySource, /historyRefreshScheduled/)
  assert.match(historySource, /queueMicrotask\(\(\) =>/)
  assert.match(historySource, /onBeforeUnmount\(\(\) => historyRequestGuard\.invalidate\(\)\)/)
})
