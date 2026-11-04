<template>
    <!--
      设备详情抽屉 - 响应式优化版本
      - 移动端：全屏宽度，优化触摸体验
      - 平板：70% 宽度
      - 桌面：固定最大宽度，防止大屏过度拉伸
    -->
    <t-drawer :key="String(device?.id || 'empty')" v-model:visible="drawerVisible"
        :size="drawerSize"
        :destroy-on-close="true"
        :close-btn="false"
        :close-on-esc-keydown="true"
        class="printer-detail-drawer"
        :class="{ 'is-mobile': isMobile, 'is-tablet': isTablet }"
        :on-close="handleClose"
        :on-close-btn-click="handleClose"
        :on-esc-keydown="handleClose"
        :on-overlay-click="handleClose">

        <template #header>
            <div class="printer-detail-drawer__header">
                <span class="printer-detail-drawer__title">{{ drawerTitle }}</span>
                <t-button
                    theme="default"
                    variant="text"
                    shape="square"
                    size="small"
                    aria-label="关闭打印机详情"
                    @click="handleVisibleChange(false)"
                >
                    <Close />
                </t-button>
            </div>
        </template>

        <!-- 内容区域 - 使用流式内边距 -->
        <div v-if="detailLoading" class="flex min-h-48 items-center justify-center">
            <t-loading text="正在加载打印机详情..." />
        </div>

        <t-empty v-else-if="detailError" type="fail" title="打印机详情加载失败" :description="detailError">
            <template #extra>
                <t-button theme="primary" @click="emit('retry')">重试</t-button>
            </template>
        </t-empty>

        <div v-else-if="device" class="printer-detail-drawer__content">
            <t-tabs v-model:value="activeDetailTab" class="printer-detail-drawer__tabs"
                :class="{ 'is-single-panel': !showAnalytics }"
                @change="handleDetailTabChange">
                <t-tab-panel value="overview" label="设备概览">
                    <div class="printer-detail-drawer__panel printer-detail-drawer__overview app-scroll-region">
                        <section class="printer-detail-drawer__status-card" :class="`is-${currentStateClass}`">
                            <div class="printer-detail-drawer__status-main">
                                <div class="printer-detail-drawer__status-copy">
                                    <div class="printer-detail-drawer__status-heading">
                                        <StatusTag domain="printer" :status="currentState" variant="dark" size="large" />
                                        <t-tag size="small" :theme="connectionTheme" variant="light">
                                            通信{{ connectionLabel }}
                                        </t-tag>
                                        <t-tag v-if="showLastKnownState" size="small" theme="default" variant="light">
                                            最后已知：{{ lastKnownStateLabel }}
                                        </t-tag>
                                    </div>
                                    <span v-if="isConnectionUnavailable" class="printer-detail-drawer__status-description">
                                        {{ statusDescription }}
                                    </span>
                                    <div v-else-if="isDeviceTaskActive" class="printer-detail-drawer__task-observation">
                                        <t-tag size="small" :theme="deviceTaskSourceMeta.theme" variant="light">
                                            {{ deviceTaskSourceMeta.label }}
                                        </t-tag>
                                        <span class="printer-detail-drawer__task-filename" :title="observedTaskFilename">
                                            {{ observedTaskFilename || '设备未返回文件名' }}
                                        </span>
                                    </div>
                                    <div v-else-if="isAssignedState" class="printer-detail-drawer__task-observation">
                                        <t-tag size="small" theme="warning" variant="light">待打印任务</t-tag>
                                        <span class="printer-detail-drawer__task-filename" :title="assignedFileName">
                                            {{ assignedFileName }}
                                        </span>
                                    </div>
                                    <span v-else class="printer-detail-drawer__status-description">
                                        {{ statusDescription }}
                                    </span>
                                </div>
                                <div v-if="isPrintingOrRelated && currentProgress !== null" class="printer-detail-drawer__progress-summary">
                                    <strong>{{ currentProgress }}%</strong>
                                    <span>打印进度</span>
                                </div>
                            </div>
                            <t-progress v-if="isPrintingOrRelated && currentProgress !== null" :percentage="currentProgress"
                                :status="progressStatus" :stroke-width="6" :label="false" />
                            <div v-if="realTimeData?.systemMessage && isErrorState"
                                class="printer-detail-drawer__inline-error">
                                <Warning />
                                <span class="line-clamp-2" :title="realTimeData.systemMessage">{{ realTimeData.systemMessage }}</span>
                            </div>
                        </section>

                        <t-alert v-if="externalTaskNotice" theme="warning" :close-btn="false"
                            :title="externalTaskNotice" />
                        <t-alert v-if="currentJobStatus === 'RECONCILING'" theme="warning" :close-btn="false"
                            title="设备状态无法自动确认，请人工核对打印结果。" />

                        <section class="printer-detail-drawer__monitor-section" aria-labelledby="printer-monitor-title">
                            <div class="printer-detail-drawer__section-heading">
                                <span id="printer-monitor-title">监控与通信</span>
                                <div class="printer-detail-drawer__monitor-toggle">
                                    <span>{{ monitorEnabled ? '已启用' : '已停用' }}</span>
                                    <t-switch :value="monitorEnabled"
                                        :disabled="!canManageMonitor || monitorLoading || monitorUpdating"
                                        :loading="monitorUpdating" @change="handleMonitorChange" />
                                </div>
                            </div>
                            <t-alert v-if="monitorError" theme="error" :title="monitorError" :close-btn="false" />
                            <t-skeleton v-else-if="monitorLoading" :loading="true" theme="paragraph" />
                            <div v-else class="printer-detail-drawer__monitor-summary">
                                <div class="printer-detail-drawer__summary-item">
                                    <span>通信状态</span>
                                    <t-tag size="small" :theme="connectionTheme" variant="light">{{ connectionLabel }}</t-tag>
                                </div>
                                <div class="printer-detail-drawer__summary-item">
                                    <span>最近通信</span>
                                    <strong>{{ formatDateTime(monitorValue.lastSeenAt) }}</strong>
                                </div>
                                <div class="printer-detail-drawer__summary-item">
                                    <span>连续失败</span>
                                    <strong>{{ monitorValue.consecutiveFailureCount ?? 0 }} 次</strong>
                                </div>
                            </div>
                            <div v-if="monitorValue.lastCommunicationError" class="printer-detail-drawer__communication-error"
                                :title="monitorValue.lastCommunicationError">
                                {{ monitorValue.lastCommunicationError }}
                            </div>
                        </section>

                        <PrinterModelPanel :printer-id="device.id" :active="drawerVisible && activeDetailTab === 'overview'"
                            @summary="canonicalSummary = $event" />

                        <section class="printer-detail-drawer__detail-section"
                            aria-labelledby="printer-device-info-title">
                            <div id="printer-device-info-title" class="printer-detail-drawer__section-heading">
                                <span>设备信息</span>
                            </div>
                            <div class="printer-detail-drawer__device-info-grid">
                                <div v-for="item in deviceInfoItems" :key="item.label"
                                    class="printer-detail-drawer__device-info-item">
                                    <span>{{ item.label }}</span>
                                    <strong :title="item.value">{{ item.value }}</strong>
                                </div>
                            </div>
                        </section>

                        <section v-if="userStore.canOperate && isAssignedState" class="printer-detail-drawer__assigned-section">
                            <div class="printer-detail-drawer__section-heading">
                                <span><Lock />待打印任务</span>
                            </div>
                            <div class="printer-detail-drawer__assigned-card">
                                <div class="printer-detail-drawer__assigned-copy">
                                    <strong :title="assignedFileName">{{ assignedFileName }}</strong>
                                    <span>任务 #{{ linkedFarmJobId }} · 请确认现场安全后启动</span>
                                </div>
                                <t-button v-if="!isSafetyConfirmed" theme="warning" size="medium"
                                    @click="handleConfirmSafe" :loading="isLoading">
                                    <Lock />确认现场安全
                                </t-button>
                                <div v-else class="printer-detail-drawer__assigned-actions">
                                    <t-button theme="primary" size="medium"
                                        @click="handleStartPrint('START_PRINT')" :loading="isLoading">
                                        <VideoPlay />下发并打印
                                    </t-button>
                                    <t-button theme="default" size="medium"
                                        @click="handleStartPrint('UPLOAD_ONLY')" :loading="isLoading">
                                        <DocumentAdd />仅下发文件
                                    </t-button>
                                </div>
                            </div>
                        </section>

                    </div>
                </t-tab-panel>

                <t-tab-panel v-if="showAnalytics" value="history" label="历史统计">
                    <div class="printer-detail-drawer__panel printer-detail-drawer__history-panel app-scroll-region">
                        <section class="printer-detail-drawer__statistics-section">
                            <div class="printer-detail-drawer__section-heading">
                                <span>打印统计</span>
                                <t-tag v-if="historyIncrementNotice" theme="primary" variant="light" size="small">
                                    实时状态已更新
                                </t-tag>
                            </div>
                            <t-alert v-if="statisticsError" theme="error" :title="statisticsError" :close-btn="false" />
                            <t-skeleton v-else-if="statisticsLoading" :loading="true" theme="paragraph" />
                            <div v-else-if="statistics" class="printer-detail-drawer__statistics-grid">
                                <div v-for="item in statisticCards" :key="item.key" class="printer-detail-drawer__statistic">
                                    <span>{{ item.label }}</span>
                                    <strong>{{ item.value }}</strong>
                                </div>
                            </div>
                            <t-empty v-else description="暂无统计数据" />
                        </section>

                        <section class="printer-detail-drawer__history-section">
                            <div class="printer-detail-drawer__history-toolbar">
                                <t-date-range-picker v-model="historyRangeModel" separator="至"
                                    :placeholder="['开始日期', '结束日期']"
                                    value-type="YYYY-MM-DD HH:mm:ss"
                                    :default-time="['00:00:00', '23:59:59']" />
                                <t-button size="small" theme="primary" :loading="historyLoading"
                                    @click="handleHistoryQuery">查询</t-button>
                                <t-button v-if="historyIncrementNotice" size="small" variant="outline"
                                    @click="handleHistoryQuery">刷新</t-button>
                            </div>
                            <t-alert v-if="historyError" theme="error" :title="historyError" :close-btn="false" />
                            <t-skeleton v-else-if="historyLoading" :loading="true" theme="paragraph" />
                            <div v-else class="printer-detail-drawer__history-table-region">
                                <t-table v-if="statusHistory.length > 0" class="printer-history-table"
                                    :data="displayStatusHistory" :columns="historyColumns"
                                    row-key="historyRowKey" size="small" bordered>
                                    <template #status="slotProps">
                                        <div class="printer-history-status">
                                            <StatusTag domain="printer" :status="slotProps.row.status" />
                                            <span v-if="slotProps.row.sampleCount > 1" class="printer-history-samples">
                                                {{ slotProps.row.sampleCount }} 次
                                            </span>
                                        </div>
                                    </template>
                                    <template #taskSource="slotProps">
                                        <t-tag size="small" :theme="getTaskSourceMeta(slotProps.row.taskSource).theme" variant="light">
                                            {{ getTaskSourceMeta(slotProps.row.taskSource).label }}
                                        </t-tag>
                                    </template>
                                    <template #progress="slotProps">{{ formatHistoryProgress(slotProps.row) }}</template>
                                    <template #recordedAt="slotProps">{{ formatHistoryPeriod(slotProps.row) }}</template>
                                </t-table>
                                <t-empty v-else description="暂无状态历史" />
                            </div>
                            <t-pagination v-if="historyTotal > historyPageSize"
                                :current="historyPageNum" :page-size="historyPageSize" :total="historyTotal"
                                :show-page-size="false" @change="handleHistoryPageChange" />
                        </section>
                    </div>
                </t-tab-panel>
            </t-tabs>
        </div>

        <!-- 抽屉底部操作区 -->
        <template #footer>
            <div v-if="device" class="printer-detail-drawer__footer">
                <div class="printer-detail-drawer__footer-primary">
                    <t-button v-if="userStore.canOperate && device.ipAddress" theme="primary" size="medium" tag="a"
                        :href="deviceConsoleUrl" target="_blank" rel="noopener noreferrer"
                        class="printer-detail-drawer__console-button">
                        <Monitor />{{ isRrfDevice ? '打开 DWC' : '打开 Mainsail' }}
                    </t-button>
                    <t-button v-else-if="!device.ipAddress" theme="default" size="medium" disabled>
                        <Monitor />设备地址不可用
                    </t-button>
                    <t-button theme="default" variant="base" size="medium"
                        :disabled="detailLoading || monitorLoading" @click="emit('retry')">
                        <Refresh />刷新状态
                    </t-button>
                </div>
                <div class="printer-detail-drawer__footer-actions">
                    <t-button v-if="userStore.canOperate && canPause" theme="warning" size="medium" :disabled="actionLoading"
                        :loading="actionLoading" @click="handleAction('pause')">
                        <VideoPause />暂停
                    </t-button>
                    <t-button v-if="userStore.canOperate && canResume" theme="success" size="medium" :disabled="actionLoading"
                        :loading="actionLoading" @click="handleAction('resume')">
                        <VideoPlay />恢复
                    </t-button>
                    <t-button v-if="userStore.canOperate && canCancel" theme="danger" size="medium"
                        :disabled="actionLoading" :loading="actionLoading" @click="handleAction('cancel')">
                        <CircleClose />取消
                    </t-button>
                    <t-button v-if="userStore.canOperate && canEmergencyStop" theme="danger" size="medium"
                        :disabled="actionLoading" :loading="actionLoading" @click="handleEmergencyStop">
                        <Warning />紧急停机
                    </t-button>
                    <span v-if="!hasTaskControls" class="printer-detail-drawer__footer-hint">
                        {{ !userStore.canOperate ? '当前账号仅可查看' : connectionLabel === '在线' ? '当前状态无需任务控制' : '设备离线，控制操作不可用' }}
                    </span>
                    <t-popconfirm v-if="canManageDevice" content="确定要将此设备从该物理位置下架吗？"
                        confirm-btn="确认下架" cancel-btn="取消" theme="danger" @confirm="handleRemove">
                        <template>
                            <t-button theme="danger" variant="text" size="medium">
                                <Delete />下架
                            </t-button>
                        </template>
                    </t-popconfirm>
                </div>
            </div>
        </template>
    </t-drawer>
