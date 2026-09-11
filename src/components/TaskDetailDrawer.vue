<template>
  <t-drawer
    v-model:visible="drawerVisible"
    :destroy-on-close="true"
    :close-btn="false"
    :close-on-esc-keydown="true"
    :footer="false"
    size="460px"
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
            <StatusTag domain="job" :status="task.status" />
          </div>
          <span v-else class="task-detail-drawer__title">任务详情</span>
          <span v-if="task" class="task-detail-drawer__status-description">{{ statusView.description }}</span>
        </div>
        <t-button variant="text" shape="square" aria-label="关闭任务详情" @click="handleClose">
          <Close />
        </t-button>
      </div>
    </template>

    <div class="task-detail-drawer__body">
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
          :close-btn="false"
          class="task-detail-drawer__reconcile-alert"
        >
          <template #default>设备状态无法自动确认，请人工核对打印结果。</template>
          <template #operation>
            <t-space size="small" break-line class="task-detail-drawer__reconcile-actions">
              <t-button size="small" theme="success" :disabled="reconcileLoading || reconcileStale" @click="openReconcile('COMPLETED')">确认完成</t-button>
              <t-button size="small" theme="danger" variant="outline" :disabled="reconcileLoading || reconcileStale" @click="openReconcile('FAILED')">确认失败</t-button>
              <t-button size="small" theme="warning" variant="outline" :disabled="reconcileLoading || reconcileStale" @click="openReconcile('CANCELLED')">确认取消</t-button>
              <t-button size="small" variant="outline" :disabled="reconcileLoading || reconcileStale" @click="openReconcile('QUEUED')">重新排队</t-button>
            </t-space>
          </template>
        </t-alert>

        <section class="task-detail-drawer__section" aria-labelledby="task-detail-resources">
          <h2 id="task-detail-resources">资源与人员</h2>
          <t-descriptions class="task-detail-drawer__descriptions" bordered :column="1" size="small">
            <t-descriptions-item label="文件">
              <div class="task-detail-drawer__value">
                <t-tooltip :content="detailDisplay.fileName" class="task-detail-drawer__value-tooltip">
                  <span class="task-detail-drawer__value-text">{{ detailDisplay.fileName }}</span>
                </t-tooltip>
                <t-tag size="small" variant="outline" :theme="sourceTagTheme(detailDisplay.sources.fileName)">{{ detailDisplay.sources.fileName }}</t-tag>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="打印机名称">
              <div class="task-detail-drawer__value">
                <t-tooltip :content="detailDisplay.printerName" class="task-detail-drawer__value-tooltip">
                  <span class="task-detail-drawer__value-text">{{ detailDisplay.printerName }}</span>
                </t-tooltip>
                <t-tag size="small" variant="outline" :theme="sourceTagTheme(detailDisplay.sources.printerName)">{{ detailDisplay.sources.printerName }}</t-tag>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="机器编号">
              <div class="task-detail-drawer__value">
                <t-tooltip :content="detailDisplay.machineNumber" class="task-detail-drawer__value-tooltip">
                  <span class="task-detail-drawer__value-text">{{ detailDisplay.machineNumber }}</span>
                </t-tooltip>
                <t-tag size="small" variant="outline" :theme="sourceTagTheme(detailDisplay.sources.machineNumber)">{{ detailDisplay.sources.machineNumber }}</t-tag>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="创建人">
              <div class="task-detail-drawer__value">
                <t-tooltip :content="detailDisplay.creatorUsername" class="task-detail-drawer__value-tooltip">
                  <span class="task-detail-drawer__value-text">{{ detailDisplay.creatorUsername }}</span>
                </t-tooltip>
                <t-tag size="small" variant="outline" :theme="sourceTagTheme(detailDisplay.sources.creatorUsername)">{{ detailDisplay.sources.creatorUsername }}</t-tag>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="操作员">
              <div class="task-detail-drawer__value">
                <t-tooltip :content="detailDisplay.operatorUsername" class="task-detail-drawer__value-tooltip">
                  <span class="task-detail-drawer__value-text">{{ detailDisplay.operatorUsername }}</span>
                </t-tooltip>
                <t-tag size="small" variant="outline" :theme="sourceTagTheme(detailDisplay.sources.operatorUsername)">{{ detailDisplay.sources.operatorUsername }}</t-tag>
              </div>
            </t-descriptions-item>
          </t-descriptions>
        </section>

        <section class="task-detail-drawer__section" aria-labelledby="task-detail-execution">
          <h2 id="task-detail-execution">执行信息</h2>
          <t-descriptions class="task-detail-drawer__descriptions" bordered :column="1" size="small">
            <t-descriptions-item label="状态">
              <div class="task-detail-drawer__status-value">
                <StatusTag domain="job" :status="task.status" />
                <span class="task-detail-drawer__status-description">{{ statusView.description }}</span>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="优先级">{{ formatValue(task.priority) }}</t-descriptions-item>
            <t-descriptions-item label="进度">
              <t-progress v-if="hasValue(task.progress)" :percentage="task.progress" />
              <span v-else>-</span>
            </t-descriptions-item>
            <t-descriptions-item label="创建时间">{{ formatDateTime(task.createdAt) }}</t-descriptions-item>
            <t-descriptions-item label="开始时间">{{ formatDateTime(task.startedAt) }}</t-descriptions-item>
            <t-descriptions-item label="完成时间">{{ formatDateTime(task.completedAt) }}</t-descriptions-item>
            <t-descriptions-item label="更新时间">{{ formatDateTime(task.updatedAt) }}</t-descriptions-item>
            <t-descriptions-item label="失败/核对原因">
              <t-tooltip :content="formatValue(task.errorReason)" class="task-detail-drawer__value-tooltip">
                <span class="task-detail-drawer__long-text task-detail-drawer__error">{{ formatValue(task.errorReason) }}</span>
              </t-tooltip>
            </t-descriptions-item>
          </t-descriptions>
        </section>

        <section class="task-detail-drawer__timeline" aria-labelledby="task-detail-timeline">
          <h2 id="task-detail-timeline">已知时间线</h2>
          <t-timeline>
            <t-timeline-item v-if="hasValue(task.createdAt)" label="任务创建">{{ formatDateTime(task.createdAt) }}</t-timeline-item>
            <t-timeline-item v-if="hasValue(task.startedAt)" label="开始执行">{{ formatDateTime(task.startedAt) }}</t-timeline-item>
            <t-timeline-item v-if="hasValue(task.completedAt)" label="任务完成">{{ formatDateTime(task.completedAt) }}</t-timeline-item>
            <t-timeline-item v-if="hasValue(task.updatedAt)" label="最近更新">{{ formatDateTime(task.updatedAt) }}</t-timeline-item>
          </t-timeline>
          <t-empty
            v-if="!hasValue(task.createdAt) && !hasValue(task.startedAt) && !hasValue(task.completedAt) && !hasValue(task.updatedAt)"
            description="暂无时间记录"
          />
        </section>

        <t-collapse class="task-detail-drawer__technical" :default-value="[]">
          <t-collapse-panel value="technical" header="技术信息">
            <t-descriptions class="task-detail-drawer__descriptions" bordered :column="1" size="small">
              <t-descriptions-item label="任务 ID">{{ formatTechnicalValue(task.id) }}</t-descriptions-item>
              <t-descriptions-item label="文件 ID">{{ formatTechnicalValue(task.fileId) }}</t-descriptions-item>
              <t-descriptions-item label="打印机 ID">{{ formatTechnicalValue(task.printerId) }}</t-descriptions-item>
              <t-descriptions-item label="发起用户 ID">{{ formatTechnicalValue(task.userId) }}</t-descriptions-item>
              <t-descriptions-item label="现场操作员 ID">{{ formatTechnicalValue(task.operatorId) }}</t-descriptions-item>
              <t-descriptions-item label="重试来源任务 ID">{{ formatTechnicalValue(task.retryOfJobId) }}</t-descriptions-item>
              <t-descriptions-item label="根任务 ID">{{ formatTechnicalValue(task.rootJobId) }}</t-descriptions-item>
              <t-descriptions-item label="尝试次数">{{ formatValue(task.attemptNumber) }}</t-descriptions-item>
              <t-descriptions-item v-if="hasValue(task.idempotencyKey)" label="幂等键">{{ formatTechnicalValue(task.idempotencyKey) }}</t-descriptions-item>
              <t-descriptions-item v-if="hasValue(task.eventId)" label="事件 ID">{{ formatTechnicalValue(task.eventId) }}</t-descriptions-item>
              <t-descriptions-item v-if="hasValue(task.sequence)" label="事件序号">{{ formatTechnicalValue(task.sequence) }}</t-descriptions-item>
            </t-descriptions>
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
        <t-select v-model="reconcileForm.result" :disabled="reconcileLoading">
          <t-option value="COMPLETED" label="确认完成" />
          <t-option value="FAILED" label="确认失败" />
          <t-option value="CANCELLED" label="确认取消" />
          <t-option value="QUEUED" label="重新排队" />
        </t-select>
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
import StatusTag from './StatusTag.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  task: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  reconcileLoading: { type: Boolean, default: false },
  reconcileSuccessKey: { type: [String, Number], default: 0 },
  reconcileStale: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'reconcile'])

