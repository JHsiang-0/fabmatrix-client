<template>
  <section class="dashboard-details-panel mt-3 grid gap-3 xl:grid-cols-3" aria-label="实时状态详情">
    <t-card bordered hover-shadow class="dashboard-detail-card dashboard-detail-card--status min-w-0">
      <template #header>
        <div class="dashboard-detail-card__heading flex items-center justify-between gap-2">
          <div>
            <h3 class="font-semibold text-gray-900">状态分布</h3>
            <p class="text-xs text-gray-500">当前实时状态快照，共 {{ summary.total }} 台</p>
          </div>
          <t-tag variant="light">实时</t-tag>
        </div>
      </template>
      <div v-if="summary.total" class="dashboard-status-list space-y-2">
        <div v-for="item in summary.items" :key="item.key" class="dashboard-status-row flex items-center gap-2 text-sm">
          <span class="w-20 shrink-0 text-gray-600">{{ item.label }}</span>
          <t-progress :percentage="item.percent" :status="statusProgress(item.theme)" :show-info="false" class="flex-1" />
          <span class="w-8 text-right font-medium text-gray-800">{{ item.count }}</span>
        </div>
      </div>
      <t-empty v-else description="暂无实时设备状态" />
    </t-card>

    <t-card bordered hover-shadow class="dashboard-detail-card dashboard-detail-card--activity min-w-0 xl:col-span-2">
      <template #header>
        <div class="dashboard-detail-card__heading flex items-center justify-between gap-2">
          <div>
            <h3 class="font-semibold text-gray-900">活动任务</h3>
            <p class="text-xs text-gray-500">来自任务 Store 的 REST/WS 合并状态</p>
          </div>
          <t-tag theme="primary" variant="light">{{ activeJobs.length }} 项</t-tag>
        </div>
      </template>
      <div v-if="activeJobs.length" class="dashboard-active-jobs grid gap-2 md:grid-cols-2">
        <div v-for="job in activeJobs" :key="String(job.id)" class="dashboard-active-job rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-sm font-semibold text-gray-800">任务 #{{ job.id }}</span>
            <StatusTag domain="job" :status="job.status" />
          </div>
          <div class="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>打印机：{{ job.printerId || '未分配' }}</span>
            <span>{{ job.progress ?? 0 }}%</span>
          </div>
          <t-progress class="mt-1" :percentage="Number(job.progress) || 0" :status="progressStatus(job.status)" :show-info="false" />
        </div>
      </div>
      <t-empty v-else description="当前没有活动任务" />
    </t-card>

    <t-card bordered hover-shadow class="dashboard-detail-card dashboard-detail-card--trend min-w-0 xl:col-span-3">
      <template #header>
        <div class="dashboard-detail-card__heading">
          <h3 class="font-semibold text-gray-900">近 7 日任务趋势</h3>
          <p class="text-xs text-gray-500">按已结束任务的 completedAt/createdAt 统计</p>
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
      <div v-else class="dashboard-trend-chart grid grid-cols-7 items-end gap-2" aria-label="近七日任务数量">
        <div v-for="day in trend" :key="day.key" class="dashboard-trend-day flex min-w-0 flex-col items-center gap-2">
          <span class="text-xs font-medium text-gray-700">{{ day.count }}</span>
          <div class="dashboard-trend-bar flex h-28 w-full items-end rounded bg-gray-50 p-1">
            <div class="w-full rounded bg-primary transition-all" :style="{ height: `${barHeight(day.count)}%` }" :title="`${day.label}: ${day.count} 项`" />
          </div>
          <span class="text-xs text-gray-500">{{ day.label }}</span>
        </div>
      </div>
    </t-card>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import AsyncState from './AsyncState.vue'
import StatusTag from './StatusTag.vue'
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

const progressStatus = status => status === 'FAILED' ? 'error' : status === 'COMPLETED' ? 'success' : 'active'
const statusProgress = theme => theme === 'danger' ? 'error' : theme === 'success' ? 'success' : theme === 'warning' ? 'warning' : 'active'
const barHeight = count => Math.max(6, Math.round((count / maxTrendCount.value) * 100))
</script>

<style scoped>
.dashboard-details-panel {
  min-width: 0;
}

.dashboard-detail-card {
  min-width: 0;
  border-color: var(--app-border);
  background: var(--app-surface);
}

.dashboard-detail-card :deep(.t-card__header) {
  padding: var(--app-spacing-4) var(--app-spacing-5) 0;
  border-bottom: 0;
}

.dashboard-detail-card :deep(.t-card__body) {
  min-width: 0;
  padding: var(--app-spacing-4) var(--app-spacing-5) var(--app-spacing-5);
}

.dashboard-detail-card__heading {
  min-width: 0;
}

.dashboard-detail-card__heading h3,
.dashboard-detail-card__heading p {
  margin: 0;
}

.dashboard-detail-card__heading h3 {
  color: var(--app-text-primary);
}

.dashboard-detail-card__heading p {
  margin-top: var(--app-spacing-1);
  color: var(--app-text-secondary);
}

.dashboard-status-row,
.dashboard-active-job,
.dashboard-trend-day {
  min-width: 0;
}

.dashboard-active-job {
  border-color: var(--app-border);
  background: var(--app-surface-muted);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.dashboard-active-job:hover {
  border-color: var(--app-border-strong);
  box-shadow: var(--app-shadow);
}

.dashboard-trend-chart {
  min-width: 420px;
}

.dashboard-trend-bar {
  min-height: 7rem;
  background: var(--app-surface-muted);
}

@media (max-width: 520px) {
  .dashboard-detail-card :deep(.t-card__header),
  .dashboard-detail-card :deep(.t-card__body) {
    padding-left: var(--app-spacing-4);
    padding-right: var(--app-spacing-4);
  }

  .dashboard-trend-chart {
    min-width: 0;
    gap: var(--app-spacing-1);
  }
}
</style>
