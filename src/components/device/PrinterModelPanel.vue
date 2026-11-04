<template>
  <section class="printer-model-panel" aria-label="完整设备状态">
    <div class="model-heading">
      <strong>完整设备状态</strong>
      <t-button size="small" variant="outline" :loading="state.loading" @click="loader.refresh">刷新状态</t-button>
    </div>
    <t-loading v-if="state.loading && !state.data" text="正在读取设备模型" />
    <t-empty v-else-if="state.error" type="fail" title="设备模型加载失败" :description="state.error">
      <template #extra><t-button size="small" @click="loader.refresh">重试</t-button></template>
    </t-empty>
    <t-empty v-else-if="!state.data?.model" title="尚无设备模型" description="等待 Server 监控采集，确认设备已启用监控并成功连接。" />
    <template v-else>
      <t-alert v-if="!current" theme="warning" :close-btn="false" title="当前数据不可用"
        :message="`${modelLabel(observation.connection.status)} · ${observation.connection.monitorEnabled ? '监控已启用' : '监控已关闭'}。采样值已过期，当前执行无法确认。`" />
      <t-space break-line class="model-status">
        <t-tag :theme="current ? 'success' : 'warning'" variant="light">{{ current ? '实时数据' : '数据过期' }}</t-tag>
        <span>系统 {{ current ? modelLabel(observation.systemState) : '未知' }}</span>
        <span>作业 {{ current ? modelLabel(observation.operationState) : '未知' }}</span>
      </t-space>
      <div class="model-time">采样时间 {{ modelTime(observation.observedAt) }} · {{ modelLabel(observation.completeness) }}</div>
      <t-collapse :default-value="['0', '1']">
        <t-collapse-panel v-for="(group, index) in groups" :key="group.label" :value="String(index)" :header="group.label">
          <t-empty v-if="!group.rows.length" description="设备未提供该信息" size="small" />
          <t-descriptions v-else :column="1" size="small" bordered>
            <t-descriptions-item v-for="(row, rowIndex) in group.rows" :key="rowIndex" :label="row.name">
              <t-tooltip v-if="row.description" :content="row.description">
                <span class="model-value" tabindex="0">{{ row.value ?? '未知' }}</span>
              </t-tooltip>
              <span v-else class="model-value">{{ row.value ?? '未知' }}</span>
            </t-descriptions-item>
          </t-descriptions>
        </t-collapse-panel>
      </t-collapse>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { getPrinterModel } from '@/api/printer'
import { useUserStore } from '@/stores/user'
import { createPrinterModelLoader } from '@/utils/printerModelLoader'
import { isModelCurrent, modelLabel, modelTime, printerModelGroups, printerModelSummary } from '@/utils/printerModel'

const props = defineProps({ printerId: { type: [String, Number], required: true }, active: Boolean })
const emit = defineEmits(['summary'])
const user = useUserStore()
const visible = ref(!document.hidden)
const clock = ref(Date.now())
const state = shallowRef({ loading: false, data: null, error: '', receivedAt: null })
let sessionGeneration
const canRead = () => props.active && visible.value && user.isAuthenticated && !user.userInfo.mustChangePassword
const loader = createPrinterModelLoader({
  fetchModel: getPrinterModel,
  onChange: value => { state.value = value },
  isActive: () => canRead() && sessionGeneration === user.getSessionGeneration()
})
watch(() => [props.printerId, props.active, visible.value, user.token, user.userInfo, user.isAuthenticated], () => {
  loader.stop()
  sessionGeneration = user.getSessionGeneration()
  if (canRead()) loader.start(props.printerId)
}, { immediate: true, flush: 'sync' })

// Calibrate against server time so different PC clocks do not keep old readings fresh.
const serverNow = computed(() => Date.parse(state.value.data?.serverTime)
  + Math.max(0, clock.value - state.value.receivedAt))
const observation = computed(() => state.value.data?.model?.observation)
const current = computed(() => isModelCurrent(state.value.data, serverNow.value))
const groups = computed(() => state.value.data?.model ? printerModelGroups(state.value.data, serverNow.value) : [])
watch(() => printerModelSummary(state.value.data, serverNow.value), summary => emit('summary', summary
  || (state.value.error ? { status: 'UNKNOWN', connectionStatus: 'UNKNOWN', progress: null, taskSource: 'UNKNOWN', filename: '' } : null)), { immediate: true })
let clockTimer
const visibilityChanged = () => { visible.value = !document.hidden }
onMounted(() => {
  document.addEventListener('visibilitychange', visibilityChanged)
  clockTimer = setInterval(() => { clock.value = Date.now() }, 1000)
})
onUnmounted(() => {
  loader.stop()
  clearInterval(clockTimer)
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>

<style scoped>
.model-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.model-status { margin: 12px 0 4px; }
.model-time { color: var(--td-text-color-secondary); font-size: 12px; margin-bottom: 12px; }
.model-value { overflow-wrap: anywhere; white-space: normal; }
</style>
