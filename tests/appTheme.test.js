import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const themeSource = await readFile(new URL('../src/styles/theme.css', import.meta.url), 'utf8')
const navigationSource = await readFile(new URL('../src/config/navigation.js', import.meta.url), 'utf8')
const sidebarSource = await readFile(new URL('../src/components/layout/AppSidebar.vue', import.meta.url), 'utf8')
const userMenuSource = await readFile(new URL('../src/components/layout/AppUserMenu.vue', import.meta.url), 'utf8')
const headerSource = await readFile(new URL('../src/components/layout/AppHeader.vue', import.meta.url), 'utf8')
const loginSource = await readFile(new URL('../src/views/Login.vue', import.meta.url), 'utf8')
const layoutSource = await readFile(new URL('../src/layout/index.vue', import.meta.url), 'utf8')

test('FabMatrix theme maps application semantics to installed TDesign tokens', () => {
  assert.match(themeSource, /--app-primary:\s*var\(--td-brand-color\)/)
  assert.match(themeSource, /--app-page-background:\s*var\(--td-bg-color-page\)/)
  assert.match(themeSource, /--app-text-primary:\s*var\(--td-text-color-primary\)/)
  assert.match(themeSource, /--app-shadow:\s*var\(--td-shadow-1\)/)
  assert.match(themeSource, /theme-mode='dark'/)
})

test('responsive shell keeps desktop dimensions in semantic tokens', () => {
  assert.match(themeSource, /--app-sidebar-width:\s*232px/)
  assert.match(themeSource, /--app-sidebar-collapsed-width:\s*64px/)
  assert.match(themeSource, /--app-sidebar-mobile-width:\s*280px/)
  assert.match(themeSource, /--app-content-padding:\s*var\(--app-spacing-6\)/)
  assert.match(layoutSource, /\.app-content \{[\s\S]*overflow: hidden/)
  assert.match(layoutSource, /\.app-content__inner \{[\s\S]*overflow: visible/)
  assert.match(layoutSource, /\.app-content__view \{[\s\S]*overflow: hidden/)
  assert.match(layoutSource, /\.app-content__view--page-scroll \{[\s\S]*overflow-x: hidden[\s\S]*overflow-y: auto/)
})

test('semantic scroll regions share Chromium and Firefox scrollbar tokens', () => {
  assert.match(themeSource, /\.app-scroll-region \{[\s\S]*scrollbar-color: var\(--app-scrollbar-thumb\)/)
  assert.match(themeSource, /\.app-scroll-region::-webkit-scrollbar \{[\s\S]*width: 8px/)
  assert.match(themeSource, /--app-scrollbar-thumb-hover: var\(--td-text-color-placeholder\)/)
})

test('navigation follows the T208-1 information architecture', () => {
  for (const label of ['工作台', '打印机', '文件', '任务', '批量派发', '管理中心', '个人中心']) {
    assert.match(navigationSource, new RegExp(`label: '${label}'`))
  }
  assert.match(navigationSource, /to: '\/profile'/)
  assert.match(navigationSource, /roles: \['ADMIN'\]/)
})

test('brand and profile entry are real FabMatrix routes', () => {
  assert.doesNotMatch(sidebarSource, /class="app-brand(?:__logo|__name)?"/)
  assert.match(sidebarSource, /class="app-sidebar__top-spacer"/)
  assert.match(sidebarSource, /class="app-menu app-scroll-region"/)
  assert.match(sidebarSource, /<t-menu[\s\S]*v-model:expanded="expandedGroupKeys"/)
  assert.match(sidebarSource, /<t-submenu v-for="group in visibleGroups"/)
  assert.match(sidebarSource, /:is="group.icon"/)
  assert.doesNotMatch(sidebarSource, /:is="item.icon"/)
  assert.match(sidebarSource, /expand-type="normal"/)
  assert.match(userMenuSource, /router\.push\('\/profile'\)/)
  assert.doesNotMatch(userMenuSource, /后续版本开放/)
  assert.doesNotMatch(headerSource, /:count="3"/)
  assert.doesNotMatch(loginSource, /class="logo-mark"|<span>FabMatrix<\/span>/)
  assert.match(loginSource, /<t-button[\s\S]*class="connection-link"[\s\S]*variant="outline"/)
  assert.match(loginSource, /import \{ SettingIcon \} from 'tdesign-icons-vue-next'/)
  assert.match(loginSource, /aria-label="配置服务器地址"[\s\S]*<SettingIcon size="20" \/>/)
  assert.match(loginSource, /class="characters-section"/)
})

test('应用头部使用明确的看板入口、组合式实时状态和带图标的用户菜单', () => {
  assert.match(headerSource, /<ViewListIcon size="20" \/>/)
  assert.match(headerSource, /class="app-header__realtime-control"[^]*variant="dark"[^]*class="app-header__realtime-status"/)
  assert.match(headerSource, /theme="primary"[^]*variant="outline"[^]*aria-label="重新连接实时状态"/)
  assert.match(headerSource, /theme="default"[^]*variant="base"[^]*aria-label="设备看板"/)
  assert.match(headerSource, /class="app-header__realtime-control"[^]*app-header__realtime-status[^]*app-header__reconnect/)
  assert.match(headerSource, /app-header__realtime-control[^]*aria-label="设备看板"/)
  assert.match(userMenuSource, /#prefixIcon><UserIcon size="16" \/>/)
  assert.match(userMenuSource, /#prefixIcon><PoweroffIcon size="16" \/>/)
  assert.match(userMenuSource, /class="user-menu-trigger__identity"/)
  assert.doesNotMatch(userMenuSource, /value="logout" divider/)
})
