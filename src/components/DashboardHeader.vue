<template>
  <header v-cloak class="dashboard-header" aria-label="实时设备看板导航">
    <div class="dashboard-header__brand">
      <span class="dashboard-header__brand-icon" aria-hidden="true">
        <PrintIcon size="18" />
      </span>
      <div class="dashboard-header__brand-title-row">
        <h1>{{ labels.title }}</h1>
        <t-tag theme="primary" variant="light-outline" size="small">
          <template #icon><Location size="12" /></template>
          {{ workshopName }}
        </t-tag>
      </div>
    </div>

    <div class="dashboard-header__stats" aria-label="设备状态统计">
      <t-tag theme="default" variant="dark" class="dashboard-header__total">
        <span>{{ labels.total }}</span>
        <strong>{{ totalCount }}</strong>
      </t-tag>
      <t-tag
        v-for="item in statusItems"
        :key="item.key"
        :theme="item.theme"
        variant="light-outline"
        size="small"
        class="dashboard-header__status"
      >
        <span class="dashboard-header__status-dot" :class="`dashboard-header__status-dot--${item.theme}`"></span>
        <span>{{ item.label }}</span>
        <strong>{{ item.count }}</strong>
      </t-tag>
    </div>

    <div class="dashboard-header__actions">
      <span v-if="lastUpdateTime" class="dashboard-header__updated">
        <TimeIcon size="13" />
        {{ labels.updatedAt }} <strong>{{ lastUpdateTime }}</strong>
      </span>
      <slot name="actions"></slot>
      <t-button
        theme="primary"
        size="small"
        :icon="renderIcon(Refresh)"
        :loading="isRefreshing"
        @click="handleRefresh"
      >
        {{ isRefreshing ? labels.refreshing : labels.refresh }}
      </t-button>
      <slot name="fullscreen-action"></slot>
    </div>
  </header>
</template>

<script setup>
import { computed, ref } from 'vue'
import { LocationIcon as Location, PrintIcon, RefreshIcon as Refresh, TimeIcon } from 'tdesign-icons-vue-next'
import { PRINTER_STATE } from '@/utils/constants'
import { renderIcon } from '@/utils/tdesign'

defineOptions({ name: 'DashboardHeader' })

const labels = {
  title: 'FabMatrix 3D 打印控制系统',
  total: '设备总数',
  printing: '打印中',
  standby: '待机',
  completed: '已完成',
  paused: '已暂停',
  fatal: '致命错误',
  printError: '打印中断',
  refresh: '刷新',
  refreshing: '刷新中...',
  updatedAt: '更新于'
}

const props = defineProps({
  statusCounts: {
    type: Object,
    required: true,
    default: () => ({})
  },
  workshopName: {
    type: String,
    default: '3F-一号车间'
  },
  lastUpdateTime: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['refresh'])
const isRefreshing = ref(false)

const totalCount = computed(() => Object.values(props.statusCounts).reduce((sum, count) => sum + (count || 0), 0))
const printingCount = computed(() => props.statusCounts[PRINTER_STATE.PRINTING] || 0)
const fatalCount = computed(() => (
  (props.statusCounts[PRINTER_STATE.FAULT] || 0) +
  (props.statusCounts[PRINTER_STATE.SYS_ERROR] || 0)
))
const statusItems = computed(() => [
  { key: PRINTER_STATE.PRINTING, label: labels.printing, count: printingCount.value, theme: 'primary' },
  { key: PRINTER_STATE.STANDBY, label: labels.standby, count: props.statusCounts[PRINTER_STATE.STANDBY] || 0, theme: 'success' },
  { key: PRINTER_STATE.COMPLETED, label: labels.completed, count: props.statusCounts[PRINTER_STATE.COMPLETED] || 0, theme: 'default' },
  { key: PRINTER_STATE.PAUSED, label: labels.paused, count: props.statusCounts[PRINTER_STATE.PAUSED] || 0, theme: 'warning' },
  { key: 'fatal', label: labels.fatal, count: fatalCount.value, theme: 'danger' },
  { key: PRINTER_STATE.PRINT_ERROR, label: labels.printError, count: props.statusCounts[PRINTER_STATE.PRINT_ERROR] || 0, theme: 'warning' }
])

function handleRefresh() {
  if (isRefreshing.value) return

  isRefreshing.value = true
  emit('refresh')
  window.setTimeout(() => {
    isRefreshing.value = false
  }, 1500)
}
</script>

<style scoped>
.dashboard-header {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(240px, 1fr);
  gap: var(--app-spacing-3);
  align-items: center;
  min-height: 50px;
  padding: 0 var(--app-spacing-4);
  background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
}

.dashboard-header__brand,
.dashboard-header__brand-title-row,
.dashboard-header__actions,
.dashboard-header__updated {
  display: flex;
  align-items: center;
}

.dashboard-header__brand {
  min-width: 0;
  gap: var(--app-spacing-2);
}

.dashboard-header__brand-icon {
  display: inline-flex;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--td-text-color-anti);
  background: var(--td-brand-color-7);
  border-radius: var(--app-radius);
}

.dashboard-header__brand-title-row {
  min-width: 0;
  gap: var(--app-spacing-2);
}

.dashboard-header h1 {
  margin: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-medium);
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-header__stats {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px;
  overflow-x: auto;
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  scrollbar-width: none;
}

.dashboard-header__stats::-webkit-scrollbar { display: none; }

.dashboard-header__total,
.dashboard-header__status {
  flex: 0 0 auto;
  gap: 6px;
  white-space: nowrap;
}

.dashboard-header__total strong,
.dashboard-header__status strong {
  font-family: var(--app-font-family-mono);
  font-weight: 700;
}

.dashboard-header__status-dot {
  width: 7px;
  height: 7px;
  background: var(--td-text-color-placeholder);
  border-radius: 50%;
}

.dashboard-header__status-dot--primary { background: var(--td-brand-color-6); }
.dashboard-header__status-dot--success { background: var(--td-success-color-6); }
.dashboard-header__status-dot--warning { background: var(--td-warning-color-6); }
.dashboard-header__status-dot--danger { background: var(--td-error-color-6); }

.dashboard-header__actions {
  justify-content: flex-end;
  gap: var(--app-spacing-2);
  min-width: 0;
  white-space: nowrap;
}

.dashboard-header__updated {
  gap: 4px;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-caption);
}

.dashboard-header__updated strong {
  color: var(--app-text-primary);
  font-family: var(--app-font-family-mono);
  font-weight: 500;
}

@media (max-width: 1280px) {
  .dashboard-header {
    grid-template-columns: minmax(220px, 1fr) minmax(0, 1.7fr);
  }

  .dashboard-header__stats {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: flex-start;
  }
}

@media (max-width: 767px) {
  .dashboard-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--app-spacing-2);
    padding: var(--app-spacing-3);
  }

  .dashboard-header__brand-title-row,
  .dashboard-header__actions {
    justify-content: space-between;
  }

  .dashboard-header__actions {
    flex-wrap: wrap;
  }

  .dashboard-header__updated {
    flex: 1 1 100%;
  }
}
</style>
