<template>
  <t-drawer
    v-model:visible="drawerVisible"
    :destroy-on-close="true"
    :close-btn="false"
    :close-on-esc-keydown="true"
    :footer="showActionFooter"
    size="min(560px, 100vw)"
    class="task-detail-drawer"
    @close="handleClose"
  >
    <template #header>
      <div class="task-detail-drawer__header">
        <div class="task-detail-drawer__identity">
          <div v-if="task" class="task-detail-drawer__title-row">
            <t-tooltip :content="detailDisplay.fileName" class="task-detail-drawer__name-tooltip">
              <span class="task-detail-drawer__title">{{ detailDisplay.fileName }}</span>
            </t-tooltip>
          </div>
          <span v-else class="task-detail-drawer__title">任务详情</span>
          <span v-if="task" class="task-detail-drawer__subtitle">
            任务 #{{ formatTechnicalValue(task.id) }}
          </span>
        </div>
        <t-button
          class="task-detail-drawer__close"
          variant="text"
          shape="square"
          size="large"
          aria-label="关闭任务详情"
          @click="handleClose"
        >
          <Close size="20px" />
        </t-button>
      </div>
    </template>

    <div class="task-detail-drawer__body app-scroll-region">
      <div v-if="loading" class="task-detail-drawer__loading" role="status" aria-live="polite">
        <t-skeleton :loading="true" theme="article" />
        <span class="task-detail-drawer__loading-text">任务详情加载中...</span>
      </div>

      <template v-else-if="task">
        <t-alert v-if="error" theme="error" :title="error" :close-btn="false" class="task-detail-drawer__error-alert" />
        <t-alert v-if="reconcileStale" theme="error" :close-btn="false" class="task-detail-drawer__stale-alert">
          当前任务详情刷新失败，已停止人工核对操作，请刷新任务详情后再试。
        </t-alert>
        <t-alert
          v-if="task.status === 'RECONCILING'"
          theme="warning"
          title="设备状态无法自动确认，请人工核对打印结果。"
          :close-btn="false"
          class="task-detail-drawer__reconcile-alert"
        />

        <section class="task-detail-drawer__overview" aria-labelledby="task-detail-overview">
          <div class="task-detail-drawer__overview-heading">
            <div>
              <h2 id="task-detail-overview">执行概览</h2>
              <p>{{ statusView.description }}</p>
            </div>
            <t-tag :theme="priorityTheme" variant="light">{{ priorityLabel }}</t-tag>
          </div>

          <div class="task-detail-drawer__progress-row">
            <span>任务进度</span>
            <strong>{{ hasValue(task.progress) ? `${task.progress}%` : '-' }}</strong>
          </div>
          <t-progress
            v-if="hasValue(task.progress)"
            :percentage="task.progress"
            :label="false"
            :stroke-width="6"
          />
          <div v-if="hasValue(task.errorReason)" class="task-detail-drawer__reason">
            <span>失败/核对原因</span>
            <t-tooltip :content="formatValue(task.errorReason)" class="task-detail-drawer__value-tooltip">
              <strong>{{ formatValue(task.errorReason) }}</strong>
            </t-tooltip>
          </div>
        </section>

        <section class="task-detail-drawer__section" aria-labelledby="task-detail-resources">
          <h2 id="task-detail-resources">资源与人员</h2>
          <div class="task-detail-drawer__resource-grid">
            <article class="task-detail-drawer__resource-card">
              <span class="task-detail-drawer__field-label">打印文件</span>
              <t-tooltip :content="detailDisplay.fileName" class="task-detail-drawer__value-tooltip">
                <strong class="task-detail-drawer__resource-name">{{ detailDisplay.fileName }}</strong>
              </t-tooltip>
              <t-tag
                v-if="shouldShowSource(detailDisplay.sources.fileName)"
                size="small"
                variant="light"
                :theme="sourceTagTheme(detailDisplay.sources.fileName)"
              >
                {{ detailDisplay.sources.fileName }}
              </t-tag>
            </article>

            <article class="task-detail-drawer__resource-card">
              <span class="task-detail-drawer__field-label">打印设备</span>
              <t-tooltip :content="detailDisplay.printerName" class="task-detail-drawer__value-tooltip">
                <strong class="task-detail-drawer__resource-name">{{ detailDisplay.printerName }}</strong>
              </t-tooltip>
              <span class="task-detail-drawer__resource-meta">机器编号：{{ detailDisplay.machineNumber }}</span>
              <t-tag
                v-if="shouldShowSource(detailDisplay.sources.printerName) || shouldShowSource(detailDisplay.sources.machineNumber)"
                size="small"
                variant="light"
                :theme="sourceTagTheme(deviceSource)"
              >
                {{ deviceSource }}
              </t-tag>
            </article>
          </div>

          <div class="task-detail-drawer__people-grid">
            <div class="task-detail-drawer__person">
              <span class="task-detail-drawer__field-label">创建人</span>
              <strong>{{ detailDisplay.creatorUsername }}</strong>
              <t-tag
                v-if="shouldShowSource(detailDisplay.sources.creatorUsername)"
                size="small"
                variant="light"
                :theme="sourceTagTheme(detailDisplay.sources.creatorUsername)"
              >
                {{ detailDisplay.sources.creatorUsername }}
              </t-tag>
            </div>
            <div class="task-detail-drawer__person">
              <span class="task-detail-drawer__field-label">操作员</span>
              <strong>{{ detailDisplay.operatorUsername }}</strong>
              <t-tag
                v-if="shouldShowSource(detailDisplay.sources.operatorUsername)"
                size="small"
                variant="light"
                :theme="sourceTagTheme(detailDisplay.sources.operatorUsername)"
              >
                {{ detailDisplay.sources.operatorUsername }}
              </t-tag>
            </div>
          </div>
        </section>

        <section class="task-detail-drawer__section task-detail-drawer__timeline" aria-labelledby="task-detail-timeline">
          <h2 id="task-detail-timeline">已知时间线</h2>
          <div v-if="timelineItems.length" class="task-detail-drawer__timeline-grid">
            <div v-for="item in timelineItems" :key="item.key" class="task-detail-drawer__timeline-item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <t-empty v-else description="暂无时间记录" />
        </section>

        <t-collapse class="task-detail-drawer__technical" :default-value="[]" borderless>
          <t-collapse-panel value="technical" header="技术信息">
            <div class="task-detail-drawer__technical-grid">
              <div class="task-detail-drawer__technical-item">
                <span>任务 ID</span>
                <strong>{{ formatTechnicalValue(task.id) }}</strong>
              </div>
              <div class="task-detail-drawer__technical-item">
                <span>文件 ID</span>
                <strong>{{ formatTechnicalValue(task.fileId) }}</strong>
              </div>
              <div class="task-detail-drawer__technical-item">
                <span>打印机 ID</span>
                <strong>{{ formatTechnicalValue(task.printerId) }}</strong>
              </div>
              <div class="task-detail-drawer__technical-item">
                <span>发起用户 ID</span>
                <strong>{{ formatTechnicalValue(task.userId) }}</strong>
              </div>
              <div class="task-detail-drawer__technical-item">
                <span>现场操作员 ID</span>
                <strong>{{ formatTechnicalValue(task.operatorId) }}</strong>
              </div>
              <div class="task-detail-drawer__technical-item">
                <span>重试来源任务 ID</span>
                <strong>{{ formatTechnicalValue(task.retryOfJobId) }}</strong>
              </div>
              <div class="task-detail-drawer__technical-item">
                <span>根任务 ID</span>
                <strong>{{ formatTechnicalValue(task.rootJobId) }}</strong>
              </div>
              <div class="task-detail-drawer__technical-item">
                <span>尝试次数</span>
                <strong>{{ formatValue(task.attemptNumber) }}</strong>
              </div>
              <div v-if="hasValue(task.idempotencyKey)" class="task-detail-drawer__technical-item">
                <span>幂等键</span>
                <strong>{{ formatTechnicalValue(task.idempotencyKey) }}</strong>
              </div>
              <div v-if="hasValue(task.eventId)" class="task-detail-drawer__technical-item">
                <span>事件 ID</span>
                <strong>{{ formatTechnicalValue(task.eventId) }}</strong>
              </div>
              <div v-if="hasValue(task.sequence)" class="task-detail-drawer__technical-item">
                <span>事件序号</span>
                <strong>{{ formatTechnicalValue(task.sequence) }}</strong>
              </div>
            </div>
          </t-collapse-panel>
        </t-collapse>
      </template>

      <t-alert v-else-if="error" theme="error" :title="error" :close-btn="false" class="task-detail-drawer__error-alert">
        <template #operation>
          <span>任务详情暂时不可用，请稍后重试。</span>
        </template>
      </t-alert>
      <t-empty v-else description="未选择任务" />
    </div>

    <template #footer>
      <div v-if="showReconcileFooter" class="task-detail-drawer__footer">
        <div>
          <strong>需要现场确认</strong>
          <span>核对实际打印结果后提交任务终态</span>
        </div>
        <t-button
          theme="primary"
          :loading="reconcileLoading"
          :disabled="reconcileLoading || reconcileStale"
          @click="openReconcile('COMPLETED')"
        >
          人工核对
        </t-button>
      </div>
      <div v-else-if="showRetryFooter" class="task-detail-drawer__footer">
        <div>
          <strong>任务执行失败</strong>
          <span>确认原因后，可基于当前任务创建新的排队任务</span>
        </div>
        <t-button
          theme="warning"
          :loading="retryLoading"
          :disabled="retryLoading"
          @click="emit('retry')"
        >
          重新排队
        </t-button>
      </div>
    </template>
  </t-drawer>

  <t-dialog
    v-model:visible="reconcileDialogVisible"
    header="人工核对打印结果"
    width="480px"
    :confirm-btn="{ content: '提交核对', loading: reconcileLoading }"
    :cancel-btn="{ content: '取消', disabled: reconcileLoading }"
    :close-on-overlay-click="!reconcileLoading"
    :close-on-esc-keydown="!reconcileLoading"
    destroy-on-close
    @confirm="submitReconcile"
  >
    <t-form ref="reconcileFormRef" :data="reconcileForm" :rules="reconcileRules" label-align="top">
      <t-form-item label="核对结果" name="result">
        <t-radio-group v-model="reconcileForm.result" variant="default-filled" :disabled="reconcileLoading">
          <t-radio-button value="COMPLETED">确认完成</t-radio-button>
          <t-radio-button value="FAILED">确认失败</t-radio-button>
          <t-radio-button value="CANCELLED">确认取消</t-radio-button>
          <t-radio-button value="QUEUED">重新排队</t-radio-button>
        </t-radio-group>
      </t-form-item>
      <t-form-item label="核对原因" name="reason">
        <t-alert v-if="reconcileValidationError" theme="error" :close-btn="false" class="task-detail-drawer__form-error">
          {{ reconcileValidationError }}
        </t-alert>
        <t-textarea
          v-model="reconcileForm.reason"
          :maxlength="255"
          :disabled="reconcileLoading"
          placeholder="请填写现场核对结果或重新排队原因"
          :autosize="{ minRows: 3, maxRows: 6 }"
          allow-input-over-max
        />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { CloseIcon as Close } from 'tdesign-icons-vue-next'
