<template>
  <div v-cloak class="farm-dashboard h-full bg-gray-100 flex flex-col overflow-hidden">
    <!-- 顶部标题和统计 -->
    <div class="dashboard-top-shell">
      <dashboard-header :status-counts="store.statusCounts" :workshop-name="workshopName"
        :last-update-time="lastUpdateTime" @refresh="handleRefresh">
      <!-- 布局编辑入口：管理员在这里完成解锁、调整和保存 -->
      <template #actions>
        <t-button v-if="canManageLayout" :theme="isEditMode ? 'primary' : 'default'"
          :icon="renderIcon(isEditMode ? Unlock : Lock)" :loading="layoutSaving" @click="toggleLayoutEditing">
          {{ isEditMode ? '完成布局' : '布局设置' }}
        </t-button>
        <t-button v-if="canManageLayout && isEditMode" variant="outline" @click="cancelLayoutEditing">
          取消编辑
        </t-button>
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
        <t-alert
          v-for="alert in store.alerts"
          :key="alert.id"
          :theme="alert.theme"
          :title="alert.title"
          :message="alert.message"
          :close-btn="true"
          @close="store.dismissAlert(alert.id)"
        />
      </div>
    </div>

    <dashboard-details-panel
      :status-counts="store.statusCounts"
      :active-jobs="activeJobs"
      :history-jobs="historyJobs"
      :history-loading="historyLoading"
      :history-error="historyError"
      @retry-history="fetchHistory"
    />

    <!-- 独立车间看板容器 - 响应式布局，与状态栏对齐 -->
    <div class="dashboard-workshop-scroll app-scroll-region relative w-full flex-1 px-4 pb-4 bg-gray-100">

      <!-- 厂房网格布局 - 与DashboardHeader保持相同最大宽度 -->
      <div class="w-full max-w-[1920px] mx-auto bg-gray-100 border border-gray-200 rounded-xl shadow-sm p-4">
        <!-- 使用 GridMap 组件 -->
        <grid-map :device-matrix="store.deviceMatrix" :real-time-status="store.realTimeStatus"
          :grid-config="store.gridConfig" :is-edit-mode="isEditMode" :dragged-device="draggedDevice"
          :drag-over-cell="dragOverCell" @dragstart="handleDragStart" @dragend="handleDragEnd"
          @dragenter="handleDragEnter" @dragleave="handleDragLeave" @drop="handleDrop" @cell-click="handleCellClick"
          @dimension-change="handleDimensionChange" @aisle-context="handleAisleContext" />
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

    <grid-aisle-settings-dialog v-model:visible="aisleDialogVisible" :axis="aisleDialog.axis"
      :index="aisleDialog.index" :aisle="aisleDialog.aisle" @confirm="applyAisleSettings" />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { message, confirmMessage } from '@/utils/message'
import { renderIcon } from '@/utils/tdesign'
import { useUserStore } from '@/stores/user'
import { LockOnIcon as Lock, LockOffIcon as Unlock } from 'tdesign-icons-vue-next'
import { usePrinterStore } from '@/stores/printer'
import { useJobStore } from '@/stores/jobStore'
import { emergencyStopPrinter, pausePrinter, resumePrinter, cancelPrinter } from '@/api/printer'
import { getJobPage } from '@/api/job'
import DashboardHeader from './DashboardHeader.vue'
import DashboardDetailsPanel from './DashboardDetailsPanel.vue'
import GridMap from './grid/GridMap.vue'
import GridAisleSettingsDialog from './GridAisleSettingsDialog.vue'
import BindDeviceDialog from './BindDeviceDialog.vue'
import DeviceDetailDrawer from './device/DeviceDetailDrawer.vue'
import { createGridConfig, getOutOfBoundsDevices } from '@/utils/gridLayout'

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
const jobStore = useJobStore()
const controlLoading = ref(false)
const activeJobs = computed(() => jobStore.activeJobs)
const historyJobs = ref([])
const historyLoading = ref(false)
const historyError = ref('')
const reconnecting = ref(false)

// ============================================
// Reactive State
// ============================================

/** 编辑模式状态 - 默认锁定监控模式 */
const isEditMode = ref(false)
const layoutSnapshot = ref(null)
const layoutSaving = ref(false)
const aisleDialogVisible = ref(false)
const aisleDialog = ref({ axis: 'column', index: 1, aisle: null })
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

/** 车间信息 */
const workshopName = ref('3F-一号车间')

