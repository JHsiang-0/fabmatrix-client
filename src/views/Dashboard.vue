<template>
  <div class="dashboard-page">
    <header class="dashboard-heading">
      <div>
        <h1 class="app-route-title">概览仪表盘</h1>
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
        <t-card
          v-for="stat in statCards"
          :key="stat.key"
          bordered
          hover-shadow
          class="stat-card"
          :class="{ 'stat-card--interactive': stat.to }"
          :role="stat.to ? 'button' : undefined"
          :tabindex="stat.to ? 0 : undefined"
          :aria-label="stat.to ? `查看${stat.title}` : undefined"
          @click="stat.to && goTo(stat.to)"
          @keydown.enter.prevent="stat.to && goTo(stat.to)"
          @keydown.space.prevent="stat.to && goTo(stat.to)"
        >
          <t-statistic :title="stat.title" :value="stat.value" :loading="stat.loading">
            <template #prefix>
              <span class="stat-card__icon"><component :is="stat.icon" size="20" /></span>
            </template>
            <template #extra>{{ stat.description }}</template>
          </t-statistic>
        </t-card>
      </section>

      <section class="dashboard-grid">
        <t-card bordered hover-shadow class="dashboard-card dashboard-card--trend trend-card">
          <template #header>
            <div class="card-heading">
              <div>
                <h2>近 7 日任务趋势</h2>
                <p>按真实任务的创建或完成时间统计</p>
              </div>
              <t-tag theme="primary" variant="light">任务趋势</t-tag>
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

        <t-card bordered hover-shadow class="dashboard-card dashboard-card--status status-card">
          <template #header>
            <div class="card-heading">
              <div>
                <h2>设备状态分布</h2>
                <p>实时状态优先，断开时回退到 REST 快照</p>
              </div>
            </div>
          </template>
          <div v-if="totalPrinters" class="status-list">
            <div v-for="item in statusSegments" :key="item.key" class="status-list__item">
              <div class="status-list__heading">
                <span>{{ item.label }}</span>
                <strong>{{ item.count }}</strong>
              </div>
              <t-progress
                :percentage="item.percent"
                :status="item.progressStatus"
                :show-info="false"
                size="small"
              />
            </div>
          </div>
          <t-empty v-else description="暂无打印机设备" />
        </t-card>
      </section>

      <section class="dashboard-grid dashboard-grid--three">
        <t-card bordered hover-shadow class="dashboard-card dashboard-card--activity activity-card">
          <template #header>
            <div class="card-heading">
              <div>
                <h2>活动任务进度</h2>
                <p>来自任务 Store 的 REST/WS 合并状态</p>
              </div>
              <t-tag theme="primary" variant="light">{{ dashboardActiveTotal === null ? '—' : `${dashboardActiveTotal} 项` }}</t-tag>
            </div>
          </template>
          <div v-if="activeJobs.length" class="activity-list">
            <div v-for="job in activeJobs.slice(0, 5)" :key="String(job.id)" class="activity-row">
              <div class="activity-row__heading">
                <span class="activity-row__name">{{ job.fileName || `任务 #${job.id}` }}</span>
                <StatusTag domain="job" :status="job.status" />
              </div>
              <div class="activity-row__meta">
                <span>打印机：{{ job.printerId || '未分配' }}</span>
                <span v-if="hasProgress(job)">{{ progressValue(job) }}%</span>
                <span v-else>进度未上报</span>
              </div>
              <t-progress
                v-if="hasProgress(job)"
                :percentage="progressValue(job)"
                :status="job.status === 'RECONCILING' ? 'warning' : 'active'"
                :show-info="false"
                size="small"
              />
            </div>
          </div>
          <t-empty v-else description="当前没有活动任务" />
        </t-card>

        <t-card bordered hover-shadow class="dashboard-card dashboard-card--recent recent-card">
          <template #header>
            <div class="card-heading">
              <div>
                <h2>最近任务</h2>
                <p>来自任务分页接口的最新记录</p>
              </div>
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
                <FileIcon size="18" />
                <span class="job-row__content">
                  <strong>{{ job.fileName || `任务 #${job.id}` }}</strong>
                  <small>{{ formatJobTime(job.createdAt) }}</small>
                </span>
              </span>
              <StatusTag domain="job" :status="job.status" />
            </t-button>
          </div>
          <t-empty v-else description="暂无打印任务" />
        </t-card>

        <t-card bordered hover-shadow class="dashboard-card dashboard-card--alerts alert-card">
          <template #header>
            <div class="card-heading">
              <div>
                <h2>异常设备</h2>
                <p>需要关注的离线、未知或故障设备</p>
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
              <span class="alert-row__main">
                <ErrorCircleIcon size="18" />
                <span class="alert-row__content">
                  <strong>{{ printer.name || `打印机 #${printer.id}` }}</strong>
                  <small>{{ printerStatusLabel(printer.status) }}</small>
                </span>
              </span>
              <ChevronRightIcon size="16" />
            </t-button>
          </div>
          <t-empty v-else description="暂无需要处理的设备" />
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
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import {
  ChevronRightIcon,
  DashboardIcon,
  ErrorCircleIcon,
  FileIcon,
  PrintIcon,
  RefreshIcon,
  TaskIcon
} from 'tdesign-icons-vue-next'
import { getJobPage } from '@/api/job'
import { getPrinterList } from '@/api/printer'
import AsyncState from '@/components/AsyncState.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useJobStore } from '@/stores/jobStore'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'
import { usePrinterStateClock } from '@/stores/printer/stateClock'
import { applyPrinterStateSummary } from '@/utils/printerStateSummary'
import { PRINTER_STATUS, PRINTER_STATUS_MAP } from '@/utils/constants'
import { resolveEffectivePrinterStatus } from '@/utils/dataAdapters'
import { buildFarmDateRange, buildSevenDayJobTrend } from '@/utils/dashboardMetrics'
import { ACTIVE_JOB_STATUSES } from '@/utils/jobSelectors'
import { fetchAllPageRecords } from '@/utils/jobPagination'
import { renderIcon } from '@/utils/tdesign'

