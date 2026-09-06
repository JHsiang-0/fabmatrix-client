<template>
  <t-drawer
    v-model:visible="drawerVisible"
    :destroy-on-close="true"
    :footer="false"
    :close-btn="false"
    :close-on-esc-keydown="true"
    size="520px"
    class="file-detail-drawer"
    @close="handleClose"
  >
    <template #header>
      <div class="file-detail-drawer__header">
        <span class="file-detail-drawer__title">文件详情</span>
        <t-button variant="text" shape="square" aria-label="关闭文件详情" @click="handleClose">
          <Close />
        </t-button>
      </div>
    </template>

    <div class="file-detail-drawer__body">
      <div v-if="loading" class="file-detail-drawer__loading">
        <t-skeleton :loading="true" theme="article" />
      </div>

      <template v-else-if="file">
        <t-alert v-if="error" theme="error" :title="error" :close-btn="false">
          <template #operation>
            <t-button size="small" variant="outline" @click="emit('retry')">重试</t-button>
          </template>
        </t-alert>
        <t-alert
          v-if="file.thumbnailError"
          theme="warning"
          title="缩略图暂不可用，文件元数据仍可查看"
          :close-btn="false"
        />

        <section class="file-detail-drawer__summary" aria-labelledby="file-detail-name">
          <div class="file-detail-drawer__thumbnail">
            <t-image v-if="file.thumbnailUrl" :src="file.thumbnailUrl" :alt="file.originalName" fit="cover">
              <template #error><Document :size="32" /></template>
            </t-image>
            <Document v-else :size="32" />
            <span v-if="!file.thumbnailUrl">暂无缩略图</span>
          </div>

          <div class="file-detail-drawer__identity">
            <h2 id="file-detail-name" :title="file.originalName">{{ file.originalName }}</h2>
            <t-tag :theme="getMaterialTagType(file.materialType)" size="small">
              {{ file.materialType || '未指定' }}
            </t-tag>
          </div>

          <div class="file-detail-drawer__actions">
            <t-button theme="primary" size="small" :icon="renderIcon(Printer)" @click="handlePrint">
              打印
            </t-button>
            <t-button variant="outline" size="small" :icon="renderIcon(Download)" @click="handleDownload">
              下载
            </t-button>
          </div>
        </section>

        <section class="file-detail-drawer__section" aria-labelledby="file-detail-metrics">
          <h3 id="file-detail-metrics">切片摘要</h3>
          <t-descriptions :column="2" size="small" bordered>
            <t-descriptions-item label="预计耗时">{{ formatDuration(file.estTime) }}</t-descriptions-item>
            <t-descriptions-item label="文件大小">{{ formatFileSize(file.fileSize) }}</t-descriptions-item>
            <t-descriptions-item label="耗材重量">{{ formatWeight(file.filamentWeight) }}</t-descriptions-item>
            <t-descriptions-item label="所需线长">{{ formatLength(file.filamentLength) }}</t-descriptions-item>
            <t-descriptions-item label="喷嘴要求">{{ formatNozzle(file.nozzleSize) }}</t-descriptions-item>
            <t-descriptions-item label="上传时间">{{ formatDateTime(file.createdAt) }}</t-descriptions-item>
          </t-descriptions>
        </section>

        <t-divider />

        <section class="file-detail-drawer__section" aria-labelledby="file-detail-parameters">
          <h3 id="file-detail-parameters">切片参数</h3>
          <t-descriptions :column="2" size="small" bordered>
            <t-descriptions-item label="常规层高">{{ formatHeight(file.layerHeight) }}</t-descriptions-item>
            <t-descriptions-item label="首层层高">{{ formatHeight(file.firstLayerHeight) }}</t-descriptions-item>
            <t-descriptions-item label="喷嘴温度">{{ formatTemperature(file.nozzleTemp) }}</t-descriptions-item>
            <t-descriptions-item label="首层喷嘴温度">{{ formatTemperature(file.firstLayerNozzleTemp) }}</t-descriptions-item>
            <t-descriptions-item label="热床温度">{{ formatTemperature(file.bedTemp) }}</t-descriptions-item>
            <t-descriptions-item label="首层热床温度">{{ formatTemperature(file.firstLayerBedTemp) }}</t-descriptions-item>
          </t-descriptions>
        </section>

        <t-divider />

        <section class="file-detail-drawer__section" aria-labelledby="file-detail-jobs">
          <div class="file-detail-drawer__section-heading">
            <h3 id="file-detail-jobs">关联打印任务</h3>
            <t-tag v-if="!jobsLoading" theme="default" variant="light" size="small">{{ jobs.length }} 条</t-tag>
          </div>
          <t-alert v-if="jobsError" theme="error" :title="jobsError" :close-btn="false">
            <template #operation>
              <t-button size="small" variant="outline" @click="emit('retry-jobs')">重试</t-button>
            </template>
          </t-alert>
          <t-skeleton v-else-if="jobsLoading" :loading="true" theme="paragraph" />
          <t-table v-else-if="jobs.length > 0" :data="jobs" :columns="jobColumns" row-key="id" size="small" bordered>
            <template #status="slotProps">
              <t-tag :theme="getJobStatusTagType(slotProps.row.status)" size="small">
                {{ slotProps.row.status || '-' }}
              </t-tag>
            </template>
            <template #createdAt="slotProps">
              {{ formatDateTime(slotProps.row.createdAt) }}
            </template>
          </t-table>
          <t-empty v-else description="暂无关联任务" />
        </section>
      </template>

      <t-empty v-else description="未选择文件" />
    </div>
  </t-drawer>
