import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'
import { MOCK_ERROR_SCENARIOS } from '../src/mock/scenarios.js'
import {
  canTransitionMockJob,
  MOCK_JOB_STATUS_TRANSITIONS
} from '../src/mock/stateMachine.js'
import { acceptRealtimeSequence } from '../src/utils/realtimeSequence.js'
import { getAsyncState, ASYNC_STATES } from '../src/utils/asyncState.js'
import { resolveRouteAccess, ROUTE_ACCESS } from '../src/utils/permissions.js'

const request = (method, url, data, headers, params) => mockRequest({
  method,
  url,
  data,
  headers,
  params
})

const adminHeaders = { Authorization: 'Bearer t208-acceptance-admin' }

test.afterEach(() => resetMockState())

test('T208-10 Mock 错误矩阵保留 HTTP 与业务码', async () => {
  resetMockState()
  mockState.sessions['t208-acceptance-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }

  for (const code of Object.keys(MOCK_ERROR_SCENARIOS).filter(item => /^\d{3}$/.test(item))) {
    await assert.rejects(
      request('GET', '/api/v1/printers/page', undefined, adminHeaders, { mockError: code }),
      error => {
        assert.equal(error.response.status, Number(code))
        assert.equal(error.response.data.code, Number(code))
        assert.equal(error.response.data.data, null)
        assert.equal(typeof error.response.data.message, 'string')
        return true
      }
    )
  }
})

test('T208-10 Mock 资源为空时各分页接口返回真实空结构', async () => {
  resetMockState()
  mockState.sessions['t208-acceptance-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.printers = []
  mockState.files = []
  mockState.jobs = []
  mockState.auditLogs = []

  const printerPage = await request('GET', '/api/v1/printers/page', undefined, adminHeaders, { pageNum: 1, pageSize: 20 })
  const filePage = await request('POST', '/api/v1/print-files/page', { pageNum: 1, pageSize: 20, parentId: null }, adminHeaders)
  const jobQueue = await request('GET', '/api/v1/print-jobs/queue', undefined, adminHeaders)
  const jobPage = await request('POST', '/api/v1/print-jobs/page', { pageNum: 1, pageSize: 20 }, adminHeaders)
  const auditPage = await request('GET', '/api/v1/auth/admin/audit-logs', undefined, adminHeaders, { pageNum: 1, pageSize: 20 })

  for (const page of [printerPage.data, filePage.data, jobPage.data, auditPage.data]) {
    assert.deepEqual(page.records, [])
    assert.equal(page.total, 0)
    assert.equal(page.pages, 0)
  }
  assert.deepEqual(jobQueue.data, [])
})

test('T208-10 任务状态机、异步状态和实时断序恢复矩阵闭合', () => {
  for (const [from, nextStates] of Object.entries(MOCK_JOB_STATUS_TRANSITIONS)) {
    assert.equal(canTransitionMockJob(from, from), true)
    for (const to of nextStates) assert.equal(canTransitionMockJob(from, to), true)
  }
  assert.equal(canTransitionMockJob('COMPLETED', 'PRINTING'), false)

  assert.equal(getAsyncState({ loading: true, error: new Error('网络断开'), hasData: true }), ASYNC_STATES.LOADING)
  assert.equal(getAsyncState({ error: new Error('服务不可用'), hasData: true }), ASYNC_STATES.ERROR)
  assert.equal(getAsyncState({ hasData: false }), ASYNC_STATES.EMPTY)
  assert.equal(getAsyncState({ hasData: true }), ASYNC_STATES.READY)

  assert.deepEqual(acceptRealtimeSequence(10, 11), { accepted: true, gap: false, nextSequence: 11 })
  assert.deepEqual(acceptRealtimeSequence(10, 13), { accepted: true, gap: true, nextSequence: 13 })
  assert.deepEqual(acceptRealtimeSequence(13, 12), { accepted: false, gap: false, nextSequence: 13 })
})

test('T208-10 路由权限矩阵覆盖 ADMIN、OPERATOR 和未登录状态', () => {
  const protectedRoute = {
    requiresAuth: true,
    roleRequirements: [['ADMIN', 'OPERATOR']],
    token: 't208-token',
    restoreState: 'authenticated'
  }
  assert.equal(resolveRouteAccess({ ...protectedRoute, role: 'ADMIN' }), ROUTE_ACCESS.ALLOW)
  assert.equal(resolveRouteAccess({ ...protectedRoute, role: 'OPERATOR' }), ROUTE_ACCESS.ALLOW)
  assert.equal(resolveRouteAccess({ ...protectedRoute, role: 'OPERATOR', roleRequirements: [['ADMIN']] }), ROUTE_ACCESS.FORBIDDEN)
  assert.equal(resolveRouteAccess({ ...protectedRoute, token: '', role: '' }), ROUTE_ACCESS.LOGIN_REQUIRED)
  assert.equal(resolveRouteAccess({ ...protectedRoute, role: 'UNKNOWN' }), ROUTE_ACCESS.UNKNOWN_ROLE)
})

test('T208-10 页面契约使用可见字段和危险操作语义', async () => {
  const sources = await Promise.all([
    readFile(new URL('../src/views/BatchDispatch.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/FileLibrary.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/UserManagement.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/AuditLog.vue', import.meta.url), 'utf8')
  ])
  const [batch, files, users, audit] = sources
  assert.match(batch, /confirmMessage/)
  assert.match(batch, /'danger'/)
  assert.match(batch, /retryable/)
  assert.match(files, /selectedIds\.value\.slice\(\)/)
  assert.match(files, /batchDeleting/)
  assert.match(users, /<t-form[\s\S]*label="用户名"/)
  assert.match(audit, /<QueryToolbar[\s\S]*audit-filter-field__label">时间范围/)
  assert.doesNotMatch(sources.join('\n'), /apiKey|rustfsKey/)
})
