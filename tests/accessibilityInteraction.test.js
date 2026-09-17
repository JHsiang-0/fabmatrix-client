import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const layoutSource = read('../src/layout/index.vue')
const headerSource = read('../src/components/layout/AppHeader.vue')
const sidebarSource = read('../src/components/layout/AppSidebar.vue')
const userMenuSource = read('../src/components/layout/AppUserMenu.vue')
const asyncStateSource = read('../src/components/AsyncState.vue')
const fileSource = read('../src/views/FileLibrary.vue')
const queueSource = read('../src/views/JobQueue.vue')
const userSource = read('../src/views/UserManagement.vue')
const auditSource = read('../src/views/AuditLog.vue')
const requestCoreSource = read('../src/utils/requestCore.js')

test('应用壳的交互控件使用 TDesign 并具备图标按钮标签', () => {
  assert.match(layoutSource, /<t-button[\s\S]*关闭导航菜单/)
  assert.match(headerSource, /<t-button[\s\S]*aria-label="消息通知"/)
  assert.match(headerSource, /aria-label="消息通知"[\s\S]*disabled/)
  assert.match(headerSource, /aria-label="帮助中心"[\s\S]*disabled/)
  assert.match(headerSource, /aria-label="系统设置"[\s\S]*disabled/)
  assert.match(headerSource, /<t-tooltip content="通知中心暂未开放"[\s\S]*class="app-header__tooltip-trigger"/)
  assert.match(headerSource, /<t-tooltip content="帮助中心暂未开放"[\s\S]*app-header__optional-action/)
  assert.match(headerSource, /<t-tooltip content="系统设置暂未开放"[\s\S]*app-header__optional-action/)
  assert.match(sidebarSource, /<t-menu[\s\S]*class="app-menu app-scroll-region"/)
  assert.match(userMenuSource, /<t-button[\s\S]*aria-label="打开用户菜单"/)
  assert.doesNotMatch(layoutSource + headerSource + sidebarSource + userMenuSource, /<button/)
})

test('异步状态和批量文件操作提供 TDesign 状态语义与操作中保护', () => {
  assert.match(asyncStateSource, /:close-btn="false"/)
  assert.match(fileSource, /batchDeleting/)
  assert.match(fileSource, /deletingIds/)
  assert.match(fileSource, /const ids = selectedIds\.value\.slice\(\)/)
  assert.match(queueSource, /value: 'cancel'/)
  assert.match(userSource, /<t-form[\s\S]*label="用户名"/)
  assert.match(auditSource, /<QueryToolbar[\s\S]*audit-filter-field__label">时间范围/)
})

test('请求层保留统一错误上下文并覆盖标准错误码', () => {
  assert.match(requestCoreSource, /400: '请求参数错误/)
  assert.match(requestCoreSource, /401: '登录已过期/)
  assert.match(requestCoreSource, /403: '当前账号没有执行此操作的权限/)
  assert.match(requestCoreSource, /404: '请求的资源不存在/)
  assert.match(requestCoreSource, /409: '当前资源存在冲突/)
  assert.match(requestCoreSource, /422: '当前状态不允许执行此操作/)
  assert.match(requestCoreSource, /503: '服务暂时不可用/)
  assert.match(requestCoreSource, /this\.status = details\.status/)
})