/** 最后更新时间 */
const lastUpdateTime = ref('')

const realtimeNotice = computed(() => props.realtimeNoticeOverride || (
  store.isRecovering
    ? '正在恢复实时状态，当前显示最近一次可用快照'
    : store.isRealtimeStale
      ? '实时状态可能已陈旧，当前看板正在重新收敛'
      : store.wsConnectionState !== 'OPEN'
        ? '实时连接未建立，当前看板展示 REST 快照数据'
        : ''
))

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
  const rowLabel = store.formatRowLabel(targetSlot.value.row)
  return `${rowLabel}-${targetSlot.value.col.toString().padStart(2, '0')}`
})

/** 当前设备的实时状态数据 */
const activeRealTimeData = computed(() => {
  if (!activeDevice.value) return null
  return store.realTimeStatus[String(activeDevice.value.id)]
})

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
  // 不能放置到行过道或列过道
  if (store.isAisleRowCell(rowIndex) || store.isAisleCell(colIndex)) return
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
  // 防止放置到行过道或列过道
  if (store.isAisleRowCell(targetRowIndex) || store.isAisleCell(targetColIndex)) return

  // 如果没有拖拽的设备，不处理
  if (!draggedDevice.value || !draggedFrom.value) return

  const fromRow = draggedFrom.value.row
  const fromCol = draggedFrom.value.col

  // 如果放置到同一位置，不处理
  if (fromRow === targetRowIndex && fromCol === targetColIndex) {
    handleDragEnd()
    return
  }

  // 将视觉坐标还原为后端使用的物理坐标
  const newGridRow = store.getPhysicalRowByIndex(targetRowIndex)
  const newGridCol = store.getPhysicalColByIndex(targetColIndex)
  if (newGridRow === null || newGridCol === null) {
    handleDragEnd()
    return
  }

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
  const device1NewRow = store.getPhysicalRowByIndex(pos2.row)
  const device1NewCol = store.getPhysicalColByIndex(pos2.col)
  const device2NewRow = store.getPhysicalRowByIndex(pos1.row)
  const device2NewCol = store.getPhysicalColByIndex(pos1.col)
  if ([device1NewRow, device1NewCol, device2NewRow, device2NewCol].some(value => value === null)) return

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
    const physicalRow = store.getPhysicalRowByIndex(rowIndex)
    const physicalCol = store.getPhysicalColByIndex(colIndex)
    if (physicalRow === null || physicalCol === null) return
    targetSlot.value = {
      row: physicalRow,
      col: physicalCol
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

/** 进入或完成布局编辑。 */
function toggleLayoutEditing() {
  if (!canManageLayout.value) {
    message.error('当前账号没有维护网格布局的权限')
    return
  }
  if (isEditMode.value) {
    saveLayout()
    return
  }
  layoutSnapshot.value = createGridConfig(store.gridConfig)
  isEditMode.value = true
  message.info('已进入布局编辑模式，可调整行列或右键设置过道')
}

function cancelLayoutEditing() {
  if (layoutSnapshot.value) store.updateGridConfig(layoutSnapshot.value)
  layoutSnapshot.value = null
  isEditMode.value = false
  message.info('已取消布局编辑')
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
    layoutSaving.value = true
    await saveLayoutPositions()
    isEditMode.value = false
    layoutSnapshot.value = null
    message.success('布局已保存')
  } catch (error) {
    console.error('保存布局失败:', error)
    message.error('保存布局失败，请重试')
  } finally {
    layoutSaving.value = false
  }
}

async function handleDimensionChange({ axis, delta }) {
  if (!isEditMode.value || !canManageLayout.value) return
  const current = store.gridConfig
  const nextConfig = createGridConfig({
    ...current,
    rowCount: axis === 'row' ? current.rowCount + delta : current.rowCount,
    columnCount: axis === 'column' ? current.columnCount + delta : current.columnCount
  })
  if (nextConfig.rowCount === current.rowCount && nextConfig.columnCount === current.columnCount) return
  await applyGridConfig(nextConfig)
}

