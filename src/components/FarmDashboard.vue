<template>
  <div v-cloak class="farm-dashboard h-full bg-gray-100 flex flex-col overflow-hidden">
    <!-- 顶部品牌和操作 -->
    <div class="dashboard-top-shell">
      <dashboard-header :last-update-time="lastUpdateTime" @refresh="handleRefresh">
      <!-- 布局锁定/编辑模式切换按钮 -->
      <template #actions>
        <t-button v-if="canManageLayout && !isEditMode" class="dashboard-action-button" theme="default" variant="outline"
          size="small" :icon="renderIcon(Lock)" @click="toggleEditMode">
          布局设置
        </t-button>
        <t-button v-else-if="canManageLayout" class="dashboard-action-button" theme="primary" variant="base"
          size="small" :icon="renderIcon(Unlock)" @click="saveLayout">
          完成布局
        </t-button>
      </template>
      <template #fullscreen-action>
        <slot name="fullscreen-action"></slot>
      </template>
      </dashboard-header>
      <div v-if="realtimeNotice || store.alerts.length" class="dashboard-alert-stack" aria-live="polite">
        <t-alert v-if="realtimeNotice" theme="warning" class="dashboard-realtime-alert" :close-btn="false">
          <template #default>
            <span class="dashboard-alert__message">{{ realtimeNotice }}</span>
          </template>
          <template #operation>
            <t-button size="small" variant="outline" :loading="reconnecting" @click="reconnectRealtime">
              重新连接
            </t-button>
          </template>
        </t-alert>
        <t-alert v-for="alert in store.alerts" :key="alert.id" :theme="alert.theme" :title="alert.title"
          :message="alert.message" :close-btn="true" @close="store.dismissAlert(alert.id)" />
      </div>
    </div>

    <section class="stat-grid" aria-label="设备统计">
      <div v-for="stat in statCards" :key="stat.key" class="stat-card"
        :class="[`stat-card--${stat.tone}`, { 'stat-card--interactive': stat.to }]"
        :role="stat.to ? 'button' : undefined" :tabindex="stat.to ? 0 : undefined"
        :aria-label="stat.to ? `查看${stat.label}` : undefined" @click="stat.to && goTo(stat.to)"
        @keydown.enter.prevent="stat.to && goTo(stat.to)" @keydown.space.prevent="stat.to && goTo(stat.to)">
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

    <!-- 独立车间看板容器 - 响应式布局，与状态栏对齐 -->
    <div class="farm-dashboard__workshop dashboard-workshop-scroll app-scroll-region relative w-full flex-1 px-4 pb-4 bg-gray-100">

      <!-- 厂房网格布局 - 与DashboardHeader保持相同最大宽度 -->
      <div class="farm-dashboard__workshop-surface w-full max-w-[1920px] mx-auto bg-gray-100 border border-gray-200 rounded-xl shadow-sm p-4">
        <!-- 使用 GridMap 组件 -->
        <grid-map :device-matrix="store.deviceMatrix" :devices="store.rawDeviceList" :real-time-status="store.realTimeStatus"
          :grid-config="store.GRID_CONFIG" :is-edit-mode="isEditMode" :dragged-device="draggedDevice"
          :drag-over-cell="dragOverCell" @dragstart="handleDragStart" @dragend="handleDragEnd"
          @dragenter="handleDragEnter" @dragleave="handleDragLeave" @drop="handleDrop" @cell-click="handleCellClick" />
      </div>
    </div>

    <!-- 绑定设备弹窗 -->
    <bind-device-dialog v-model:visible="bindDialogVisible" :target-slot-label="targetSlotLabel"
      @confirm="performBind" />

    <!-- 设备详情抽屉 - 使用 DeviceDetailDrawer 组件 -->
    <device-detail-drawer v-model="drawerVisible" :device="activeDevice" :real-time-data="activeRealTimeData"
      :can-manage-device="userStore.isAdmin" :action-loading="controlLoading"
      @action="handlePrinterAction" @emergency-stop="handleEmergencyStop" @remove="handleRemoveFromBoard"
      @closed="handleDrawerClosed" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircleIcon,
  ChevronRightIcon,
  DashboardIcon,
  ErrorCircleIcon,
  LockOnIcon as Lock,
  LockOffIcon as Unlock,
  PrintIcon
} from 'tdesign-icons-vue-next'
import { message, confirmMessage } from '@/utils/message'
import { renderIcon } from '@/utils/tdesign'
import { useUserStore } from '@/stores/user'
import { usePrinterStore } from '@/stores/printer'
import { emergencyStopPrinter, pausePrinter, resumePrinter, cancelPrinter } from '@/api/printer'
import { getJobPage } from '@/api/job'
import { PRINTER_STATUS } from '@/utils/constants'
import { normalizePrinterStatus } from '@/utils/dataAdapters'
import DashboardHeader from './DashboardHeader.vue'
import GridMap from './grid/GridMap.vue'
import BindDeviceDialog from './BindDeviceDialog.vue'
import DeviceDetailDrawer from './device/DeviceDetailDrawer.vue'