defineOptions({ name: 'DashboardView' })

const router = useRouter()
const jobStore = useJobStore()
const realtimeStore = useRealtimeStore()
const stateClock = usePrinterStateClock()
const { queueJobs, activeJobs } = storeToRefs(jobStore)
const { statusMap, wsConnectionState, isWsConnected, isRealtimeStale, isRecovering } = storeToRefs(realtimeStore)

const loading = ref(false)
const loadError = ref('')
const hasLoadedOnce = ref(false)
const printers = ref([])
const recentJobs = ref([])
const failedJobTotal = ref(null)
const dashboardActiveTotal = ref(null)
const trendJobs = ref([])
const overviewReferenceTime = ref(null)
const lastUpdateAt = ref(null)

const statusSegmentsConfig = [
  { key: PRINTER_STATUS.PRINTING, label: '打印中', progressStatus: 'active' },
  { key: PRINTER_STATUS.PREPARING, label: '准备中', progressStatus: 'warning' },
  { key: PRINTER_STATUS.PAUSED, label: '已暂停', progressStatus: 'warning' },
  { key: PRINTER_STATUS.IDLE, label: '空闲', progressStatus: 'success' },
  { key: PRINTER_STATUS.ERROR, label: '故障', progressStatus: 'error' },
  { key: PRINTER_STATUS.OFFLINE, label: '离线', progressStatus: 'active' },
  { key: PRINTER_STATUS.UNKNOWN, label: '未知', progressStatus: 'active' }
]

