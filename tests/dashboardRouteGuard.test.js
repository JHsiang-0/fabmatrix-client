import assert from 'node:assert/strict'
import test from 'node:test'
import { guardDashboardRouteLeave } from '../src/utils/dashboardRouteGuard.js'

const createGuardContext = overrides => {
  const calls = { confirm: 0, clear: 0, notices: [] }
  return {
    calls,
    options: {
      to: { name: 'files', path: '/files' },
      isSaving: () => true,
      isAuthenticated: () => true,
      hasUnsavedChanges: () => true,
      confirmDiscard: async () => { calls.confirm += 1 },
      clearEditingState: () => { calls.clear += 1 },
      notifySaving: content => calls.notices.push(content),
      ...overrides
    }
  }
}

test('布局保存中仍阻止一般业务导航', async () => {
  const { options, calls } = createGuardContext()
  assert.equal(await guardDashboardRouteLeave(options), false)
  assert.deepEqual(calls, { confirm: 0, clear: 0, notices: ['保存中请稍候'] })
})

test('布局保存中主动注销可进入登录页且不提前清理请求状态', async () => {
  const { options, calls } = createGuardContext({
    to: { name: 'login', path: '/login' }
  })
  assert.equal(await guardDashboardRouteLeave(options), true)
  assert.deepEqual(calls, { confirm: 0, clear: 0, notices: [] })
})

test('401 已清除认证时允许登录导航且不被保存状态拦截', async () => {
  const { options, calls } = createGuardContext({
    isAuthenticated: () => false
  })
  assert.equal(await guardDashboardRouteLeave(options), true)
  assert.deepEqual(calls, { confirm: 0, clear: 0, notices: [] })
})