import { formatDateTime } from '@/utils/formatters'
import { getJobDetailDisplay, JOB_DISPLAY_SOURCE } from '@/utils/jobDisplay'
import { getStatusView } from '@/utils/statusView'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  task: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  reconcileLoading: { type: Boolean, default: false },
  reconcileSuccessKey: { type: [String, Number], default: 0 },
  reconcileStale: { type: Boolean, default: false },
  retryLoading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'reconcile', 'retry'])

const drawerVisible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const isTerminal = computed(() => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(props.task?.status))
const detailDisplay = computed(() => getJobDetailDisplay(props.task || {}, isTerminal.value ? 'history' : 'current'))
const statusView = computed(() => getStatusView('job', props.task?.status))
const showReconcileFooter = computed(() => props.task?.status === 'RECONCILING')
const showRetryFooter = computed(() => props.task?.status === 'FAILED')
const showActionFooter = computed(() => showReconcileFooter.value || showRetryFooter.value)

const priorityLabel = computed(() => {
  const priority = Number(props.task?.priority)
  if (!Number.isFinite(priority)) return '优先级未知'
  if (priority >= 80) return `紧急 · ${priority}`
  if (priority >= 50) return `高优先级 · ${priority}`
  if (priority >= 20) return `较高优先级 · ${priority}`
  return `普通 · ${priority}`
})

