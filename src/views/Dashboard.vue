<template>
  <div class="dashboard-page">
    <header class="dashboard-heading">
      <div>
        <h1 class="app-route-title">总览</h1>
        <p class="dashboard-heading__description">基于打印机 REST 快照与实时状态的生产概览</p>
      </div>
      <t-space class="dashboard-heading__actions">
        <t-button :loading="loading" :icon="renderIcon(RefreshIcon)" @click="fetchOverview">刷新数据</t-button>
        <t-button theme="primary" @click="goTo('/printers')">
          <template #icon><PrintIcon /></template>
          设备管理
        </t-button>
      </t-space>
    </header>

    <AsyncState
      v-if="!hasLoadedOnce"
      :loading="loading"
      :error="loadError"
      :empty="!loading && !loadError"
      empty-description="暂无可用概览数据"
      @retry="fetchOverview"
    />

    <template v-else>
      <t-alert v-if="loadError" class="dashboard-alert" theme="warning" :close-btn="false">
        <template #default>{{ loadError }}</template>
        <template #operation>
          <t-button size="small" variant="outline" :loading="loading" @click="fetchOverview">重试</t-button>
        </template>
      </t-alert>

      <section class="dashboard-meta" aria-label="实时数据状态">
        <t-space size="small">
          <span class="dashboard-meta__label">实时连接</span>
          <t-tag :theme="connectionTheme" variant="light">{{ connectionLabel }}</t-tag>
        </t-space>
        <span>最后更新：{{ lastUpdateLabel }}</span>
      </section>

      <section class="stat-grid" aria-label="设备和任务统计">
        <div
          v-for="stat in statCards"
          :key="stat.key"
          class="stat-card"
          :class="[`stat-card--${stat.tone}`, { 'stat-card--interactive': stat.to }]"
          :role="stat.to ? 'button' : undefined"
          :tabindex="stat.to ? 0 : undefined"
          :aria-label="stat.to ? `查看${stat.label}` : undefined"
          @click="stat.to && goTo(stat.to)"
          @keydown.enter.prevent="stat.to && goTo(stat.to)"
          @keydown.space.prevent="stat.to && goTo(stat.to)"
        >
          <div class="stat-card__body">
            <div class="stat-card__topline">
              <span class="stat-card__label">{{ stat.label }}</span>
              <span class="stat-card__icon"><component :is="stat.icon" :size="22" /></span>
            </div>
            <div class="stat-card__value">{{ stat.value }}</div>
            <div class="stat-card__footer">
              <span>{{ stat.description }}</span>
              <ChevronRightIcon :size="16" />
            </div>
          </div>
        </div>
      </section>

      <section class="dashboard-grid">
        <t-card bordered class="dashboard-card trend-card">
          <template #header>
            <div class="card-heading">
              <div>
                <h2>打印任务趋势</h2>
              </div>
              <t-tag theme="primary" variant="light">任务统计</t-tag>
            </div>
          </template>
          <div v-if="trendData.length" class="trend-chart">
            <svg viewBox="0 0 640 230" role="img" aria-label="近七日打印任务趋势图">
              <line
                v-for="line in chartGridLines"
                :key="line"
                x1="24"
                x2="616"
                :y1="line"
                :y2="line"
                class="chart-grid-line"
              />
              <polygon :points="chartAreaPoints" class="chart-area" />
              <polyline :points="chartPoints" class="chart-line" />
              <circle
                v-for="point in chartPointList"
                :key="point.label"
                :cx="point.x"
                :cy="point.y"
                r="4"
                class="chart-point"
              />
            </svg>
            <div class="chart-labels">
              <span v-for="item in trendData" :key="item.key">{{ item.label }}</span>
            </div>
          </div>
          <t-empty v-else description="近 7 日暂无任务记录" />
        </t-card>

        <t-card bordered class="dashboard-card status-card">
          <template #header>
            <div class="card-heading">
              <div>
                <h2>设备状态分布</h2>
                <p>实时状态优先，断开时回退到 REST 快照</p>
              </div>
            </div>
          </template>
          <t-alert
            v-if="printerLoadError && !totalPrinters"
            class="status-state status-state--error"
            theme="error"
            :close-btn="false"
          >
            <template #default>{{ printerLoadError }}</template>
            <template #operation>
              <t-button size="small" variant="outline" :loading="loading" @click="fetchOverview">重新加载</t-button>
            </template>
          </t-alert>
          <div v-else-if="totalPrinters" class="status-overview">
            <div class="status-donut" :style="donutStyle">
              <div class="status-donut__content">
                <strong>{{ totalPrinters }}</strong>
                <span>台设备</span>
              </div>
            </div>
            <div class="status-legend">
              <div v-for="item in statusOverviewSegments" :key="item.key" class="status-legend__item">
                <span class="status-legend__name">
                  <i :style="{ backgroundColor: item.color }" />
                  {{ item.label }}
                </span>
                <strong>{{ item.count }}</strong>
              </div>
            </div>
          </div>
          <t-empty v-else class="status-state status-state--empty" description="暂无设备数据" />
        </t-card>
      </section>

      <section class="bottom-grid">
        <t-card bordered class="dashboard-card recent-card">
          <template #header>
            <div class="card-heading">
              <div>
                <h2>最近打印任务</h2>
              </div>
              <t-tag theme="primary" variant="light">
                活动 {{ activeJobs.length }} 项 · 失败 {{ failedJobTotal === null ? '—' : failedJobTotal }} 项
              </t-tag>
              <t-button variant="text" @click="goTo('/tasks/history')">查看全部</t-button>
            </div>
          </template>
          <div v-if="recentJobs.length" class="job-list">
            <t-button
              v-for="job in recentJobs.slice(0, 5)"
              :key="String(job.id)"
              variant="text"
              block
              class="job-row"
              @click="goTo(`/tasks/history?jobId=${job.id}`)"
            >
              <span class="job-row__main">
                <span class="job-row__icon"><FileIcon :size="18" /></span>
                <span class="job-row__content">
                  <strong>{{ job.fileName || `任务 #${job.id}` }}</strong>
                  <small>{{ formatJobTime(job.createdAt) }}</small>
                </span>
              </span>
              <t-tag :theme="getJobStatusType(job.status)" variant="light" size="small">
                {{ getJobStatusLabel(job.status) }}
              </t-tag>
            </t-button>
          </div>
          <t-empty v-else description="暂无打印任务" />
        </t-card>

        <t-card bordered class="dashboard-card alert-card">
          <template #header>
            <div class="card-heading">
              <div>
                <h2>设备提醒</h2>
              </div>
              <t-button variant="text" @click="goTo('/printers')">设备列表</t-button>
            </div>
          </template>
          <div v-if="attentionPrinters.length" class="alert-list">
            <t-button
              v-for="printer in attentionPrinters.slice(0, 5)"
              :key="String(printer.id)"
              variant="text"
              block
              class="alert-row"
              @click="goTo('/printers')"
            >
              <span class="alert-row__icon"><ErrorCircleIcon :size="18" /></span>
              <span class="alert-row__content">
                <strong>{{ printer.name || `打印机 #${printer.id}` }}</strong>
                <span>{{ printerStatusLabel(printer.status) }}</span>
              </span>
              <ChevronRightIcon :size="16" />
            </t-button>
          </div>
          <t-empty v-else description="设备运行正常" />
        </t-card>
      </section>

      <section class="quick-links" aria-label="快捷入口">
        <span class="quick-links__title">快捷入口</span>
        <t-space>
          <t-button variant="outline" @click="goTo('/printers')">打印机管理</t-button>
          <t-button variant="outline" @click="goTo('/files')">文件库</t-button>
          <t-button variant="outline" @click="goTo('/tasks/queue')">任务队列</t-button>
          <t-button variant="outline" @click="goTo('/dashboard/fullscreen')">全屏监控</t-button>
        </t-space>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import {
  CheckCircleIcon,
  ChevronRightIcon,
  DashboardIcon,
  ErrorCircleIcon,
  FileIcon,
  PrintIcon,
  RefreshIcon
} from 'tdesign-icons-vue-next'
import { getJobPage } from '@/api/job'
import { getPrinterList } from '@/api/printer'
import AsyncState from '@/components/AsyncState.vue'
import { useJobStore } from '@/stores/jobStore'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'
import { PRINTER_STATUS, PRINTER_STATUS_MAP } from '@/utils/constants'
import { normalizePrinterStatus } from '@/utils/dataAdapters'
import { buildSevenDayJobTrend } from '@/utils/dashboardMetrics'
import { renderIcon } from '@/utils/tdesign'

