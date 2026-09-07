<template>
  <section class="dashboard-details-panel" aria-label="实时状态详情">
    <t-card bordered class="dashboard-detail-card dashboard-detail-card--status">
      <template #header>
        <div class="dashboard-detail-card__heading">
          <div>
            <h3>状态分布</h3>
            <p>当前实时快照 · 共 {{ summary.total }} 台</p>
          </div>
          <t-tag theme="default" variant="light" size="small">实时</t-tag>
        </div>
      </template>
      <template v-if="summary.total">
        <div class="dashboard-status-summary">
          <div class="dashboard-status-summary__labels">
            <span>在线设备：<strong class="is-success">{{ onlineCount }}</strong> 台</span>
            <span>离线/未知：<strong>{{ unknownCount }}</strong> 台</span>
          </div>
          <div class="dashboard-status-summary__bar" aria-label="在线和离线设备比例">
            <span class="is-success" :style="{ width: `${onlinePercent}%` }"></span>
            <span class="is-unknown" :style="{ width: `${unknownPercent}%` }"></span>
          </div>
        </div>
        <div class="dashboard-status-items">
          <div v-for="item in compactStatusItems" :key="item.key" class="dashboard-status-item">
            <span class="dashboard-status-item__dot" :class="`is-${item.theme}`"></span>
            <span class="dashboard-status-item__label">{{ item.label }}</span>
            <strong>{{ item.count }}</strong>
          </div>
        </div>
      </template>
      <t-empty v-else description="暂无实时设备状态" />
    </t-card>

    <t-card bordered class="dashboard-detail-card dashboard-detail-card--activity">
      <template #header>
        <div class="dashboard-detail-card__heading">
          <div>
            <h3>活动任务</h3>
            <p>REST/WS 合并状态</p>
          </div>
          <t-tag theme="primary" variant="light" size="small">{{ activeJobs.length }} 项</t-tag>
        </div>
      </template>
      <div v-if="activeJobs.length" class="dashboard-active-jobs">
        <div v-for="job in activeJobs.slice(0, 2)" :key="String(job.id)" class="dashboard-active-job">
          <div class="dashboard-active-job__heading">
            <span>任务 #{{ job.id }}</span>
            <StatusTag domain="job" :status="job.status" />
          </div>
          <div class="dashboard-active-job__meta">
            <span>打印机：{{ job.printerId || '未分配' }}</span>
            <span>{{ job.progress ?? 0 }}%</span>
          </div>
          <t-progress :percentage="Number(job.progress) || 0" :status="progressStatus(job.status)" :show-info="false" size="small" />
        </div>
      </div>
      <div v-else class="dashboard-detail-empty">
        <t-empty description="暂无执行中任务" />
        <span>当前无切片处理或正在打印的项目</span>
      </div>
    </t-card>

    <t-card bordered class="dashboard-detail-card dashboard-detail-card--trend">
      <template #header>
        <div class="dashboard-detail-card__heading">
          <div>
            <h3>近 7 日任务趋势</h3>
            <p>按已结束任务时间统计</p>
          </div>
          <span v-if="trend.length" class="dashboard-trend-range">{{ trend[0].label }} ~ {{ trend.at(-1).label }}</span>
        </div>
      </template>
      <AsyncState
        v-if="historyLoading || historyError || historyJobs.length === 0"
        :loading="historyLoading"
        :error="historyError"
        :empty="historyJobs.length === 0"
        empty-description="近 7 日暂无已结束任务"
        @retry="$emit('retry-history')"
      />
      <div v-else class="dashboard-trend-chart" aria-label="近七日任务数量">
        <div v-for="day in trend" :key="day.key" class="dashboard-trend-day">
          <span class="dashboard-trend-day__count">{{ day.count }}</span>
          <div class="dashboard-trend-day__track">
            <span :style="{ height: `${barHeight(day.count)}%` }" :title="`${day.label}: ${day.count} 项`"></span>
          </div>
          <span class="dashboard-trend-day__label">{{ day.label }}</span>
        </div>
      </div>
    </t-card>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import AsyncState from './AsyncState.vue'
import StatusTag from './StatusTag.vue'
import { PRINTER_STATE } from '@/utils/constants'
import { buildSevenDayJobTrend, buildStatusSummary } from '@/utils/dashboardMetrics'

const props = defineProps({
  statusCounts: { type: Object, default: () => ({}) },
  activeJobs: { type: Array, default: () => [] },
  historyJobs: { type: Array, default: () => [] },
  historyLoading: { type: Boolean, default: false },
  historyError: { type: [String, Error, Object], default: null }
})

defineEmits(['retry-history'])

const summary = computed(() => buildStatusSummary(props.statusCounts))
const trend = computed(() => buildSevenDayJobTrend(props.historyJobs))
const maxTrendCount = computed(() => Math.max(...trend.value.map(item => item.count), 1))
const unknownCount = computed(() => summary.value.items
  .filter(item => item.key === PRINTER_STATE.UNKNOWN)
  .reduce((total, item) => total + item.count, 0))
const onlineCount = computed(() => Math.max(0, summary.value.total - unknownCount.value))
const unknownPercent = computed(() => summary.value.total ? Math.round((unknownCount.value / summary.value.total) * 100) : 0)
const onlinePercent = computed(() => Math.max(0, 100 - unknownPercent.value))