const priorityTheme = computed(() => {
  const priority = Number(props.task?.priority)
  if (priority >= 80) return 'danger'
  if (priority >= 50) return 'warning'
  if (priority >= 20) return 'primary'
  return 'default'
})

const sourceTagTheme = source => {
  if (source === JOB_DISPLAY_SOURCE.SNAPSHOT) return 'warning'
  if (source === JOB_DISPLAY_SOURCE.UNAVAILABLE) return 'danger'
  return 'default'
}

const shouldShowSource = source => [
  JOB_DISPLAY_SOURCE.SNAPSHOT,
  JOB_DISPLAY_SOURCE.UNAVAILABLE
].includes(source)

const deviceSource = computed(() => {
  const sources = [detailDisplay.value.sources.printerName, detailDisplay.value.sources.machineNumber]
  if (sources.includes(JOB_DISPLAY_SOURCE.UNAVAILABLE)) return JOB_DISPLAY_SOURCE.UNAVAILABLE
  if (sources.includes(JOB_DISPLAY_SOURCE.SNAPSHOT)) return JOB_DISPLAY_SOURCE.SNAPSHOT
  return JOB_DISPLAY_SOURCE.CURRENT
})

const hasValue = value => value !== undefined && value !== null && value !== ''
const formatValue = value => hasValue(value) ? String(value) : '-'
const formatTechnicalValue = value => formatValue(value)

