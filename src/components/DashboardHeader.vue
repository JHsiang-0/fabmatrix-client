<template>
  <!--
    仪表盘头部组件 - 完全响应式重构版
    设计原则：
    1. 移动端（< 768px）：垂直堆叠布局，减少信息量
    2. 平板（768px - 1279px）：水平布局，适度紧凑
    3. 桌面（>= 1280px）：完整水平布局，所有功能可见
  -->
  <div v-cloak class="dashboard-header flex flex-col lg:flex-row justify-between items-stretch lg:items-center p-fluid-md bg-white rounded-lg shadow-sm gap-fluid-md">

    <!-- 左侧：标题和车间信息 -->
    <div class="dashboard-header__identity header-left flex items-center shrink-0">
      <div class="flex items-center gap-3">
        <!-- 图标：移动端缩小 -->
        <office-building :size="isMobile ? '24' : '28'" class="text-primary" />

        <div class="flex flex-col gap-0.5">
          <!-- 标题：响应式字体 -->
          <h2 class="text-fluid-lg font-bold text-gray-900 leading-tight">{{ labels.title }}</h2>

          <!-- 车间信息：移动端隐藏详细地址 -->
          <span class="inline-flex items-center gap-1 text-fluid-xs text-gray-500 font-medium">
            <location size="12" class="text-red-500" />
            {{ workshopName }}
          </span>
        </div>
      </div>
    </div>

    <!-- 中间：状态统计条 - 响应式布局 -->
    <div class="dashboard-header__summary header-center flex flex-col items-center gap-2 flex-1 lg:max-w-[800px]">
      <!-- 状态标签行：平板和桌面端使用 flex，移动端使用 wrap -->
      <div class="dashboard-header__stats stats-bar flex flex-wrap items-center gap-1 justify-center lg:justify-center">

        <!-- 设备总数 - 始终显示 -->
        <StatBadge
          :count="totalCount"
          :label="labels.total"
          bgClass="bg-gradient-to-r from-gray-100 to-gray-200"
          iconBgClass="bg-gray-600"
        />

        <div class="w-px h-5 bg-gray-100 mx-1 shrink-0" aria-hidden="true"></div>

        <!-- 打印中 - 高亮显示 -->
        <StatBadge
          :count="statusCounts.PRINTING"
          :label="labels.printing"
          bgClass="bg-gradient-to-r from-blue-50 to-blue-100"
          iconBgClass="bg-blue-600"
           :iconComponent="IconNozzle"
          :highlight="statusCounts.PRINTING > 0"
          highlightRing="ring-blue-300"
        />

        <!-- 待机 -->
        <StatBadge
          :count="statusCounts.STANDBY"
          :label="labels.standby"
          bgClass="bg-gradient-to-r from-blue-50 to-blue-100"
          iconBgClass="bg-blue-500"
          iconType="circle-check"
        />

        <!-- 已完成 -->
        <StatBadge
          :count="statusCounts.COMPLETED"
          :label="labels.completed"
          bgClass="bg-gradient-to-r from-green-50 to-green-100"
          iconBgClass="bg-green-600"
          iconType="circle-check-filled"
        />

        <!-- 已暂停 -->
        <StatBadge
          :count="statusCounts.PAUSED"
          :label="labels.paused"
          bgClass="bg-gradient-to-r from-yellow-50 to-yellow-100"
          iconBgClass="bg-yellow-600"
          iconType="video-pause"
          :highlight="statusCounts.PAUSED > 0"
          highlightRing="ring-yellow-300"
        />

        <!-- 致命错误 - 严重警告 -->
        <StatBadge
          :count="fatalCount"
          :label="labels.fatal"
          bgClass="bg-gradient-to-r from-red-50 to-red-100"
          iconBgClass="bg-red-600"
          iconType="circle-close"
          :highlight="fatalCount > 0"
          highlightRing="ring-red-300"
        />

        <!-- 打印中断 -->
        <StatBadge
          :count="statusCounts.PRINT_ERROR"
          :label="labels.printError"
          bgClass="bg-gradient-to-r from-orange-50 to-orange-100"
          iconBgClass="bg-orange-600"
          iconType="warning"
          :highlight="statusCounts.PRINT_ERROR > 0"
          highlightRing="ring-orange-300"
        />
      </div>

      <!-- 进度概览 - 仅在有设备时显示 -->
      <div class="dashboard-header__progress flex items-center gap-3 w-full max-w-[400px]" v-if="totalCount > 0">
        <div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
          <div class="h-full bg-blue-600 transition-all" :style="{ width: printingPercent + '%' }"></div>
          <div class="h-full bg-green-600 transition-all" :style="{ width: completedPercent + '%' }"></div>
          <div class="h-full bg-blue-500 transition-all" :style="{ width: standbyPercent + '%' }"></div>
          <div class="h-full bg-red-600 transition-all" :style="{ width: errorPercent + '%' }"></div>
        </div>
        <span class="text-fluid-xs text-gray-500 font-medium whitespace-nowrap">{{ printingCount }} 台正在打印</span>
      </div>
    </div>

    <!-- 右侧：操作按钮 - 响应式布局 -->
    <div class="dashboard-header__actions action-group flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:gap-3 shrink-0">
      <!-- 外部传入的操作按钮（解锁/保存布局） -->
      <slot name="actions"></slot>

      <!-- 刷新按钮 - 移动端全宽 -->
      <t-button
        :icon="renderIcon(Refresh)"
        size="medium"
        :class="{ 'w-full sm:w-auto': isMobile }"
        :loading="isRefreshing"
        @click="handleRefresh"
      >
        <span class="hidden sm:inline">{{ isRefreshing ? labels.refreshing : labels.refresh }}</span>
        <span class="sm:hidden">{{ isRefreshing ? '刷新中...' : '刷新' }}</span>
      </t-button>

      <!-- 最后更新时间 - 移动端隐藏，平板显示 -->
      <span
        class="dashboard-header__updated hidden sm:flex items-center justify-center gap-1 text-fluid-xs text-gray-400 font-normal"
        v-if="lastUpdateTime"
      >
        <clock size="12" />
        {{ labels.updatedAt }} {{ lastUpdateTime }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  BuildingIcon as OfficeBuilding,
  LocationIcon as Location,
  RefreshIcon as Refresh,
  TimeIcon as Clock
} from 'tdesign-icons-vue-next'
import IconNozzle from './icons/IconNozzle.vue'
import { PRINTER_STATE } from '@/utils/constants'
import { renderIcon } from '@/utils/tdesign'
import StatBadge from './StatBadge.vue'