defineOptions({ name: 'DashboardView' })

const router = useRouter()
const jobStore = useJobStore()
const realtimeStore = useRealtimeStore()
const { activeJobs } = storeToRefs(jobStore)
const { statusMap, wsConnectionState, isWsConnected, isRealtimeStale, isRecovering } = storeToRefs(realtimeStore)

const loading = ref(false)
const loadError = ref('')
const printerLoadError = ref('')
const hasLoadedOnce = ref(false)
const printers = ref([])
const recentJobs = ref([])
const failedJobTotal = ref(null)
const trendJobs = ref([])
const overviewReferenceTime = ref(null)
const lastUpdateAt = ref(null)

const effectivePrinters = computed(() => printers.value.map(printer => {
  const realtime = statusMap.value.get(String(printer.id))
  const status = normalizePrinterStatus(realtime?.unifiedState || realtime?.state || printer.status)
  return { ...printer, status, realtime }
}))

const printerStatusCounts = computed(() => effectivePrinters.value.reduce((counts, printer) => {
  counts[printer.status] = (counts[printer.status] || 0) + 1
  return counts
}, {}))

const totalPrinters = computed(() => effectivePrinters.value.length)
const idlePrinters = computed(() => printerStatusCounts.value[PRINTER_STATUS.IDLE] || 0)
const offlinePrinters = computed(() => printerStatusCounts.value[PRINTER_STATUS.OFFLINE] || 0)
const unknownPrinters = computed(() => printerStatusCounts.value[PRINTER_STATUS.UNKNOWN] || 0)
const attentionPrinters = computed(() => effectivePrinters.value.filter(printer => [
  PRINTER_STATUS.ERROR,
  PRINTER_STATUS.OFFLINE,
  PRINTER_STATUS.UNKNOWN
].includes(printer.status)))