</template>

<script setup>
import { useUserStore } from '@/stores/user'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import {
    CloseIcon as Close,
    DeleteIcon as Delete,
    DesktopIcon as Monitor,
    PauseIcon as VideoPause,
    PlayIcon as VideoPlay,
    CloseCircleIcon as CircleClose,
    ErrorCircleFilledIcon as Warning,
    LockOnIcon as Lock,
    FileAddIcon as DocumentAdd,
    RefreshIcon as Refresh
} from 'tdesign-icons-vue-next'
import PrinterModelPanel from './PrinterModelPanel.vue'
import { PRINTER_STATUS, PRINTER_STATUS_MAP, PROGRESS_STATUS_MAP } from '@/utils/constants'
import StatusTag from '@/components/StatusTag.vue'
import {
    resolveEffectivePrinterStatus,
    resolveLastKnownPrinterStatus
} from '@/utils/dataAdapters'
import { formatDuration, formatDateTime } from '@/utils/formatters'
import { confirmSafe } from '@/api/printer'
import { startJob } from '@/api/job'
import { message } from '@/utils/message'
import { compactStatusHistory } from '@/utils/statusHistory'

defineOptions({ name: 'DeviceDetailDrawer' })
const userStore = useUserStore()
const canonicalSummary = ref(null)