defineOptions({ name: 'FarmDashboard' })

const props = defineProps({
  realtimeNoticeOverride: {
    type: String,
    default: ''
  }
})

// ============================================
// Store
// ============================================

const store = usePrinterStore()
const userStore = useUserStore()
const router = useRouter()
const controlLoading = ref(false)
const historyJobs = ref([])
const historyLoading = ref(false)
const historyError = ref('')
const reconnecting = ref(false)

// ============================================
// Reactive State
// ============================================

/** 编辑模式状态 - 默认锁定监控模式 */
const isEditMode = ref(false)
const canManageLayout = computed(() => userStore.isAdmin)

watch(canManageLayout, canManage => {
  if (!canManage) isEditMode.value = false
})

/** 拖拽相关状态 */
const draggedDevice = ref(null)
const draggedFrom = ref(null)
const dragOverCell = ref(null)

/** 绑定设备弹窗相关状态 */
const bindDialogVisible = ref(false)
const targetSlot = ref({ row: null, col: null }) // 目标槽位坐标（物理坐标）

/** 设备详情抽屉相关状态 */
const drawerVisible = ref(false)
const activeDevice = ref(null)

/** 最后更新时间 */
const lastUpdateTime = ref('')

/**
 * 更新最后更新时间
 */
function updateLastUpdateTime() {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  lastUpdateTime.value = `${hours}:${minutes}:${seconds}`
}

// 初始化更新时间
updateLastUpdateTime()

// ============================================
// Computed Properties
// ============================================

/**
 * 目标槽位标签显示
 */
const targetSlotLabel = computed(() => {
  if (targetSlot.value.row === null || targetSlot.value.col === null) return ''
  const rowLabel = String.fromCharCode(65 + targetSlot.value.row - 1)
  return `${rowLabel}-${targetSlot.value.col.toString().padStart(2, '0')}`
})

/** 当前设备的实时状态数据 */
const activeRealTimeData = computed(() => {
  if (!activeDevice.value) return null
  return store.realTimeStatus[String(activeDevice.value.id)]
})

const realtimeNotice = computed(() => props.realtimeNoticeOverride || (
  store.isRecovering
    ? '正在恢复实时状态，当前显示最近一次可用快照'
    : store.isRealtimeStale
      ? '实时状态可能已陈旧，当前看板正在重新收敛'
      : store.wsConnectionState !== 'OPEN'
        ? '实时连接未建立，当前看板展示 REST 快照数据'
        : ''
))

function getEffectiveStatus(device) {
  const realtime = store.realTimeStatus[String(device.id)]
  if (realtime?.connectionStatus === 'OFFLINE') return PRINTER_STATUS.OFFLINE
  return normalizePrinterStatus(
    realtime?.businessStatus || realtime?.unifiedState || realtime?.state || device.status
  )
}

const dashboardStatusCounts = computed(() => store.rawDeviceList.reduce((counts, device) => {
  const status = getEffectiveStatus(device)
  counts[status] = (counts[status] || 0) + 1
  return counts
}, {}))