const statCards = computed(() => [
  {
    key: 'printers',
    label: '打印机总数',
    value: totalPrinters.value,
    description: `${Math.max(0, totalPrinters.value - offlinePrinters.value - unknownPrinters.value)} 台设备在线`,
    icon: DashboardIcon,
    tone: 'primary',
    to: '/printers'
  },
  {
    key: 'printing',
    label: '正在打印',
    value: printerStatusCounts.value[PRINTER_STATUS.PRINTING] || 0,
    description: '实时打印中的设备',
    icon: PrintIcon,
    tone: 'blue',
    to: { path: '/printers', query: { status: PRINTER_STATUS.PRINTING } }
  },
  {
    key: 'idle',
    label: '空闲打印机',
    value: idlePrinters.value,
    description: '当前可分配任务的设备',
    icon: CheckCircleIcon,
    tone: 'orange',
    to: { path: '/printers', query: { status: PRINTER_STATUS.IDLE } }
  },
  {
    key: 'errors',
    label: '异常设备',
    value: attentionPrinters.value.length,
    description: attentionPrinters.value.length ? '请及时处理异常' : '当前运行正常',
    icon: ErrorCircleIcon,
    tone: attentionPrinters.value.length ? 'red' : 'green',
    to: '/printers'
  }
])

const statusOverviewConfig = [
  { key: PRINTER_STATUS.PRINTING, label: '打印中', color: 'var(--app-primary)' },
  { key: PRINTER_STATUS.IDLE, label: '空闲', color: 'var(--app-success)' },
  { key: PRINTER_STATUS.PREPARING, label: '准备中', color: 'var(--app-warning)' },
  { key: PRINTER_STATUS.PAUSED, label: '已暂停', color: 'var(--app-warning)' },
  { key: PRINTER_STATUS.ERROR, label: '故障', color: 'var(--app-danger)' },
  { key: 'UNAVAILABLE', label: '离线/未知', color: 'var(--app-text-placeholder)' }
]

const statusOverviewSegments = computed(() => {
  const total = totalPrinters.value
  return statusOverviewConfig.map(item => {
    const count = item.key === 'UNAVAILABLE'
      ? (printerStatusCounts.value[PRINTER_STATUS.OFFLINE] || 0) + (printerStatusCounts.value[PRINTER_STATUS.UNKNOWN] || 0)
      : printerStatusCounts.value[item.key] || 0
    return { ...item, count, percent: total ? (count / total) * 100 : 0 }
  })
})

const donutStyle = computed(() => {
  if (!totalPrinters.value) return { background: 'var(--app-border)' }

  let start = 0
  const segments = statusOverviewSegments.value
    .filter(item => item.percent > 0)
    .map(item => {
      const end = start + item.percent
      const segment = `${item.color} ${start}% ${end}%`
      start = end
      return segment
    })

  return { background: `conic-gradient(${segments.join(', ')})` }
})

