<template>
  <main class="connection-page app-scroll-region">
    <section class="connection-card" aria-labelledby="connection-title">
      <div class="connection-brand">
        <span class="connection-brand__name">FabMatrix</span>
        <t-typography-text disabled>嘉东三维管理平台</t-typography-text>
      </div>

      <header class="connection-header">
        <div>
          <p class="connection-eyebrow">LOCAL EDITION</p>
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
          <t-form-item class="connection-endpoint-grid__ws" label="WebSocket 地址" name="wsUrl">
            <t-input v-model="form.wsUrl" placeholder="留空自动使用 /ws/farm-status" clearable />
            <template #help>
              <t-typography-text disabled>仅在 WebSocket 与 HTTP 服务地址不同时填写，支持 ws:// 或 wss://。</t-typography-text>
            </template>
          </t-form-item>
        </div>
        <div class="connection-endpoint-preview" aria-label="连接地址预览">
          <div>
            <span>HTTP API</span>
            <code>{{ displayBaseUrl }}</code>
          </div>
          <div>
            <span>WebSocket</span>
            <code>{{ displayWsUrl }}</code>
          </div>
        </div>

        <div class="connection-actions">
          <t-button variant="outline" :loading="testing" :disabled="testing" @click="testConnection">
            测试
          </t-button>
          <t-button theme="primary" :loading="saving" :disabled="testing || saving" @click="saveAndConnect">
            保存并连接
          </t-button>
          <t-button variant="text" :disabled="testing || saving" @click="resetToEnvironment">
            使用启动配置
          </t-button>
        </div>
      </t-form>

      <div class="connection-notes">
        <div class="connection-notes__title">连接说明</div>
        <ul>
          <li>地址只保存在当前浏览器或 Electron 用户配置中，不包含账号、密码和 Token。</li>
          <li>自动搜索局域网服务器需要后端提供发现协议；当前 API 的扫描功能仅用于发现打印机。</li>
          <li>测试会访问后端公开的健康检查接口，不会执行业务写操作。</li>
          <li>WebSocket 会按后端约定自动使用同一主机和端口的 <code>/ws/farm-status</code>。</li>
        </ul>
      </div>

      <div class="connection-footer">
        <span>当前配置：{{ displayBaseUrl }}</span>
        <t-button variant="outline" theme="default" size="small" :disabled="testing || saving" @click="goLogin">
          返回登录
        </t-button>
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
const form = reactive({
  protocol: initialEndpoint.protocol,
  host: initialEndpoint.host,
  port: initialEndpoint.port,
  wsUrl: initialConfig.wsUrl
})
const testing = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const displayBaseUrl = computed(() => buildServerBaseUrl(form) || '尚未填写完整')
const displayWsUrl = computed(() => String(form.wsUrl || '').trim() || '自动使用 /ws/farm-status')

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
  const wsUrl = String(form.wsUrl || '').trim()
  if (!wsUrl) return ''

  try {
    const parsed = new URL(wsUrl)
    if (!['ws:', 'wss:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error('WebSocket 地址必须使用 ws:// 或 wss://，且不能包含账号密码')
    }
    return wsUrl
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('WebSocket 地址必须')) throw error
    throw new Error('请输入有效的 WebSocket 地址，例如 ws://192.168.0.10:8080/ws/farm-status', { cause: error })
  }
}

const requestHealth = async () => {
  const baseUrl = resolveBaseUrl()
  resolveWebSocketUrl()
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
    saveServerConfig({ apiBaseUrl, wsUrl: resolveWebSocketUrl() })
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
  form.wsUrl = config.wsUrl
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
  padding: 32px 20px;
  background: var(--app-page-background);
  overflow-y: auto;
}

.connection-card {
  width: min(100%, 760px);
  padding: 32px;
  margin: auto;
}

.connection-brand {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 28px;
  color: var(--app-text-primary);
  align-items: flex-start;
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
  margin-bottom: 24px;
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

.connection-endpoint-grid__ws {
  grid-column: 1 / -1;
}

.connection-endpoint-preview {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-direction: column;
  gap: 8px;
  margin-top: -4px;
  padding: 10px 12px;
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius);
  font-size: 13px;
}

.connection-endpoint-preview > div {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.connection-endpoint-preview span {
  flex: 0 0 auto;
}

.connection-endpoint-preview code {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-family: var(--app-font-family);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.connection-notes {
  margin-top: 28px;
  padding: 16px;
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius);
  font-size: 13px;
  line-height: 1.7;
}

.connection-notes__title {
  margin-bottom: 4px;
  color: var(--app-text-primary);
  font-weight: 600;
}

.connection-notes ul {
  margin: 0;
  padding-left: 18px;
}

.connection-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  color: var(--app-text-secondary);
  font-size: 12px;
}

@media (max-width: 640px) {
  .connection-page {
    padding: 16px 12px;
  }

  .connection-card {
    width: 100%;
    padding: 24px 0;
  }

  .connection-header {
    flex-direction: column;
  }

  .connection-actions {
    flex-direction: column;
  }

  .connection-actions .t-button {
    width: 100%;
  }

  .connection-endpoint-grid {
    grid-template-columns: 1fr 1fr;
  }

  .connection-endpoint-grid__host {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .connection-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