const statCards = computed(() => {
  const counts = dashboardStatusCounts.value
  const total = Number(store.totalDevices) || 0
  const printing = counts[PRINTER_STATUS.PRINTING] || 0
  const idle = counts[PRINTER_STATUS.IDLE] || 0
  const abnormal = [PRINTER_STATUS.ERROR, PRINTER_STATUS.OFFLINE, PRINTER_STATUS.UNKNOWN]
    .reduce((sum, status) => sum + (counts[status] || 0), 0)
  const online = total - (counts[PRINTER_STATUS.OFFLINE] || 0) - (counts[PRINTER_STATUS.UNKNOWN] || 0)

  return [
    {
      key: 'printers',
      label: '打印机总数',
      value: total,
      description: `${Math.max(0, online)} 台设备在线`,
      icon: DashboardIcon,
      tone: 'primary',
      to: '/printers'
    },
    {
      key: 'printing',
      label: '正在打印',
      value: printing,
      description: '实时打印中的设备',
      icon: PrintIcon,
      tone: 'blue',
      to: { path: '/printers', query: { status: PRINTER_STATUS.PRINTING } }
    },
    {
      key: 'idle',
      label: '空闲打印机',
      value: idle,
      description: '当前可分配任务的设备',
      icon: CheckCircleIcon,
      tone: 'orange',
      to: { path: '/printers', query: { status: PRINTER_STATUS.IDLE } }
    },
    {
      key: 'errors',
      label: '异常设备',
      value: abnormal,
      description: abnormal ? '请及时处理异常' : '当前运行正常',
      icon: ErrorCircleIcon,
      tone: abnormal ? 'red' : 'green',
      to: '/printers'
    }
  ]
})

function goTo(path) {
  router.push(path)
}

async function fetchHistory() {
  historyLoading.value = true
  historyError.value = ''
  try {
    const [completedResult, failedResult] = await Promise.all([
      getJobPage({ pageNum: 1, pageSize: 100, status: 'COMPLETED' }),
      getJobPage({ pageNum: 1, pageSize: 100, status: 'FAILED' })
    ])
    historyJobs.value = [
      ...(completedResult.data?.records || []),
      ...(failedResult.data?.records || [])
    ]
  } catch (error) {
    historyError.value = error?.message || '历史任务加载失败，请重试'
  } finally {
    historyLoading.value = false
  }
}

// ============================================
// Event Handlers - Drag & Drop
// ============================================

/**
 * 处理拖拽开始事件
 * @param {Object} device - 被拖拽的设备对象
 * @param {number} rowIndex - 起始行索引
 * @param {number} colIndex - 起始列索引
 */
function handleDragStart(device, rowIndex, colIndex) {
  draggedDevice.value = device
  draggedFrom.value = { row: rowIndex, col: colIndex }
}

/**
 * 处理拖拽进入事件
 * @param {number} rowIndex - 目标行索引
 * @param {number} colIndex - 目标列索引
 */
function handleDragEnter(rowIndex, colIndex) {
  // 不能放置到过道
  if (store.isAisleCell(colIndex)) return
  dragOverCell.value = { row: rowIndex, col: colIndex }
}

/**
 * 处理拖拽离开事件
 */
function handleDragLeave() {
  dragOverCell.value = null
}

/**
 * 处理拖拽结束事件
 */
function handleDragEnd() {
  draggedDevice.value = null
  draggedFrom.value = null
  dragOverCell.value = null
}

/**
 * 处理放置事件
 * @param {number} targetRowIndex - 目标行索引
 * @param {number} targetColIndex - 目标列索引
 */