const effectivePrinters = computed(() => printers.value.map(printer => {
  const realtime = statusMap.value.get(String(printer.id))
  const merged = applyPrinterStateSummary({ ...printer, ...realtime }, printer.id,
    Math.max(stateClock.now, Date.now()))
  const status = resolveEffectivePrinterStatus(merged)
  return { ...printer, status, realtime }
}))

const printerStatusCounts = computed(() => effectivePrinters.value.reduce((counts, printer) => {
  counts[printer.status] = (counts[printer.status] || 0) + 1
  return counts
}, {}))

const totalPrinters = computed(() => effectivePrinters.value.length)
const busyPrinters = computed(() => [PRINTER_STATUS.PREPARING, PRINTER_STATUS.PRINTING, PRINTER_STATUS.PAUSED]
  .reduce((count, status) => count + (printerStatusCounts.value[status] || 0), 0))
const idlePrinters = computed(() => printerStatusCounts.value[PRINTER_STATUS.IDLE] || 0)
const offlinePrinters = computed(() => printerStatusCounts.value[PRINTER_STATUS.OFFLINE] || 0)
const unknownPrinters = computed(() => printerStatusCounts.value[PRINTER_STATUS.UNKNOWN] || 0)
const attentionPrinters = computed(() => effectivePrinters.value.filter(printer => [
  PRINTER_STATUS.ERROR,
  PRINTER_STATUS.OFFLINE,
  PRINTER_STATUS.UNKNOWN
].includes(printer.status)))

const statCards = computed(() => [
  { key: 'total', title: '打印机总数', value: totalPrinters.value, description: '已纳入当前看板的设备', icon: DashboardIcon, to: '/printers' },
  { key: 'busy', title: '忙碌设备', value: busyPrinters.value, description: '准备中、打印中或暂停', icon: PrintIcon, to: '/printers' },
  { key: 'idle', title: '空闲设备', value: idlePrinters.value, description: '当前处于 IDLE 状态', icon: TaskIcon, to: { path: '/printers', query: { status: 'IDLE' } } },
  { key: 'offline', title: '离线设备', value: offlinePrinters.value, description: 'REST/实时状态为 OFFLINE', icon: ErrorCircleIcon, to: { path: '/printers', query: { status: 'OFFLINE' } } },
  { key: 'unknown', title: '未知设备', value: unknownPrinters.value, description: '尚未取得可靠状态', icon: ErrorCircleIcon, to: { path: '/printers', query: { status: 'UNKNOWN' } } },
  { key: 'queued', title: '排队任务', value: queueJobs.value.length, description: '来自 QUEUED 队列接口', icon: TaskIcon, to: '/tasks/queue' },
  { key: 'active', title: '活动任务', value: dashboardActiveTotal.value === null ? '—' : dashboardActiveTotal.value, description: 'ASSIGNED 至 RECONCILING（独立统计）', icon: PrintIcon, to: '/tasks/queue' },
  { key: 'failed', title: '失败任务', value: failedJobTotal.value === null ? '—' : failedJobTotal.value, description: '来自 FAILED 分页接口', icon: ErrorCircleIcon, to: '/tasks/history' }
])

