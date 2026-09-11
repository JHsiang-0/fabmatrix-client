<template>
  <div v-cloak class="farm-dashboard h-full bg-gray-100 flex flex-col overflow-hidden">
    <!-- 顶部品牌和操作 -->
    <div class="dashboard-top-shell">
      <dashboard-header :last-update-time="lastUpdateTime" @refresh="handleRefresh">
      <!-- 布局锁定/编辑模式切换按钮 -->
      <template #actions>
        <div v-if="canManageLayout && isEditMode" class="dashboard-layout-actions">
          <t-button class="dashboard-action-button" theme="default" variant="outline" size="small"
            @click="openAisleDialog">过道管理</t-button>
          <t-button class="dashboard-action-button" theme="default" variant="outline" size="small"
            @click="cancelLayoutEdit">取消</t-button>
          <t-button class="dashboard-action-button" theme="primary" variant="base" size="small"
            :loading="store.layoutSaving" @click="saveLayout">保存布局</t-button>
        </div>
        <t-button v-else-if="canManageLayout" class="dashboard-action-button" theme="default" variant="outline"
          size="small" :icon="renderIcon(Lock)" @click="toggleEditMode">
          布局设置
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
      <t-alert v-if="invalidPositionEntries.length" theme="error" title="设备坐标异常" :close-btn="false"
        class="dashboard-position-alert">
        <template #default>
          <p>以下设备未能安全放入当前布局，请修正服务端数据或在编辑模式中处理：</p>
          <ul class="dashboard-position-issues">
            <li v-for="item in invalidPositionEntries" :key="item.key">
              {{ item.name || `设备 ${item.id || '未知'}` }}（{{ item.kind }}，原坐标 {{ item.position }}）
            </li>
          </ul>
        </template>
      </t-alert>
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
        <grid-map :device-matrix="store.deviceMatrix" :devices="displayDevices" :real-time-status="store.realTimeStatus"
          :grid-config="store.GRID_CONFIG" :is-edit-mode="isEditMode" :dragged-device="draggedDevice"
          :drag-over-cell="dragOverCell" @dragstart="handleDragStart" @dragend="handleDragEnd"
          @dragenter="handleDragEnter" @dragleave="handleDragLeave" @drop="handleDrop" @cell-click="handleCellClick"
          @dimension-change="handleDimensionChange" />
      </div>
    </div>

    <t-dialog v-model:visible="aisleDialogVisible" :header="editingAisleId ? '编辑过道' : '新增过道'"
      :confirm-btn="{ content: '应用' }" @confirm="applyAisleSettings">
      <t-form :data="aisleForm" layout="vertical">
        <t-form-item label="方向">
          <t-select v-model="aisleForm.axis" :options="aisleAxisOptions" />
        </t-form-item>
        <t-form-item label="插入位置">
          <t-input-number v-model="aisleForm.afterIndex" :min="0" :max="aislePositionMax" />
        </t-form-item>
        <t-form-item label="名称">
          <t-input v-model="aisleForm.label" maxlength="12" show-word-limit />
        </t-form-item>
        <t-form-item label="尺寸">
          <t-input-number v-model="aisleForm.size" :min="layoutLimits.minAisleSize" :max="layoutLimits.maxAisleSize" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog v-model:visible="aisleListVisible" header="过道管理" :footer="false">
      <div class="dashboard-aisle-list">
        <div v-for="aisle in draftAisles" :key="aisle.id" class="dashboard-aisle-list__item">
          <span>{{ aisle.label }}（{{ aisle.axis === 'ROW' ? '横向' : '纵向' }}，{{ aisle.afterIndex }}）</span>
          <t-space>
            <t-button variant="text" size="small" @click="openAisleDialog(aisle)">编辑</t-button>
            <t-button theme="danger" variant="text" size="small" @click="removeAisle(aisle)">删除</t-button>
          </t-space>
        </div>
        <t-empty v-if="!draftAisles.length" description="暂未配置过道" />
        <t-button theme="primary" variant="outline" block @click="openNewAisleDialog">新增过道</t-button>
      </div>
    </t-dialog>

    <t-dialog v-model:visible="summaryDialogVisible" header="确认保存布局"
      :confirm-btn="{ content: '确认保存', theme: 'primary', loading: store.layoutSaving }"
      :cancel-btn="{ content: '返回调整' }" @confirm="confirmSaveLayout">
      <t-alert theme="warning" title="保存将一次性提交布局和设备坐标" :close-btn="false" />
      <ul class="dashboard-change-summary">
        <li v-for="item in layoutChangeSummary" :key="item">{{ item }}</li>
      </ul>
    </t-dialog>

    <t-dialog v-model:visible="shrinkDialogVisible" header="缩容将下架设备"
      :confirm-btn="{ content: '下架并保存', theme: 'danger', loading: store.layoutSaving }"
      :cancel-btn="{ content: '返回调整' }" @confirm="confirmShrinkAndSave">
      <p>以下设备超出新的行列范围。确认后会在同一事务中保留原坐标清单并将其下架：</p>
      <ul class="dashboard-position-issues">
        <li v-for="item in shrinkDevices" :key="`shrink-${item.printerId}`">
          {{ item.name || `设备 ${item.printerId}` }}（{{ formatPosition(item.gridRow, item.gridCol) }}）
        </li>
      </ul>
    </t-dialog>

    <t-dialog v-model:visible="conflictDialogVisible" header="布局已被更新"
      :confirm-btn="{ content: '重新载入', theme: 'primary' }" :cancel-btn="{ content: '继续查看草稿' }"
      @confirm="reloadLatestLayout">
      <t-alert theme="error" title="其他管理员已经保存了更新" :close-btn="false" />
      <p>当前服务端版本：{{ conflictDetails.serverVersion || '未知' }}。你的草稿仍保留，重新载入后才会丢弃草稿。</p>
    </t-dialog>

    <t-dialog v-model:visible="outOfBoundsDialogVisible" header="布局保存被拒绝"
      :confirm-btn="{ content: '返回调整', theme: 'primary' }" :cancel-btn="false">
      <t-alert theme="error" title="缩容后存在越界设备" :close-btn="false" />
      <p>请调整布局；服务端原坐标如下：</p>
      <ul class="dashboard-position-issues">
        <li v-for="item in outOfBoundsDevices" :key="`out-of-bounds-${item.printerId}`">
          {{ item.name || `设备 ${item.printerId}` }}（{{ formatPosition(item.gridRow, item.gridCol) }}）
        </li>
      </ul>
    </t-dialog>

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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircleIcon,
  ChevronRightIcon,
  DashboardIcon,
  ErrorCircleIcon,
  LockOnIcon as Lock,
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
import { analyzeDevicePositions, formatGridRowLabel } from '@/utils/gridLayout'
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
const positionChanges = ref([])
const aisleListVisible = ref(false)
const aisleDialogVisible = ref(false)
const summaryDialogVisible = ref(false)
const shrinkDialogVisible = ref(false)
const conflictDialogVisible = ref(false)
const outOfBoundsDialogVisible = ref(false)
const conflictDetails = ref({})
const outOfBoundsDevices = ref([])
const shrinkDevices = ref([])
const editingAisleId = ref('')
const overflowPolicy = ref('REJECT')
const aisleForm = ref({ axis: 'COLUMN', afterIndex: 0, label: '过道', size: 100 })
const aisleAxisOptions = [
  { label: '纵向过道', value: 'COLUMN' },
  { label: '横向过道', value: 'ROW' }
]

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
  const rowLabel = formatGridRowLabel(targetSlot.value.row)
  return `${rowLabel}-${targetSlot.value.col.toString().padStart(2, '0')}`
})