async function handleDrop(targetRowIndex, targetColIndex) {
  // 防止放置到过道
  if (store.isAisleCell(targetColIndex)) return

  // 如果没有拖拽的设备，不处理
  if (!draggedDevice.value || !draggedFrom.value) return

  const fromRow = draggedFrom.value.row
  const fromCol = draggedFrom.value.col

  // 如果放置到同一位置，不处理
  if (fromRow === targetRowIndex && fromCol === targetColIndex) {
    handleDragEnd()
    return
  }

  // 计算新的物理坐标
  const newGridRow = targetRowIndex + 1
  const newGridCol = store.getPhysicalColByIndex(targetColIndex)

  // 获取目标位置的设备（如果有）
  const targetDevice = store.deviceMatrix[targetRowIndex][targetColIndex]

  try {
    if (targetDevice && typeof targetDevice === 'object') {
      // 放置到已有设备位置 - 交换位置
      await swapDevicesPosition(
        draggedDevice.value,
        { row: fromRow, col: fromCol },
        targetDevice,
        { row: targetRowIndex, col: targetColIndex }
      )
    } else {
      // 放置到空位置 - 移动设备
      await moveDeviceToEmptySlot(
        draggedDevice.value,
        { row: fromRow, col: fromCol },
        { row: newGridRow, col: newGridCol }
      )
    }

  message.success('设备位置已更新')
  } catch (error) {
    console.error('更新设备位置失败:', error)
  message.error('更新设备位置失败，请重试')
  } finally {
    handleDragEnd()
  }
}

// ============================================
// Device Operations
// ============================================

/**
 * 移动设备到空位置
 * @param {Object} device - 要移动的设备
 * @param {Object} from - 原位置 {row, col}
 * @param {Object} to - 新位置 {row, col}
 */
async function moveDeviceToEmptySlot(device, from, to) {
  const payload = [{
    id: device.id,
    gridRow: to.row,
    gridCol: to.col
  }]

  await store.updateDevicePositions(payload)
}

/**
 * 交换两台设备的位置
 * @param {Object} device1 - 第一台设备
 * @param {Object} pos1 - 第一台设备原位置 {row, col}
 * @param {Object} device2 - 第二台设备
 * @param {Object} pos2 - 第二台设备原位置 {row, col}
 */
async function swapDevicesPosition(device1, pos1, device2, pos2) {
  // 计算物理坐标
  const device1NewRow = pos2.row + 1
  const device1NewCol = store.getPhysicalColByIndex(pos2.col)
  const device2NewRow = pos1.row + 1
  const device2NewCol = store.getPhysicalColByIndex(pos1.col)

  // 批量更新两个设备的位置
  const payload = [
    {
      id: device1.id,
      gridRow: device1NewRow,
      gridCol: device1NewCol
    },
    {
      id: device2.id,
      gridRow: device2NewRow,
      gridCol: device2NewCol
    }
  ]

  await store.updateDevicePositions(payload)
}

/**
 * 处理单元格点击事件
 * @param {Object} device - 设备对象（可能为 null）
 * @param {number} rowIndex - 行索引（0-based）
 * @param {number} colIndex - 列索引（0-based）
 */
function handleCellClick(device, rowIndex, colIndex) {
  // 锁定布局时禁止点击空槽位绑定设备
  if (!device && !isEditMode.value) {
    return
  }

  if (device) {
    // 点击设备 - 打开详情抽屉
    activeDevice.value = device
    drawerVisible.value = true
  } else {
    // 点击空槽位 - 打开绑定弹窗（仅在编辑模式下）
    targetSlot.value = {
      row: rowIndex + 1,
      col: store.getPhysicalColByIndex(colIndex)
    }
    bindDialogVisible.value = true
  }
}

/**
 * 执行设备绑定
 * @param {number} deviceId - 设备ID
 */
async function performBind(deviceId) {
  if (!canManageLayout.value) {
    message.error('当前账号没有绑定设备的权限')
    return
  }

  try {
    // 先调用位置更新 API
    const positionPayload = [{
      id: deviceId,
      gridRow: targetSlot.value.row,
      gridCol: targetSlot.value.col
    }]

    await store.updateDevicePositions(positionPayload)

    // 再调用打印机更新 API 设置 machineNumber
    await store.updateDevice({
      id: deviceId,
      machineNumber: targetSlotLabel.value
    })

  message.success('设备绑定成功')
    bindDialogVisible.value = false
  } catch (error) {
    console.error('绑定设备失败:', error)
  message.error('绑定设备失败，请重试')
  }
}

