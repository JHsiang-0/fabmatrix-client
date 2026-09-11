<template>
  <t-drawer
    v-model:visible="drawerVisible"
    class="unallocated-printer-drawer"
    header="未分配设备"
    size="640px"
    :close-btn="true"
    destroy-on-close
  >
    <div class="unallocated-printer-drawer__content">
      <t-alert
        v-if="isAdmin"
        theme="info"
        title="未分配设备仅供查看"
        :close-btn="false"
      >
        点击“进入布局编辑”后，在布局中点击空槽位选择并绑定设备。
      </t-alert>
      <t-alert v-else theme="info" title="只读查看" :close-btn="false">
        当前账号可以查看未分配设备，但没有布局编辑或绑定设备权限。
      </t-alert>
      <t-alert
        v-if="isAdmin && enterLayoutLoading"
        theme="info"
        title="布局正在加载"
        message="请等待布局快照加载完成后再进入编辑。"
        :close-btn="false"
      />
      <t-alert
        v-else-if="isAdmin && enterLayoutError"
        theme="error"
        title="暂时无法进入布局编辑"
        :message="enterLayoutError"
        :close-btn="false"
      />

      <div v-if="loading" class="unallocated-printer-drawer__state" role="status" aria-live="polite">
        <t-loading text="正在加载未分配设备..." />
      </div>
      <t-alert v-else-if="error" theme="error" :close-btn="false">
        <template #default>{{ error }}</template>
        <template #operation>
          <t-button size="small" variant="outline" @click="loadPrinters">重试</t-button>
        </template>
      </t-alert>
      <t-empty v-else-if="!printers.length" description="暂无未分配设备" />
      <div v-else class="unallocated-printer-drawer__list">
        <article v-for="printer in printers" :key="printer.id || printer.ipAddress" class="unallocated-printer-card">
          <div class="unallocated-printer-card__header">
            <t-tooltip :content="printer.name || '未命名设备'">
              <strong class="unallocated-printer-card__name">{{ printer.name || '未命名设备' }}</strong>
            </t-tooltip>
          </div>
          <dl class="unallocated-printer-card__details">
            <div>
              <dt>机器编号</dt>
              <dd :title="printer.machineNumber || '-'">{{ printer.machineNumber || '-' }}</dd>
            </div>
            <div>
              <dt>IP 地址</dt>
              <dd :title="printer.ipAddress || '-'">{{ printer.ipAddress || '-' }}</dd>
            </div>
            <div>
              <dt>MAC 地址</dt>
              <dd :title="printer.macAddress || '-'">{{ printer.macAddress || '-' }}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd class="unallocated-printer-card__status"><StatusTag domain="printer" :status="printer.status" :show-icon="false" /></dd>
            </div>
          </dl>
        </article>
      </div>
    </div>

    <template #footer>
      <div class="unallocated-printer-drawer__footer">
        <span v-if="isAdmin" class="unallocated-printer-drawer__footer-hint">
          进入布局编辑后，点击空槽位选择并绑定设备
        </span>
        <t-button
          v-if="isAdmin"
          theme="primary"
          :loading="enterLayoutLoading"
          :disabled="enterLayoutLoading"
          @click="requestLayoutEdit"
        >
          进入布局编辑
        </t-button>
        <t-button @click="closeDrawer">关闭</t-button>
      </div>
    </template>
  </t-drawer>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getUnallocatedPrinters } from '@/api/printer'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard'
import StatusTag from './StatusTag.vue'

defineOptions({ name: 'UnallocatedPrinterDrawer' })

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  enterLayoutLoading: {
    type: Boolean,
    default: false
  },
  enterLayoutError: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:visible', 'enter-layout-edit'])
const drawerVisible = computed({
  get: () => props.visible,
  set: value => {
    if (!value) invalidateLoad()
    emit('update:visible', value)
  }
})
const printers = ref([])
const loading = ref(false)
const error = ref('')
let requestGuard = createLatestRequestGuard()
let componentUnmounted = false

const unwrapPrinters = response => {
  const data = response?.data ?? response
  if (Array.isArray(data)) return data
  return Array.isArray(data?.records) ? data.records : []
}

async function loadPrinters() {
  const guard = requestGuard
  const requestId = guard.begin()
  if (requestId === null) return
  loading.value = true
  error.value = ''
  try {
    const response = await getUnallocatedPrinters()
    if (!guard.isCurrent(requestId) || componentUnmounted) return
    printers.value = unwrapPrinters(response)
  } catch (requestError) {
    if (!guard.isCurrent(requestId) || componentUnmounted) return
    error.value = requestError?.message || '未分配设备加载失败，请重试'
    printers.value = []
  } finally {
    if (guard.isCurrent(requestId) && !componentUnmounted) loading.value = false
  }
}

function invalidateLoad(reactivate = true) {
  requestGuard.invalidate()
  if (reactivate) requestGuard = createLatestRequestGuard()
  loading.value = false
}

function closeDrawer() {
  drawerVisible.value = false
}

function requestLayoutEdit() {
  emit('enter-layout-edit')
}

watch(() => props.visible, visible => {
  if (visible) loadPrinters()
  else invalidateLoad()
}, { flush: 'sync' })

onBeforeUnmount(() => {
  componentUnmounted = true
  invalidateLoad(false)
})
</script>

<style scoped>
.unallocated-printer-drawer :deep(.t-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.unallocated-printer-drawer__content,
.unallocated-printer-drawer__list {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: var(--app-spacing-3);
}

.unallocated-printer-drawer__content {
  flex: 1 1 auto;
}

.unallocated-printer-drawer__state {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
}

.unallocated-printer-drawer__list {
  flex: 1 1 auto;
  overflow-y: auto;
}

.unallocated-printer-card {
  min-width: 0;
  padding: var(--app-spacing-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-surface);
}

.unallocated-printer-card__header,
.unallocated-printer-card__details,
.unallocated-printer-drawer__footer {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-spacing-2);
}

.unallocated-printer-card__header {
  justify-content: space-between;
}

.unallocated-printer-card__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unallocated-printer-card__details {
  margin: var(--app-spacing-2) 0 0;
  flex-wrap: wrap;
}

.unallocated-printer-card__details > div {
  display: flex;
  min-width: 0;
  flex: 1 1 30%;
  flex-direction: column;
  gap: 2px;
}

.unallocated-printer-card__details dt {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-caption);
}

.unallocated-printer-card__details dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-family: var(--app-font-family-mono);
  font-size: var(--td-font-size-body-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unallocated-printer-card__status {
  display: flex;
  align-items: center;
  min-height: 20px;
  font-family: inherit;
}

.unallocated-printer-drawer__footer {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.unallocated-printer-drawer__footer-hint {
  min-width: 0;
  margin-right: auto;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-caption);
}

.unallocated-printer-drawer :deep(.t-drawer__content-wrapper) {
  max-width: 100vw;
}

@media (max-width: 640px) {
  .unallocated-printer-drawer :deep(.t-drawer__content-wrapper) {
    width: 100vw !important;
  }

  .unallocated-printer-card__details > div {
    flex-basis: 100%;
  }

  .unallocated-printer-drawer__footer-hint {
    flex-basis: 100%;
    margin-right: 0;
  }
}
</style>