// ============================================
// 响应式断点检测
// ============================================

const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)
const isTablet = computed(() => windowWidth.value >= 768 && windowWidth.value < 1280)
const isLargeScreen = computed(() => windowWidth.value >= 1920)

// 响应式抽屉尺寸 - 使用响应式断点
const drawerSize = computed(() => {
    if (isMobile.value) return '100%'      // 移动端：全屏
    if (isTablet.value) return '70%'       // 平板：70% 宽度
    if (isLargeScreen.value) return '680px' // 大屏：为历史表格保留完整列宽
    return '640px'                          // 桌面：概览与历史共用稳定宽度
})

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
// Props
// ============================================

const props = defineProps({
    /** 是否显示抽屉 */
    modelValue: {
        type: Boolean,
        default: false
    },
    /** 设备对象 */
    device: {
        type: Object,
        default: null
    },
    /** 实时状态数据 */
    realTimeData: {
        type: Object,
        default: null
    },
    /** 是否允许维护设备和网格位置 */
    canManageDevice: {
        type: Boolean,
        default: false
    },
    /** 是否正在执行暂停、取消或急停 */
    actionLoading: {
        type: Boolean,
        default: false
    },
    /** 是否正在加载真实 PrinterVO 详情 */
    detailLoading: {
        type: Boolean,
        default: false
    },
    /** 详情加载错误文案 */
    detailError: {
        type: String,
        default: ''
    },
    statusHistory: {
        type: Array,
        default: () => []
    },
    historyLoading: {
        type: Boolean,
        default: false
    },
    historyError: {
        type: String,
        default: ''
    },
    historyTotal: {
        type: Number,
        default: 0
    },
    historyPageNum: {
        type: Number,
        default: 1
    },
    historyPageSize: {
        type: Number,
        default: 10
    },
    historyRange: {
        type: Array,
        default: () => []
    },
    statistics: {
        type: Object,
        default: null
    },
    statisticsLoading: {
        type: Boolean,
        default: false
    },
    statisticsError: {
        type: String,
        default: ''
    },
    monitorConfig: {
        type: Object,
        default: null
    },
    monitorLoading: {
        type: Boolean,
        default: false
    },
    monitorError: {
        type: String,
        default: ''
    },
    monitorUpdating: {
        type: Boolean,
        default: false
    },
    canManageMonitor: {
        type: Boolean,
        default: false
    },
    /** 是否提供历史与统计数据；看板复用时只展示设备概览 */
    showAnalytics: {
        type: Boolean,
        default: false
    }
})

