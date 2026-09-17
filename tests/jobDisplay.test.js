import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { getJobDetailDisplay, getJobDisplay } from '../src/utils/jobDisplay.js'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const queueSource = fs.readFileSync(new URL('../src/views/JobQueue.vue', import.meta.url), 'utf8')
const historySource = fs.readFileSync(new URL('../src/views/JobHistory.vue', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('../src/components/TaskDetailDrawer.vue', import.meta.url), 'utf8')
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
  assert.equal(missing.fileName, '关联不可用文件 #9007199254740995')
  assert.equal(missing.printerName, '关联不可用打印机 #9007199254740997')
  assert.equal(missing.machineNumber, '关联不可用打印机 #9007199254740997')
  assert.equal(missing.creatorUsername, '关联不可用用户 #7')
  assert.equal(missing.operatorUsername, '未分配')
  assert.equal(getJobDisplay({}).printerName, '未分配')
  assert.equal(getJobDisplay({}).fileName, '字段缺失文件')
})

test('详情适配器按活动当前资源优先、历史任务快照优先并返回来源', () => {
  const job = {
    id: '9007199254740993',
    fileId: '9007199254740995',
    printerId: '9007199254740997',
    userId: '9007199254740999',
    operatorId: '9007199254741001',
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

  const active = getJobDetailDisplay(job, 'current')
  assert.equal(active.fileName, '当前文件.gcode')
  assert.equal(active.printerName, '当前设备')
  assert.equal(active.sources.fileName, '当前资源')
  assert.equal(active.sources.printerName, '当前资源')

  const history = getJobDetailDisplay(job, 'history')
  assert.equal(history.fileName, '执行时文件.gcode')
  assert.equal(history.printerName, '执行时设备')
  assert.equal(history.machineNumber, 'THEN-01')
  assert.equal(history.sources.fileName, '任务快照')
  assert.equal(history.sources.operatorUsername, '任务快照')

  const missing = getJobDetailDisplay({
    id: '9007199254740993',
    fileId: '9007199254740995',
    printerId: '9007199254740997',
    userId: '9007199254740999',
    operatorId: null
  }, 'current')
  assert.equal(missing.fileName, '关联不可用文件 #9007199254740995')
  assert.equal(missing.printerName, '关联不可用打印机 #9007199254740997')
  assert.equal(missing.sources.fileName, '关联不可用')
  assert.equal(missing.sources.printerName, '关联不可用')
  assert.equal(missing.operatorUsername, '未分配')
  assert.equal(missing.sources.operatorUsername, '未分配')
})

test('详情适配器以打印机整体关联决定来源，部分快照不会把另一字段误报为未分配', () => {
  const cases = [
    {
      name: '活动当前名称优先，机器编号缺失',
      mode: 'current',
      job: { printerName: '当前设备', machineNumber: '   ', machineNumberSnapshot: '历史编号' },
      expected: ['当前设备', '字段缺失机器编号', '当前资源']
    },
    {
      name: '活动当前机器编号优先，名称缺失',
      mode: 'current',
      job: { printerNameSnapshot: '历史设备', machineNumber: '当前编号' },
      expected: ['字段缺失打印机名称', '当前编号', '当前资源']
    },
    {
      name: '历史快照名称优先，机器编号缺失',
      mode: 'history',
      job: { printerName: '当前设备', machineNumber: '当前编号', printerNameSnapshot: '执行时设备' },
      expected: ['执行时设备', '字段缺失机器编号', '任务快照']
    },
    {
      name: '历史快照机器编号优先，名称缺失',
      mode: 'history',
      job: { printerName: '当前设备', machineNumber: '当前编号', machineNumberSnapshot: '执行时编号' },
      expected: ['字段缺失打印机名称', '执行时编号', '任务快照']
    },
    {
      name: '历史无快照时回退当前整体关联',
      mode: 'history',
      job: { printerName: '当前设备', machineNumber: '当前编号' },
      expected: ['当前设备', '当前编号', '当前资源']
    }
  ]

  cases.forEach(({ name, mode, job, expected }) => {
    const display = getJobDetailDisplay({ printerId: null, ...job }, mode)
    assert.deepEqual([
      display.printerName,
      display.machineNumber,
      display.sources.printerName
    ], expected, name)
    assert.equal(display.sources.machineNumber, expected[2], name)
    assert.notEqual(display.machineNumber, '未分配', name)
  })

  const unavailable = getJobDetailDisplay({ printerId: '9007199254740997' }, 'current')
  assert.equal(unavailable.sources.printerName, '关联不可用')
  assert.equal(unavailable.sources.machineNumber, '关联不可用')
  assert.doesNotMatch(unavailable.printerName, /关联已删除/)

  const unassigned = getJobDetailDisplay({}, 'current')
  assert.equal(unassigned.printerName, '未分配')
  assert.equal(unassigned.machineNumber, '未分配')
  assert.equal(unassigned.sources.printerName, '未分配')
  assert.equal(unassigned.sources.machineNumber, '未分配')
})

test('800×560 窄视口保留组件视口与内部横向滚动，队列固定操作列且历史整行进入详情', () => {
  for (const source of [queueSource, historySource]) {
    assert.match(source, /<t-tooltip/)
    assert.match(source, /job-display__ellipsis/)
    assert.match(source, /table-content-width="max-content"/)
    assert.match(source, /style="width: 100%"/)
    assert.match(source, /\.t-table__content[\s\S]*overflow-x: auto/)
    assert.match(source, /\.t-table__content[\s\S]*width: 100%[\s\S]*min-width: 0[\s\S]*max-width: 100%/)
  }
  assert.match(queueSource, /fixed="right"/)
  assert.doesNotMatch(historySource, /fixed="right"/)
  assert.match(historySource, /@row-click="openTaskDetail"/)
  assert.match(historySource, /:row-attributes="getHistoryRowAttributes"/)
  assert.match(queueSource, /\.job-queue-table :deep\(\.t-table\)\s*\{[\s\S]*width: 100%[\s\S]*min-width: 0/)
  assert.match(historySource, /\.history-management-table :deep\(\.t-table\)\s*\{[\s\S]*width: 100%[\s\S]*min-width: 0/)
  assert.doesNotMatch(queueSource, /\.job-queue-table :deep\(\.t-table\)\s*\{[^}]*min-width:\s*\d+px/)
  assert.doesNotMatch(historySource, /\.history-management-table :deep\(\.t-table\)\s*\{[^}]*min-width:\s*\d+px/)
  assert.match(historySource, /class="history-table-wrapper"[\s\S]*height="100%"/)
  assert.match(historySource, /<t-tooltip v-if="scope\.row\.errorReason"[\s\S]*String\(scope\.row\.errorReason\)/)
})

test('JobQueue 行内控件阻止冒泡，静态护栏覆盖选择、分配和更多菜单', () => {
  assert.match(queueSource, /<t-select v-if="scope\.row\.status === 'QUEUED'"[\s\S]*?@mousedown\.stop[\s\S]*?@click\.stop[\s\S]*?@change=/)
  assert.match(queueSource, /@click\.stop="openAssignDialog\(scope\.row\)"/)
  assert.match(queueSource, /class="task-action-group" @mousedown\.stop @click\.stop/)
  assert.match(queueSource, /<t-dropdown[\s\S]*?@mousedown\.stop[\s\S]*?<t-button[^>]*@mousedown\.stop @click\.stop>更多<\/t-button>/)
  assert.match(queueSource, /@click\.stop="openTaskDetail\(scope\.row\)"/)
})

test('历史列表整行进入详情，并把 FAILED 重试操作迁移到详情抽屉', () => {
  assert.match(historySource, /@row-click="openTaskDetail"/)
  assert.match(historySource, /role: 'button'/)
  assert.match(historySource, /\['Enter', ' '\]/)
  assert.doesNotMatch(historySource, /<TdTableColumn label="操作"/)
  assert.match(historySource, /TaskTimeIcon as Timer/)
  assert.match(historySource, /<timer \/>/)
  for (const pattern of [
    />\s*暂停打印\s*</,
    />\s*恢复打印\s*</,
    />\s*取消\s*</,
    /handleRequeue|handleCancel|handlePriority/,
    /requeueJob|cancelJob|updateJobPriority/,
    /<t-popconfirm/
  ]) {
    assert.doesNotMatch(historySource, pattern)
  }
  assert.match(detailSource, /showRetryFooter/)
  assert.match(detailSource, />\s*重新排队\s*</)
  assert.match(detailSource, /emit\('retry'\)/)
  assert.match(historySource, /retryJob\(job\.id\)/)
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

  const detail = await request('GET', '/api/v1/print-jobs/9007199254740993', undefined, headers)
  assert.equal(detail.data.fileName, null)
  assert.equal(detail.data.printerName, null)
  assert.equal(detail.data.creatorUsername, null)
  assert.equal(detail.data.operatorUsername, null)
})
