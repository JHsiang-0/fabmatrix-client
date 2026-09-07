<template>
  <t-drawer
    v-model:visible="drawerVisible"
    :destroy-on-close="true"
    :close-btn="false"
    :close-on-esc-keydown="true"
    size="460px"
    class="task-detail-drawer"
    @close="handleClose"
  >
    <template #header>
      <div class="task-detail-drawer__header">
        <span class="task-detail-drawer__title">任务详情</span>
        <t-button variant="text" shape="square" aria-label="关闭任务详情" @click="handleClose">
          <Close />
        </t-button>
      </div>
    </template>

    <div class="task-detail-drawer__body">
      <div v-if="loading" class="task-detail-drawer__loading">
        <t-skeleton :loading="true" theme="article" />
      </div>
      <template v-else-if="task">
        <t-alert v-if="error" theme="error" :title="error" :close-btn="false" />
        <t-alert
          v-if="task.status === 'RECONCILING'"
          theme="warning"
          :close-btn="false"
          class="task-detail-drawer__reconcile-alert"
        >
          <template #default>设备状态无法自动确认，请人工核对打印结果。</template>
          <template #operation>
            <t-space size="small" break-line>
              <t-button size="small" theme="success" :disabled="reconcileLoading" @click="openReconcile('COMPLETED')">确认完成</t-button>
              <t-button size="small" theme="danger" variant="outline" :disabled="reconcileLoading" @click="openReconcile('FAILED')">确认失败</t-button>
              <t-button size="small" theme="warning" variant="outline" :disabled="reconcileLoading" @click="openReconcile('CANCELLED')">确认取消</t-button>
              <t-button size="small" variant="outline" :disabled="reconcileLoading" @click="openReconcile('QUEUED')">重新排队</t-button>
            </t-space>
          </template>
        </t-alert>

        <t-descriptions bordered :column="1" size="small">
          <t-descriptions-item label="任务 ID">#{{ task.id }}</t-descriptions-item>
          <t-descriptions-item label="文件 ID">{{ formatValue(task.fileId) }}</t-descriptions-item>
          <t-descriptions-item label="打印机 ID">{{ formatValue(task.printerId) }}</t-descriptions-item>
          <t-descriptions-item label="发起用户 ID">{{ formatValue(task.userId) }}</t-descriptions-item>
          <t-descriptions-item label="现场操作员 ID">{{ formatValue(task.operatorId) }}</t-descriptions-item>
          <t-descriptions-item label="状态"><StatusTag domain="job" :status="task.status" /></t-descriptions-item>
          <t-descriptions-item label="优先级">{{ formatValue(task.priority) }}</t-descriptions-item>
          <t-descriptions-item label="进度">
            <t-progress v-if="hasValue(task.progress)" :percentage="task.progress" />
            <span v-else>-</span>
          </t-descriptions-item>
          <t-descriptions-item label="创建时间">{{ formatDateTime(task.createdAt) }}</t-descriptions-item>
          <t-descriptions-item label="开始时间">{{ formatDateTime(task.startedAt) }}</t-descriptions-item>
          <t-descriptions-item label="完成时间">{{ formatDateTime(task.completedAt) }}</t-descriptions-item>
          <t-descriptions-item label="更新时间">{{ formatDateTime(task.updatedAt) }}</t-descriptions-item>
          <t-descriptions-item v-if="hasValue(task.errorReason)" label="失败/核对原因">
            <span class="task-detail-drawer__error">{{ task.errorReason }}</span>
          </t-descriptions-item>
        </t-descriptions>

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
      </template>
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
import { computed, ref } from 'vue'
import { CloseIcon as Close } from 'tdesign-icons-vue-next'
import { formatDateTime } from '@/utils/formatters'
import StatusTag from './StatusTag.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  task: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  reconcileLoading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'reconcile'])

const drawerVisible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const handleClose = () => {
  if (props.modelValue) emit('update:modelValue', false)
}

const hasValue = value => value !== undefined && value !== null && value !== ''
const formatValue = value => hasValue(value) ? value : '-'

const reconcileDialogVisible = ref(false)
const reconcileFormRef = ref(null)
const reconcileForm = ref({
  result: 'COMPLETED',
  reason: ''
})
const reconcileRules = {
  result: [{ required: true, message: '请选择核对结果', trigger: 'change' }],
  reason: [
    { required: true, message: '请填写核对原因', trigger: 'blur' },
    { max: 255, message: '核对原因最多 255 个字符', trigger: 'blur' }
  ]
}

const openReconcile = result => {
  if (props.reconcileLoading || props.task?.status !== 'RECONCILING') return
  reconcileForm.value = { result, reason: '' }
  reconcileDialogVisible.value = true
}

const submitReconcile = async () => {
  if (props.reconcileLoading || props.task?.status !== 'RECONCILING') return
  try {
    await reconcileFormRef.value?.validate()
  } catch {
    return
  }

  emit('reconcile', {
    result: reconcileForm.value.result,
    reason: reconcileForm.value.reason.trim()
  })
  reconcileDialogVisible.value = false
}
</script>

<style scoped>
.task-detail-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.task-detail-drawer__title {
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-medium);
  font-weight: 700;
}

.task-detail-drawer__body {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: var(--app-spacing-4);
}

.task-detail-drawer__loading {
  padding: var(--app-spacing-2);
}

.task-detail-drawer__reconcile-alert {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-3);
}

.task-detail-drawer__timeline {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-3);
  padding-top: var(--app-spacing-2);
  border-top: 1px solid var(--app-border);
}

.task-detail-drawer__timeline h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-small);
}

.task-detail-drawer__error {
  color: var(--td-error-color);
}
</style>
