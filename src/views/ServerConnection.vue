<template>
  <main class="connection-page app-scroll-region">
    <section class="connection-card" aria-labelledby="connection-title">
      <div class="connection-brand-bar">
        <div class="connection-brand">
          <span class="connection-brand__name">FabMatrix</span>
          <t-typography-text disabled>嘉东三维管理平台</t-typography-text>
        </div>
        <p class="connection-eyebrow">LOCAL EDITION</p>
      </div>

      <header class="connection-header">
        <div>
          <h1 id="connection-title">连接生产服务器</h1>
          <p>先配置 FabMatrix 服务地址，再登录或完成首次管理员初始化。</p>
        </div>
      </header>

      <t-alert v-if="errorMessage" theme="error" :close-btn="false" class="connection-alert">
        {{ errorMessage }}
      </t-alert>
      <t-alert v-else-if="successMessage" theme="success" :close-btn="false" class="connection-alert">
        {{ successMessage }}
      </t-alert>

      <t-form :data="form" label-align="top">
        <div class="connection-endpoint-grid">
          <t-form-item label="协议" name="protocol">
            <t-select v-model="form.protocol">
              <t-option label="HTTP" value="http" />
              <t-option label="HTTPS" value="https" />
            </t-select>
          </t-form-item>
          <t-form-item class="connection-endpoint-grid__host" label="服务器 IP / 主机" name="host">
            <t-input v-model="form.host" placeholder="例如：192.168.0.10" clearable />
          </t-form-item>
          <t-form-item label="端口" name="port">
            <t-input v-model="form.port" inputmode="numeric" placeholder="8080" clearable />
          </t-form-item>
        </div>
        <div class="connection-current-config">
          <span>当前配置</span>
          <code>{{ displayBaseUrl }}</code>
        </div>

        <div class="connection-ws-config">
          <t-form-item class="connection-ws-input" name="wsUrl">
            <div class="connection-ws-heading">
              <span class="connection-ws-label">
                <t-switch
                  v-model="form.customWsUrlEnabled"
                  aria-label="启用自定义 WebSocket 地址"
                  size="small"
                />
                <span>WebSocket 地址</span>
              </span>
            </div>
            <div class="connection-ws-input-group">
              <t-select
                v-model="form.wsProtocol"
                class="connection-ws-protocol"
                :disabled="!form.customWsUrlEnabled"
                aria-label="WebSocket 协议"
              >
                <t-option label="ws://" value="ws" />
                <t-option label="wss://" value="wss" />
              </t-select>
              <t-input
                v-model="form.wsAddress"
                class="connection-ws-address"
                :disabled="!form.customWsUrlEnabled"
                placeholder="localhost:8080/ws/farm-status"
                clearable
                aria-label="WebSocket 主机、端口和路径"
              />
            </div>
          </t-form-item>
        </div>

        <div class="connection-actions">
          <t-button variant="outline" theme="default" :disabled="testing || saving" @click="goLogin">
            返回登录
          </t-button>
          <div class="connection-actions__right">
            <t-button variant="outline" theme="default" :disabled="testing || saving" @click="resetToEnvironment">
              使用启动配置
            </t-button>
            <t-button variant="outline" theme="default" :loading="testing" :disabled="testing || saving" @click="testConnection">
              测试
            </t-button>
            <t-button theme="primary" :loading="saving" :disabled="testing || saving" @click="saveAndConnect">
              保存并连接
            </t-button>
          </div>
        </div>
      </t-form>

      <div class="connection-notes">
        <div class="connection-notes__title">连接说明</div>
        <ul>
          <li>地址只保存在当前浏览器或 Electron 用户配置中，不包含账号、密码和 Token。</li>
          <li>自动搜索局域网服务器需要后端提供发现协议；当前 API 的扫描功能仅用于发现打印机。</li>
          <li>测试会访问后端公开的健康检查接口，不会执行业务写操作。</li>
          <li>开启自定义 WebSocket 地址后，仅在实时服务与 HTTP 服务地址不同时填写。</li>
        </ul>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { buildServerBaseUrl, getEnvironmentServerConfig, getServerConfig, isValidServerHost, parseServerEndpoint, saveServerConfig } from '@/utils/serverConfig'

defineOptions({ name: 'ServerConnectionView' })

const router = useRouter()
const initialConfig = getServerConfig()
const initialEndpoint = parseServerEndpoint(initialConfig.apiBaseUrl)
const initialWsEndpoint = parseWebSocketEndpoint(initialConfig.wsUrl)
const form = reactive({
  protocol: initialEndpoint.protocol,
  host: initialEndpoint.host,
  port: initialEndpoint.port,
  wsProtocol: initialWsEndpoint.protocol,
  wsAddress: initialWsEndpoint.address,
  customWsUrlEnabled: Boolean(initialConfig.wsUrl)
})
const testing = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const displayBaseUrl = computed(() => buildServerBaseUrl(form) || '尚未填写完整')

function parseWebSocketEndpoint(wsUrl) {
  const value = String(wsUrl || '').trim()
  const match = value.match(/^(wss?):\/\/(.*)$/i)
  return {
    protocol: match?.[1]?.toLowerCase() || 'ws',
    address: match?.[2] || ''
  }
}

const getHealthUrl = baseUrl => `${baseUrl}/actuator/health`

const resolveBaseUrl = () => {
  const baseUrl = buildServerBaseUrl(form)
  if (!isValidServerHost(form.host)) throw new Error('请输入有效的服务器 IP 或主机名，不要包含协议、路径或查询参数')
  if (!/^\d{1,5}$/.test(String(form.port || '').trim()) || Number(form.port) < 1 || Number(form.port) > 65535) {
    throw new Error('端口必须是 1 到 65535 的数字')
  }
  if (!baseUrl) throw new Error('请输入有效的服务器地址')
  return baseUrl
}