const layoutLimits = computed(() => store.layoutLimits || {
  minRows: 1,
  maxRows: 30,
  minColumns: 1,
  maxColumns: 60,
  maxAisles: 20,
  minAisleSize: 48,
  maxAisleSize: 240
})

const draftAisles = computed(() => store.layoutDraft?.aisles || [])
const aislePositionMax = computed(() => aisleForm.value.axis === 'ROW'
  ? (store.layoutDraft?.rowCount || 1)
  : (store.layoutDraft?.columnCount || 1))
const displayDevices = computed(() => {
  const changes = new Map(positionChanges.value.map(change => [String(change.printerId), change]))
  return store.rawDeviceList.map(device => {
    const change = changes.get(String(device.id))
    return change ? { ...device, gridRow: change.gridRow, gridCol: change.gridCol } : device
  })
})
const draftPositionIssues = computed(() => analyzeDevicePositions(displayDevices.value, store.GRID_CONFIG))
const activePositionIssues = computed(() => isEditMode.value ? draftPositionIssues.value : store.invalidPositionDevices)
const invalidPositionEntries = computed(() => {
  const issues = activePositionIssues.value || {}
  const entries = []
  const add = (item, kind) => entries.push({
    key: `${kind}-${item.id}-${item.gridRow ?? 'null'}-${item.gridCol ?? 'null'}`,
    id: item.id,
    name: item.name,
    kind,
    position: formatPosition(item.gridRow, item.gridCol)
  })
  ;(issues.invalid || []).forEach(item => add(item, '半空或格式异常'))
  ;(issues.outOfBounds || []).forEach(item => add(item, '越界'))
  ;(issues.duplicates || []).forEach(group => (group.devices || []).forEach(item => add(item, '重复槽位')))
  return entries
})
const layoutChangeSummary = computed(() => {
  const summary = []
  const snapshot = store.layoutSnapshot
  const draft = store.layoutDraft
  if (snapshot && draft && (snapshot.rowCount !== draft.rowCount || snapshot.columnCount !== draft.columnCount)) {
    summary.push(`物理布局：${snapshot.rowCount}×${snapshot.columnCount} → ${draft.rowCount}×${draft.columnCount}`)
  }
  if (snapshot && draft && JSON.stringify(snapshot.aisles || []) !== JSON.stringify(draft.aisles || [])) {
    summary.push(`过道配置：${snapshot.aisles?.length || 0} 条 → ${draft.aisles?.length || 0} 条`)
  }
  positionChanges.value.forEach(change => {
    const device = store.getDeviceById(change.printerId)
    summary.push(`${device?.name || `设备 ${change.printerId}`}：${formatPosition(device?.gridRow, device?.gridCol)} → ${formatPosition(change.gridRow, change.gridCol)}`)
  })
  return summary.length ? summary : ['没有检测到布局或设备坐标变化']
})