</template>

<script setup>
import { computed } from 'vue'
import {
  DownloadIcon as Download,
  FileIcon as Document,
  PrintIcon as Printer,
  CloseIcon as Close
} from 'tdesign-icons-vue-next'
import { renderIcon } from '@/utils/tdesign'
import { formatDuration, formatFileSize, formatDateTime } from '@/utils/formatters'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  file: { type: Object, default: () => null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  jobs: { type: Array, default: () => [] },
  jobsLoading: { type: Boolean, default: false },
  jobsError: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'download', 'closed', 'print', 'retry', 'retry-jobs'])

const drawerVisible = computed({
  get: () => props.modelValue,
  set: value => handleVisibleChange(value)
})

const jobColumns = [
  { colKey: 'id', title: '任务 ID', width: 80 },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'createdAt', title: '创建时间', ellipsis: true }
]

const handleVisibleChange = value => {
  emit('update:modelValue', value)
  if (!value) emit('closed')
}

const handleClose = () => {
  if (props.modelValue) handleVisibleChange(false)
}

const handlePrint = () => emit('print', props.file)
const handleDownload = () => emit('download', props.file)
const formatWeight = value => value === undefined || value === null ? '-' : `${Number(value).toFixed(1)}g`
const formatLength = value => value === undefined || value === null ? '-' : `${Number(value).toFixed(2)}m`
const formatNozzle = value => value === undefined || value === null ? '-' : `${Number(value).toFixed(1)}mm`
const formatHeight = value => value === undefined || value === null ? '-' : `${Number(value).toFixed(2)}mm`
const formatTemperature = value => value === undefined || value === null ? '-' : `${Number(value).toFixed(0)}°C`

const getMaterialTagType = materialType => ({
  PLA: 'success',
  ABS: 'warning',
  PETG: 'primary',
  TPU: 'default',
  尼龙: 'danger'
}[materialType] || 'default')

const getJobStatusTagType = status => ({
  COMPLETED: 'success',
  PRINTING: 'primary',
  QUEUED: 'warning',
  ASSIGNED: 'warning',
  FAILED: 'danger',
  CANCELLED: 'default',
  PAUSED: 'warning'
}[status] || 'default')
</script>

<style scoped>
.file-detail-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.file-detail-drawer__title {
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-medium);
  font-weight: 700;
}

.file-detail-drawer__body {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: var(--app-spacing-4);
}

.file-detail-drawer__loading {
  padding: var(--app-spacing-2);
}

.file-detail-drawer__summary {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--app-spacing-3);
}

.file-detail-drawer__thumbnail {
  display: flex;
  width: 88px;
  height: 88px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  font-size: var(--td-font-size-body-small);
}

.file-detail-drawer__thumbnail :deep(.t-image) {
  width: 100%;
  height: 100%;
}

.file-detail-drawer__identity {
  min-width: 0;
}

.file-detail-drawer__identity h2,
.file-detail-drawer__section h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-weight: 700;
}

.file-detail-drawer__identity h2 {
  overflow: hidden;
  font-size: var(--td-font-size-title-medium);
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-detail-drawer__actions {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: var(--app-spacing-2);
}

.file-detail-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-3);
}

.file-detail-drawer__section h3 {
  font-size: var(--td-font-size-title-small);
}

.file-detail-drawer__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-3);
}

.file-detail-drawer :deep(.t-divider) {
  margin: 0;
}

@media (max-width: 460px) {
  .file-detail-drawer__summary {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .file-detail-drawer__thumbnail {
    width: 72px;
    height: 72px;
  }

  .file-detail-drawer__actions {
    grid-column: 1 / -1;
    align-items: stretch;
    flex-direction: row;
  }
}
</style>