// ============================================
// Emits
// ============================================

const emit = defineEmits([
    'update:modelValue',
    'action',
    'emergency-stop',
    'remove',
    'closed',
    'history-query',
    'history-page-change',
    'analytics-open',
    'retry',
    'monitor-change'
])

const historyRangeModel = ref([])
const historyIncrementNotice = ref(false)
const activeDetailTab = ref('overview')
const analyticsRequested = ref(false)
const drawerVisible = computed({
    get: () => props.modelValue,
    set: value => handleVisibleChange(value)
})

const historyColumns = computed(() => {
    if (isMobile.value) {
        return [
            { colKey: 'status', title: '状态', width: 82 },
            { colKey: 'taskSource', title: '来源', width: 72 },
            { colKey: 'filename', title: '文件', width: 104, ellipsis: true },
            { colKey: 'progress', title: '进度', width: 60 },
            { colKey: 'recordedAt', title: '记录区间', width: 148 }
        ]
    }

    return [
        { colKey: 'status', title: '状态', width: 92 },
        { colKey: 'taskSource', title: '来源', width: 78 },
        { colKey: 'filename', title: '文件', width: 124, ellipsis: true },
        { colKey: 'progress', title: '进度', width: 72 },
        { colKey: 'recordedAt', title: '记录区间', width: 152 }
    ]
})

const displayStatusHistory = computed(() => compactStatusHistory(props.statusHistory))

const formatProgressValue = value => {
    const number = Number(value)
    if (!Number.isFinite(number)) return '-'
    return `${Number(number.toFixed(2))}%`
}

const formatHistoryProgress = row => {
    const earliest = formatProgressValue(row.earliestProgress)
    const latest = formatProgressValue(row.latestProgress)
    return earliest === latest ? latest : `${earliest} → ${latest}`
}

const formatHistoryPeriod = row => {
    const earliest = formatDateTime(row.earliestRecordedAt)
    const latest = formatDateTime(row.latestRecordedAt)
    return earliest === latest ? latest : `${earliest} – ${latest}`
}

const statisticCards = computed(() => {
    const stats = props.statistics || {}
    return [
        { key: 'totalJobs', label: '总任务', value: stats.totalJobs ?? 0 },
        { key: 'completedJobs', label: '已完成', value: stats.completedJobs ?? 0 },
        { key: 'failedJobs', label: '失败', value: stats.failedJobs ?? 0 },
        { key: 'successRate', label: '成功率', value: `${Number(stats.successRate || 0).toFixed(1)}%` },
        { key: 'totalPrintSeconds', label: '总打印时长', value: formatDuration(stats.totalPrintSeconds) },
        { key: 'averagePrintSeconds', label: '平均时长', value: formatDuration(stats.averagePrintSeconds) }
    ]
})

watch(() => props.historyRange, value => {
    historyRangeModel.value = Array.isArray(value) ? [...value] : []
}, { immediate: true })

watch(() => props.realTimeData?.updatedAt, (value, previousValue) => {
    if (value && previousValue && value !== previousValue) historyIncrementNotice.value = true
})

watch(() => props.modelValue, visible => {
    if (visible) {
        activeDetailTab.value = 'overview'
        analyticsRequested.value = false
    } else {
        historyIncrementNotice.value = false
    }
})

// ============================================
// Computed
// ============================================

/** 可见性双向绑定 */
function handleVisibleChange(value) {
    emit('update:modelValue', value)
    if (!value) emit('closed')
}

/**
 * TDesign Drawer 的关闭事件覆盖 ESC、关闭按钮和遮罩点击。
 * 组件受控时必须主动同步 v-model，否则 Drawer 会在下一次渲染中被父级重新打开。
 */
function handleClose() {
    if (props.modelValue) handleVisibleChange(false)
}

function handleHistoryQuery() {
    historyIncrementNotice.value = false
    emit('history-query', [...historyRangeModel.value])
}

function handleHistoryPageChange(page) {
    emit('history-page-change', page)
}

function handleDetailTabChange(value) {
    if (value !== 'history' || analyticsRequested.value) return
    analyticsRequested.value = true
    emit('analytics-open')
}

// 监听抽屉打开事件
watch(() => props.modelValue, (newVal) => {
    if (newVal) {
        // 打开抽屉时根据后端返回的 isSafeToPrint 初始化安全确认状态
        isSafetyConfirmed.value = !!props.device?.isSafeToPrint
    }
})

/** 抽屉标题 */
const drawerTitle = computed(() => {
    if (!props.device) return '打印机详情'
    const deviceName = props.device.name || props.device.machineNumber
    return deviceName ? `${deviceName} - 详细信息` : '打印机详情'
})

/** 当前状态 */
const currentState = computed(() => {
    if (canonicalSummary.value) return canonicalSummary.value.status
    return resolveEffectivePrinterStatus({
        ...props.device,
        ...props.device?.realtimeStatus,
        ...props.monitorConfig,
        ...props.realTimeData
    })
})