function formatPosition(row, col) {
  if (row == null && col == null) return '未分配'
  return `${row ?? '空'}行 / ${col ?? '空'}列`
}

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
  // 不能放置到横向或纵向过道
  if (store.isAisleCell(colIndex) || store.isAisleRowCell(rowIndex)) return
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
function handleDrop(targetRowIndex, targetColIndex) {
  // 防止放置到过道
  if (store.isAisleCell(targetColIndex) || store.isAisleRowCell(targetRowIndex)) return

  // 如果没有拖拽的设备，不处理
  if (!draggedDevice.value || !draggedFrom.value) return

  const fromRow = draggedFrom.value.row
  const fromCol = draggedFrom.value.col

  // 如果放置到同一位置，不处理
  if (fromRow === targetRowIndex && fromCol === targetColIndex) {
    handleDragEnd()
    return
  }

  const targetPosition = getPhysicalSlot(targetRowIndex, targetColIndex)
  if (!targetPosition) return

  // 获取草稿目标位置的设备（如果有）
  const targetDevice = displayDevices.value.find(device => (
    device.gridRow === targetPosition.row && device.gridCol === targetPosition.col
  ))

  const sourcePosition = getPhysicalSlot(fromRow, fromCol)
  if (!sourcePosition) return
  if (targetDevice && String(targetDevice.id) !== String(draggedDevice.value.id)) {
    swapDevicesPosition(draggedDevice.value, sourcePosition, targetDevice, targetPosition)
  } else {
    moveDeviceToEmptySlot(draggedDevice.value, targetPosition)
  }
  message.info('位置变更已加入布局草稿，保存后生效')
  handleDragEnd()
}

// ============================================
// Device Operations
// ============================================

/**
 * 移动设备到空位置
 * @param {Object} device - 要移动的设备
 * @param {Object} to - 新位置 {row, col}
 */
function moveDeviceToEmptySlot(device, to) {
  recordPositionChange(device.id, to.row, to.col)
}

/**
 * 交换两台设备的位置
 * @param {Object} device1 - 第一台设备
 * @param {Object} pos1 - 第一台设备原位置 {row, col}
 * @param {Object} device2 - 第二台设备
 * @param {Object} pos2 - 第二台设备原位置 {row, col}
 */
function swapDevicesPosition(device1, pos1, device2, pos2) {
  recordPositionChange(device1.id, pos2.row, pos2.col)
  recordPositionChange(device2.id, pos1.row, pos1.col)
}

function getPhysicalSlot(rowIndex, colIndex) {
  const row = store.getPhysicalRowByIndex(rowIndex)
  const col = store.getPhysicalColByIndex(colIndex)
  return row && col ? { row, col } : null
}