const resolveWebSocketUrl = () => {
  const address = String(form.wsAddress || '').trim()
  if (!address) return ''
  if (/^wss?:\/\//i.test(address)) {
    throw new Error('WebSocket 地址请不要重复输入 ws:// 或 wss:// 前缀')
  }

  const wsUrl = `${form.wsProtocol}://${address}`

  try {
    const parsed = new URL(wsUrl)
    if (!['ws:', 'wss:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) {
      throw new Error('WebSocket 地址必须使用 ws:// 或 wss://，且不能包含账号密码')
    }
    return wsUrl
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('WebSocket 地址')) throw error
    throw new Error('请输入有效的 WebSocket 主机、端口和路径', { cause: error })
  }
}

const requestHealth = async () => {
  const baseUrl = resolveBaseUrl()
  if (form.customWsUrlEnabled) resolveWebSocketUrl()
  const response = await fetch(getHealthUrl(baseUrl), {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`服务器返回 HTTP ${response.status}`)
  return baseUrl
}

const testConnection = async () => {
  testing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await requestHealth()
    successMessage.value = '服务器连接测试成功，尚未保存配置。'
  } catch (error) {
    errorMessage.value = error?.message || '无法连接服务器，请检查 IP、端口和网络。'
  } finally {
    testing.value = false
  }
}

const saveAndConnect = async () => {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const apiBaseUrl = await requestHealth()
    saveServerConfig({ apiBaseUrl, wsUrl: form.customWsUrlEnabled ? resolveWebSocketUrl() : '' })
    await router.push({ name: 'login' })
  } catch (error) {
    errorMessage.value = error?.message || '无法连接服务器，配置未保存。'
  } finally {
    saving.value = false
  }
}

const resetToEnvironment = () => {
  const config = getEnvironmentServerConfig()
  const endpoint = parseServerEndpoint(config.apiBaseUrl)
  form.protocol = endpoint.protocol
  form.host = endpoint.host
  form.port = endpoint.port
  const wsEndpoint = parseWebSocketEndpoint(config.wsUrl)
  form.wsProtocol = wsEndpoint.protocol
  form.wsAddress = wsEndpoint.address
  form.customWsUrlEnabled = Boolean(config.wsUrl)
  errorMessage.value = ''
  successMessage.value = '已载入当前启动配置，请测试后保存。'
}

const goLogin = () => router.push({ name: 'login' })
</script>

<style scoped>
.connection-page {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 100%;
  padding: 24px 32px;
  background: var(--app-page-background);
  overflow-y: auto;
}

.connection-card {
  width: min(100%, 760px);
  box-sizing: border-box;
  padding: 28px 32px;
  margin: auto;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-large);
  box-shadow: var(--app-shadow-raised);
}

.connection-brand-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.connection-brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--app-text-primary);
}

.connection-brand__name {
  font-size: 24px;
  font-weight: 700;
}

.connection-brand :deep(.t-typography) {
  font-size: 13px;
}

.connection-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.connection-eyebrow {
  margin: 0 0 6px;
  color: var(--app-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.connection-header h1 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 28px;
  line-height: 1.35;
}

.connection-header p:not(.connection-eyebrow) {
  margin: 8px 0 0;
  color: var(--app-text-secondary);
  line-height: 1.6;
}

.connection-alert {
  margin-bottom: 20px;
}

.connection-endpoint-grid {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 120px;
  gap: 12px;
}

.connection-current-config {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: -2px;
  padding: 10px 12px;
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius);
  font-size: 13px;
}

.connection-current-config code {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-family: var(--app-font-family);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-ws-config {
  margin-top: 14px;
}

.connection-ws-heading {
  display: flex;
  align-items: center;
  min-height: 24px;
  margin-bottom: 8px;
}

.connection-ws-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.connection-ws-input :deep(.t-form__controls) {
  min-width: 0;
}

.connection-ws-input :deep(.t-form__controls-content) {
  display: block;
  width: 100%;
}

.connection-ws-input {
  margin: 0;
}

.connection-ws-input-group {
  display: flex;
  gap: 8px;
  width: 100%;
}

.connection-ws-protocol {
  flex: 0 0 96px;
}

.connection-ws-address {
  flex: 1 1 auto;
  min-width: 0;
}

.connection-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
}

.connection-actions__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.connection-notes {
  margin-top: 18px;
  padding: 12px 14px;
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius);
  font-size: 13px;
  line-height: 1.5;
}

.connection-notes__title {
  margin-bottom: 4px;
  color: var(--app-text-primary);
  font-weight: 600;
}

.connection-notes ul {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 24px;
  margin: 0;
  padding-left: 18px;
}

@media (max-width: 640px) {
  .connection-page {
    padding: 16px 12px 24px;
    overflow-y: auto;
  }

  .connection-card {
    width: 100%;
    padding: 24px 20px;
  }

  .connection-brand-bar {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .connection-header {
    flex-direction: column;
  }

  .connection-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }

  .connection-actions__right {
    align-items: stretch;
    flex-direction: column;
  }

  .connection-actions .t-button,
  .connection-actions__right .t-button {
    width: 100%;
  }

  .connection-endpoint-grid {
    grid-template-columns: 1fr 1fr;
  }

  .connection-endpoint-grid__host {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .connection-current-config {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .connection-notes ul {
    display: block;
  }
}
</style>