const monitorValue = computed(() => ({
    ...props.device,
    ...props.monitorConfig,
    ...props.device?.realtimeStatus,
    ...props.realTimeData,
    ...canonicalSummary.value,
    lastKnownStatus: props.realTimeData?.lastKnownStatus
        || props.realTimeData?.unifiedState
        || props.device?.realtimeStatus?.unifiedState
        || props.monitorConfig?.lastKnownStatus
        || props.device?.lastKnownStatus,
    lastProtocolState: props.realTimeData?.lastProtocolState
        || props.device?.realtimeStatus?.state
        || props.monitorConfig?.lastProtocolState
        || props.device?.lastProtocolState
}))

const monitorEnabled = computed(() => (
    (props.monitorConfig?.monitorEnabled ?? props.device?.monitorEnabled) === true
))
const connectionLabel = computed(() => ({
    ONLINE: '在线',
    OFFLINE: '离线',
    UNKNOWN: '未知'
}[String(monitorValue.value.connectionStatus || 'UNKNOWN').toUpperCase()] || '未知'))
const connectionTheme = computed(() => ({
    ONLINE: 'success',
    OFFLINE: 'danger',
    UNKNOWN: 'default'
}[String(monitorValue.value.connectionStatus || 'UNKNOWN').toUpperCase()] || 'default'))
const isConnectionUnavailable = computed(() => (
    [PRINTER_STATUS.OFFLINE, PRINTER_STATUS.UNKNOWN].includes(currentState.value)
))
const lastKnownState = computed(() => resolveLastKnownPrinterStatus(monitorValue.value))
const showLastKnownState = computed(() => (
    isConnectionUnavailable.value && !!lastKnownState.value
))
const lastKnownStateLabel = computed(() => (
    PRINTER_STATUS_MAP[lastKnownState.value]?.label || '未知'
))
const currentJobStatus = computed(() => String(
    props.realTimeData?.currentJobStatus
    || props.device?.realtimeStatus?.farmJobStatus
    || props.device?.currentJob?.status
    || props.device?.currentJobStatus
    || ''
).toUpperCase())

const getTaskSourceMeta = source => ({
    FARM: { label: '平台任务', theme: 'primary' },
    EXTERNAL: { label: '外部任务', theme: 'warning' },
    UNKNOWN: { label: '来源待确认', theme: 'default' },
    NONE: { label: '无任务', theme: 'default' }
}[String(source || 'UNKNOWN').toUpperCase()] || { label: '来源待确认', theme: 'default' })

const deviceTaskSource = computed(() => String(
    canonicalSummary.value?.taskSource
    || props.realTimeData?.taskSource
    || props.device?.realtimeStatus?.taskSource
    || 'NONE'
).toUpperCase())
const deviceTaskSourceMeta = computed(() => getTaskSourceMeta(deviceTaskSource.value))
const observedTaskFilename = computed(() => (
    canonicalSummary.value ? canonicalSummary.value.filename : props.realTimeData?.observedFilename
    || props.realTimeData?.filename
    || props.device?.realtimeStatus?.filename
    || ''
))
const linkedFarmJobId = computed(() => (
    props.realTimeData?.farmJobId
    || props.realTimeData?.currentJobId
    || props.device?.realtimeStatus?.farmJobId
    || props.device?.currentJob?.id
    || props.device?.currentJobId
    || null
))
const assignedFileName = computed(() => (
    props.realTimeData?.currentJobFileName
    || props.device?.currentJobFileName
    || `任务 #${linkedFarmJobId.value || '-'}`
))
const isDeviceTaskActive = computed(() => (
    isPrintingOrRelated.value && ['FARM', 'EXTERNAL', 'UNKNOWN'].includes(deviceTaskSource.value)
))
const externalTaskNotice = computed(() => {
    if (!isDeviceTaskActive.value || !['EXTERNAL', 'UNKNOWN'].includes(deviceTaskSource.value)) return ''
    const sourceText = deviceTaskSource.value === 'EXTERNAL' ? '检测到设备端外部任务' : '设备任务来源暂时无法确认'
    const fileText = observedTaskFilename.value ? `：${observedTaskFilename.value}` : ''
    const farmText = linkedFarmJobId.value
        ? `。平台任务 #${linkedFarmJobId.value} 保持“${currentJobStatus.value || '待启动'}”，未与本次打印关联`
        : '。本次打印未关联平台任务'
    return `${sourceText}${fileText}${farmText}`
})
/** 当前状态类名 */
const currentStateClass = computed(() => {
    return currentState.value.toLowerCase()
})

/** 是否为打印中或相关状态 */
const isPrintingOrRelated = computed(() => {
    const relatedStates = [
        PRINTER_STATUS.PRINTING,
        PRINTER_STATUS.PAUSED
    ]
    return relatedStates.includes(currentState.value)
})

const currentProgress = computed(() => {
    if (canonicalSummary.value) return canonicalSummary.value.progress
    const value = Number(
        props.realTimeData?.progress
        ?? props.device?.realtimeStatus?.progress
        ?? props.device?.progress
        ?? 0
    )
    if (!Number.isFinite(value)) return 0
    return Number(Math.min(Math.max(value, 0), 100).toFixed(2))
})

const statusDescription = computed(() => ({
    [PRINTER_STATUS.IDLE]: '设备空闲，可接收新的打印任务',
    [PRINTER_STATUS.PREPARING]: '设备正在准备打印任务',
    [PRINTER_STATUS.PRINTING]: '设备正在执行打印任务',
    [PRINTER_STATUS.PAUSED]: '当前打印任务已暂停',
    [PRINTER_STATUS.ERROR]: '设备存在异常，请检查后处理',
    [PRINTER_STATUS.OFFLINE]: lastKnownState.value
        ? `设备当前无法通信，最后已知状态为${lastKnownStateLabel.value}；控制和任务下发不可用`
        : '设备当前无法通信；控制和任务下发不可用',
    [PRINTER_STATUS.UNKNOWN]: monitorEnabled.value
        ? '暂时无法确认设备当前状态；取得可靠状态前不可下发任务'
        : '设备监控已停用；当前状态不可确认，任务下发不可用'
}[currentState.value] || '暂时无法确认设备状态'))