// ============================================
// Device Detail Drawer Functions
// ============================================

/**
 * 处理打印机操作
 * @param {string} action - 操作类型
 * @param {Object} device - 设备对象
 */
async function handlePrinterAction(action, device) {
  const actionMap = {
    pause: '暂停打印',
    resume: '恢复打印',
    cancel: '取消任务'
  }

  try {
    await confirmMessage(`确定要对 ${device.machineNumber || device.name} 执行“${actionMap[action]}”吗？`, '操作确认', {
      confirmButtonText: actionMap[action],
      cancelButtonText: '取消',
      type: action === 'cancel' ? 'danger' : 'warning'
    })

    controlLoading.value = true
    if (action === 'pause') {
      await pausePrinter(device.id)
    } else if (action === 'resume') {
      await resumePrinter(device.id)
    } else if (action === 'cancel') {
      if (!device.currentJobId && !store.realTimeStatus[device.id]?.currentJobId) {
        message.warning('该设备当前没有可取消的任务')
        return
      }
      await cancelPrinter(device.id)
    }

    await store.fetchDeviceData()
    message.success(`${actionMap[action]}成功`)
  } catch (error) {
    if (error !== 'cancel') console.error(`${actionMap[action]}失败:`, error)
  } finally {
    controlLoading.value = false
  }
}

/**
 * 处理紧急停机
 * @param {Object} device - 设备对象
 */
async function handleEmergencyStop(device) {
  try {
    await confirmMessage(
      `紧急停机会立即停止 ${device.machineNumber || device.name}，确定继续吗？`,
      '紧急停机确认',
      { confirmButtonText: '确认急停', cancelButtonText: '取消', type: 'danger' }
    )
    controlLoading.value = true
    await emergencyStopPrinter(device.id)
    await store.fetchDeviceData()
    message.success('紧急停机成功')
  } catch (error) {
    if (error !== 'cancel') console.error('紧急停机失败:', error)
  } finally {
    controlLoading.value = false
  }
}

/**
 * 处理从看板下架设备
 * @param {Object} device - 设备对象
 */
async function handleRemoveFromBoard(device) {
  if (!canManageLayout.value) {
    message.error('当前账号没有下架设备的权限')
    return
  }

  try {
    await store.removeDeviceFromBoard(device.id)

  message.success(`设备 ${device.machineNumber} 已从看板下架`)

    // 关闭抽屉
    drawerVisible.value = false
    activeDevice.value = null
  } catch (error) {
    console.error('下架设备失败:', error)
  message.error('下架设备失败，请重试')
  }
}

/**
 * 处理抽屉关闭事件
 */
function handleDrawerClosed() {
  drawerVisible.value = false
  activeDevice.value = null
}

// ============================================
// Layout Edit Mode Functions
// ============================================

/**
 * 切换编辑模式
 */
function toggleEditMode() {
  if (!canManageLayout.value) {
    message.error('当前账号没有维护网格布局的权限')
    return
  }
  isEditMode.value = true
  message.info('已进入编辑模式，现在可以拖拽设备调整位置')
}

/**
 * 保存布局位置
 * 预留函数桩，用于后续对接保存到数据库的 API
 */
async function saveLayoutPositions() {
  if (!canManageLayout.value) return
  // 拖拽时已经通过 /printers/positions 持久化，这里只负责结束编辑状态。
}

/**
 * 保存布局并退出编辑模式
 */
async function saveLayout() {
  if (!canManageLayout.value) {
    isEditMode.value = false
    return
  }

  try {
    await saveLayoutPositions()
    isEditMode.value = false
  message.success('布局已保存')
  } catch (error) {
    console.error('保存布局失败:', error)
  message.error('保存布局失败，请重试')
  }
}

// ============================================
// Action Handlers
// ============================================

/**
 * 处理刷新按钮点击 - 刷新 REST 设备和任务快照。
 * WebSocket 生命周期由 App.vue 管理；此处只请求最新基线。
 */