const trendData = computed(() => trendJobs.value.length
  ? buildSevenDayJobTrend(trendJobs.value, overviewReferenceTime.value || new Date())
  : [])
const chartPointList = computed(() => {
  const width = 640
  const height = 230
  const paddingX = 24
  const paddingY = 24
  const max = Math.max(...trendData.value.map(item => item.count), 1)
  const step = (width - paddingX * 2) / Math.max(trendData.value.length - 1, 1)
  return trendData.value.map((item, index) => ({
    label: item.label,
    x: paddingX + step * index,
    y: height - paddingY - (item.count / max) * (height - paddingY * 2)
  }))
})
const chartPoints = computed(() => chartPointList.value.map(point => `${point.x},${point.y}`).join(' '))
const chartAreaPoints = computed(() => chartPointList.value.length
  ? `${chartPointList.value[0].x},206 ${chartPoints.value} ${chartPointList.value.at(-1).x},206`
  : '')
const chartGridLines = [24, 70, 116, 162, 206]

const connectionLabel = computed(() => {
  if (isRecovering.value) return '恢复中'
  if (isRealtimeStale.value) return '数据陈旧'
  if (isWsConnected.value) return '已连接'
  return wsConnectionState.value === 'CONNECTING' ? '连接中' : '未连接'
})
const connectionTheme = computed(() => {
  if (isRecovering.value || isRealtimeStale.value) return 'warning'
  return isWsConnected.value ? 'success' : 'default'
})
const lastUpdateLabel = computed(() => lastUpdateAt.value
  ? new Date(lastUpdateAt.value).toLocaleString('zh-CN', { hour12: false })
  : '暂无成功更新')

function markUpdated() {
  lastUpdateAt.value = Date.now()
}

async function fetchOverview() {
  loading.value = true
  loadError.value = ''
  printerLoadError.value = ''
  const rangeEnd = new Date()
  const rangeStart = new Date(rangeEnd)
  rangeStart.setDate(rangeStart.getDate() - 6)
  const range = { startTime: rangeStart.toISOString(), endTime: rangeEnd.toISOString() }
  const results = await Promise.allSettled([
    getPrinterList({ pageNum: 1, pageSize: 100 }),
    jobStore.refresh(),
    getJobPage({ pageNum: 1, pageSize: 100 }),
    getJobPage({ pageNum: 1, pageSize: 100, status: 'FAILED' }),
    getJobPage({ pageNum: 1, pageSize: 100, status: 'COMPLETED', ...range }),
    getJobPage({ pageNum: 1, pageSize: 100, status: 'FAILED', ...range }),
    getJobPage({ pageNum: 1, pageSize: 100, status: 'CANCELLED', ...range })
  ])

  const [printerResult, , recentResult, failedResult, completedResult, failedTrendResult, cancelledResult] = results
  if (printerResult.status === 'fulfilled') printers.value = printerResult.value.data?.records || []
  else printerLoadError.value = '设备状态暂不可用，请检查后端服务或数据库结构'
  if (recentResult.status === 'fulfilled') recentJobs.value = recentResult.value.data?.records || []
  if (failedResult.status === 'fulfilled') {
    const data = failedResult.value.data || {}
    failedJobTotal.value = Number.isFinite(Number(data.total)) ? Number(data.total) : (data.records || []).length
  }
  const trendResults = [completedResult, failedTrendResult, cancelledResult]
    .filter(result => result.status === 'fulfilled')
    .flatMap(result => result.value.data?.records || [])
  if (completedResult.status === 'fulfilled' || failedTrendResult.status === 'fulfilled' || cancelledResult.status === 'fulfilled') {
    trendJobs.value = trendResults
    overviewReferenceTime.value = rangeEnd
  }

  const failedCount = results.filter(result => result.status === 'rejected').length
  if (failedCount === results.length) loadError.value = '概览数据加载失败，请重试'
  else if (failedCount) loadError.value = '部分概览数据加载失败，已展示可用数据'
  if (results.some(result => result.status === 'fulfilled')) markUpdated()
  hasLoadedOnce.value = true
  loading.value = false
}

function reconnectRealtime() {
  if (!isWsConnected.value) realtimeStore.connectWs()
}

function goTo(path) {
  router.push(path)
}