const devicePosition = computed(() => {
    const row = props.device?.gridRow
    const col = props.device?.gridCol
    if (row == null && col == null) return '未分配'
    return `${row ?? '-'} 行 / ${col ?? '-'} 列`
})

const deviceInfoItems = computed(() => [
    { label: '机器编号', value: props.device?.machineNumber || '未设置' },
    { label: 'IP 地址', value: props.device?.ipAddress || '-' },
    { label: 'MAC 地址', value: props.device?.macAddress || monitorValue.value.macAddress || '未获取' },
    { label: '设备协议', value: props.device?.firmwareType || '-' },
    { label: '当前耗材', value: props.device?.currentMaterial || '未设置' },
    { label: '喷嘴尺寸', value: props.device?.nozzleSize ? `${props.device.nozzleSize}mm` : '未设置' },
    { label: '看板位置', value: devicePosition.value }
])

/** 是否为错误状态 */
const isErrorState = computed(() => {
    return currentState.value === PRINTER_STATUS.ERROR
})

/** 设备原生管理界面地址（RRF=DWC，Klipper=Mainsail） */
const deviceConsoleUrl = computed(() => {
    if (!props.device?.ipAddress) return '#'
    return `http://${props.device.ipAddress}`
})

const isRrfDevice = computed(() => String(props.device?.firmwareType || '').toUpperCase() === 'RRF')

/** 进度条状态 */
const progressStatus = computed(() => {
    return PROGRESS_STATUS_MAP[currentState.value] || ''
})

/** 是否为已分配状态（等待安全确认） */
const isAssignedState = computed(() => {
    return currentJobStatus.value === 'ASSIGNED' && !!linkedFarmJobId.value
})

/** 是否已确认安全 */
const isSafetyConfirmed = ref(false)

/** 是否正在执行操作 */
const isLoading = ref(false)

/** 是否可以暂停 */
const canPause = computed(() => {
    return currentState.value === PRINTER_STATUS.PRINTING
})

/** 是否可以恢复 */
const canResume = computed(() => {
    return currentState.value === PRINTER_STATUS.PAUSED
})

/** 是否可以取消 */
const canCancel = computed(() => {
    return [PRINTER_STATUS.PRINTING, PRINTER_STATUS.PAUSED].includes(currentState.value)
})

const canEmergencyStop = computed(() => {
    const controllableStates = [
        PRINTER_STATUS.PREPARING,
        PRINTER_STATUS.PRINTING,
        PRINTER_STATUS.PAUSED,
        PRINTER_STATUS.ERROR
    ]
    return connectionLabel.value === '在线' && controllableStates.includes(currentState.value)
})

const hasTaskControls = computed(() => (
    canPause.value || canResume.value || canCancel.value || canEmergencyStop.value
))

// ============================================
// Event Handlers
// ============================================

function handleAction(action) {
    emit('action', action, props.device)
}

function handleMonitorChange(enabled) {
    if (props.canManageMonitor && !props.monitorUpdating) emit('monitor-change', enabled)
}

function handleEmergencyStop() {
    emit('emergency-stop', props.device)
}

function handleRemove() {
    emit('remove', props.device)
}

/** 确认现场安全 */
async function handleConfirmSafe() {
    try {
        isLoading.value = true
        const jobId = props.realTimeData?.currentJobId || props.device?.currentJobId
        if (!jobId) {
            message.error('找不到当前绑定的任务')
            return
        }
        await confirmSafe(jobId, props.device.id)
        message.success('现场安全确认成功！')
        isSafetyConfirmed.value = true
    } catch {
        // 错误信息由拦截器处理
    } finally {
        isLoading.value = false
    }
}

/** 启动打印 */
async function handleStartPrint(action) {
    try {
        isLoading.value = true
        const jobId = props.realTimeData?.currentJobId || props.device?.currentJobId
        if (!jobId) {
            message.error('找不到任务ID')
            return
        }
        await startJob(jobId, action)
        const successMsg = action === 'START_PRINT' ? '下发并开始打印成功！' : '仅下发文件成功！'
        message.success(successMsg)
        // 关闭抽屉
        emit('update:modelValue', false)
    } catch {
        // 错误信息由拦截器处理
    } finally {
        isLoading.value = false
    }
}

</script>

<style scoped>
/* ============================================
   抽屉整体样式 - 响应式优化
   ============================================ */
.printer-detail-drawer :deep(.t-drawer__body) {
    min-height: 0;
    padding: 0;
    overflow: hidden;
}

.printer-detail-drawer :deep(.t-drawer__footer) {
    padding: 0;
    border-top: 1px solid var(--app-border);
}

.printer-detail-drawer__panel {
    scrollbar-color: var(--app-scrollbar-thumb) var(--app-scrollbar-track);
    scrollbar-width: thin;
}

.printer-detail-drawer__panel::-webkit-scrollbar { width: 8px; height: 8px; }
.printer-detail-drawer__panel::-webkit-scrollbar-track { background: var(--app-scrollbar-track); }
.printer-detail-drawer__panel::-webkit-scrollbar-thumb {
    background: var(--app-scrollbar-thumb);
    border: 2px solid transparent;
    border-radius: 999px;
    background-clip: padding-box;
}
.printer-detail-drawer__panel::-webkit-scrollbar-thumb:hover {
    background: var(--app-scrollbar-thumb-hover);
    background-clip: padding-box;
}

.printer-detail-drawer__content {
    display: flex;
    height: 100%;
    min-height: 0;
    min-width: 0;
    flex-direction: column;
}

.printer-detail-drawer__tabs {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
}

.printer-detail-drawer__tabs :deep(.t-tabs__nav) {
    flex: 0 0 auto;
    padding: 0 var(--app-spacing-4);
}

.printer-detail-drawer__tabs.is-single-panel :deep(.t-tabs__nav) {
    display: none;
}

