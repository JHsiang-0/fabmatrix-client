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
        <t-button
          class="file-detail-drawer__close"
          variant="text"
          shape="square"
          size="large"
          aria-label="关闭文件详情"
          @click="handleClose"
        >
          <Close size="20px" />
        </t-button>
      </div>
    </template>

    <div class="file-detail-drawer__body">
      <div v-if="loading" class="file-detail-drawer__loading">
        <t-skeleton :loading="true" theme="article" />
      </div>

      <template v-else-if="file">
        <t-alert v-if="error" theme="error" :title="error" :close-btn="false" class="file-detail-drawer__error-alert">
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
            <div class="file-detail-drawer__security-meta">
              <t-tag size="small" :theme="file.visibility === 'PUBLIC' ? 'primary' : 'default'">
                {{ file.visibility === 'PUBLIC' ? '公共文件' : '私有文件' }}
              </t-tag>
              <span>创建者：{{ file.userId || file.ownerId || '-' }}</span>
            </div>
          </div>
        </section>

        <t-divider class="file-detail-drawer__summary-divider" />

        <section
          class="file-detail-drawer__section file-detail-drawer__info-card"
          aria-labelledby="file-detail-metrics file-detail-parameters"
        >
          <div class="file-detail-drawer__info-section" aria-labelledby="file-detail-metrics">
            <h3 id="file-detail-metrics">切片摘要</h3>
            <div class="file-detail-drawer__metric-grid">
              <div
                v-for="item in summaryItems"
                :key="item.label"
                class="file-detail-drawer__metric-item"
                :class="{ 'is-compact': item.compact }"
              >
                <span class="file-detail-drawer__metric-label">{{ item.label }}</span>
                <t-tooltip class="file-detail-drawer__value-tooltip" :content="item.value">
                  <strong class="file-detail-drawer__metric-value">{{ item.value }}</strong>
                </t-tooltip>
              </div>
            </div>
          </div>

          <t-divider class="file-detail-drawer__info-divider" />

          <div class="file-detail-drawer__info-section" aria-labelledby="file-detail-parameters">
            <h3 id="file-detail-parameters">切片参数</h3>
            <div class="file-detail-drawer__parameter-grid">
              <div v-for="item in parameterItems" :key="item.label" class="file-detail-drawer__parameter-item">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="file-detail-drawer__section file-detail-drawer__jobs-section" aria-labelledby="file-detail-jobs">
          <div class="file-detail-drawer__section-heading">
            <h3 id="file-detail-jobs">关联打印任务</h3>
            <span v-if="!jobsLoading" class="file-detail-drawer__jobs-count">共 {{ displayJobCount }} 条</span>
          </div>
          <t-alert v-if="jobsError" theme="error" :title="jobsError" :close-btn="false">
            <template #operation>
              <t-button size="small" variant="outline" @click="emit('retry-jobs')">重试</t-button>
            </template>
          </t-alert>
          <t-skeleton v-else-if="jobsLoading" :loading="true" theme="paragraph" />
          <div v-else-if="jobs.length > 0" class="file-detail-drawer__jobs-table">
            <t-table :data="jobs" :columns="jobColumns" row-key="id" table-layout="fixed" size="small" hover>
            <template #id="slotProps">
              <div class="file-detail-drawer__job-identity">
                <strong>#{{ slotProps.row.id ?? '-' }}</strong>
                <t-tooltip class="file-detail-drawer__value-tooltip" :content="getJobPrinterLabel(slotProps.row)">
                  <span>{{ getJobPrinterLabel(slotProps.row) }}</span>
                </t-tooltip>
              </div>
            </template>
            <template #status="slotProps">
              <StatusTag domain="job" :status="slotProps.row.status" :show-icon="false" />
            </template>
            <template #createdAt="slotProps">
              <t-tooltip class="file-detail-drawer__value-tooltip" :content="formatDateTimeValue(slotProps.row.createdAt)"><span class="file-detail-drawer__value">{{ formatDateTimeValue(slotProps.row.createdAt) }}</span></t-tooltip>
            </template>
            </t-table>
          </div>
          <t-empty v-else description="暂无关联任务" />
        </section>

        <div class="file-detail-drawer__footer-actions" aria-label="文件操作">
          <t-button v-if="file.canDownload === true" variant="outline" size="large" :icon="renderIcon(Download)" @click="handleDownload">
            下载
          </t-button>
          <t-button v-if="file.canPrint === true" theme="primary" size="large" :icon="renderIcon(Printer)" @click="handlePrint">
            打印
          </t-button>
          <t-empty v-if="file.canDownload !== true && file.canPrint !== true" description="当前无可用操作" />
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
import StatusTag from '@/components/StatusTag.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  file: { type: Object, default: () => null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  jobs: { type: Array, default: () => [] },
  jobsTotal: { type: Number, default: 0 },
  jobsLoading: { type: Boolean, default: false },
  jobsError: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'download', 'closed', 'print', 'retry', 'retry-jobs'])