async function handleRefresh() {
  try {
    message.info('正在刷新打印机数据...')

    // 重新获取设备和任务数据，实时连接继续由应用根部维护。
    await Promise.all([store.fetchDeviceData(), fetchHistory()])

    updateLastUpdateTime()
    message.success('打印机状态已刷新')
  } catch (error) {
    console.error('刷新打印机状态失败:', error)
    message.error('刷新打印机状态失败，请重试')
  }
}

function reconnectRealtime() {
  if (reconnecting.value || store.wsConnectionState === 'OPEN') return
  reconnecting.value = true
  store.connectWs()
  window.setTimeout(() => {
    reconnecting.value = false
  }, 800)
}

// ============================================
// Lifecycle Hooks
// ============================================

onMounted(() => {
  // 先取得服务端布局，再取得完整设备快照；实时连接由应用根部统一维护
  initializeDashboard()
})

async function initializeDashboard() {
  await store.loadLayout()
  await store.fetchDeviceData()
  fetchHistory()
}
</script>

<style scoped>
/* ============================================
   v-cloak: 防止 Vue 未加载完成时显示内容
   ============================================ */
[v-cloak] {
  display: none !important;
}

/* ============================================
   编辑模式视觉反馈
   ============================================ */

/* 编辑模式：工程网格背景 */
.is-edit-mode :deep(.workshop-canvas) {
  background-image:
    linear-gradient(to right, #e5e7eb 1px, transparent 1px),
    linear-gradient(to bottom, #e5e7eb 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: center center;
  border-radius: 6px;
  background-color: #f3f4f6;
}

/* 编辑模式：行标签和列标题高亮 */
.is-edit-mode :deep(.row-label) {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 700;
}

.is-edit-mode :deep(.col-header) {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 700;
}

.is-edit-mode :deep(.col-header.aisle-header) {
  background: #e8e0d0;
  color: #7a6545;
}

/* 编辑模式：过道区域淡化 */
.is-edit-mode :deep(.aisle-cell) {
  background: #e8e0d0;
  border: 2px dashed #c4b8a0;
  opacity: 0.8;
}

.dashboard-workshop-scroll {
  min-height: 0;
  overflow: auto;
}

.farm-dashboard {
  min-width: 0;
  background: var(--app-page-background);
  color: var(--app-text-primary);
}

.farm-dashboard__workshop {
  box-sizing: border-box;
  background: var(--app-page-background);
}

.farm-dashboard__workshop-surface {
  box-sizing: border-box;
  min-width: 0;
  background: var(--app-surface);
  border-color: var(--app-border);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-spacing-4);
  padding: var(--app-spacing-3) var(--app-spacing-4) var(--app-spacing-4);
  background: var(--app-page-background);
}

.stat-card {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 142px;
  padding: var(--app-spacing-4);
  overflow: hidden;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
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
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
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
  flex-shrink: 0;
  color: var(--app-primary);
  background: var(--app-primary-light);
  border-radius: var(--app-radius-round);
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

.dashboard-top-shell {
  flex: 0 0 auto;
  min-width: 0;
}

.dashboard-alert-stack {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 var(--app-spacing-4);
  background: var(--app-page-background);
}

.dashboard-alert-stack :deep(.t-alert) {
  min-height: 32px;
  padding: 4px 8px;
  border-radius: 0;
}

.dashboard-realtime-alert :deep(.t-alert__content),
.dashboard-realtime-alert :deep(.t-alert__message) {
  display: flex;
  align-items: center;
  min-width: 0;
}

.dashboard-realtime-alert :deep(.t-alert__message) {
  justify-content: space-between;
  gap: var(--app-spacing-3);
}

.dashboard-realtime-alert :deep(.t-alert__description),
.dashboard-alert__message {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-realtime-alert :deep(.t-alert__operation) {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 0;
}

@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .farm-dashboard__workshop {
    padding-left: var(--app-spacing-3);
    padding-right: var(--app-spacing-3);
  }

  .farm-dashboard__workshop-surface {
    padding: var(--app-spacing-3);
  }
}
</style>
