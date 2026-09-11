import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { getJobDisplay } from '../src/utils/jobDisplay.js'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const queueSource = fs.readFileSync(new URL('../src/views/JobQueue.vue', import.meta.url), 'utf8')
const historySource = fs.readFileSync(new URL('../src/views/JobHistory.vue', import.meta.url), 'utf8')
const request = (method, url, data, headers) => mockRequest({ method, url, data, headers })
const headers = { Authorization: 'Bearer job-display-session' }

test('任务摘要以文件、设备和人员可读字段为主，Long ID 保持字符串', () => {
  const display = getJobDisplay({
    id: '9007199254740993',
    fileId: '9007199254740995',
    printerId: '9007199254740997',
    userId: '9007199254740999',
    operatorId: '9007199254741001',
    fileName: 'gearbox.gcode',
    printerName: 'Printer_C0DA',
    machineNumber: 'A-01',
    creatorUsername: 'admin',
    operatorUsername: 'operator'
  })

  assert.deepEqual(display, {
    jobId: '9007199254740993',
    fileId: '9007199254740995',
    printerId: '9007199254740997',
    userId: '9007199254740999',
    operatorId: '9007199254741001',
    fileName: 'gearbox.gcode',
    printerName: 'Printer_C0DA',
    machineNumber: 'A-01',
    creatorUsername: 'admin',
    operatorUsername: 'operator'
  })
})

test('显示适配器按集合选择当前值或历史快照，并统一处理缺失资源', () => {
  const job = {
    id: '1001',
    fileId: '20',
    printerId: '403',
    userId: '1',
    operatorId: '2',
    fileName: '当前文件.gcode',
    fileNameSnapshot: '执行时文件.gcode',
    printerName: '当前设备',
    printerNameSnapshot: '执行时设备',
    machineNumber: 'NOW-01',
    machineNumberSnapshot: 'THEN-01',
    creatorUsername: 'current-creator',
    creatorUsernameSnapshot: 'snapshot-creator',
    operatorUsername: 'current-operator',
    operatorUsernameSnapshot: 'snapshot-operator'
  }

  assert.equal(getJobDisplay(job, 'current').fileName, '当前文件.gcode')
  assert.equal(getJobDisplay(job, 'current').printerName, '当前设备')
  assert.equal(getJobDisplay(job, 'current').creatorUsername, 'current-creator')
  assert.equal(getJobDisplay(job, 'current').operatorUsername, 'current-operator')
  assert.equal(getJobDisplay(job, 'history').fileName, '执行时文件.gcode')
  assert.equal(getJobDisplay(job, 'history').printerName, '执行时设备')
  assert.equal(getJobDisplay(job, 'history').machineNumber, 'THEN-01')
  assert.equal(getJobDisplay(job, 'history').creatorUsername, 'snapshot-creator')
  assert.equal(getJobDisplay(job, 'history').operatorUsername, 'snapshot-operator')

  const missing = getJobDisplay({ id: '9007199254740993', fileId: '9007199254740995', printerId: '9007199254740997', userId: '7', operatorId: null })
  assert.equal(missing.fileName, '已删除文件 #9007199254740995')
  assert.equal(missing.printerName, '已删除打印机 #9007199254740997')
  assert.equal(missing.machineNumber, '已删除打印机 #9007199254740997')
  assert.equal(missing.creatorUsername, '未知用户 #7')
  assert.equal(missing.operatorUsername, '未分配')
  assert.equal(getJobDisplay({}).printerName, '未分配')
  assert.equal(getJobDisplay({}).fileName, '未知文件')
})