const timelineItems = computed(() => {
  const candidates = [
    { key: 'created', label: '任务创建', rawValue: props.task?.createdAt },
    { key: 'started', label: '开始执行', rawValue: props.task?.startedAt },
    { key: 'completed', label: '任务完成', rawValue: props.task?.completedAt },
    { key: 'updated', label: '最近更新', rawValue: props.task?.updatedAt }
  ].filter(item => hasValue(item.rawValue))

  const seen = new Set()
  return candidates.filter(item => {
    const normalized = String(item.rawValue)
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  }).map(item => ({ ...item, value: formatDateTime(item.rawValue) }))
})

const handleClose = () => {
  resetReconcile()
  if (props.modelValue) emit('update:modelValue', false)
}

const reconcileDialogVisible = ref(false)
const reconcileFormRef = ref(null)
const reconcileForm = ref({
  result: 'COMPLETED',
  reason: ''
})
const reconcileValidationError = ref('')
const reconcileRules = {
  result: [{ required: true, message: '请选择核对结果', trigger: 'change' }],
  reason: [{ required: true, message: '请填写核对原因', trigger: 'blur' }]
}

function resetReconcile() {
  reconcileDialogVisible.value = false
  reconcileForm.value = { result: 'COMPLETED', reason: '' }
  reconcileValidationError.value = ''
}

watch(() => props.modelValue, visible => {
  if (!visible) resetReconcile()
})

watch(() => props.task?.id, () => {
  resetReconcile()
})

watch(() => props.reconcileSuccessKey, (value, previous) => {
  if (value !== previous) resetReconcile()
})

const openReconcile = result => {
  if (props.reconcileLoading || props.reconcileStale || props.task?.status !== 'RECONCILING') return
  reconcileForm.value = { result, reason: '' }
  reconcileValidationError.value = ''
  reconcileDialogVisible.value = true
}

const submitReconcile = async () => {
  if (props.reconcileLoading || props.reconcileStale || props.task?.status !== 'RECONCILING') return
  reconcileValidationError.value = ''
  let validationResult
  try {
    validationResult = await reconcileFormRef.value?.validate()
  } catch {
    return
  }
  if (validationResult !== true) {
    reconcileValidationError.value = '请修正表单后再提交'
    return
  }

  const reason = reconcileForm.value.reason.trim()
  if (!reason) {
    reconcileValidationError.value = '请填写核对原因'
    return
  }
  if (reason.length > 255) {
    reconcileValidationError.value = '核对原因最多 255 个字符'
    return
  }

  emit('reconcile', {
    result: reconcileForm.value.result,
    reason
  })
}
</script>

<style scoped>
.task-detail-drawer :deep(.t-drawer__body) {
  min-height: 0;
  overflow: hidden;
}

.task-detail-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  gap: var(--app-spacing-3);
}

.task-detail-drawer__identity {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--app-spacing-1);
}

.task-detail-drawer__title-row {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--app-spacing-2);
}

.task-detail-drawer__close {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  color: var(--app-text-secondary);
  border-radius: var(--app-radius);
}

.task-detail-drawer__close :deep(.t-icon) {
  width: 22px;
  height: 22px;
}

.task-detail-drawer__close:hover {
  color: var(--app-text-primary);
  background: var(--app-surface-hover);
}

.task-detail-drawer__name-tooltip,
.task-detail-drawer__value-tooltip {
  display: block;
  min-width: 0;
  flex: 1;
}