.printer-detail-drawer__tabs :deep(.t-tabs__content) {
    min-height: 0;
    flex: 1 1 auto;
    overflow: hidden;
}

.printer-detail-drawer__tabs :deep(.t-tab-panel) {
    height: 100%;
    min-height: 0;
}

.printer-detail-drawer__panel {
    height: 100%;
    min-height: 0;
    padding: var(--app-spacing-3) var(--app-spacing-4);
}

.printer-detail-drawer__overview {
    display: grid;
    align-content: start;
    gap: var(--app-spacing-3);
    overflow-y: auto;
}

.printer-detail-drawer__status-card {
    --printer-status-accent: var(--app-text-secondary);
    display: grid;
    gap: var(--app-spacing-2);
    padding: var(--app-spacing-3) var(--app-spacing-4);
    background: var(--app-surface-muted);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius);
}

.printer-detail-drawer__status-card.is-idle {
    --printer-status-accent: var(--td-success-color-7);
    background: var(--td-success-color-1);
    border-color: var(--td-success-color-3);
}

.printer-detail-drawer__status-card.is-error {
    --printer-status-accent: var(--td-error-color-7);
    background: var(--td-error-color-1);
    border-color: var(--td-error-color-3);
}

.printer-detail-drawer__status-card.is-preparing,
.printer-detail-drawer__status-card.is-paused {
    --printer-status-accent: var(--td-warning-color-7);
    background: var(--td-warning-color-1);
    border-color: var(--td-warning-color-3);
}

.printer-detail-drawer__status-card.is-printing {
    --printer-status-accent: var(--td-brand-color-7);
    background: var(--td-brand-color-1);
    border-color: var(--td-brand-color-3);
}

.printer-detail-drawer__status-card.is-offline,
.printer-detail-drawer__status-card.is-unknown {
    --printer-status-accent: var(--app-text-secondary);
    background: var(--app-surface-muted);
    border-color: var(--app-border);
}

.printer-detail-drawer__status-main {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: var(--app-spacing-3);
}

.printer-detail-drawer__status-copy {
    min-width: 0;
    flex: 1 1 auto;
}

.printer-detail-drawer__status-heading,
.printer-detail-drawer__section-heading,
.printer-detail-drawer__footer,
.printer-detail-drawer__footer-primary,
.printer-detail-drawer__footer-actions,
.printer-detail-drawer__monitor-toggle,
.printer-detail-drawer__assigned-actions {
    display: flex;
    align-items: center;
}

.printer-detail-drawer__section-heading,
.printer-detail-drawer__footer {
    justify-content: space-between;
}

.printer-detail-drawer__status-heading {
    min-width: 0;
    flex-wrap: wrap;
    gap: var(--app-spacing-2);
}

.printer-detail-drawer__status-description {
    color: var(--app-text-secondary);
    font-size: var(--td-font-size-body-small);
    line-height: 1.5;
}

.printer-detail-drawer__progress-summary {
    display: flex;
    flex: 0 0 auto;
    align-items: baseline;
    gap: var(--app-spacing-2);
}

.printer-detail-drawer__progress-summary strong {
    color: var(--printer-status-accent);
    font-size: var(--td-font-size-title-large);
}

.printer-detail-drawer__device-info-grid {
    display: grid;
    min-width: 0;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--app-spacing-2);
    margin-top: var(--app-spacing-2);
}

.printer-detail-drawer__device-info-item {
    display: flex;
    min-width: 0;
    min-height: 44px;
    padding: var(--app-spacing-2) var(--app-spacing-3);
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    background: var(--app-surface-muted);
    border-radius: var(--app-radius-small);
}

.printer-detail-drawer__device-info-item > span {
    color: var(--app-text-secondary);
    font-size: var(--td-font-size-body-small);
}

.printer-detail-drawer__device-info-item > strong {
    overflow: hidden;
    color: var(--app-text-primary);
    font-size: var(--td-font-size-body-medium);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.printer-detail-drawer__progress-summary span,
.printer-detail-drawer__monitor-toggle,
.printer-detail-drawer__summary-item > span,
.printer-detail-drawer__metric > span,
.printer-detail-drawer__assigned-copy > span,
.printer-detail-drawer__statistic > span {
    color: var(--app-text-secondary);
    font-size: var(--td-font-size-body-small);
}

.printer-detail-drawer__inline-error {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: var(--app-spacing-2);
    color: var(--td-error-color-7);
    font-size: var(--td-font-size-body-small);
}

.printer-detail-drawer__monitor-section,
.printer-detail-drawer__detail-section,
.printer-detail-drawer__statistics-section,
.printer-detail-drawer__history-section {
    padding: var(--app-spacing-3);
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius);
}

.printer-detail-drawer__section-heading {
    min-height: var(--td-comp-size-xs);
    gap: var(--app-spacing-2);
    color: var(--app-text-primary);
    font-size: var(--td-font-size-body-medium);
    font-weight: 600;
}

.printer-detail-drawer__section-heading > span {
    display: inline-flex;
    align-items: center;
    gap: var(--app-spacing-1);
}

.printer-detail-drawer__monitor-toggle,
.printer-detail-drawer__footer-actions,
.printer-detail-drawer__assigned-actions {
    gap: var(--app-spacing-2);
}

.printer-detail-drawer__monitor-summary {
    display: grid;
    grid-template-columns: 0.8fr 1.5fr 0.8fr;
    gap: var(--app-spacing-2);
    margin-top: var(--app-spacing-2);
}

.printer-detail-drawer__summary-item {
    display: flex;
    min-width: 0;
    min-height: 44px;
    padding: var(--app-spacing-2) var(--app-spacing-3);
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    background: var(--app-surface-muted);
    border-radius: var(--app-radius-small);
}