const drawerVisible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const isTerminal = computed(() => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(props.task?.status))
const detailDisplay = computed(() => getJobDetailDisplay(props.task || {}, isTerminal.value ? 'history' : 'current'))
const statusView = computed(() => getStatusView('job', props.task?.status))

const sourceTagTheme = source => {
  if (source === JOB_DISPLAY_SOURCE.CURRENT) return 'primary'
  if (source === JOB_DISPLAY_SOURCE.SNAPSHOT) return 'warning'
  if (source === JOB_DISPLAY_SOURCE.UNAVAILABLE) return 'danger'
  return 'default'
}

const handleClose = () => {
  resetReconcile()
  if (props.modelValue) emit('update:modelValue', false)
}

const hasValue = value => value !== undefined && value !== null && value !== ''
const formatValue = value => hasValue(value) ? String(value) : '-'
const formatTechnicalValue = value => formatValue(value)

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
  overflow-y: auto;
}

.task-detail-drawer__header {
  display: flex;
  align-items: flex-start;
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

.task-detail-drawer__title-row,
.task-detail-drawer__status-value {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--app-spacing-2);
}

.task-detail-drawer__name-tooltip {
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

.task-detail-drawer__status-description {
  min-width: 0;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  overflow-wrap: anywhere;
}

.task-detail-drawer__body {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  padding-bottom: var(--app-spacing-6);
  flex-direction: column;
  gap: var(--app-spacing-4);
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

.task-detail-drawer__section,
.task-detail-drawer__timeline {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-spacing-3);
}

.task-detail-drawer__section h2,
.task-detail-drawer__timeline h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-small);
}