defineOptions({ name: 'DashboardHeader' })

// ============================================
// 响应式断点检测
// ============================================

const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)
// 监听窗口大小变化
let resizeHandler = null

onMounted(() => {
  resizeHandler = () => {
    windowWidth.value = window.innerWidth
  }
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
})

// ============================================
// Data - 中文标签配置
// ============================================

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
  updatedAt: '更新于',
  unknown: '离线/未知'
}

// ============================================
// Props
// ============================================

const props = defineProps({
  /** 状态计数对象 - 10个标准状态（包含 UNKNOWN） */
  statusCounts: {
    type: Object,
    required: true,
    default: () => ({
      [PRINTER_STATE.UNKNOWN]: 0,
      [PRINTER_STATE.PRINTING]: 0,
      [PRINTER_STATE.STANDBY]: 0,
      [PRINTER_STATE.COMPLETED]: 0,
      [PRINTER_STATE.PAUSED]: 0,
      [PRINTER_STATE.FAULT]: 0,
      [PRINTER_STATE.SYS_ERROR]: 0,
      [PRINTER_STATE.PRINT_ERROR]: 0,
      [PRINTER_STATE.STARTING]: 0,
      [PRINTER_STATE.CANCELLED]: 0
    })
  },
  /** 车间名称 */
  workshopName: {
    type: String,
    default: '3F-一号车间'
  },
  /** 最后更新时间 */
  lastUpdateTime: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['refresh'])

// ============================================
// Reactive State
// ============================================

const isRefreshing = ref(false)

// ============================================
// Computed
// ============================================

/**
 * 设备总数
 */
const totalCount = computed(() => {
  return Object.values(props.statusCounts).reduce((sum, count) => sum + (count || 0), 0)
})

/**
 * 打印中数量
 */
const printingCount = computed(() => {
  return props.statusCounts[PRINTER_STATE.PRINTING] || 0
})

/**
 * 致命错误总数（设备故障 + 系统错误）
 */
const fatalCount = computed(() => {
  return (props.statusCounts[PRINTER_STATE.FAULT] || 0) +
    (props.statusCounts[PRINTER_STATE.SYS_ERROR] || 0)
})

/**
 * 各状态百分比
 */
const printingPercent = computed(() => {
  return totalCount.value > 0 ? Math.round((printingCount.value / totalCount.value) * 100) : 0
})

const completedPercent = computed(() => {
  const count = props.statusCounts[PRINTER_STATE.COMPLETED] || 0
  return totalCount.value > 0 ? Math.round((count / totalCount.value) * 100) : 0
})

const standbyPercent = computed(() => {
  const count = props.statusCounts[PRINTER_STATE.STANDBY] || 0
  return totalCount.value > 0 ? Math.round((count / totalCount.value) * 100) : 0
})

const errorPercent = computed(() => {
  const count = fatalCount.value + (props.statusCounts[PRINTER_STATE.PRINT_ERROR] || 0)
  return totalCount.value > 0 ? Math.round((count / totalCount.value) * 100) : 0
})

// ============================================
// Methods
// ============================================

/**
 * 处理刷新按钮点击
 */
function handleRefresh() {
  if (isRefreshing.value) return

  isRefreshing.value = true
  emit('refresh')

  // 1.5秒后恢复按钮状态
  setTimeout(() => {
    isRefreshing.value = false
  }, 1500)
}
</script>

<style scoped>
.dashboard-header {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text-primary);
}

