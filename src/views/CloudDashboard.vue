<template>
  <main class="cloud-page app-scroll-region">
    <header class="cloud-header">
      <div><h1>云端只读看板</h1><p>远程查看已授权农场的设备状态</p></div>
      <div class="cloud-actions">
        <t-button variant="outline" @click="router.push({ name: 'dashboard-overview' })">返回局域网</t-button>
        <t-tag theme="primary" variant="light">只读</t-tag>
        <t-button v-if="state.token && !state.user?.mustChangePassword" variant="outline" @click="router.push({ name: 'cloud-management' })">组织与农场管理</t-button>
        <t-button variant="outline" @click="router.push({ name: 'server-connection' })">局域网连接</t-button>
        <t-button v-if="state.token" variant="outline" @click="store.logout">退出云端</t-button>
      </div>
    </header>

    <t-alert v-if="state.error" theme="error" :close-btn="false" class="cloud-alert">{{ state.error }}</t-alert>

    <t-card v-if="!state.token" class="cloud-login" title="登录云端">
      <form @submit.prevent="login">
        <t-form-item label="云端地址"><t-input v-model="form.url" aria-label="云端地址" placeholder="https://cloud.example.com" :disabled="state.authenticating" /></t-form-item>
        <t-form-item label="用户名"><t-input v-model="form.username" aria-label="云端用户名" placeholder="云端用户名" :disabled="state.authenticating" /></t-form-item>
        <t-form-item label="密码"><t-input v-model="form.password" type="password" aria-label="云端密码" placeholder="云端密码" :disabled="state.authenticating" /></t-form-item>
        <t-button type="submit" block :loading="state.authenticating" :disabled="!form.username || !form.password">登录云端</t-button>
      </form>
      <p class="cloud-note">使用云端账号登录。云端会话仅保存在本次应用运行期间，局域网账号保持独立。</p>
      <p v-if="route.query.next === 'management'" class="cloud-note">登录后进入组织与农场管理。</p>
    </t-card>

    <t-card v-else-if="state.user?.mustChangePassword" title="首次登录请修改临时密码" class="cloud-login">
      <form @submit.prevent="changePassword">
        <t-form-item label="临时密码"><t-input v-model="passwordForm.current" type="password" aria-label="云端临时密码" /></t-form-item>
        <t-form-item label="新密码"><t-input v-model="passwordForm.next" type="password" aria-label="云端新密码" :maxlength="64" /></t-form-item>
        <t-form-item label="确认新密码"><t-input v-model="passwordForm.confirm" type="password" aria-label="确认云端新密码" :maxlength="64" /></t-form-item>
        <t-button type="submit" :loading="state.authenticating" :disabled="!passwordValid">修改密码并重新登录</t-button>
      </form>
    </t-card>
    <template v-else>
      <t-card class="cloud-toolbar">
        <div class="cloud-filters">
          <t-select :value="state.organizationId" aria-label="选择组织" placeholder="选择组织" :options="organizationOptions" :disabled="state.loading" @change="store.selectOrganization" />
          <t-select :value="state.farmId" aria-label="选择农场" placeholder="选择农场" :options="farmOptions" :disabled="state.loading || !state.farms.length" @change="store.selectFarm" />
          <t-button :loading="state.loading" :disabled="!state.farmId" @click="store.refresh">刷新状态</t-button>
        </div>
        <p class="cloud-note">{{ state.user?.username }} · {{ state.lastRefreshAt ? `最近同步：${formatTime(state.lastRefreshAt)}` : '等待同步' }} · 每 5 秒刷新</p>
      </t-card>
      <t-empty v-if="!state.organizations.length" description="暂无组织，请联系管理员" />
      <t-empty v-else-if="!state.farms.length && !state.loading" description="暂无可访问的农场，请联系管理员授权" />
      <t-card v-else>
        <t-alert theme="info" :close-btn="false" class="cloud-alert">灰色或过期状态表示最后一次已知数据，不能据此判断设备当前可操作。</t-alert>
        <div class="cloud-mobile-list">
          <t-empty v-if="!state.printers.length" description="尚未收到设备状态" />
          <article v-for="row in state.printers" :key="row.id" class="cloud-device">
            <div class="cloud-device-title"><strong>{{ row.name }}</strong><t-tag :theme="isStale(row) ? 'default' : 'primary'" variant="light">{{ isStale(row) ? '数据过期' : stateLabel(row.printState) }}</t-tag></div>
            <p>{{ row.gatewayName }} · {{ gatewayLabel(row) }}</p>
            <p>进度 {{ row.progress == null ? '—' : `${row.progress.toFixed(1)}%` }} · 喷头 {{ temperature(row.toolTemperature) }} · 热床 {{ temperature(row.bedTemperature) }}</p>
            <small>观察时间：{{ formatTime(row.observedAt) }}</small>
          </article>
        </div>
        <t-table class="cloud-table" row-key="id" :data="state.printers" :columns="columns" :loading="state.loading" table-layout="fixed" :max-height="560">
          <template #empty><t-empty description="尚未收到设备状态，请确认现场网关已绑定并启用云连接" /></template>
          <template #gatewayOnline="{ row }"><t-tag :theme="row.gatewayOnline && !connectionUncertain() ? 'success' : 'default'" variant="light">{{ gatewayLabel(row) }}</t-tag></template>
          <template #printState="{ row }"><t-tag :theme="isStale(row) ? 'default' : 'primary'" variant="light">{{ isStale(row) ? '数据过期' : stateLabel(row.printState) }}</t-tag></template>
          <template #progress="{ row }">{{ row.progress == null ? '—' : `${row.progress.toFixed(1)}%` }}</template>
          <template #temperature="{ row }">{{ temperature(row.toolTemperature) }} / {{ temperature(row.bedTemperature) }}</template>
          <template #observedAt="{ row }">{{ formatTime(row.observedAt) }}</template>
        </t-table>
        <t-pagination :current="state.page" :page-size="state.size" :total="state.total" :page-size-options="[20, 50, 100]" class="cloud-pagination" @change="changePage" />
      </t-card>
    </template>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCloudStore } from '@/stores/cloud'

