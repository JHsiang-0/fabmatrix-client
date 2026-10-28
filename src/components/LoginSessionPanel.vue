<template>
  <section>
    <t-space class="mb-3">
      <t-button variant="outline" :loading="loading" @click="load">刷新会话</t-button>
      <t-button theme="danger" variant="outline" :disabled="busy || loading || !rows.length" @click="revokeAll">
        {{ userId ? '退出该账号全部会话' : '退出其他全部会话' }}
      </t-button>
    </t-space>
    <t-alert theme="info" :close-btn="false" class="mb-3">显示尚未过期且未撤销的登录，最近活动每五分钟更新一次，不代表当前在线。最多显示最近 100 个。</t-alert>
    <AsyncState v-if="!rows.length" :loading="loading" :error="error" :empty="!loading && !error" empty-description="暂无有效登录会话" @retry="load" />
    <t-alert v-else-if="error" theme="error" :close-btn="false">{{ error }}</t-alert>
    <t-list v-if="rows.length" split>
      <t-list-item v-for="row in rows" :key="row.id">
        <t-list-item-meta :title="`${row.ipAddress || '未知地址'}${row.current ? '（当前会话）' : ''}`">
          <template #description>
            <div class="session-agent">{{ row.userAgent || '未知客户端' }}</div>
            <div>登录：{{ formatDateTime(row.createdAt) }}</div>
            <div>活动：{{ formatDateTime(row.lastSeenAt) }} · 到期：{{ formatDateTime(row.expiresAt) }}</div>
          </template>
        </t-list-item-meta>
        <template #action><t-button theme="danger" variant="text" :disabled="busy || loading" @click="revoke(row)">退出会话</t-button></template>
      </t-list-item>
    </t-list>
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getLoginSessions, revokeLoginSession, revokeOtherSessions, revokeUserSessions } from '@/api/user'
import { useUserStore } from '@/stores/user'
import { confirmMessage, message } from '@/utils/message'
import { formatDateTime } from '@/utils/formatters'
import AsyncState from '@/components/AsyncState.vue'

const props = defineProps({ userId: { type: String, default: '' } })
const rows = ref([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const user = useUserStore()
const router = useRouter()
let generation = 0
const load = async () => {
  const current = ++generation
  loading.value = true
  error.value = ''
  rows.value = []
  try {
    const response = await getLoginSessions(props.userId)
    if (current === generation) rows.value = response.data || []
  } catch (cause) { if (current === generation) error.value = cause.message || '会话加载失败' }
  finally { if (current === generation) loading.value = false }
}
const run = async (operation, clearsCurrent) => {
  if (busy.value) return
  try { await confirmMessage('撤销后，该客户端需要重新登录。', '确认退出会话', { type: 'warning' }) } catch { return }
  busy.value = true
  try {
    await operation()
    message.success('会话已退出')
    if (clearsCurrent) { user.logout(); await router.replace({ name: 'login' }) }
    else await load()
  } catch (cause) { error.value = cause.message || '操作失败，请刷新重试' }
  finally { busy.value = false }
}
const revoke = row => {
  const target = props.userId
  return run(() => revokeLoginSession(row.id, target), row.current)
}
const revokeAll = () => {
  const target = props.userId
  return run(() => target ? revokeUserSessions(target) : revokeOtherSessions(), target === user.userInfo.id)
}
onMounted(load)
watch(() => props.userId, load)
onUnmounted(() => { generation += 1 })
</script>

<style scoped>
.session-agent { overflow-wrap: anywhere; }
</style>