const statusSegments = computed(() => {
  const total = totalPrinters.value
  return statusSegmentsConfig.map(item => {
    const count = printerStatusCounts.value[item.key] || 0
    return { ...item, count, percent: total ? Math.round((count / total) * 100) : 0 }
  })
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
  const range = buildFarmDateRange()
  const results = await Promise.allSettled([
    getPrinterList({ pageNum: 1, pageSize: 100 }),
    jobStore.refresh(),
    getJobPage({ pageNum: 1, pageSize: 1, statuses: ACTIVE_JOB_STATUSES }),
    getJobPage({ pageNum: 1, pageSize: 100 }),
    getJobPage({ pageNum: 1, pageSize: 100, status: 'FAILED' }),
    fetchAllPageRecords(getJobPage, {
      pageNum: 1,
      pageSize: 100,
      statuses: ['COMPLETED', 'FAILED', 'CANCELLED'],
      timeField: 'COMPLETED_AT',
      ...range
    })
  ])

  const [printerResult, , activeTotalResult, recentResult, failedResult, trendResult] = results
  if (printerResult.status === 'fulfilled') printers.value = printerResult.value.data?.records || []
  if (activeTotalResult.status === 'fulfilled') {
    dashboardActiveTotal.value = Number(activeTotalResult.value.data?.total || 0)
  }
  if (recentResult.status === 'fulfilled') recentJobs.value = recentResult.value.data?.records || []
  if (failedResult.status === 'fulfilled') {
    const data = failedResult.value.data || {}
    failedJobTotal.value = Number.isFinite(Number(data.total)) ? Number(data.total) : (data.records || []).length
  }
  if (trendResult.status === 'fulfilled') {
    trendJobs.value = trendResult.value || []
    overviewReferenceTime.value = range.endTime
  }

  const failedCount = results.filter(result => result.status === 'rejected').length
  if (failedCount === results.length) loadError.value = '概览数据加载失败，请重试'
  else if (failedCount) loadError.value = '部分概览数据加载失败，已展示可用数据'
  if (results.some(result => result.status === 'fulfilled')) markUpdated()
  hasLoadedOnce.value = true
  loading.value = false
}

function goTo(path) {
  router.push(path)
}

function hasProgress(job) {
  const value = Number(job?.progress)
  return Number.isFinite(value) && value >= 0 && value <= 100
}

function progressValue(job) {
  return Math.min(100, Math.max(0, Number(job.progress)))
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
})
</script>