.task-detail-drawer__reconcile-alert {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-3);
}

.task-detail-drawer__stale-alert,
.task-detail-drawer__form-error {
  overflow-wrap: anywhere;
}

.task-detail-drawer__reconcile-actions {
  width: 100%;
  max-width: 100%;
  flex-wrap: wrap;
}

.task-detail-drawer__descriptions {
  min-width: 0;
  overflow: hidden;
  border-radius: var(--app-radius-medium);
}

.task-detail-drawer__descriptions :deep(.t-descriptions__label),
.task-detail-drawer__descriptions :deep(.t-descriptions__content) {
  min-width: 0;
  max-width: 100%;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.task-detail-drawer__value,
.task-detail-drawer__status-value {
  max-width: 100%;
}

.task-detail-drawer__value {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--app-spacing-2);
}

.task-detail-drawer__value-tooltip {
  display: block;
  min-width: 0;
  flex: 1;
}

.task-detail-drawer__value-text,
.task-detail-drawer__long-text {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-drawer__long-text {
  overflow-wrap: anywhere;
  white-space: normal;
  word-break: break-word;
}

.task-detail-drawer__status-value {
  flex-wrap: wrap;
}

.task-detail-drawer__error-alert {
  overflow-wrap: anywhere;
}

.task-detail-drawer__timeline {
  padding-top: var(--app-spacing-2);
  border-top: 1px solid var(--app-border);
}

.task-detail-drawer__technical {
  flex-shrink: 0;
}

.task-detail-drawer__error {
  color: var(--td-error-color);
}

@media (max-width: 600px) {
  .task-detail-drawer__body {
    gap: var(--app-spacing-3);
  }

  .task-detail-drawer__value {
    align-items: flex-start;
    flex-direction: column;
  }

  .task-detail-drawer__reconcile-actions {
    width: 100%;
  }
}
</style>
