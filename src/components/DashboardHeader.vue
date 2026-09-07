<template>
  <header v-cloak class="dashboard-header" aria-label="实时设备看板导航">
    <div class="dashboard-header__brand">
      <img class="dashboard-header__brand-logo" src="/icon.png" alt="" aria-hidden="true" />
      <div class="dashboard-header__brand-title-row">
        <h1>{{ labels.title }}</h1>
      </div>
    </div>

    <div class="dashboard-header__actions">
      <span v-if="lastUpdateTime" class="dashboard-header__updated">
        <TimeIcon size="13" />
        {{ labels.updatedAt }} <strong>{{ lastUpdateTime }}</strong>
      </span>
      <t-dropdown
        v-if="workshopOptions.length"
        :options="workshopOptions"
        trigger="click"
        @click="handleWorkshopChange"
      >
        <t-button
          class="dashboard-header__workshop-switch dashboard-header__action-button"
          theme="primary"
          variant="outline"
          size="small"
          aria-label="切换区域"
        >
          <template #icon><Location size="14" /></template>
          <span class="dashboard-header__workshop-name">{{ workshopName }}</span>
          <ChevronDownIcon size="14" />
        </t-button>
      </t-dropdown>
      <t-button
        v-else
        class="dashboard-header__workshop-switch dashboard-header__action-button"
        theme="primary"
        variant="outline"
        size="small"
        disabled
      >
        <template #icon><Location size="14" /></template>
        <span class="dashboard-header__workshop-name">{{ workshopName }}</span>
      </t-button>
      <slot name="actions"></slot>
      <t-button
        class="dashboard-header__action-button"
        theme="default"
        variant="outline"
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
import { ref } from 'vue'
import { ChevronDownIcon, LocationIcon as Location, RefreshIcon as Refresh, TimeIcon } from 'tdesign-icons-vue-next'
import { renderIcon } from '@/utils/tdesign'

defineOptions({ name: 'DashboardHeader' })

const labels = {
  title: '嘉东__联动3D打印实时控制系统',
  refresh: '刷新',
  refreshing: '刷新中...',
  updatedAt: '更新于'
}

const props = defineProps({
  workshopName: {
    type: String,
    default: '3F-一号车间'
  },
  workshopOptions: {
    type: Array,
    default: () => []
  },
  lastUpdateTime: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['refresh', 'workshop-change'])
const isRefreshing = ref(false)

function handleRefresh() {
  if (isRefreshing.value) return

  isRefreshing.value = true
  emit('refresh')
  window.setTimeout(() => {
    isRefreshing.value = false
  }, 1500)
}

function handleWorkshopChange(item) {
  const nextWorkshop = typeof item === 'string' ? item : item?.value ?? item?.content
  if (!nextWorkshop || nextWorkshop === props.workshopName) return

  emit('workshop-change', nextWorkshop)
}
</script>

<style scoped>
.dashboard-header {
  display: flex;
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
  flex: 1 1 auto;
  min-width: 0;
  gap: var(--app-spacing-2);
}

.dashboard-header__brand-logo {
  display: block;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.dashboard-header__brand-title-row {
  flex: 1 1 auto;
  min-width: 0;
  gap: var(--app-spacing-2);
}

.dashboard-header__brand-title-row h1 {
  min-width: 0;
  flex: 1 1 auto;
}

.dashboard-header__workshop-switch {
  min-width: 120px;
}

.dashboard-header__workshop-switch :deep(.t-button__text) {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
}

.dashboard-header__workshop-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-header__workshop-switch :deep(svg) {
  flex: 0 0 auto;
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

.dashboard-header__actions {
  flex: 0 1 auto;
  margin-left: auto;
  justify-content: flex-end;
  gap: var(--app-spacing-2);
  min-width: 0;
  flex-wrap: wrap;
  white-space: nowrap;
}

.dashboard-header__action-button {
  min-width: 80px;
  height: 32px;
  border-radius: var(--app-radius);
}

.dashboard-header__actions :deep(.dashboard-action-button) {
  min-width: 80px;
  height: 32px;
  border-radius: var(--app-radius);
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

@media (max-width: 767px) {
  .dashboard-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--app-spacing-2);
    padding: var(--app-spacing-3);
  }

  .dashboard-header__brand-title-row {
    justify-content: space-between;
  }

  .dashboard-header__updated {
    flex: 1 1 100%;
  }
}
</style>