.printer-detail-drawer__summary-item strong {
    overflow: hidden;
    color: var(--app-text-primary);
    font-size: var(--td-font-size-body-small);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.printer-detail-drawer__communication-error {
    margin-top: var(--app-spacing-2);
    overflow: hidden;
    color: var(--td-error-color-7);
    font-size: var(--td-font-size-body-small);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.printer-detail-drawer__task-observation {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: var(--app-spacing-2);
    margin-top: var(--app-spacing-2);
}

.printer-detail-drawer__task-filename {
    min-width: 0;
    overflow: hidden;
    color: var(--app-text-secondary);
    font-size: var(--td-font-size-body-small);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.printer-detail-drawer__metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--app-spacing-2);
    margin-top: var(--app-spacing-2);
}

.printer-detail-drawer__metric {
    display: flex;
    min-width: 0;
    min-height: 58px;
    padding: var(--app-spacing-2) var(--app-spacing-3);
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    background: var(--app-surface-muted);
    border-radius: var(--app-radius-small);
}

.printer-detail-drawer__metric > span {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-1);
}

.printer-detail-drawer__metric svg {
    width: 14px;
    height: 14px;
}

.printer-detail-drawer__metric strong {
    color: var(--app-text-primary);
    font-size: var(--td-font-size-title-medium);
}

.printer-detail-drawer__assigned-section {
    display: grid;
    gap: var(--app-spacing-2);
}

.printer-detail-drawer__assigned-card {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: var(--app-spacing-3);
    padding: var(--app-spacing-3);
    background: var(--td-warning-color-1);
    border: 1px solid var(--td-warning-color-3);
    border-radius: var(--app-radius);
}

.printer-detail-drawer__assigned-copy {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 2px;
}

.printer-detail-drawer__assigned-copy strong {
    overflow: hidden;
    color: var(--app-text-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.printer-detail-drawer__history-panel {
    display: flex;
    flex-direction: column;
    gap: var(--app-spacing-3);
    overflow: hidden;
}

.printer-detail-drawer__statistics-section {
    flex: 0 0 auto;
}

.printer-detail-drawer__statistics-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--app-spacing-2);
    margin-top: var(--app-spacing-2);
}

.printer-detail-drawer__statistic {
    display: flex;
    min-width: 0;
    min-height: 48px;
    padding: var(--app-spacing-2) var(--app-spacing-3);
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    background: var(--app-surface-muted);
    border-radius: var(--app-radius-small);
}

.printer-detail-drawer__statistic strong {
    overflow: hidden;
    color: var(--app-text-primary);
    font-size: var(--td-font-size-title-small);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.printer-detail-drawer__history-section {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--app-spacing-2);
}

.printer-detail-drawer__history-toolbar {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--app-spacing-2);
}

.printer-detail-drawer__history-toolbar :deep(.t-date-range-picker) {
    min-width: 0;
    flex: 1 1 auto;
}

.printer-detail-drawer__history-table-region {
    min-height: 160px;
    flex: 1 1 auto;
    overflow: auto;
}

.printer-detail-drawer :deep(.printer-history-table) {
    width: 100%;
    min-width: 0;
}

.printer-detail-drawer :deep(.printer-history-table .t-table__content) {
    width: 100%;
    max-width: 100%;
    overflow: visible;
}

.printer-detail-drawer :deep(.printer-history-table table) {
    width: 100%;
    table-layout: fixed;
}

.printer-detail-drawer :deep(.printer-history-table td:nth-child(3)) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.printer-history-status {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
}

.printer-history-samples {
    color: var(--app-text-placeholder);
    font-size: var(--td-font-size-body-extra-small);
    white-space: nowrap;
}

.printer-detail-drawer__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-width: 0;
    gap: var(--app-spacing-3);
}

.printer-detail-drawer__title {
    overflow: hidden;
    color: var(--app-text-primary);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.printer-detail-drawer__footer {
    min-height: 64px;
    padding: var(--app-spacing-3) var(--app-spacing-4);
    flex-wrap: wrap;
    gap: var(--app-spacing-3);
    border-top: 0;
}

.printer-detail-drawer__console-button {
    flex: 0 0 auto;
}

.printer-detail-drawer__footer-primary,
.printer-detail-drawer__footer-actions {
    flex-wrap: wrap;
    gap: var(--app-spacing-2);
}

.printer-detail-drawer__footer-hint {
    color: var(--app-text-secondary);
    font-size: var(--td-font-size-body-small);
}

.printer-detail-drawer__footer :deep(.t-button__text) {
    display: inline-flex;
    align-items: center;
    gap: var(--app-spacing-1);
}

.printer-detail-drawer__footer :deep(.t-button__text > svg) {
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
}

/* ============================================
   移动端适配
   ============================================ */
@media (max-width: 767px) {
    :deep(.t-drawer) {
        width: 100% !important;
    }

    .printer-detail-drawer__panel {
        padding: var(--app-spacing-2) var(--app-spacing-3);
    }

    .printer-detail-drawer__monitor-summary,
    .printer-detail-drawer__statistics-grid,
    .printer-detail-drawer__device-info-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .printer-detail-drawer__status-main {
        align-items: flex-start;
    }

    .printer-detail-drawer__assigned-card,
    .printer-detail-drawer__footer {
        align-items: stretch;
        flex-direction: column;
    }

    .printer-detail-drawer__assigned-actions,
    .printer-detail-drawer__footer-primary,
    .printer-detail-drawer__footer-actions {
        width: 100%;
    }

    .printer-detail-drawer__assigned-actions > *,
    .printer-detail-drawer__footer-primary > *,
    .printer-detail-drawer__footer-actions > * {
        flex: 1 1 auto;
    }

    .printer-detail-drawer__history-panel {
        overflow-y: auto;
    }

    .printer-detail-drawer__history-section {
        min-height: 460px;
    }
}

/* ============================================
   平板适配
   ============================================ */
@media (min-width: 768px) and (max-width: 1279px) {
    :deep(.t-drawer) {
        width: 70% !important;
    }
}

</style>