test('800×560 窄视口保留组件视口、内部横向滚动和固定操作列（静态 DOM/CSS 护栏）', () => {
  for (const source of [queueSource, historySource]) {
    assert.match(source, /<t-tooltip/)
    assert.match(source, /job-display__ellipsis/)
    assert.match(source, /table-content-width="max-content"/)
    assert.match(source, /style="width: 100%"/)
    assert.match(source, /fixed="right"/)
    assert.match(source, /\.t-table__content[\s\S]*overflow-x: auto/)
    assert.match(source, /\.t-table__content[\s\S]*width: 100%[\s\S]*min-width: 0[\s\S]*max-width: 100%/)
  }
  assert.match(queueSource, /\.job-queue-table :deep\(\.t-table\)\s*\{[\s\S]*width: 100%[\s\S]*min-width: 0/)
  assert.match(historySource, /\.history-management-table :deep\(\.t-table\)\s*\{[\s\S]*width: 100%[\s\S]*min-width: 0/)
  assert.doesNotMatch(queueSource, /\.job-queue-table :deep\(\.t-table\)\s*\{[^}]*min-width:\s*\d+px/)
  assert.doesNotMatch(historySource, /\.history-management-table :deep\(\.t-table\)\s*\{[^}]*min-width:\s*\d+px/)
  assert.match(historySource, /class="history-table-wrapper"[\s\S]*height="100%"/)
  assert.match(historySource, /报错原因[\s\S]*<t-tooltip[\s\S]*String\(scope\.row\.errorReason\)/)
})

test('JobQueue 行内控件阻止冒泡，静态护栏覆盖选择、分配和更多菜单', () => {
  assert.match(queueSource, /<t-select v-if="scope\.row\.status === 'QUEUED'"[\s\S]*?@mousedown\.stop[\s\S]*?@click\.stop[\s\S]*?@change=/)
  assert.match(queueSource, /@click\.stop="openAssignDialog\(scope\.row\)"/)
  assert.match(queueSource, /class="task-action-group" @mousedown\.stop @click\.stop/)
  assert.match(queueSource, /<t-dropdown[\s\S]*?@mousedown\.stop[\s\S]*?<t-button[^>]*@mousedown\.stop @click\.stop>更多<\/t-button>/)
  assert.match(queueSource, /@click\.stop="openTaskDetail\(scope\.row\)"/)
})

test('历史列表只保留详情入口，不渲染活动控制操作', () => {
  assert.match(historySource, /<t-button size="small" variant="text" @click\.stop="openTaskDetail\(scope\.row\)">详情<\/t-button>/)
  assert.match(historySource, /TaskTimeIcon as Timer/)
  assert.match(historySource, /<timer \/>/)
  for (const pattern of [
    />\s*重新排队\s*</,
    />\s*暂停打印\s*</,
    />\s*恢复打印\s*</,
    />\s*取消\s*</,
    /handleRetry|handleRequeue|handleCancel|handlePriority/,
    /retryJob|requeueJob|cancelJob|updateJobPriority/,
    /<t-popconfirm/
  ]) {
    assert.doesNotMatch(historySource, pattern)
  }
})

test('Mock 任务响应包含 TC-002 可读摘要字段，并对缺失关联返回 null', async () => {
  resetMockState()
  mockState.sessions['job-display-session'] = { userId: 1, username: 'admin', role: 'ADMIN' }

  const queue = await request('GET', '/api/v1/print-jobs/queue', undefined, headers)
  const queued = queue.data.find(job => job.id === '1003')
  assert.equal(queued.fileName, 'bracket.gcode')
  assert.equal(queued.printerName, null)
  assert.equal(queued.machineNumber, null)
  assert.equal(queued.creatorUsername, 'admin')
  assert.equal(queued.operatorUsername, null)
  assert.equal(queued.materialType, 'PETG')
  assert.equal(queued.nozzleSize, 0.4)

  const active = await request('POST', '/api/v1/print-jobs/page', {
    pageNum: 1,
    pageSize: 10,
    statuses: ['PRINTING']
  }, headers)
  assert.equal(active.data.records[0].fileName, 'gearbox.gcode')
  assert.equal(active.data.records[0].printerName, 'Printer_C0DA')
  assert.equal(active.data.records[0].machineNumber, 'A-01')
  assert.equal(active.data.records[0].creatorUsername, 'admin')
  assert.equal(active.data.records[0].operatorUsername, 'operator')

  mockState.jobs.push({
    id: '9007199254740993',
    fileId: '9007199254740995',
    printerId: '9007199254740997',
    userId: '9007199254740999',
    operatorId: null,
    status: 'FAILED',
    createdAt: '2026-09-11T10:00:00',
    completedAt: '2026-09-11T10:01:00'
  })
  const history = await request('POST', '/api/v1/print-jobs/page', {
    pageNum: 1,
    pageSize: 20,
    statuses: ['FAILED'],
    timeField: 'COMPLETED_AT'
  }, headers)
  const missing = history.data.records.find(job => job.id === '9007199254740993')
  assert.equal(missing.fileName, null)
  assert.equal(missing.printerName, null)
  assert.equal(missing.machineNumber, null)
  assert.equal(missing.creatorUsername, null)
  assert.equal(missing.operatorUsername, null)
  assert.equal(typeof missing.id, 'string')
})
