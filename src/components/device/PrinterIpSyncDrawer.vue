<template>
  <t-drawer v-model:visible="visible" class="printer-ip-sync-drawer" header="同步设备 IP" size="580px" :footer="true" destroy-on-close>
    <div class="printer-ip-sync-content">
      <t-alert theme="info" message="查找已登记打印机的新地址" description="设备重新开机后，可在这里同步地址。仅更新确认身份的已有设备，名称、编号和任务关联保持不变。" />
      <div class="printer-ip-sync-scope">
        <strong>扫描范围</strong>
        <div v-if="result?.subnets?.length" class="printer-ip-sync-subnets">
          <t-tag v-for="subnet in result.subnets" :key="subnet" variant="light">{{ subnet }}</t-tag>
        </div>
        <span v-else class="printer-ip-sync-muted">开始同步后显示服务端配置的厂内网段</span>
      </div>
      <t-alert v-if="error" theme="error" :message="error">
        <template #operation><t-button variant="text" :loading="pending" @click="resume">重新查询</t-button></template>
      </t-alert>
      <t-loading v-if="pending && !result" size="small" text="正在查询同步记录" />
      <div v-if="isRunning" role="status" aria-live="polite">
        <t-loading size="small" text="正在查找设备，请稍候" />
        <p class="printer-ip-sync-muted">关闭此窗口后，服务端仍会继续同步。</p>
      </div>
      <t-alert v-else-if="result?.status === 'FAILED'" theme="error" :message="result.message || '同步失败，请检查厂内网络后重试'" />
      <template v-if="result && result.status !== 'IDLE'">
        <p class="printer-ip-sync-summary" role="status" aria-live="polite">
          已检查 {{ result.scannedAddressCount }} 个地址 · 更新 {{ result.updatedCount }} 台 · 地址未变 {{ result.unchangedCount }} 台 · 待处理 {{ result.unresolvedCount }} 台
        </p>
        <p v-if="result.status === 'COMPLETED'" class="printer-ip-sync-muted">{{ result.message || '地址同步完成' }}</p>
        <div v-if="result.items.length" class="printer-ip-sync-results" aria-label="设备 IP 同步结果">
          <div v-for="(item, index) in result.items" :key="`${item.printerId}-${index}`" class="printer-ip-sync-item">
            <div class="printer-ip-sync-item-heading">
              <strong>{{ item.printerName || '未命名打印机' }}</strong>
              <t-tag :theme="getRediscoveryItemStatus(item.status).theme" variant="light">{{ getRediscoveryItemStatus(item.status).label }}</t-tag>
            </div>
            <div class="printer-ip-sync-address">{{ item.oldIpAddress || '未登记地址' }} → {{ item.newIpAddress || '未确认新地址' }}</div>
            <p v-if="item.message" class="printer-ip-sync-muted">{{ item.message }}</p>
          </div>
        </div>
        <t-empty v-else-if="!isRunning" description="暂无需要同步的设备结果" />
      </template>
      <t-empty v-else-if="!pending && !error" description="尚无同步记录，点击开始同步查找设备" />
    </div>
    <template #footer>
      <div class="printer-ip-sync-footer">
        <t-button theme="default" variant="outline" @click="visible = false">关闭</t-button>
        <t-button theme="primary" :loading="pending || isRunning" :disabled="!isAdmin || pending || isRunning" @click="start">
          {{ isRunning ? '正在同步' : '开始同步' }}
        </t-button>
      </div>
    </template>
  </t-drawer>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getPrinterRediscovery, startPrinterRediscovery } from '@/api/printer'
import { createPrinterRediscoverySession, getRediscoveryItemStatus } from '@/utils/printerRediscovery'

const props = defineProps({ isAdmin: { type: Boolean, default: false } })
const visible = defineModel('visible', { type: Boolean, default: false })
const emit = defineEmits(['completed', 'running'])
const result = ref(null)
const error = ref('')
const pending = ref(false)
const isRunning = computed(() => result.value?.status === 'RUNNING')
const session = createPrinterRediscoverySession({
  start: startPrinterRediscovery,
  getStatus: getPrinterRediscovery,
  canManage: () => props.isAdmin,
  onPending: value => { pending.value = value },
  onUpdate: value => {
    error.value = ''
    result.value = value
    emit('running', value.status === 'RUNNING')
  },
  onComplete: value => emit('completed', value),
  onError: value => { error.value = value?.message || '无法查询同步进度，请检查服务连接后重试' }
})

const start = () => {
  error.value = ''
  return session.start()
}
const resume = () => {
  error.value = ''
  return session.resume()
}

onMounted(resume)
watch(visible, value => { if (value) void resume() })
onUnmounted(() => session.dispose())
</script>

<style scoped>
.printer-ip-sync-content,
.printer-ip-sync-results,
.printer-ip-sync-scope {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-spacing-3);
}

.printer-ip-sync-item {
  min-width: 0;
  padding: var(--app-spacing-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
}

.printer-ip-sync-item-heading,
.printer-ip-sync-subnets,
.printer-ip-sync-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--app-spacing-2);
}

.printer-ip-sync-item-heading {
  justify-content: space-between;
}

.printer-ip-sync-item-heading strong,
.printer-ip-sync-address,
.printer-ip-sync-muted {
  overflow-wrap: anywhere;
}

.printer-ip-sync-address {
  margin-top: var(--app-spacing-2);
}

.printer-ip-sync-muted {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.printer-ip-sync-summary {
  margin: 0;
}

.printer-ip-sync-footer {
  justify-content: flex-end;
}

.printer-ip-sync-drawer :deep(.t-drawer__content-wrapper) {
  max-width: 100vw;
}
</style>