const drawerVisible = computed({
  get: () => props.modelValue,
  set: value => handleVisibleChange(value)
})

const jobColumns = [
  { colKey: 'id', title: '任务', width: '38%', ellipsis: true },
  { colKey: 'status', title: '状态', width: '24%', ellipsis: true },
  { colKey: 'createdAt', title: '创建时间', width: '38%', ellipsis: true }
]

const displayJobCount = computed(() => Math.max(props.jobsTotal || 0, props.jobs.length))
const summaryItems = computed(() => [
  { label: '预计耗时', value: formatDurationValue(props.file?.estTime) },
  { label: '耗材重量', value: formatWeight(props.file?.filamentWeight) },
  { label: '所需线长', value: formatLength(props.file?.filamentLength) },
  { label: '文件大小', value: formatFileSizeValue(props.file?.fileSize) },
  { label: '喷嘴要求', value: formatNozzle(props.file?.nozzleSize) },
  { label: '上传时间', value: formatDateTimeValue(props.file?.createdAt), compact: true }
])
const parameterItems = computed(() => [
  { label: '常规层高', value: formatHeight(props.file?.layerHeight) },
  { label: '首层层高', value: formatHeight(props.file?.firstLayerHeight) },
  { label: '喷嘴温度', value: formatTemperature(props.file?.nozzleTemp) },
  { label: '首层喷嘴温度', value: formatTemperature(props.file?.firstLayerNozzleTemp) },
  { label: '热床温度', value: formatTemperature(props.file?.bedTemp) },
  { label: '首层热床温度', value: formatTemperature(props.file?.firstLayerBedTemp) }
])

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
const getJobPrinterLabel = job => {
  if (!job?.printerName) return '未分配打印机'
  return job.machineNumber ? `${job.printerName} · ${job.machineNumber}` : job.printerName
}

const getMaterialTagType = materialType => ({
  PLA: 'success',
  ABS: 'warning',
  PETG: 'primary',
  TPU: 'default',
  尼龙: 'danger'
}[materialType] || 'default')

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

.file-detail-drawer__close {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  color: var(--app-text-secondary);
  border-radius: var(--app-radius);
}

.file-detail-drawer__close :deep(.t-icon) {
  width: 22px;
  height: 22px;
}

.file-detail-drawer__close:hover {
  color: var(--app-text-primary);
  background: var(--app-surface-hover);
}

.file-detail-drawer__body {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: var(--app-spacing-3);
  padding-bottom: var(--app-spacing-2);
  overflow: hidden;
}

:global(.file-detail-drawer .t-drawer__body) {
  overflow: hidden;
  scrollbar-color: var(--app-scrollbar-thumb) var(--app-scrollbar-track);
  scrollbar-width: thin;
}

.file-detail-drawer__error-alert {
  overflow-wrap: anywhere;
}

.file-detail-drawer__loading {
  padding: var(--app-spacing-2);
}