function recordPositionChange(printerId, gridRow, gridCol) {
  const next = positionChanges.value.filter(change => String(change.printerId) !== String(printerId))
  next.push({ printerId: String(printerId), gridRow, gridCol })
  positionChanges.value = next
  store.setPositionDraft(next)
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
    const slot = getPhysicalSlot(rowIndex, colIndex)
    if (!slot) return
    targetSlot.value = slot
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

  recordPositionChange(deviceId, targetSlot.value.row, targetSlot.value.col)
  message.info('设备绑定已加入布局草稿，保存后生效')
  bindDialogVisible.value = false
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
 * 处理从看板下架设备；下架只写入布局草稿。
 * @param {Object} device - 设备对象
 */
async function handleRemoveFromBoard(device) {
  if (!canManageLayout.value || !isEditMode.value) {
    message.error('请先进入布局编辑模式')
    return
  }

  try {
    await confirmMessage(`确定将设备 ${device.machineNumber || device.name} 从看板下架吗？`, '确认下架', {
      confirmButtonText: '下架',
      cancelButtonText: '返回',
      type: 'danger'
    })
    recordPositionChange(device.id, null, null)
    message.info('下架变更已加入布局草稿，保存后生效')
    // 关闭抽屉
    drawerVisible.value = false
    activeDevice.value = null
  } catch (error) {
    if (error !== 'cancel') {
      console.error('下架设备失败:', error)
      message.error('下架设备失败，请重试')
    }
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

function toggleEditMode() {
  if (!canManageLayout.value) {
    message.error('当前账号没有维护网格布局的权限')
    return
  }
  if (!store.beginLayoutEdit()) {
    message.error('布局快照尚未加载完成，请稍后重试')
    return
  }
  positionChanges.value = []
  store.setPositionDraft([])
  overflowPolicy.value = 'REJECT'
  isEditMode.value = true
  message.info('已进入编辑模式，现在可以拖拽设备调整位置')
}

async function cancelLayoutEdit() {
  if (!store.layoutDirty && !positionChanges.value.length) {
    store.cancelLayoutEdit()
    isEditMode.value = false
    return
  }
  try {
    await confirmMessage('当前布局草稿尚未保存，确定放弃修改吗？', '取消布局编辑', {
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
      type: 'warning'
    })
    store.cancelLayoutEdit()
    positionChanges.value = []
    isEditMode.value = false
  } catch (error) {
    if (error !== 'cancel') console.error('取消布局编辑失败:', error)
  }
}

function handleDimensionChange({ axis, delta }) {
  if (!isEditMode.value || !canManageLayout.value || !store.layoutDraft) return
  const isRow = axis === 'row'
  const current = isRow ? store.layoutDraft.rowCount : store.layoutDraft.columnCount
  const min = isRow ? layoutLimits.value.minRows : layoutLimits.value.minColumns
  const max = isRow ? layoutLimits.value.maxRows : layoutLimits.value.maxColumns
  const next = Math.min(max, Math.max(min, Number(current) + Number(delta)))
  const rowCount = isRow ? next : store.layoutDraft.rowCount
  const columnCount = isRow ? store.layoutDraft.columnCount : next
  if (next === current) return
  if (rowCount * columnCount > (layoutLimits.value.maxCells || 1800)) {
    message.error('行列乘积不能超过布局槽位上限')
    return
  }
  store.updateLayoutDraft({ rowCount, columnCount })
}

function openAisleDialog(aisle = null) {
  if (!aisle) {
    aisleListVisible.value = true
    return
  }
  editingAisleId.value = aisle.id
  aisleForm.value = { axis: aisle.axis, afterIndex: aisle.afterIndex, label: aisle.label, size: aisle.size }
  aisleDialogVisible.value = true
  aisleListVisible.value = false
}

function openNewAisleDialog() {
  editingAisleId.value = ''
  aisleForm.value = { axis: 'COLUMN', afterIndex: 0, label: '过道', size: 100 }
  aisleDialogVisible.value = true
  aisleListVisible.value = false
}

function applyAisleSettings() {
  const label = String(aisleForm.value.label || '').trim()
  const afterIndex = Number(aisleForm.value.afterIndex)
  const size = Number(aisleForm.value.size)
  const positionMax = aisleForm.value.axis === 'ROW'
    ? (store.layoutDraft?.rowCount || 1)
    : (store.layoutDraft?.columnCount || 1)
  if (!label || label.length > 12 || !Number.isInteger(afterIndex) || afterIndex < 0 || afterIndex > positionMax
    || !Number.isInteger(size) || size < layoutLimits.value.minAisleSize || size > layoutLimits.value.maxAisleSize) {
    message.error('请填写合法的过道方向、位置、名称和尺寸')
    return
  }
  const current = [...draftAisles.value]
  const duplicate = current.find(aisle => aisle.id !== editingAisleId.value
    && aisle.axis === aisleForm.value.axis && aisle.afterIndex === afterIndex)
  if (duplicate) {
    message.error('同方向同位置只能配置一条过道')
    return
  }
  const next = {
    id: editingAisleId.value || `aisle-${aisleForm.value.axis.toLowerCase()}-${Date.now()}`,
    axis: aisleForm.value.axis,
    afterIndex,
    label,
    size
  }
  const aisles = editingAisleId.value
    ? current.map(aisle => aisle.id === editingAisleId.value ? next : aisle)
    : [...current, next]
  if (aisles.length > layoutLimits.value.maxAisles) {
    message.error(`过道数量不能超过 ${layoutLimits.value.maxAisles} 条`)
    return
  }
  store.updateLayoutDraft({ aisles })
  aisleDialogVisible.value = false
  aisleListVisible.value = true
}

async function removeAisle(aisle) {
  try {
    await confirmMessage(`确定删除过道“${aisle.label}”吗？`, '删除过道', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'danger'
    })
    store.updateLayoutDraft({ aisles: draftAisles.value.filter(item => item.id !== aisle.id) })
  } catch (error) {
    if (error !== 'cancel') console.error('删除过道失败:', error)
  }
}

function saveLayout() {
  if (!canManageLayout.value || store.layoutSaving) return
  if (!store.layoutDirty && !positionChanges.value.length) {
    message.info('当前没有需要保存的布局变更')
    return
  }
  summaryDialogVisible.value = true
}

async function confirmSaveLayout() {
  summaryDialogVisible.value = false
  if (draftPositionIssues.value.outOfBounds.length && overflowPolicy.value === 'REJECT') {
    shrinkDevices.value = draftPositionIssues.value.outOfBounds.map(item => ({
      printerId: item.id,
      name: item.name,
      gridRow: item.gridRow,
      gridCol: item.gridCol
    }))
    shrinkDialogVisible.value = true
    return
  }
  await executeSaveLayout()
}

async function confirmShrinkAndSave() {
  shrinkDialogVisible.value = false
  overflowPolicy.value = 'UNALLOCATE'
  await executeSaveLayout()
}

async function executeSaveLayout() {
  try {
    await store.saveLayoutDraft(positionChanges.value, overflowPolicy.value)
    await store.fetchDeviceData()
    positionChanges.value = []
    isEditMode.value = false
    message.success('布局已保存')
  } catch (error) {
    console.error('保存布局失败:', error)
    if (Number(error?.status || error?.code) === 409) {
      conflictDetails.value = error.data || {}
      conflictDialogVisible.value = true
    } else if (Number(error?.status || error?.code) === 422) {
      outOfBoundsDevices.value = error.data?.outOfBoundsPrinters || []
      outOfBoundsDialogVisible.value = true
    } else {
      message.error(error?.message || '保存布局失败，请重试')
    }
  }
}

async function reloadLatestLayout() {
  conflictDialogVisible.value = false
  try {
    await store.loadLayout()
    await store.fetchDeviceData()
    positionChanges.value = []
    overflowPolicy.value = 'REJECT'
    isEditMode.value = false
    message.success('已重新载入服务端布局')
  } catch (error) {
    message.error(error?.message || '重新载入布局失败，请重试')
  }
}

function handleBeforeUnload(event) {
  if (isEditMode.value && (store.layoutDirty || positionChanges.value.length)) {
    event.preventDefault()
    event.returnValue = ''
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
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))

async function initializeDashboard() {
  try {
    await store.loadLayout()
  } catch (error) {
    console.error('加载看板布局失败:', error)
    message.error(error?.message || '加载看板布局失败，请重试')
    return
  }
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

.dashboard-layout-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.dashboard-aisle-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dashboard-aisle-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--app-border);
  border-radius: 0.5rem;
  color: var(--app-text-primary);
}

.dashboard-aisle-list__item > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.farm-dashboard__workshop {
  box-sizing: border-box;
  display: flex;
  min-height: 0;
  flex-direction: column;
  background: var(--app-page-background);
}

.farm-dashboard__workshop-surface {
  box-sizing: border-box;
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  background: var(--app-surface);
  border-color: var(--app-border);
}

.dashboard-position-alert {
  flex: 0 0 auto;
  margin: 0 var(--app-spacing-4);
}

.dashboard-position-issues,
.dashboard-change-summary {
  max-height: 180px;
  margin: var(--app-spacing-2) 0 0;
  padding-left: 1.25rem;
  overflow: auto;
}

.dashboard-position-issues li,
.dashboard-change-summary li {
  margin-bottom: 0.25rem;
  color: var(--app-text-primary);
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