const compactStatusItems = computed(() => {
  const getCount = key => summary.value.items.find(item => item.key === key)?.count || 0
  return [
    { key: 'unknown', label: '离线未知', count: unknownCount.value, theme: 'unknown' },
    { key: 'standby', label: '待机就绪', count: getCount(PRINTER_STATE.STANDBY), theme: 'success' },
    { key: 'printing', label: '正在打印', count: getCount(PRINTER_STATE.PRINTING), theme: 'primary' },
    {
      key: 'error',
      label: '错误故障',
      count: getCount(PRINTER_STATE.FAULT) + getCount(PRINTER_STATE.SYS_ERROR) + getCount(PRINTER_STATE.PRINT_ERROR),
      theme: 'danger'
    }
  ]
})

const progressStatus = status => status === 'FAILED' ? 'error' : status === 'COMPLETED' ? 'success' : 'active'
const barHeight = count => Math.max(6, Math.round((count / maxTrendCount.value) * 100))
</script>

<style scoped>
.dashboard-details-panel {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 3fr) minmax(0, 4fr);
  gap: var(--app-spacing-3);
  padding: var(--app-spacing-3) var(--app-spacing-4);
  background: var(--app-page-background);
  border-bottom: 1px solid var(--app-border);
}

.dashboard-detail-card {
  min-width: 0;
  min-height: 152px;
  height: auto;
  display: flex;
  flex-direction: column;
  overflow: visible;
  background: var(--app-surface);
  border-color: var(--app-border);
}

.dashboard-detail-card :deep(.t-card__header) {
  flex: 0 0 auto;
  padding: 10px 10px 6px;
  border-bottom: 1px solid var(--app-border);
}

.dashboard-detail-card :deep(.t-card__body) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: 8px 10px 10px;
}

.dashboard-detail-card__heading,
.dashboard-status-summary__labels,
.dashboard-active-job__heading,
.dashboard-active-job__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-2);
}

.dashboard-detail-card__heading h3,
.dashboard-detail-card__heading p {
  margin: 0;
}

.dashboard-detail-card__heading > div {
  min-width: 0;
}

.dashboard-detail-card--trend .dashboard-detail-card__heading {
  min-width: 0;
}

.dashboard-detail-card__heading h3 {
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-small);
  font-weight: 700;
}

.dashboard-detail-card__heading p,
.dashboard-active-job__meta,
.dashboard-detail-empty > span {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-caption);
}

.dashboard-trend-range {
  flex: 0 0 auto;
  max-width: 45%;
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-status-summary__labels {
  margin-bottom: 4px;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-caption);
}

.dashboard-status-summary__labels strong {
  color: var(--app-text-primary);
  font-family: var(--app-font-family-mono);
}

.dashboard-status-summary__labels strong.is-success { color: var(--td-success-color-6); }

.dashboard-status-summary__bar {
  display: flex;
  width: 100%;
  height: 8px;
  overflow: hidden;
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
  border-radius: 999px;
}

.dashboard-status-summary__bar span { display: block; height: 100%; }
.dashboard-status-summary__bar .is-success { background: var(--td-success-color-6); }
.dashboard-status-summary__bar .is-unknown { background: var(--td-brand-color-7); }

.dashboard-status-items {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--app-border);
}

.dashboard-status-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  color: var(--app-text-secondary);
  font-size: 11px;
}

.dashboard-status-item__dot {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dashboard-status-item__dot.is-unknown { background: var(--td-brand-color-6); }
.dashboard-status-item__dot.is-success { background: var(--td-success-color-6); }
.dashboard-status-item__dot.is-primary { background: var(--td-brand-color-6); }
.dashboard-status-item__dot.is-danger { background: var(--td-error-color-6); }

.dashboard-status-item__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-status-item strong {
  margin-left: auto;
  color: var(--app-text-primary);
  font-family: var(--app-font-family-mono);
}

.dashboard-active-jobs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dashboard-active-job {
  min-width: 0;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--app-border);
}

.dashboard-active-job:last-child { border-bottom: 0; }

.dashboard-active-job__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 6px;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-caption);
  font-weight: 600;
}

.dashboard-active-job__heading > span,
.dashboard-active-job__meta > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-active-job__meta { margin: 4px 0; }

.dashboard-detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 72px;
  text-align: center;
}

.dashboard-detail-empty :deep(.t-empty) { padding: 0; }
.dashboard-detail-empty :deep(.t-empty__image) { display: none; }

.dashboard-trend-chart {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-items: end;
  gap: 6px;
  height: 88px;
}

.dashboard-trend-day {
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: end;
  gap: 2px;
}

.dashboard-trend-day__count,
.dashboard-trend-day__label {
  color: var(--app-text-secondary);
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  white-space: nowrap;
}

.dashboard-trend-day__count { color: var(--app-text-primary); font-weight: 600; }

.dashboard-trend-day__track {
  display: flex;
  width: 100%;
  height: 46px;
  align-items: end;
  padding: 2px;
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-small);
}

.dashboard-trend-day__track span {
  display: block;
  width: 100%;
  min-height: 3px;
  background: var(--td-brand-color-6);
  border-radius: var(--app-radius-small);
}

@media (max-width: 1200px) {
  .dashboard-details-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-detail-card--trend { grid-column: 1 / -1; }
}

@media (max-width: 767px) {
  .dashboard-details-panel { grid-template-columns: minmax(0, 1fr); }
  .dashboard-detail-card--trend { grid-column: auto; }
  .dashboard-detail-card { min-height: 152px; }
}
</style>