.file-detail-drawer__summary {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  align-items: center;
  min-width: 0;
  flex-shrink: 0;
  gap: var(--app-spacing-3);
}

.file-detail-drawer__thumbnail {
  display: flex;
  width: 76px;
  height: 76px;
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
  overflow: hidden;
}

.file-detail-drawer__name-tooltip,
.file-detail-drawer__value-tooltip {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.file-detail-drawer__material-tooltip {
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

.file-detail-drawer__security-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--app-spacing-1);
  margin-top: var(--app-spacing-1);
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.file-detail-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-2);
}

.file-detail-drawer__info-card {
  flex-shrink: 0;
  padding: var(--app-spacing-3);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
}

.file-detail-drawer__info-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-spacing-2);
}

.file-detail-drawer__info-divider {
  margin: var(--app-spacing-1) 0;
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

:global(.file-detail-drawer .t-divider) {
  flex: 0 0 1px;
  height: 1px;
  min-height: 1px;
  margin: 0;
}

.file-detail-drawer__metric-grid,
.file-detail-drawer__parameter-grid {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-spacing-2);
}

.file-detail-drawer__metric-item {
  display: flex;
  min-height: 48px;
  min-width: 0;
  justify-content: center;
  flex-direction: column;
  gap: 2px;
  padding: var(--app-spacing-2);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-small);
}

.file-detail-drawer__metric-label,
.file-detail-drawer__parameter-item span {
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-detail-drawer__metric-value {
  display: block;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-small);
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-detail-drawer__metric-item.is-compact .file-detail-drawer__metric-value {
  font-size: var(--td-font-size-body-small);
}

.file-detail-drawer__parameter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: var(--app-spacing-1);
  padding: 6px var(--app-spacing-2);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-small);
}

.file-detail-drawer__parameter-item strong {
  flex: 0 0 auto;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-medium);
  font-weight: 600;
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

.file-detail-drawer__jobs-section {
  min-height: 0;
  flex: 0 1 auto;
  overflow: hidden;
}

.file-detail-drawer__jobs-count {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.file-detail-drawer__jobs-table {
  width: 100%;
  min-height: 0;
  min-width: 0;
  max-height: 220px;
  flex: 0 1 auto;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  scrollbar-color: var(--app-scrollbar-thumb) var(--app-scrollbar-track);
  scrollbar-width: thin;
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

.file-detail-drawer__jobs-table :deep(.t-table__th),
.file-detail-drawer__jobs-table :deep(.t-table__td) {
  padding: var(--app-spacing-2) var(--app-spacing-3);
  border-right: 0;
}

.file-detail-drawer__jobs-table :deep(.t-table__th) {
  color: var(--app-text-secondary);
  font-weight: 500;
}

.file-detail-drawer__job-identity {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.file-detail-drawer__job-identity strong {
  color: var(--app-text-primary);
  font-weight: 600;
}

.file-detail-drawer__job-identity span {
  display: block;
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-detail-drawer__jobs-table :deep(.app-status-tag) {
  max-width: 100%;
}

.file-detail-drawer__footer-actions {
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  flex-wrap: wrap;
  gap: var(--app-spacing-2);
  margin-top: auto;
  padding-top: var(--app-spacing-2);
  flex-shrink: 0;
  border-top: 1px solid var(--app-border);
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

  .file-detail-drawer__metric-grid,
  .file-detail-drawer__parameter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .file-detail-drawer__footer-actions {
    flex-direction: column;
  }

  .file-detail-drawer__footer-actions :deep(.t-button) {
    width: 100%;
  }
}

@media (max-height: 720px) {
  :global(.file-detail-drawer .t-drawer__body) {
    overflow-y: auto;
  }

  .file-detail-drawer__body {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }

  .file-detail-drawer__jobs-section {
    min-height: 0;
  }

  .file-detail-drawer__jobs-table {
    max-height: 180px;
  }
}
</style>