async function handleAisleContext({ action, axis, index, aisle }) {
  if (!isEditMode.value || !canManageLayout.value) return
  const axisLabel = axis === 'row' ? '行' : '列'
  const current = store.gridConfig
  const aisles = current.aisles.map(item => ({ ...item }))

  if (action === 'add-aisle' || action === 'edit-aisle') {
    if (aisles.some(item => item.axis === axis && item.afterIndex === index && item.id !== aisle?.id)) {
      if (action === 'add-aisle') message.info(`第 ${index} ${axisLabel}后已经设置过道`)
      return
    }
    aisleDialog.value = { axis, index, aisle: action === 'edit-aisle' ? aisle : null }
    aisleDialogVisible.value = true
    return
  } else if (action === 'remove-aisle') {
    try {
      await confirmMessage(`确定要删除这条${axisLabel}过道吗？`, '删除过道', {
        confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning'
      })
    } catch {
      return
    }
    const aisleId = aisle?.id
    const aisleIndex = aisles.findIndex(item => item.id === aisleId)
    if (aisleIndex >= 0) aisles.splice(aisleIndex, 1)
  } else {
    return
  }

  await applyGridConfig(createGridConfig({ ...current, aisles }))
}

async function applyAisleSettings({ label, size }) {
  const { axis, index, aisle } = aisleDialog.value
  const current = store.gridConfig
  const aisles = current.aisles.map(item => ({ ...item }))
  const nextAisle = { axis, afterIndex: index, label, size }
  let applied = false

  if (aisle) {
    const aisleIndex = aisles.findIndex(item => item.id === aisle.id)
    if (aisleIndex >= 0) {
      aisles[aisleIndex] = { ...aisles[aisleIndex], ...nextAisle }
      applied = true
    }
  } else if (!aisles.some(item => item.axis === axis && item.afterIndex === index)) {
    aisles.push(nextAisle)
    applied = true
  }

  if (!applied) {
    message.info('过道位置已经存在配置')
    return
  }

  if (await applyGridConfig(createGridConfig({ ...current, aisles }))) {
    aisleDialogVisible.value = false
  }
}

async function applyGridConfig(nextConfig) {
  const outOfBoundsDevices = getOutOfBoundsDevices(store.rawDeviceList, nextConfig)
  if (outOfBoundsDevices.length) {
    const deviceNames = outOfBoundsDevices
      .slice(0, 5)
      .map(device => device.machineNumber || device.name || `#${device.id}`)
      .join('、')
    const suffix = outOfBoundsDevices.length > 5 ? '等' : ''

    try {
      await confirmMessage(
        `${deviceNames}${suffix} 共 ${outOfBoundsDevices.length} 台设备超出新布局范围，应用后将暂不显示在网格中，确定继续吗？`,
        '确认调整布局',
        { confirmButtonText: '继续应用', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return false
    }
  }

  store.updateGridConfig(nextConfig)
  message.success('网格布局已更新')
  return true
}

// ============================================
// Action Handlers
// ============================================

/**
 * 处理刷新按钮点击 - 刷新打印机 WebSocket 状态
 * 1. 断开现有 WebSocket 连接
 * 2. 重新获取设备数据
 * 3. 重新建立 WebSocket 连接
 */
async function handleRefresh() {
  try {
    // 先断开现有 WebSocket 连接
    store.disconnectWs()
  message.info('正在重新连接打印机...')

    // 重新获取设备数据并建立 WebSocket 连接
    await Promise.all([store.fetchDeviceData(), fetchHistory()])
    store.connectWs()

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
  // 获取设备数据并建立 WebSocket 连接
  store.fetchDeviceData()
  store.connectWs()
  fetchHistory()
})

onUnmounted(() => {
  // 断开 WebSocket 连接
  store.disconnectWs()
})
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
    linear-gradient(to right, var(--app-border) 1px, transparent 1px),
    linear-gradient(to bottom, var(--app-border) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: center center;
  border-radius: 6px;
  background-color: var(--app-page-background);
}

/* 编辑模式：行标签和列标题高亮 */
.is-edit-mode :deep(.row-label) {
  background: var(--app-primary-light-hover);
  color: var(--app-primary-active);
  font-weight: 700;
}

.is-edit-mode :deep(.col-header) {
  background: var(--app-primary-light-hover);
  color: var(--app-primary-active);
  font-weight: 700;
}

.is-edit-mode :deep(.col-header.aisle-header) {
  background: var(--app-warning-light);
  color: var(--app-warning);
}

/* 编辑模式：过道区域淡化 */
.is-edit-mode :deep(.aisle-cell) {
  background: var(--app-warning-light);
  border: 2px dashed var(--app-warning);
  opacity: 0.8;
}

.dashboard-workshop-scroll {
  min-height: 0;
  overflow: auto;
}

.dashboard-top-shell {
  flex: 0 0 auto;
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
</style>
