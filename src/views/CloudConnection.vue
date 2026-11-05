<template>
  <section class="cloud-connection-page">
    <header class="cloud-connection-header">
      <div>
        <h1>云端连接</h1>
        <t-typography-text theme="secondary">管理当前生产服务器的云端数据上报，同一服务器的所有客户端共享此设置。</t-typography-text>
      </div>
      <t-button variant="outline" :loading="loading" :disabled="busy" @click="load">刷新状态</t-button>
    </header>
    <t-alert v-if="error" theme="error" :close-btn="false">{{ error }}</t-alert>
    <t-loading :loading="loading && !connection" show-overlay>
      <t-card v-if="!connection" bordered>
        <t-empty description="云端连接配置尚未加载"><template #action><t-button @click="load">重试</t-button></template></t-empty>
      </t-card>
      <template v-else>
        <t-card bordered title="数据上报">
          <template #actions><t-tag :theme="statusTheme" variant="light">{{ statusLabel }}</t-tag></template>
          <div class="cloud-reporting-row">
            <div>
              <t-typography-title level="h5">允许当前 Server 上云</t-typography-title>
              <p>向已绑定的云端发送设备清单、运行状态和执行摘要。厂内账号、文件及打印操作由本地服务器管理。</p>
            </div>
            <t-switch :value="connection.enabled" :disabled="busy || !connection.bound" role="switch"
              aria-label="启用云端数据上报" :aria-checked="connection.enabled" :aria-disabled="busy || !connection.bound"
              :tabindex="busy || !connection.bound ? -1 : 0" @change="changeReporting"
              @keydown.enter.prevent="changeReporting(!connection.enabled)" @keydown.space.prevent="changeReporting(!connection.enabled)" />
          </div>
          <t-alert v-if="!connection.bound" theme="info" :close-btn="false">当前服务器尚未绑定云网关。完成绑定后，可选择开启数据上报。</t-alert>
          <t-alert v-else-if="connection.errorCode" theme="warning" :close-btn="false">{{ connection.errorCode }}。请检查云服务、网络及凭据有效期。</t-alert>
          <dl class="cloud-info-grid">
            <div><dt>本地设备数量</dt><dd>{{ connection.printerCount }} 台</dd></div>
            <div><dt>最近成功上报</dt><dd>{{ date(connection.lastAckAt) }}</dd></div>
            <div><dt>上报模型</dt><dd>{{ connection.fullModelEnabled ? '统一模型，按云端版本协商' : '兼容状态快照' }}</dd></div>
          </dl>
          <t-typography-text theme="secondary">关闭后保留绑定和云端历史。云端会在心跳超时后显示离线或数据过期。</t-typography-text>
        </t-card>
        <t-card bordered title="网关绑定">
          <dl v-if="connection.bound" class="cloud-info-grid">
            <div><dt>组织</dt><dd><span>{{ connection.organizationName || '待获取名称' }}</span><small>{{ connection.organizationId }}</small></dd></div>
            <div><dt>农场</dt><dd><span>{{ connection.farmName || '待获取名称' }}</span><small>{{ connection.farmId }}</small></dd></div>
            <div><dt>网关</dt><dd><span>{{ connection.gatewayName || '待获取名称' }}</span><small>{{ connection.gatewayId }}</small></dd></div>
            <div><dt>云服务地址</dt><dd>{{ connection.apiUrl }}</dd></div>
            <div><dt>MQTT 地址</dt><dd>{{ connection.mqttUrl }}</dd></div>
            <div><dt>凭据到期时间</dt><dd>{{ date(connection.credentialExpiresAt) }}</dd></div>
          </dl>
          <t-empty v-else description="使用手机 App 创建云网关，并在此输入一次性绑定码" />
          <t-space break-line>
            <t-button theme="primary" :disabled="busy" @click="openBinding">{{ connection.bound ? '重新绑定' : '绑定云网关' }}</t-button>
            <t-button v-if="connection.bound" variant="outline" :disabled="busy" @click="refreshBinding">刷新绑定信息</t-button>
            <t-button v-if="connection.bound" theme="danger" variant="outline" :disabled="busy" @click="unbind">解除绑定</t-button>
          </t-space>
        </t-card>
      </template>
    </t-loading>

    <t-dialog v-model:visible="bindingVisible" header="绑定当前 Server" :footer="false" :close-on-overlay-click="false" :close-btn="!busy" destroy-on-close width="560px" @closed="clearBindingSecret">
      <t-alert theme="info" :close-btn="false">在手机 App 中选择组织和农场，创建网关或签发新的绑定码。绑定完成后，上报开关保持关闭，供你核对归属。</t-alert>
      <t-form :data="form" class="cloud-binding-form" label-align="top" @submit="bind">
        <t-form-item label="云服务地址"><t-input v-model="form.apiUrl" aria-label="云服务地址" placeholder="https://cloud.example.com" :disabled="busy" /></t-form-item>
        <t-form-item label="MQTT TLS 地址"><t-input v-model="form.mqttUrl" aria-label="MQTT TLS 地址" placeholder="ssl://mqtt.example.com:8883" :disabled="busy" /></t-form-item>
        <t-form-item label="一次性绑定码"><t-input v-model="form.bindingToken" aria-label="一次性绑定码" type="password" autocomplete="off" :disabled="busy" /></t-form-item>
        <t-form-item label="证书信任"><t-checkbox v-model="form.useSystemTrust" :disabled="busy">使用 Server 系统信任的证书</t-checkbox></t-form-item>
        <t-form-item v-if="!form.useSystemTrust" label="自建云 CA 公共证书（PEM）">
          <t-textarea v-model="form.caCertificatePem" aria-label="CA 公共证书" :disabled="busy" placeholder="粘贴 CA 公共证书。留空沿用当前 Server 的自定义 CA。" />
        </t-form-item>
        <t-alert v-if="bindingError" theme="error" :close-btn="false">{{ bindingError }}</t-alert>
        <t-space class="cloud-binding-actions">
          <t-button type="submit" theme="primary" :loading="busy">确认绑定</t-button>
          <t-button variant="outline" :disabled="busy" @click="bindingVisible = false">取消</t-button>
        </t-space>
      </t-form>
    </t-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { getCloudConnection, bindCloudGateway, setCloudReporting, refreshCloudBinding, unbindCloudGateway } from '@/api/cloudConnection'