defineOptions({ name: 'CloudDashboard' })
const store = useCloudStore()
const state = store.state
const router = useRouter()
const route = useRoute()
const clock = ref(Date.now())
const connectionUncertain = () => Boolean(state.error) || clock.value - (state.lastRefreshAt || 0) > 15000
const isStale = row => row.stale || connectionUncertain()
const gatewayLabel = row => connectionUncertain() ? '连接待确认' : row.gatewayOnline ? '网关在线' : '网关离线'
const endpointKey = 'fabmatrix.cloud.endpoint'
let storedEndpoint = ''
try { storedEndpoint = window.localStorage.getItem(endpointKey) || '' } catch { /* Storage is optional. */ }
const form = reactive({ url: state.apiUrl || storedEndpoint, username: '', password: '' })
const passwordForm = reactive({ current: '', next: '', confirm: '' })
const passwordValid = computed(() => passwordForm.current && passwordForm.next.length >= 6
  && passwordForm.next === passwordForm.confirm && new TextEncoder().encode(passwordForm.next).length <= 72)
const changePassword = async () => {
  if (!passwordValid.value) return
  try { await store.changeRequiredPassword(passwordForm.current, passwordForm.next) }
  finally { Object.assign(passwordForm, { current: '', next: '', confirm: '' }) }
}
const organizationOptions = computed(() => state.organizations.map(item => ({ label: item.name, value: item.id })))
const farmOptions = computed(() => state.farms.map(item => ({ label: item.name, value: item.id })))
const columns = [
  { colKey: 'name', title: '打印机', width: 160 },
  { colKey: 'gatewayName', title: '现场网关', width: 150 },
  { colKey: 'gatewayOnline', title: '连接', width: 120 },
  { colKey: 'printState', title: '状态', width: 120 },
  { colKey: 'progress', title: '进度', width: 100 },
  { colKey: 'temperature', title: '喷头 / 热床', width: 150 },
  { colKey: 'observedAt', title: '设备观察时间', width: 190 }
]
const formatTime = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未知'
const temperature = value => value == null ? '—' : `${value.toFixed(1)}℃`
const stateLabel = value => ({ IDLE: '空闲', PRINTING: '打印中', PAUSED: '暂停', PREPARING: '准备中', ERROR: '故障', OFFLINE: '离线', UNKNOWN: '未知' })[value] || '未知'
const login = async () => {
  try {
    const loggedIn = await store.login(form.url, form.username.trim(), form.password)
    if (state.token) {
      try { window.localStorage.setItem(endpointKey, state.apiUrl) } catch { /* Storage is optional. */ }
    }
    if (loggedIn && state.token && !state.user?.mustChangePassword && route.query.next === 'management') {
      await router.replace({ name: 'cloud-management' })
    }
  } finally { form.password = '' }
}
const changePage = ({ current, pageSize }) => {
  store.cancel()
  state.page = current
  state.size = pageSize
  store.refresh()
}
let timer
onMounted(() => {
  timer = window.setInterval(() => { clock.value = Date.now(); if (!document.hidden) store.refresh() }, 5000)
  if (state.token) store.refresh()
})
onUnmounted(() => { window.clearInterval(timer); store.cancel(); Object.assign(passwordForm, { current: '', next: '', confirm: '' }) })
</script>

<style scoped>
.cloud-page { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.cloud-header, .cloud-actions, .cloud-filters { display: flex; align-items: center; gap: 12px; }
.cloud-header { justify-content: space-between; flex-wrap: wrap; }
.cloud-header h1 { font-size: 24px; font-weight: 600; margin: 0; }
.cloud-header p, .cloud-note { color: var(--td-text-color-secondary); margin: 8px 0 0; font-size: 13px; }
.cloud-login { width: min(100%, 440px); align-self: center; margin-top: 32px; }
.cloud-login :deep(.t-form__item) { margin-bottom: 20px; }
.cloud-alert { margin-bottom: 16px; }
.cloud-filters :deep(.t-select__wrap) { max-width: 280px; }
.cloud-pagination { margin-top: 20px; }
.cloud-mobile-list { display: none; }
.cloud-device + .cloud-device { border-top: 1px solid var(--td-component-border); padding-top: 16px; }
.cloud-device-title { display: flex; justify-content: space-between; gap: 12px; }
.cloud-device p, .cloud-device small { color: var(--td-text-color-secondary); margin-top: 8px; font-size: 13px; }
@media (max-width: 640px) {
  .cloud-page { padding: 16px; }
  .cloud-filters, .cloud-actions { flex-wrap: wrap; }
  .cloud-table { display: none; }
  .cloud-mobile-list { display: grid; gap: 16px; }
}
</style>