function getJobStatusLabel(status) {
  return {
    QUEUED: '排队中',
    ASSIGNED: '已分配',
    UPLOADING: '上传中',
    READY: '待启动',
    PRINTING: '打印中',
    PAUSED: '已暂停',
    RECONCILING: '核对中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELLED: '已取消'
  }[status] || status || '未知'
}

function getJobStatusType(status) {
  return {
    QUEUED: 'primary',
    ASSIGNED: 'warning',
    UPLOADING: 'warning',
    READY: 'warning',
    PRINTING: 'success',
    PAUSED: 'warning',
    RECONCILING: 'warning',
    FAILED: 'danger',
    CANCELLED: 'default',
    COMPLETED: 'default'
  }[status] || 'default'
}

function printerStatusLabel(status) {
  return PRINTER_STATUS_MAP[status]?.label || '未知'
}

function formatJobTime(value) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : '时间未知'
}

watch(statusMap, value => {
  if (value.size) markUpdated()
})

onMounted(() => {
  fetchOverview()
  reconnectRealtime()
})

onUnmounted(() => {
  realtimeStore.disconnectWs()
})
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  padding-bottom: var(--app-spacing-6);
}

.dashboard-heading,
.dashboard-meta,
.card-heading,
.stat-card__topline,
.stat-card__footer,
.job-row,
.job-row__main,
.alert-row {
  display: flex;
  align-items: center;
}

.dashboard-heading,
.dashboard-meta,
.card-heading,
.stat-card__topline,
.stat-card__footer,
.job-row,
.alert-row {
  justify-content: space-between;
}

.dashboard-heading {
  gap: var(--app-spacing-4);
  margin-bottom: var(--app-spacing-4);
}

.dashboard-heading h1,
.dashboard-heading p,
.card-heading h2,
.card-heading p {
  margin: 0;
}

.dashboard-heading h1,
.card-heading h2 {
  color: var(--app-text-primary);
}

.dashboard-heading__description {
  margin-top: var(--app-spacing-1);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-caption);
}

.dashboard-heading__actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--app-spacing-3);
}

.dashboard-alert {
  margin-bottom: var(--app-spacing-4);
}

.dashboard-meta {
  margin-bottom: var(--app-spacing-4);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-caption);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-spacing-4);
  margin-bottom: var(--app-spacing-4);
}

.stat-card,
.dashboard-card {
  min-width: 0;
  background: var(--app-surface);
  border-color: var(--app-border);
}

.stat-card {
  box-sizing: border-box;
  width: 100%;
  min-height: 142px;
  padding: var(--app-spacing-4);
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-medium);
}

.stat-card--interactive {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card--interactive:hover {
  box-shadow: var(--app-shadow);
  transform: translateY(-2px);
}

.stat-card--interactive:focus-visible {
  outline: 2px solid var(--app-primary);
  outline-offset: 2px;
}

.stat-card__body {
  display: flex;
  height: 100%;
  min-width: 0;
  flex-direction: column;
}

.stat-card__topline,
.stat-card__footer {
  min-width: 0;
  gap: var(--app-spacing-2);
}

.stat-card__label,
.stat-card__footer > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-card__label {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-body-small);
}

.stat-card__icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  color: var(--app-primary);
  background: var(--app-primary-light);
  border-radius: var(--app-radius-round);
  flex-shrink: 0;
}

.stat-card__value {
  margin: var(--app-spacing-3) 0 var(--app-spacing-2);
  color: var(--app-text-primary);
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1;
}

.stat-card__footer {
  margin-top: auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-caption);
}

.stat-card--primary {
  color: var(--app-text-on-brand);
  background: var(--app-primary);
  border-color: var(--app-primary);
}

.stat-card--primary .stat-card__label,
.stat-card--primary .stat-card__value,
.stat-card--primary .stat-card__footer {
  color: var(--app-text-on-brand);
}

.stat-card--primary .stat-card__icon {
  color: var(--app-text-on-brand);
  background: rgb(255 255 255 / 18%);
}

.stat-card--orange .stat-card__icon {
  color: var(--app-warning);
  background: var(--app-warning-light);
}

.stat-card--green .stat-card__icon {
  color: var(--app-success);
  background: var(--app-success-light);
}

.stat-card--red .stat-card__icon {
  color: var(--app-danger);
  background: var(--app-danger-light);
}

.dashboard-grid,
.bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
  gap: var(--app-spacing-4);
  margin-bottom: var(--app-spacing-4);
}

.dashboard-grid {
  align-items: start;
}

.bottom-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 0;
}