import { confirmMessage, message } from '@/utils/message'
import { formatDateTime } from '@/utils/formatters'

const user = useUserStore()
const generation = user.getSessionGeneration()
const connection = ref(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const bindingError = ref('')
const bindingVisible = ref(false)
const form = reactive({ apiUrl: '', mqttUrl: '', bindingToken: '', useSystemTrust: true, caCertificatePem: '' })
let active = true
let timer
const current = () => active && user.isAuthenticated && user.isAdmin && user.getSessionGeneration() === generation
const date = value => value ? formatDateTime(value) : '暂无记录'
const statusLabel = computed(() => {
  if (!connection.value?.bound && connection.value?.state !== 'CONFIG_ERROR') return '未绑定'
  return ({ DISABLED: '已关闭', STARTING: '连接中', SYNCHRONIZING: '同步中', CONNECTED: '在线', RETRYING: '等待重连', SUPERSEDED: '网关身份被接管', CONFIG_ERROR: '配置异常' })[connection.value?.state] || '连接状态未知'
})
const statusTheme = computed(() => connection.value?.connected ? 'success' : connection.value?.errorCode ? 'warning' : 'default')

async function load() {
  if (loading.value || busy.value || !current()) return
  loading.value = true
  try {
    const response = await getCloudConnection()
    if (current()) { connection.value = response.data; error.value = '' }
  } catch (cause) { if (current()) error.value = cause.message || '读取云端连接失败' }
  finally { if (current()) loading.value = false }
}

async function mutate(operation, success) {
  if (busy.value || !current()) return
  busy.value = true
  error.value = ''
  try {
    const response = await operation()
    if (current()) { connection.value = response.data; message.success(success) }
    return true
  } catch (cause) {
    if (current()) error.value = cause.message || '操作失败，请刷新后重试'
    return false
  } finally {
    if (current()) {
      const operationError = error.value
      busy.value = false
      await load()
      if (operationError && current()) error.value = operationError
    }
  }
}

async function changeReporting(enabled) {
  if (busy.value || !connection.value?.bound || !current()) return
  const revision = connection.value.revision
  try {
    await confirmMessage(enabled ? '允许当前 Server 将设备运行数据上报到已绑定的云端？' : '关闭当前 Server 的数据上报？云端将显示离线或数据过期。', enabled ? '开启数据上报' : '关闭数据上报')
    if (current()) await mutate(() => setCloudReporting({ revision, enabled }), enabled ? '数据上报已开启' : '数据上报已关闭')
  } catch { /* 用户取消。 */ }
}

function clearBindingSecret() { form.bindingToken = ''; form.caCertificatePem = ''; bindingError.value = '' }
async function openBinding() {
  if (!current() || busy.value) return
  if (connection.value.bound) {
    try { await confirmMessage('请先在手机 App 签发新的绑定码。重新绑定成功后，需要重新开启上报并核对组织与农场。', '重新绑定网关') }
    catch { return }
  }
  if (!current()) return
  clearBindingSecret()
  Object.assign(form, { apiUrl: connection.value.apiUrl || '', mqttUrl: connection.value.mqttUrl || '', useSystemTrust: !connection.value.caCertificateConfigured })
  bindingVisible.value = true
}

async function bind() {
  if (busy.value || !current()) return
  if (!/^fmc_b_[A-Za-z0-9_-]{43}$/.test(form.bindingToken.trim())) { bindingError.value = '请输入有效的一次性绑定码'; return }
  if (!form.apiUrl.trim() || !form.mqttUrl.trim()) { bindingError.value = '请填写云服务和 MQTT 地址'; return }
  const payload = { ...form, apiUrl: form.apiUrl.trim(), mqttUrl: form.mqttUrl.trim(), bindingToken: form.bindingToken.trim(), revision: connection.value.revision }
  const succeeded = await mutate(() => bindCloudGateway(payload), '网关已绑定，请核对归属后开启数据上报')
  clearBindingSecret()
  if (current()) {
    if (succeeded) bindingVisible.value = false
    else bindingError.value = error.value || '绑定失败，请重新输入有效绑定码'
  }
}

async function refreshBinding() {
  const revision = connection.value.revision
  await mutate(() => refreshCloudBinding(revision), '绑定信息已更新')
}

async function unbind() {
  const revision = connection.value.revision
  try {
    await confirmMessage('将停止当前 Server 上报并请求 Cloud 撤销网关凭据。云端设备历史会保留。云端不可达时先保持上报关闭，恢复网络后重试解绑。', '确认解除绑定')
    if (current()) await mutate(() => unbindCloudGateway(revision), '云网关绑定已解除')
  } catch { /* 用户取消。 */ }
}

onMounted(() => {
  void load()
  timer = setInterval(() => { if (!document.hidden && !bindingVisible.value) void load() }, 10000)
})
onUnmounted(() => { active = false; clearInterval(timer); clearBindingSecret() })
</script>

<style scoped>
.cloud-connection-page { display: grid; align-content: start; gap: 20px; }
.cloud-connection-page :deep(.t-card + .t-card) { margin-top: 20px; }
.cloud-connection-header, .cloud-reporting-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.cloud-connection-header h1 { margin: 0 0 8px; font-size: 24px; }
.cloud-reporting-row p { color: var(--td-text-color-secondary); }
.cloud-info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 20px; margin: 24px 0; }
.cloud-info-grid dt { color: var(--td-text-color-secondary); margin-bottom: 6px; }
.cloud-info-grid dd { margin: 0; overflow-wrap: anywhere; }
.cloud-info-grid small { display: block; margin-top: 4px; color: var(--td-text-color-placeholder); }
.cloud-binding-actions { margin-top: 20px; }
.cloud-binding-form { margin-top: 20px; }
@media (max-width: 600px) { .cloud-connection-header { align-items: flex-start; flex-direction: column; } }
</style>