<style scoped>
.dashboard-page { min-width: 0; padding-bottom: var(--app-spacing-6); }
.dashboard-heading, .dashboard-meta, .card-heading, .status-list__heading, .activity-row__heading, .activity-row__meta, .job-row, .alert-row, .job-row__main, .alert-row__main { display: flex; align-items: center; }
.dashboard-heading, .dashboard-meta, .card-heading, .status-list__heading, .activity-row__heading, .activity-row__meta, .job-row, .alert-row { justify-content: space-between; }
.dashboard-heading { gap: var(--app-spacing-4); margin-bottom: var(--app-spacing-4); }
.dashboard-heading h1, .dashboard-heading p, .card-heading h2, .card-heading p { margin: 0; }
.dashboard-heading h1, .card-heading h2 { color: var(--app-text-primary); }
.dashboard-heading__description, .card-heading p { margin-top: var(--app-spacing-1) !important; color: var(--app-text-secondary); font-size: var(--app-font-size-caption); }
.dashboard-heading__actions { flex-shrink: 0; }
.dashboard-alert { margin-bottom: var(--app-spacing-4); }
.dashboard-meta { margin-bottom: var(--app-spacing-4); color: var(--app-text-secondary); font-size: var(--app-font-size-caption); }
.dashboard-meta__label { color: var(--app-text-secondary); }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--app-spacing-4); margin-bottom: var(--app-spacing-4); }
.stat-card, .dashboard-card { min-width: 0; background: var(--app-surface); border-color: var(--app-border); }
.stat-card--interactive { cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; }
.stat-card--interactive:hover { transform: translateY(-2px); }
.stat-card--interactive:focus-visible { outline: 2px solid var(--app-primary); outline-offset: 2px; }
.stat-card :deep(.t-card__body) { padding: var(--app-spacing-4); }
.stat-card :deep(.t-statistic__title) { color: var(--app-text-secondary); }
.stat-card :deep(.t-statistic__content) { color: var(--app-text-primary); }
.stat-card :deep(.t-statistic__extra) { color: var(--app-text-secondary); font-size: var(--app-font-size-caption); }
.stat-card__icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; color: var(--app-primary); background: var(--app-primary-light); border-radius: var(--app-radius-round); }
.dashboard-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: var(--app-spacing-4); margin-bottom: var(--app-spacing-4); }
.dashboard-grid--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.dashboard-card :deep(.t-card__header) { padding: var(--app-spacing-4) var(--app-spacing-6) 0; border-bottom: 0; }
.dashboard-card :deep(.t-card__body) { padding: var(--app-spacing-4) var(--app-spacing-6) var(--app-spacing-6); }
.card-heading h2 { font-size: var(--app-font-size-subtitle); font-weight: 600; }
.trend-chart { width: 100%; padding-top: var(--app-spacing-2); }
.trend-chart svg { display: block; width: 100%; height: 230px; overflow: visible; }
.chart-grid-line { stroke: var(--app-border); stroke-width: 1; }
.chart-area { fill: var(--app-primary-light); }
.chart-line { fill: none; stroke: var(--app-primary); stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; }
.chart-point { fill: var(--app-surface); stroke: var(--app-primary); stroke-width: 3; }
.chart-labels { display: flex; justify-content: space-between; padding: 0 var(--app-spacing-2); color: var(--app-text-placeholder); font-size: 0.6875rem; }
.status-list, .activity-list, .job-list, .alert-list { display: flex; flex-direction: column; gap: var(--app-spacing-3); }
.status-list__item { display: grid; gap: var(--app-spacing-1); }
.status-list__heading, .activity-row__meta { color: var(--app-text-secondary); font-size: var(--app-font-size-caption); }
.status-list__heading strong { color: var(--app-text-primary); }
.activity-row, .job-row, .alert-row { min-width: 0; padding: var(--app-spacing-2) 0; border-bottom: 1px solid var(--app-border); }
.activity-row:last-child, .job-row:last-child, .alert-row:last-child { border-bottom: 0; }
.activity-row__heading { gap: var(--app-spacing-2); }
.activity-row__name, .job-row strong, .alert-row strong { overflow: hidden; color: var(--app-text-primary); font-size: var(--app-font-size-body); text-overflow: ellipsis; white-space: nowrap; }
.activity-row__meta { margin: var(--app-spacing-2) 0 var(--app-spacing-1); }
.job-row, .alert-row { height: auto; justify-content: space-between; color: var(--app-text-secondary); text-align: left; }
.job-row__main, .alert-row__main { min-width: 0; gap: var(--app-spacing-3); }
.job-row__main > svg, .alert-row__main > svg { flex-shrink: 0; color: var(--app-primary); }
.alert-row__main > svg { color: var(--app-danger); }
.job-row__content, .alert-row__content { display: flex; flex-direction: column; min-width: 0; gap: var(--app-spacing-1); }
.job-row small, .alert-row small { color: var(--app-text-secondary); font-size: var(--app-font-size-caption); }
.quick-links { display: flex; align-items: center; justify-content: space-between; gap: var(--app-spacing-4); padding: var(--app-spacing-4); background: var(--app-surface); border: 1px solid var(--app-border); border-radius: var(--app-radius-medium); }
.quick-links__title { color: var(--app-text-primary); font-weight: 600; }
@media (max-width: 1200px) { .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dashboard-grid--three { grid-template-columns: 1fr 1fr; } .alert-card { grid-column: span 2; } }
@media (max-width: 800px) { .dashboard-heading, .dashboard-meta, .quick-links { align-items: flex-start; flex-direction: column; } .dashboard-heading__actions, .quick-links .t-space { width: 100%; } .dashboard-heading__actions .t-button { flex: 1; } .dashboard-grid, .dashboard-grid--three { grid-template-columns: 1fr; } .alert-card { grid-column: auto; } }
@media (max-width: 520px) { .stat-grid { grid-template-columns: 1fr; } .dashboard-card :deep(.t-card__header), .dashboard-card :deep(.t-card__body) { padding-left: var(--app-spacing-4); padding-right: var(--app-spacing-4); } }
</style>
