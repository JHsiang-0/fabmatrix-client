<template>
  <div class="pairing-panel">
    <t-alert theme="info" :close-btn="false">打开手机 App「我的 → 扫码连接现场服务器」，扫码后选择组织、农场并确认。配对完成后，在本机开启数据上报。</t-alert>
    <t-alert v-if="error" theme="error" :close-btn="false">{{ error }}</t-alert>
    <template v-if="pairing">
      <div v-if="!expired" class="pairing-code">
        <t-qrcode :value="pairing.qrContent" :size="240" level="M" />
        <p>核对编号：{{ pairing.pairingId.slice(-8).toUpperCase() }}</p>
        <p>云服务：{{ pairingCloud }}</p>
        <p>等待手机确认 · 剩余 {{ remaining }} 秒</p>
      </div>
      <t-empty v-else title="二维码已过期" description="请重新生成配对二维码" />
      <t-space break-line>
        <t-button v-if="!expired" :disabled="busy" @click="poll">检查配对结果</t-button>
        <t-button variant="outline" :disabled="busy" @click="cancel">{{ expired ? '重新配对' : '取消配对' }}</t-button>
      </t-space>
    </template>
    <t-form v-else :data="form" label-align="top" @submit="start">
      <p>首次连接需填写云服务部署地址。未配对或关闭上报时，本地生产可独立使用。</p>
      <t-form-item label="云服务地址"><t-input v-model="form.apiUrl" placeholder="https://cloud.example.com" :disabled="busy" /></t-form-item>
      <t-form-item label="MQTT TLS 地址"><t-input v-model="form.mqttUrl" placeholder="ssl://mqtt.example.com:8883" :disabled="busy" /></t-form-item>
      <t-form-item label="证书信任"><t-checkbox v-model="form.useSystemTrust" :disabled="busy">使用 Server 系统信任的证书</t-checkbox></t-form-item>
      <t-form-item v-if="!form.useSystemTrust" label="自建云 CA 公共证书（PEM）">
        <t-textarea v-model="form.caCertificatePem" :disabled="busy" placeholder="留空沿用当前 Server 的 CA 公共证书" />
      </t-form-item>
      <t-button type="submit" theme="primary" :loading="busy">生成配对二维码</t-button>
    </t-form>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { startCloudPairing, pollCloudPairing, cancelCloudPairing } from '@/api/cloudConnection'
import { useUserStore } from '@/stores/user'

const props = defineProps({ connection: { type: Object, required: true } })
const emit = defineEmits(['bound'])
const user = useUserStore()
const generation = user.getSessionGeneration()
const revision = props.connection.revision
const form = reactive({ apiUrl: props.connection.apiUrl || '', mqttUrl: props.connection.mqttUrl || '',
  useSystemTrust: !props.connection.caCertificateConfigured, caCertificatePem: '' })
const pairing = ref(null)
const busy = ref(false)
const error = ref('')
const now = ref(Date.now())
const remaining = computed(() => Math.max(0, Math.ceil(((pairing.value?.expiresAt || 0) - now.value) / 1000)))
const expired = computed(() => pairing.value?.state === 'EXPIRED' || remaining.value === 0)
const pairingCloud = computed(() => {
  try { return JSON.parse(pairing.value?.qrContent || '{}').cloudUrl || '' }
  catch { return '' }
})
let active = true
let timer
let lastPoll = 0
const current = () => active && user.isAdmin && user.isAuthenticated && user.getSessionGeneration() === generation

async function start() {
  if (!current() || busy.value) return
  if (!form.apiUrl.trim() || !form.mqttUrl.trim()) { error.value = '请填写云服务和 MQTT 地址'; return }
  busy.value = true
  try {
    const response = await startCloudPairing({ ...form, revision })
    if (current()) { pairing.value = response.data; now.value = Date.now(); error.value = ''; form.caCertificatePem = '' }
  } catch (cause) { if (current()) error.value = cause.message || '生成二维码失败，请检查连接配置' }
  finally { if (current()) busy.value = false }
}
async function poll() {
  if (!current() || busy.value || !pairing.value || expired.value) return
  busy.value = true
  lastPoll = Date.now()
  try {
    const response = await pollCloudPairing({ revision, pairingId: pairing.value.pairingId })
    if (!current()) return
    pairing.value = response.data
    error.value = ''
    if (response.data.state === 'COMPLETED') { pairing.value = null; active = false; clearInterval(timer); emit('bound') }
  } catch (cause) { if (current()) error.value = cause.message || '暂时无法查询，将自动重试' }
  finally { if (active) busy.value = false }
}
async function cancel() {
  if (!current() || busy.value || !pairing.value) return
  busy.value = true
  try {
    await cancelCloudPairing({ revision, pairingId: pairing.value.pairingId })
    if (current()) { pairing.value = null; error.value = '' }
  } catch (cause) { if (current()) error.value = cause.message || '取消失败，请检查配对结果或等待过期' }
  finally { if (current()) busy.value = false }
}
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
    if (!document.hidden && now.value - lastPoll > 3000) void poll()
  }, 1000)
})
onUnmounted(() => { active = false; clearInterval(timer); pairing.value = null; form.caCertificatePem = '' })
</script>

<style scoped>
.pairing-panel { display: grid; gap: 16px; }
.pairing-code { display: grid; justify-items: center; padding: 16px; text-align: center; }
</style>