.task-detail-drawer__title {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-medium);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-drawer__subtitle,
.task-detail-drawer__field-label,
.task-detail-drawer__resource-meta,
.task-detail-drawer__overview-heading p,
.task-detail-drawer__footer span {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.task-detail-drawer__body {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding-bottom: var(--app-spacing-2);
  flex-direction: column;
  gap: var(--app-spacing-3);
  overflow-y: auto;
}

.task-detail-drawer__loading {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-3);
  padding: var(--app-spacing-2);
}

.task-detail-drawer__loading-text {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.task-detail-drawer__overview {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-2);
  padding: var(--app-spacing-3) var(--app-spacing-4);
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
}

.task-detail-drawer__overview-heading,
.task-detail-drawer__progress-row,
.task-detail-drawer__reason,
.task-detail-drawer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: var(--app-spacing-3);
}

.task-detail-drawer__overview-heading h2,
.task-detail-drawer__section h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-small);
}

.task-detail-drawer__overview-heading p {
  margin: var(--app-spacing-1) 0 0;
}

.task-detail-drawer__progress-row span,
.task-detail-drawer__reason span {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.task-detail-drawer__progress-row strong {
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-small);
}

.task-detail-drawer__reason {
  align-items: flex-start;
  padding-top: var(--app-spacing-2);
  border-top: 1px solid var(--app-border);
}

.task-detail-drawer__reason strong {
  display: -webkit-box;
  overflow: hidden;
  color: var(--td-error-color);
  font-size: var(--td-font-size-body-small);
  text-align: right;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.task-detail-drawer__section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-spacing-2);
}

.task-detail-drawer__resource-grid,
.task-detail-drawer__people-grid,
.task-detail-drawer__timeline-grid {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-spacing-2);
}

.task-detail-drawer__resource-card,
.task-detail-drawer__person,
.task-detail-drawer__timeline-item {
  display: flex;
  min-width: 0;
  padding: var(--app-spacing-3);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
}

.task-detail-drawer__resource-card {
  align-items: flex-start;
  flex-direction: column;
  gap: var(--app-spacing-1);
}

.task-detail-drawer__resource-name {
  display: block;
  width: 100%;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-drawer__person {
  align-items: center;
  gap: var(--app-spacing-2);
}

.task-detail-drawer__person .task-detail-drawer__field-label {
  flex: 0 0 auto;
}

.task-detail-drawer__person strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-drawer__timeline {
  padding-top: var(--app-spacing-2);
  border-top: 1px solid var(--app-border);
}

.task-detail-drawer__timeline-item {
  align-items: flex-start;
  flex-direction: column;
  gap: var(--app-spacing-1);
}

.task-detail-drawer__timeline-item span {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.task-detail-drawer__timeline-item strong {
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-medium);
  font-weight: 500;
}

.task-detail-drawer__technical {
  flex-shrink: 0;
  overflow: hidden;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
}

.task-detail-drawer__technical :deep(.t-collapse-panel__header) {
  min-height: 44px;
  padding: var(--app-spacing-2) var(--app-spacing-3);
  background: var(--app-surface);
}

.task-detail-drawer__technical :deep(.t-collapse-panel__content) {
  padding: 0 var(--app-spacing-3) var(--app-spacing-3);
}

.task-detail-drawer__technical-grid {
  display: grid;
  min-width: 0;
  padding-top: var(--app-spacing-2);
  border-top: 1px solid var(--app-border);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--app-spacing-5);
  row-gap: var(--app-spacing-1);
}

.task-detail-drawer__technical-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  min-width: 0;
  gap: var(--app-spacing-2);
  padding: var(--app-spacing-1) 0;
}

.task-detail-drawer__technical-item span {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.task-detail-drawer__technical-item strong {
  min-width: 0;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-small);
  font-weight: 500;
  text-align: right;
  overflow-wrap: anywhere;
}

.task-detail-drawer__stale-alert,
.task-detail-drawer__form-error,
.task-detail-drawer__error-alert {
  overflow-wrap: anywhere;
}

.task-detail-drawer__footer > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-spacing-1);
}

.task-detail-drawer__footer strong {
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-medium);
}

@media (max-width: 600px) {
  .task-detail-drawer__resource-grid,
  .task-detail-drawer__people-grid,
  .task-detail-drawer__timeline-grid,
  .task-detail-drawer__technical-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .task-detail-drawer__overview-heading,
  .task-detail-drawer__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .task-detail-drawer__footer :deep(.t-button) {
    width: 100%;
  }
}
</style>
