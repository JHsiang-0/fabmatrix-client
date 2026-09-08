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
            <t-tooltip
              class="file-detail-drawer__name-tooltip"
              :content="String(file.originalName || '未命名文件')"
            >
              <h2 id="file-detail-name">{{ file.originalName || '未命名文件' }}</h2>
            </t-tooltip>
            <t-tooltip
              class="file-detail-drawer__material-tooltip"
              :content="String(file.materialType || '未指定')"
            >
              <t-tag
                :theme="getMaterialTagType(file.materialType)"
                size="small"
                class="file-detail-drawer__material-tag"
              >
                {{ file.materialType || '未指定' }}
              </t-tag>
            </t-tooltip>
          </div>
        </section>

        <t-divider class="file-detail-drawer__summary-divider" />

        <section class="file-detail-drawer__section file-detail-drawer__info-card" aria-labelledby="file-detail-metrics">
          <h3 id="file-detail-metrics">切片摘要</h3>
          <t-descriptions
            class="file-detail-drawer__descriptions"
            :column="3"
            colon
            layout="horizontal"
            item-layout="horizontal"
            table-layout="auto"
            size="small"
            :bordered="false"
          >
            <t-descriptions-item label="预计耗时"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatDurationValue(file.estTime)"><span class="file-detail-drawer__value">{{ formatDurationValue(file.estTime) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="文件大小"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatFileSizeValue(file.fileSize)"><span class="file-detail-drawer__value">{{ formatFileSizeValue(file.fileSize) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="耗材重量"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatWeight(file.filamentWeight)"><span class="file-detail-drawer__value">{{ formatWeight(file.filamentWeight) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="所需线长"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatLength(file.filamentLength)"><span class="file-detail-drawer__value">{{ formatLength(file.filamentLength) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="喷嘴要求"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatNozzle(file.nozzleSize)"><span class="file-detail-drawer__value">{{ formatNozzle(file.nozzleSize) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="上传时间"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatDateTimeValue(file.createdAt)"><span class="file-detail-drawer__value">{{ formatDateTimeValue(file.createdAt) }}</span></t-tooltip></t-descriptions-item>
          </t-descriptions>
        </section>

        <t-divider />

        <section class="file-detail-drawer__section file-detail-drawer__info-card" aria-labelledby="file-detail-parameters">
          <h3 id="file-detail-parameters">切片参数</h3>
          <t-descriptions
            class="file-detail-drawer__descriptions"
            :column="3"
            colon
            layout="horizontal"
            item-layout="horizontal"
            table-layout="auto"
            size="small"
            :bordered="false"
          >
            <t-descriptions-item label="常规层高"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatHeight(file.layerHeight)"><span class="file-detail-drawer__value">{{ formatHeight(file.layerHeight) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="首层层高"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatHeight(file.firstLayerHeight)"><span class="file-detail-drawer__value">{{ formatHeight(file.firstLayerHeight) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="喷嘴温度"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatTemperature(file.nozzleTemp)"><span class="file-detail-drawer__value">{{ formatTemperature(file.nozzleTemp) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="首层喷嘴温度"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatTemperature(file.firstLayerNozzleTemp)"><span class="file-detail-drawer__value">{{ formatTemperature(file.firstLayerNozzleTemp) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="热床温度"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatTemperature(file.bedTemp)"><span class="file-detail-drawer__value">{{ formatTemperature(file.bedTemp) }}</span></t-tooltip></t-descriptions-item>
            <t-descriptions-item label="首层热床温度"><t-tooltip class="file-detail-drawer__value-tooltip" :content="formatTemperature(file.firstLayerBedTemp)"><span class="file-detail-drawer__value">{{ formatTemperature(file.firstLayerBedTemp) }}</span></t-tooltip></t-descriptions-item>
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
          <div v-else-if="jobs.length > 0" class="file-detail-drawer__jobs-table">
            <t-table :data="jobs" :columns="jobColumns" row-key="id" table-layout="fixed" size="small" bordered>
            <template #id="slotProps">
              <t-tooltip class="file-detail-drawer__value-tooltip" :content="String(slotProps.row.id ?? '-')"><span class="file-detail-drawer__value">{{ slotProps.row.id ?? '-' }}</span></t-tooltip>
            </template>
            <template #status="slotProps">
              <t-tooltip class="file-detail-drawer__job-status-tooltip" :content="String(slotProps.row.status || '-')">
                <t-tag :theme="getJobStatusTagType(slotProps.row.status)" size="small" class="file-detail-drawer__job-status-tag">
                  {{ slotProps.row.status || '-' }}
                </t-tag>
              </t-tooltip>
            </template>
            <template #createdAt="slotProps">
              <t-tooltip class="file-detail-drawer__value-tooltip" :content="formatDateTimeValue(slotProps.row.createdAt)"><span class="file-detail-drawer__value">{{ formatDateTimeValue(slotProps.row.createdAt) }}</span></t-tooltip>
            </template>
            </t-table>
          </div>
          <t-empty v-else description="暂无关联任务" />
        </section>

        <div class="file-detail-drawer__footer-actions" aria-label="文件操作">
          <t-button variant="outline" size="large" :icon="renderIcon(Download)" @click="handleDownload">
            下载
          </t-button>
          <t-button theme="primary" size="large" :icon="renderIcon(Printer)" @click="handlePrint">
            打印
          </t-button>
        </div>
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
  { colKey: 'id', title: '任务 ID', width: '25%', ellipsis: true },
  { colKey: 'status', title: '状态', width: '25%', ellipsis: true },
  { colKey: 'createdAt', title: '创建时间', width: '50%', ellipsis: true }
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
const isEmptyValue = value => value === undefined || value === null
const formatDurationValue = value => isEmptyValue(value) ? '-' : formatDuration(value)
const formatFileSizeValue = value => isEmptyValue(value) ? '-' : formatFileSize(value)
const formatDateTimeValue = value => isEmptyValue(value) ? '-' : formatDateTime(value)
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
  gap: var(--app-spacing-1);
}

.file-detail-drawer__loading {
  padding: var(--app-spacing-2);
}

.file-detail-drawer__summary {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: var(--app-spacing-2);
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

.file-detail-drawer__name-tooltip,
.file-detail-drawer__value-tooltip {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.file-detail-drawer__material-tooltip,
.file-detail-drawer__job-status-tooltip {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
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

.file-detail-drawer__material-tag {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-detail-drawer__job-status-tag {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-detail-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-1);
}

.file-detail-drawer__info-card {
  padding: var(--app-spacing-1) var(--app-spacing-2);
  background: var(--td-bg-color-secondarycontainer);
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
}

.file-detail-drawer__section h3 {
  font-size: var(--td-font-size-title-small);
  line-height: 1.2;
}

.file-detail-drawer__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-2);
}

.file-detail-drawer :deep(.t-divider) {
  flex: 0 0 1px;
  height: 1px;
  min-height: 1px;
  margin: -2px 0;
}

.file-detail-drawer__descriptions {
  width: 100%;
  min-width: 0;
}

.file-detail-drawer__descriptions :deep(.t-descriptions__body) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.file-detail-drawer__descriptions :deep(.t-descriptions__body > tbody > tr > td) {
  padding: var(--app-spacing-1) 0;
  line-height: 1.25;
}

.file-detail-drawer__descriptions :deep(.t-descriptions__label) {
  min-width: 0;
  width: 1%;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  word-break: keep-all;
}

.file-detail-drawer__descriptions :deep(.t-descriptions__content) {
  min-width: 0;
  width: auto;
  max-width: 100%;
  overflow: hidden;
  word-break: break-word;
}

.file-detail-drawer__descriptions :deep(.t-descriptions__content > *) {
  min-width: 0;
  max-width: 100%;
}

.file-detail-drawer__value {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
  white-space: nowrap;
}

.file-detail-drawer__jobs-table {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.file-detail-drawer__jobs-table :deep(.t-table),
.file-detail-drawer__jobs-table :deep(.t-table__content) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

.file-detail-drawer__jobs-table :deep(.t-table__body),
.file-detail-drawer__jobs-table :deep(.t-table__header) {
  table-layout: fixed;
}

.file-detail-drawer__footer-actions {
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  flex-wrap: wrap;
  gap: var(--app-spacing-2);
  margin-top: auto;
  padding-top: var(--app-spacing-2);
}

.file-detail-drawer__footer-actions :deep(.t-button) {
  flex: 1 1 0;
  min-width: 0;
}

@media (max-width: 460px) {
  .file-detail-drawer__summary {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .file-detail-drawer__thumbnail {
    width: 72px;
    height: 72px;
  }

  .file-detail-drawer__footer-actions {
    flex-direction: column;
  }

  .file-detail-drawer__footer-actions :deep(.t-button) {
    width: 100%;
  }
}
</style>
