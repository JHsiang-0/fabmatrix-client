<template>
  <section class="printer-model-panel" aria-label="设备运行状态">
    <div class="model-heading">
      <strong>运行状态</strong>
      <t-button size="small" variant="text" :loading="state.loading" @click="loader.refresh">刷新</t-button>
    </div>
    <t-loading v-if="state.loading && !state.data" text="正在读取设备状态" />
    <t-empty v-else-if="state.error" type="fail" title="设备状态加载失败" :description="state.error">
      <template #extra><t-button size="small" @click="loader.refresh">重试</t-button></template>
    </t-empty>
    <t-empty v-else-if="!state.data?.model" title="等待设备状态" description="确认设备已启用监控并成功连接。" />
    <template v-else>
      <t-alert v-if="!current" theme="warning" :close-btn="false" title="当前数据不可用"
        :message="`${modelLabel(observation.connection.status)} · ${observation.connection.monitorEnabled ? '监控已启用' : '监控已关闭'}。采样值已过期，当前执行无法确认。`" />
      <div class="temperature-grid" aria-label="设备温度">
        <div v-for="heater in view.heaters" :key="heater.id" class="temperature-card" :class="{ 'is-fault': heater.fault }">
          <div class="temperature-heading">
            <span>{{ heater.name }}</span>
            <t-tag v-if="heater.mode" size="small" :theme="heater.fault ? 'danger' : 'default'" variant="light">{{ heater.mode }}</t-tag>
          </div>
          <t-tooltip :content="heater.temperature.description">
            <strong tabindex="0" class="temperature-value">{{ current ? heater.temperature.value : '— °C' }}</strong>
          </t-tooltip>
          <span v-if="current && heater.target" class="temperature-target">目标 {{ heater.target.value }}</span>
        </div>
      </div>
      <t-empty v-if="!view.heaters.length" size="small" description="设备尚未提供温度信息" />
      <div class="model-time" :title="modelTime(observation.observedAt)">
        {{ current ? '更新于' : '最后采样' }} {{ modelTime(observation.observedAt) }}
      </div>

      <section v-if="view.execution && current" class="print-section" aria-label="打印信息">
        <div class="model-heading">
          <strong>{{ view.execution.simulation ? '当前模拟' : '打印信息' }}</strong>
        </div>
        <div v-if="view.printMetrics.length" class="print-metrics">
          <div v-for="metric in view.printMetrics" :key="metric.name" class="print-metric">
            <span>{{ metric.name }}</span>
            <t-tooltip :content="metric.description"><strong tabindex="0">{{ metric.value }}</strong></t-tooltip>
          </div>
        </div>
        <p v-else class="model-hint">等待设备返回打印统计</p>
      </section>

      <div v-if="view.lastResult" class="last-result" aria-label="最近打印结果">
        <div class="last-result-heading">
          <span>{{ view.lastResult.label }}</span>
          <t-tooltip :content="view.lastResult.evidence">
            <t-tag :theme="view.lastResult.theme" size="small" variant="light">{{ view.lastResult.outcome }}</t-tag>
          </t-tooltip>
        </div>
        <span class="model-time">{{ view.lastResult.at }}</span>
      </div>

      <t-collapse v-if="view.moreGroups.length" class="runtime-details" :default-value="[]">
        <t-collapse-panel value="more" header="更多运行信息">
          <section v-for="group in view.moreGroups" :key="group.label" class="runtime-group">
            <h4>{{ group.label }}</h4>
            <t-descriptions :column="1" size="small">
              <t-descriptions-item v-for="row in group.rows" :key="row.name" :label="row.name">
                <t-tooltip :content="row.description">
                  <span class="model-value" tabindex="0">{{ row.value }}</span>
                </t-tooltip>
              </t-descriptions-item>
            </t-descriptions>
          </section>
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
import { isModelCurrent, modelLabel, modelTime, printerModelView, printerModelSummary } from '@/utils/printerModel'

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
const view = computed(() => state.value.data?.model ? printerModelView(state.value.data, serverNow.value) : null)
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
.printer-model-panel {
  display: grid;
  gap: var(--app-spacing-3);
  min-width: 0;
}
.model-heading, .temperature-heading, .last-result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-2);
}
.model-heading strong {
  font-size: var(--td-font-size-body-medium);
}
.temperature-grid, .print-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-spacing-2);
}
.temperature-card {
  display: grid;
  align-content: start;
  gap: var(--app-spacing-2);
  min-width: 0;
  padding: var(--app-spacing-3) var(--app-spacing-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-surface);
}
.temperature-card.is-fault {
  border-color: var(--app-danger);
}
.temperature-heading {
  min-height: 22px;
  color: var(--app-text-secondary);
}
.temperature-heading > span {
  overflow-wrap: anywhere;
}
.temperature-value {
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-large);
  line-height: 1.3;
}
.temperature-target, .model-time, .model-hint {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}
.print-section {
  display: grid;
  gap: var(--app-spacing-3);
  padding: var(--app-spacing-3);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius);
}
.print-metric {
  display: grid;
  gap: var(--app-spacing-1);
  min-width: 0;
}
.print-metric > span {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}
.print-metric strong {
  color: var(--app-text-primary);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.last-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--app-spacing-2);
  padding: var(--app-spacing-3) 0;
  border-top: 1px solid var(--app-border);
}
.runtime-group + .runtime-group {
  margin-top: var(--app-spacing-4);
}
.runtime-group h4 {
  margin: 0 0 var(--app-spacing-2);
  font-size: var(--td-font-size-body-medium);
  font-weight: 500;
}
.model-value {
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
