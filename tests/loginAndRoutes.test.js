import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const loginSource = await readFile(new URL('../src/views/Login.vue', import.meta.url), 'utf8')
const resultSource = await readFile(new URL('../src/views/RouteResult.vue', import.meta.url), 'utf8')
const routerSource = await readFile(new URL('../src/router/index.js', import.meta.url), 'utf8')

test('login keeps the existing visual structure while using TDesign feedback', () => {
  assert.match(loginSource, /class="left-section"/)
  assert.match(loginSource, /class="characters-section"/)
  assert.match(loginSource, /<t-alert v-if="setupStatusError"/)
  assert.match(loginSource, /<t-loading v-if="loading"/)
  assert.match(loginSource, /role="alert"/)
  assert.match(loginSource, /autocomplete="new-password"/)
})

test('初始化模式由服务端状态锁定且没有手工降级入口', () => {
  assert.match(loginSource, /resolveSetupStatus\(\{ data: response\?\.data \}\)/)
  assert.match(loginSource, /setSetupMode\(status\.mode\)/)
  assert.doesNotMatch(loginSource, /已有账号，返回登录/)
  assert.doesNotMatch(loginSource, /@click="[^"]*setupMode/)
})

test('route guard exposes authenticated 403 and public 404 results', () => {
  assert.match(routerSource, /name: 'forbidden'/)
  assert.match(routerSource, /name: 'not-found'/)
  assert.match(routerSource, /path: '\/:pathMatch\(\.\*\)\*'/)
  assert.match(routerSource, /name: 'forbidden', query: \{ from: to\.fullPath \}/)
  assert.match(resultSource, /code: '403'/)
  assert.match(resultSource, /code: '404'/)
  assert.match(resultSource, /userStore\.isAuthenticated \? '\/dashboard' : '\/login'/)
})

test('login has no public registration route or invented auth payload', () => {
  assert.doesNotMatch(routerSource, /path: '\/register'/)
  assert.match(loginSource, /setupFirstAdmin\(\{[\s\S]*confirmPassword:/)
  assert.doesNotMatch(loginSource, /phone|email|role:\s*['"]ADMIN['"]/)
})
