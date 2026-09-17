import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'
import { fetchPageWithLastValidFallback } from '../src/utils/jobPagination.js'
import { mergeRealtimeActivePage } from '../src/utils/jobRealtime.js'
import { validateJobPageParams } from '../src/utils/jobQuery.js'

const queueSource = fs.readFileSync(new URL('../src/views/JobQueue.vue', import.meta.url), 'utf8')
const historySource = fs.readFileSync(new URL('../src/views/JobHistory.vue', import.meta.url), 'utf8')
const storeSource = fs.readFileSync(new URL('../src/stores/jobStore.js', import.meta.url), 'utf8')
const jobApiSource = fs.readFileSync(new URL('../src/api/job.js', import.meta.url), 'utf8')
const jobQuerySource = fs.readFileSync(new URL('../src/utils/jobQuery.js', import.meta.url), 'utf8')
const actionLockSource = fs.readFileSync(new URL('../src/utils/jobAction.js', import.meta.url), 'utf8')

const request = (method, url, data, headers) => mockRequest({ method, url, data, headers })
const activeSessionHeaders = { Authorization: 'Bearer tc003-active-session' }

test('队列按数据量控制高度，历史始终填充可用表格视口', () => {
  assert.match(queueSource, /:height="queueTableHeight"/)
  assert.match(queueSource, /queueData\.value\.length > 8/)
  assert.match(queueSource, /activePageData\.value\.length > 8/)
  assert.match(historySource, /height="100%"/)
  assert.doesNotMatch(historySource, /historyTableHeight/)
  assert.doesNotMatch(historySource, /tableData\.value\.length > 8/)
})

test('任务刷新失败保留已有服务端数据并提供页面内重试', () => {
  assert.doesNotMatch(storeSource, /queueError\.value = error\s+queueJobs\.value = \[\]/)
  assert.doesNotMatch(storeSource, /activeError\.value = error\s+activeJobs\.value = \[\]/)
  assert.match(queueSource, /queueError && queueData\.length/)
  assert.match(queueSource, /activeError && activePageData\.length/)
  assert.match(historySource, /loadError && tableData\.length/)
})

test('任务操作失败后重新读取服务端状态，历史页仅允许 FAILED 重试', () => {
  assert.match(queueSource, /message\.error\(error\?\.message \|\| `\$\{successText\}失败`\)[\s\S]*?await fetchQueue\(\)/)
  assert.match(queueSource, /await fetchQueue\(\)/)
  assert.match(historySource, /@row-click="openTaskDetail"/)
  assert.match(historySource, /@retry="handleRetry\(selectedJob\)"/)
  assert.match(historySource, /handleRetry/)
  assert.doesNotMatch(historySource, /handleRequeue|handleCancel|handlePriority/)
})