.dashboard-header__identity,
.dashboard-header__summary,
.dashboard-header__actions {
  min-width: 0;
}

.dashboard-header__identity > div:last-child,
.dashboard-header__summary {
  overflow: hidden;
}

.dashboard-header__stats {
  box-sizing: border-box;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
}

.dashboard-header__progress {
  max-width: 100%;
}

.dashboard-header__updated {
  color: var(--app-text-secondary);
}

/* ============================================
   动画关键帧
   ============================================ */
@keyframes pulse-primary {
  0%, 100% {
    box-shadow: 0 0 0 2px rgba(147, 197, 253, 0.5);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(219, 234, 254, 0.5);
  }
}

@keyframes pulse-danger {
  0%, 100% {
    box-shadow: 0 0 0 2px rgba(254, 202, 202, 0.5);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(254, 226, 226, 0.5);
  }
}

.animate-spin {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ============================================
   响应式适配
   ============================================ */

/* 超大屏幕优化（2.5K+）：限制最大宽度，保持内容居中 */
@media (min-width: 1920px) {
  .dashboard-header {
    max-width: 1800px;
    margin-left: auto;
    margin-right: auto;
  }
}

/* 桌面端（1280px - 1919px）：标准布局 */
@media (max-width: 1919px) and (min-width: 1280px) {
  .dashboard-header {
    flex-wrap: nowrap;
  }
}

/* 平板端（768px - 1279px）：适度紧凑 */
@media (max-width: 1279px) and (min-width: 768px) {
  .dashboard-header {
    flex-wrap: wrap;
  }

  .header-center {
    order: 3;
    width: 100%;
    max-width: none;
  }

  .stats-bar {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}

/* 移动端（< 768px）：垂直堆叠 */
@media (max-width: 767px) {
  .dashboard-header {
    flex-direction: column;
    align-items: stretch;
    padding: 0.75rem;
  }

  .header-left,
  .header-right {
    justify-content: center;
  }

  .header-center {
    order: 0;
  }

  .stats-bar {
    justify-content: center;
    gap: 0.5rem;
  }

  /* 移动端：隐藏部分统计标签，仅保留数字 */
  .stat-label {
    display: none;
  }

  .action-group {
    width: 100%;
    justify-content: center;
  }
}

/* 小屏手机（< 375px）：极致紧凑 */
@media (max-width: 374px) {
  .dashboard-header {
    padding: 0.5rem;
  }

  /* 只显示最关键的状态 */
  .stat-item:not(.stat-critical) {
    display: none;
  }
}
</style>