.dashboard-card :deep(.t-card__header) {
  padding: var(--app-spacing-4) var(--app-spacing-6) var(--app-spacing-2);
  border-bottom: 0;
}

.dashboard-card :deep(.t-card__body) {
  padding: var(--app-spacing-3) var(--app-spacing-6) var(--app-spacing-6);
}

.card-heading {
  width: 100%;
  min-width: 0;
  gap: var(--app-spacing-3);
}

.card-heading > div:first-child {
  min-width: 0;
}

.card-heading > :last-child {
  margin-left: auto;
  flex-shrink: 0;
}

.card-heading h2 {
  font-size: var(--app-font-size-subtitle);
  font-weight: 600;
}

.trend-chart {
  width: 100%;
  padding-top: var(--app-spacing-2);
}

.trend-chart svg {
  display: block;
  width: 100%;
  height: 230px;
  overflow: visible;
}

.chart-grid-line {
  stroke: var(--app-border);
  stroke-width: 1;
}

.chart-area {
  fill: var(--app-primary-light);
}

.chart-line {
  fill: none;
  stroke: var(--app-primary);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.chart-point {
  fill: var(--app-surface);
  stroke: var(--app-primary);
  stroke-width: 3;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  padding: 0 var(--app-spacing-2);
  color: var(--app-text-placeholder);
  font-size: 0.6875rem;
}

.status-state {
  min-height: 156px;
}

.status-state--error {
  display: flex;
  align-items: center;
}

.status-state--empty {
  padding-top: var(--app-spacing-6);
  padding-bottom: var(--app-spacing-6);
}

.status-overview {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: var(--app-spacing-6);
  min-height: 250px;
}

.status-donut {
  position: relative;
  display: flex;
  width: 176px;
  height: 176px;
  align-items: center;
  justify-content: center;
  padding: 18px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-donut::before {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--app-surface);
  border-radius: 50%;
  content: '';
}

.status-donut__content {
  position: absolute;
  display: flex;
  align-items: center;
  flex-direction: column;
  color: var(--app-text-secondary);
}

.status-donut__content strong {
  color: var(--app-text-primary);
  font-size: 1.75rem;
  line-height: 1.2;
}

.status-donut__content span {
  font-size: var(--app-font-size-caption);
}

.status-legend {
  display: flex;
  min-width: 120px;
  flex-direction: column;
  gap: var(--app-spacing-3);
}

.status-legend__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-4);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-body-small);
}

.status-legend__name {
  display: inline-flex;
  align-items: center;
  gap: var(--app-spacing-2);
}

.status-legend__name i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-legend__item strong {
  color: var(--app-text-primary);
}

.job-list,
.alert-list {
  display: flex;
  flex-direction: column;
}

.job-row,
.alert-row {
  width: 100%;
  min-width: 0;
  min-height: 58px;
  padding: var(--app-spacing-2) 0;
  color: var(--app-text-secondary);
  text-align: left;
  border-bottom: 1px solid var(--app-border);
}

.job-row:last-child,
.alert-row:last-child {
  border-bottom: 0;
}

.job-row__main {
  min-width: 0;
  gap: var(--app-spacing-3);
}

.job-row__icon,
.alert-row__icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  color: var(--app-primary);
  background: var(--app-primary-light);
  border-radius: var(--app-radius-round);
  flex-shrink: 0;
}

.job-row__content,
.alert-row__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--app-spacing-1);
}

.job-row strong,
.alert-row strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-body-small);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-row small,
.alert-row span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-caption);
}

.alert-row__icon {
  color: var(--app-danger);
  background: var(--app-danger-light);
}

.quick-links {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-4);
  padding: var(--app-spacing-4);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-medium);
}

.quick-links__title {
  color: var(--app-text-primary);
  font-weight: 600;
}

@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 800px) {
  .dashboard-heading,
  .dashboard-meta,
  .quick-links {
    align-items: flex-start;
    flex-direction: column;
  }

  .dashboard-heading__actions,
  .quick-links :deep(.t-space) {
    width: 100%;
  }

  .dashboard-heading__actions :deep(.t-button) {
    flex: 1;
  }
}

@media (max-width: 520px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-card :deep(.t-card__header),
  .dashboard-card :deep(.t-card__body) {
    padding-right: var(--app-spacing-4);
    padding-left: var(--app-spacing-4);
  }

  .status-overview {
    gap: var(--app-spacing-4);
    flex-direction: column;
    padding: var(--app-spacing-2) 0;
  }
}
</style>