test('JobQueue 所有确认型设备写操作在弹窗前复用 action+job 锁', () => {
  assert.match(queueSource, /import \{ acquireJobActionLock, releaseJobActionLock \} from '@\/utils\/jobAction'/)
  assert.match(queueSource, /const runConfirmedJobAction = async/)
  assert.match(queueSource, /runConfirmedJobAction\(job, 'pause'/)
  assert.match(queueSource, /runConfirmedJobAction\(job, 'resume'/)
  assert.match(queueSource, /runConfirmedJobAction\(job, 'cancel'/)
  assert.match(queueSource, /runConfirmedJobAction\(job, 'confirm-safe'/)
  assert.match(queueSource, /runConfirmedJobAction\(job, 'upload'/)
  assert.match(queueSource, /runConfirmedJobAction\(job, 'start'/)
  assert.ok(queueSource.indexOf('acquireJobActionLock') < queueSource.indexOf('await confirmMessage'))
  assert.match(actionLockSource, /actionLoadingKey\.value = getJobActionKey\(action, jobId\)/)
  assert.match(actionLockSource, /if \(actionLoadingKey\.value === key\) actionLoadingKey\.value = ''/)
})

test('活动任务支持仅上传，长耗时下发使用上传级超时且 READY 启动提示不重复上传', () => {
  assert.match(queueSource, /job\.status === 'ASSIGNED'[\s\S]*content: '上传文件', value: 'upload'/)
  assert.match(queueSource, /case 'upload': return handleUpload\(job\)/)
  assert.doesNotMatch(queueSource, /@click\.stop="handleUpload\(scope\.row\)"/)
  assert.match(queueSource, /startJob\(job\.id, 'UPLOAD_ONLY'\)/)
  assert.match(queueSource, /job\.status === 'READY'[\s\S]*本次只发送启动打印命令/)
  assert.match(jobApiSource, /timeout: REQUEST_TIMEOUT\.UPLOAD/)
})

test('历史重试成功或失败都并行刷新 history queue active 并提示部分失败', () => {
  assert.match(historySource, /const refreshRetryCollections = async retryCreated => \{[\s\S]*?Promise\.allSettled\(\[[\s\S]*?fetchData\(\{ rethrow: true \}\)[\s\S]*?jobStore\.fetchQueue\(\)[\s\S]*?jobStore\.fetchActive\(\)/)
  assert.match(historySource, /await refreshRetryCollections\(true\)/)
  assert.match(historySource, /catch \(error\) \{[\s\S]*?await refreshRetryCollections\(false\)/)
  assert.match(historySource, /重试失败，且部分任务列表刷新失败/)
})

test('TC-003 活动任务一次发送多状态服务端分页并保留服务端页元数据', async () => {
  resetMockState()
  mockState.sessions['tc003-active-session'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.jobs = Array.from({ length: 120 }, (_, index) => ({
    id: 3000 + index,
    fileId: null,
    printerId: null,
    userId: 1,
    operatorId: null,
    priority: 0,
    status: index % 2 === 0 ? 'PRINTING' : 'PAUSED',
    progress: 0,
    startedAt: null,
    completedAt: null,
    errorReason: null,
    createdAt: '2026-09-11T10:00:00',
    updatedAt: '2026-09-11T10:00:00'
  }))

  try {
    const firstPage = await request('POST', '/api/v1/print-jobs/page', {
      pageNum: 1,
      pageSize: 100,
      statuses: ['ASSIGNED', 'UPLOADING', 'READY', 'PRINTING', 'PAUSED', 'RECONCILING']
    }, activeSessionHeaders)
    const secondPage = await request('POST', '/api/v1/print-jobs/page', {
      pageNum: 2,
      pageSize: 100,
      statuses: ['ASSIGNED', 'UPLOADING', 'READY', 'PRINTING', 'PAUSED', 'RECONCILING']
    }, activeSessionHeaders)

    assert.equal(firstPage.data.total, 120)
    assert.equal(firstPage.data.records.length, 100)
    assert.equal(secondPage.data.records.length, 20)
    assert.equal(secondPage.data.records[0].id, '3019')
    assert.equal(secondPage.data.records[19].id, '3000')
  } finally {
    resetMockState()
  }
})

test('TC-003 活动分页当前页越界时只补请求一次最后有效页', async () => {
  const calls = []
  const response = await fetchPageWithLastValidFallback(async params => {
    calls.push({ ...params })
    return params.pageNum === 4
      ? { data: { pageNum: 4, pageSize: 10, total: 25, records: [] } }
      : { data: { pageNum: 3, pageSize: 10, total: 25, records: [{ id: '3' }] } }
  }, { pageNum: 4, pageSize: 10, statuses: ['PRINTING'] })

  assert.deepEqual(calls, [
    { pageNum: 4, pageSize: 10, statuses: ['PRINTING'] },
    { pageNum: 3, pageSize: 10, statuses: ['PRINTING'] }
  ])
  assert.deepEqual(response.data.records, [{ id: '3' }])
})

test('TC-003 Store 活动分页只请求一个服务端页，翻页交给 fetchActive', () => {
  const fetchActiveSource = storeSource.slice(
    storeSource.indexOf('async function fetchActive'),
    storeSource.indexOf('async function fetchJobDetail')
  )
  assert.match(fetchActiveSource, /getJobPage/)
  assert.match(fetchActiveSource, /statuses: ACTIVE_JOB_STATUSES/)
  assert.match(fetchActiveSource, /activeTotal\.value = page\.total/)
  assert.match(fetchActiveSource, /activePage\.value = page\.pageNum/)
  assert.doesNotMatch(fetchActiveSource, /Promise\.all|\.slice\(|\.sort\(/)
  assert.match(queueSource, /handleActivePageChange[\s\S]*jobStore\.fetchActive\(\{ pageNum: current \}\)/)
})

test('TC-003 WS 只更新当前 REST 页或已缓存详情，不插入跨页未知任务', () => {
  const pageJob = { id: 'page-1', status: 'PRINTING', updatedAt: '2026-09-11T10:00:00' }
  const result = mergeRealtimeActivePage(
    [pageJob],
    new Map(),
    [{ data: { jobId: 'other-page', status: 'PRINTING', progress: 20 } }]
  )
  assert.deepEqual(result.activeJobs, [pageJob])
  assert.deepEqual(result.updatedJobs, [])

  const updated = mergeRealtimeActivePage(
    [pageJob],
    new Map(),
    [{ data: { jobId: 'page-1', status: 'PAUSED', progress: 30 } }]
  )
  assert.equal(updated.activeJobs[0].progress, 30)
  assert.equal(updated.activeJobs[0].status, 'PAUSED')
  assert.equal(updated.activeJobs.length, 1)
  assert.match(storeSource, /activeTotal\.value = page\.total/)
  assert.doesNotMatch(storeSource, /activeTotal\.value\s*[+-]=/)
  assert.match(storeSource, /MAX_REALTIME_EVENT_IDS = 1000/)
  assert.match(storeSource, /rememberBoundedRealtimeEvent\(realtimeEventIds, eventKey, MAX_REALTIME_EVENT_IDS\)/)
})

test('TC-003 任务分页 API 在发送前拒绝 status 与 statuses 混用', () => {
  const pageApiSource = jobApiSource.slice(jobApiSource.indexOf('export function getJobPage'))
  assert.match(pageApiSource, /validateJobPageParams\(params\)/)
  assert.match(jobQuerySource, /hasStatuses/)
  assert.match(jobQuerySource, /throw new TypeError\('status 与 statuses 不能同时使用'\)/)
  assert.match(jobQuerySource, /throw new TypeError\('statuses 不能为空'\)/)
  assert.match(pageApiSource, /normalizePageParams\(params\)/)
  assert.throws(() => validateJobPageParams({ statuses: [] }), /statuses 不能为空/)
  assert.throws(() => validateJobPageParams({ status: 'COMPLETED', statuses: [] }), /不能同时使用/)
})

test('TC-005 详情请求只允许最新任务响应提交详情状态', () => {
  const detailRequestSource = storeSource.slice(storeSource.indexOf('async function fetchJobDetail'))
  assert.match(storeSource, /detailRequestGuard = createLatestRequestGuard\(\)/)
  assert.match(detailRequestSource, /const guard = detailRequestGuard/)
  assert.match(detailRequestSource, /const requestId = guard\.begin\(\)/)
  assert.match(detailRequestSource, /guard\.isCurrent\(requestId\)/)
  assert.match(detailRequestSource, /cacheJobDetail\(id, detail\)/)
  assert.doesNotMatch(detailRequestSource, /detailRequestGuard\.isCurrent\(requestId\)/)
  assert.match(storeSource, /function invalidateJobDetailRequest\(\)/)
  assert.match(storeSource, /detailRequestGuard\.invalidate\(\)/)
})

test('TC-005 详情恢复可从活动页查找或按保存 ID 直接加载，关闭会失效详情请求', () => {
  assert.match(queueSource, /\[\.\.\.queueData\.value, \.\.\.activePageData\.value\]\.find/)
  assert.match(queueSource, /else openTaskDetail\(\{ id: jobId \}\)/)
  const fetchQueueSource = queueSource.slice(queueSource.indexOf('const fetchQueue ='), queueSource.indexOf('const handleActivePageChange'))
  assert.match(fetchQueueSource, /finally[\s\S]*restoreTaskDetailContext\(\)/)
  assert.match(historySource, /jobStore\.invalidateJobDetailRequest\(\)/)
  assert.match(queueSource, /jobStore\.invalidateJobDetailRequest\(\)/)
})

test('TC-003 历史页固定终态和完成时间字段，并在重置时恢复默认分页条件', () => {
  assert.match(historySource, /HISTORY_STATUSES = Object\.freeze\(\['COMPLETED', 'FAILED', 'CANCELLED'\]\)/)
  assert.match(historySource, /timeField: 'COMPLETED_AT'/)
  assert.match(historySource, /params\.statuses = \[\.\.\.HISTORY_STATUSES\]/)
  assert.match(historySource, /params\.status = queryForm\.status/)
  assert.match(historySource, /toIsoLocalTime\(queryForm\.dateRange\[0\]\)/)
  assert.match(historySource, /queryForm\.dateRange = \[\]/)
  assert.match(historySource, /queryForm\.fileName/)
  assert.match(historySource, /params\.fileName = queryForm\.fileName/)
  assert.match(historySource, /queryForm\.userId/)
  assert.match(historySource, /params\.userId = queryForm\.userId/)
  assert.match(historySource, /getAdminUsers\(\{ pageNum: 1, pageSize: 100 \}\)/)
  assert.match(historySource, /v-if="userStore\.isAdmin"/)
  assert.doesNotMatch(historySource, /<t-option label="排队中"|<t-option label="打印中"/)
})
