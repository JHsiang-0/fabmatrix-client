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

        <div v-else-if="device" class="printer-detail-drawer__content p-fluid-md flex flex-col gap-fluid-lg">
            <!-- 实时状态概览卡片 -->
            <div class="printer-detail-drawer__status-card p-fluid-md rounded-lg bg-gray-100 border" :class="[
                currentStateClass === 'error' ? 'bg-red-50 border-red-300' : '',
                currentStateClass === 'preparing' || currentStateClass === 'paused' ? 'bg-yellow-50 border-yellow-300' : '',
                currentStateClass === 'printing' ? 'bg-gray-100 border-gray-500' : ''
            ]">
                <!-- 状态标签和进度 -->
                <div class="flex items-center justify-between gap-3">
                    <StatusTag domain="printer" :status="currentState" variant="dark" size="large" />
                    <span v-if="realTimeData?.progress !== undefined && isPrintingState"
                        class="text-fluid-2xl font-bold text-gray-700">
                        {{ realTimeData.progress }}%
                    </span>
                </div>

                <!-- 系统错误信息 -->
                <div v-if="realTimeData?.systemMessage && isErrorState"
                    class="mt-3 p-fluid-sm bg-red-50 border border-red-300 rounded text-fluid-xs text-red-700 leading-tight flex items-start gap-2">
                    <span class="shrink-0 mt-0.5">
                        <Warning />
                    </span>
                    <span class="line-clamp-3" :title="realTimeData.systemMessage">{{ realTimeData.systemMessage }}</span>
                </div>
            </div>

            <section class="printer-detail-drawer__monitor-section" aria-labelledby="printer-monitor-title">
                <div class="flex items-center justify-between gap-2 text-fluid-sm font-semibold text-gray-900">
                    <span id="printer-monitor-title">监控与通信</span>
                    <t-switch :value="monitorEnabled" :disabled="!canManageMonitor || monitorLoading || monitorUpdating"
                        :loading="monitorUpdating" @change="handleMonitorChange" />
                </div>
                <t-alert v-if="monitorError" theme="error" :title="monitorError" :close-btn="false" />
                <t-skeleton v-else-if="monitorLoading" :loading="true" theme="paragraph" />
                <t-descriptions v-else :column="descriptionColumn" size="small" bordered>
                    <t-descriptions-item label="后台监控">
                        {{ monitorEnabled ? '已启用' : '已停用' }}
                    </t-descriptions-item>
                    <t-descriptions-item label="通信状态">
                        <t-tag size="small" :theme="connectionTheme" variant="light">{{ connectionLabel }}</t-tag>
                    </t-descriptions-item>
                    <t-descriptions-item label="最近通信">
                        {{ formatDateTime(monitorValue.lastSeenAt) }}
                    </t-descriptions-item>
                    <t-descriptions-item label="连续失败">
                        {{ monitorValue.consecutiveFailureCount ?? 0 }} 次
                    </t-descriptions-item>
                    <t-descriptions-item label="最近已知状态">
                        <StatusTag domain="printer" :status="monitorValue.lastKnownStatus || currentState" />
                    </t-descriptions-item>
                    <t-descriptions-item label="协议原始状态">
                        {{ monitorValue.lastProtocolState || '-' }}
                    </t-descriptions-item>
                    <t-descriptions-item label="设备运行时间">
                        {{ monitorValue.lastDeviceUptime ?? '-' }}
                    </t-descriptions-item>
                    <t-descriptions-item v-if="monitorValue.lastCommunicationError" label="最近通信错误" :span="descriptionColumn">
                        <span class="text-red-600">{{ monitorValue.lastCommunicationError }}</span>
                    </t-descriptions-item>
                </t-descriptions>
            </section>

            <t-alert v-if="currentJobStatus === 'RECONCILING'" theme="warning" :close-btn="false"
                title="设备状态无法自动确认，请人工核对打印结果。" />

            <!-- 温度监控 -->
            <div class="flex flex-col gap-fluid-sm">
                <div class="flex items-center gap-2 text-fluid-sm font-semibold text-gray-900">
                    <IconNozzle class="w-4 h-4 text-red-600" />
                    温度监控
                </div>
                <!-- 温度卡片网格 - 响应式：移动端堆叠，桌面端并排 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-fluid-sm">
                    <!-- 喷头温度 -->
                    <div class="p-fluid-sm bg-gray-100 rounded-lg flex flex-col gap-1">
                        <span class="flex items-center text-fluid-xs text-gray-600">
                            <IconNozzle class="w-3.5 h-3.5 mr-1 text-red-600" />
                            喷头温度
                        </span>
                        <span class="text-fluid-2xl font-bold text-gray-900" :class="{ 'text-red-600': nozzleTemp > 50 }">
                            {{ formatTemp(nozzleTemp) }}
                        </span>
                    </div>
                    <!-- 热床温度 -->
                    <div class="p-fluid-sm bg-gray-100 rounded-lg flex flex-col gap-1">
                        <span class="flex items-center text-fluid-xs text-gray-600">
                            <IconBed class="w-3.5 h-3.5 mr-1 text-yellow-600" />
                            热床温度
                        </span>
                        <span class="text-fluid-2xl font-bold text-gray-900" :class="{ 'text-yellow-600': bedTemp > 40 }">
                            {{ formatTemp(bedTemp) }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- ASSIGNED 状态：待安全确认的任务信息 -->
            <div v-if="isAssignedState" class="flex flex-col gap-fluid-sm">
                <div class="flex items-center gap-2 text-fluid-sm font-semibold text-gray-900">
                    <span class="text-yellow-600">
                        <Lock />
                    </span>
                    待打印任务
                </div>
                <div class="p-fluid-md bg-yellow-50 border border-yellow-300 rounded-lg flex flex-col gap-fluid-sm">
                    <!-- 任务标题和图标 -->
                    <div class="flex items-start gap-3">
                        <div class="shrink-0 mt-0.5">
                            <Lock :size="24" class="text-yellow-600" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-yellow-800 text-fluid-lg">
                                {{ props.realTimeData?.currentJobFileName ||
                                    props.device?.currentJobFileName ||
                                    '任务 #' + (props.realTimeData?.currentJobId || props.device?.currentJobId) }}
                            </div>
                            <div class="text-fluid-xs text-yellow-700 mt-1">
                                任务已分配，请确认现场安全后启动打印
                            </div>
                        </div>
                    </div>

                    <!-- 任务详情网格 -->
                    <t-divider class="my-2" />
                    <div class="grid grid-cols-2 gap-2 text-fluid-sm">
                        <div class="flex flex-col">
                            <span class="text-fluid-xs text-yellow-600">任务编号</span>
                            <span class="font-medium text-yellow-800">#{{ props.realTimeData?.currentJobId ||
                                props.device?.currentJobId || '-' }}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-fluid-xs text-yellow-600">文件名称</span>
                            <span class="font-medium text-yellow-800 truncate">{{ props.realTimeData?.currentJobFileName
                                || props.device?.currentJobFileName || '-' }}</span>
                        </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div class="mt-2">
                        <t-button v-if="!isSafetyConfirmed" theme="warning" size="large"
                            class="w-full" @click="handleConfirmSafe" :loading="isLoading">
                            <span>
                                <Lock />
                            </span>
                            确认现场安全
                        </t-button>
                        <div v-else class="flex gap-2">
                            <t-button theme="primary" size="large" class="flex-1"
                                @click="handleStartPrint('START_PRINT')" :loading="isLoading">
                                <span>
                                    <VideoPlay />
                                </span>
                                下发并开始打印
                            </t-button>
                            <t-button theme="default" size="large" class="flex-1"
                                @click="handleStartPrint('UPLOAD_ONLY')" :loading="isLoading">
                                <span>
                                    <DocumentAdd />
                                </span>
                                仅下发文件
                            </t-button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 打印任务信息 -->
            <div v-if="isPrintingOrRelated" class="flex flex-col gap-fluid-sm">
                <div class="flex items-center gap-2 text-fluid-sm font-semibold text-gray-900">
                    <span class="text-gray-600">
                        <Printer />
                    </span>
                    打印任务
                </div>
                <div class="grid grid-cols-2 gap-fluid-sm">
                    <div class="p-fluid-sm bg-gray-100 rounded-lg flex flex-col gap-1">
                        <span class="text-fluid-xs text-gray-600">打印时长</span>
                        <span class="text-fluid-base font-medium text-gray-900">{{ formatDuration(realTimeData?.printDuration)
                            }}</span>
                    </div>
                    <div class="p-fluid-sm bg-gray-100 rounded-lg flex flex-col gap-1">
                        <span class="flex items-center text-fluid-xs text-gray-600">
                            <IconSpool class="w-3.5 h-3.5 mr-1 text-green-600" />
                            已用耗材
                        </span>
                        <span class="text-fluid-base font-medium text-gray-900">{{ formatFilament(realTimeData?.filamentUsed)
                            }}</span>
                    </div>
                    <div v-if="isPrintingState" class="p-fluid-sm bg-gray-100 rounded-lg flex flex-col gap-1 col-span-2">
                        <span class="text-fluid-xs text-gray-600">打印进度</span>
                        <t-progress :percentage="realTimeData?.progress || 0" :status="progressStatus"
                            :stroke-width="10" class="mt-2" />
                    </div>
                </div>
            </div>

            <!-- 设备信息 -->
            <div class="flex flex-col gap-fluid-sm">
                <div class="flex items-center gap-2 text-fluid-sm font-semibold text-gray-900">
                    <span class="text-gray-600">
                        <InfoFilled />
                    </span>
                    设备信息
                </div>
                <t-descriptions :column="descriptionColumn" size="small" bordered>
                    <t-descriptions-item label="机器编号" :span="descriptionColumn">
                        {{ device.machineNumber || '-' }}
                    </t-descriptions-item>
                    <t-descriptions-item label="设备名称" :span="descriptionColumn">
                        {{ device.name || '-' }}
                    </t-descriptions-item>
                    <t-descriptions-item label="IP 地址" :span="descriptionColumn">
                        {{ device.ipAddress || '-' }}
                    </t-descriptions-item>
                    <t-descriptions-item label="固件类型">
                        {{ device.firmwareType || '-' }}
                    </t-descriptions-item>
                    <t-descriptions-item label="喷头尺寸">
                        {{ device.nozzleSize ? device.nozzleSize + 'mm' : '-' }}
                    </t-descriptions-item>
                </t-descriptions>
            </div>

            <!-- 历史与统计 -->
            <div class="flex flex-col gap-fluid-sm">
                <div class="flex items-center justify-between gap-2 text-fluid-sm font-semibold text-gray-900">
                    <span class="flex items-center gap-2">
                        <span class="text-gray-600"><InfoFilled /></span>
                        状态历史与统计
                    </span>
                    <t-tag v-if="historyIncrementNotice" theme="primary" variant="light" size="small">
                        实时状态已更新
                    </t-tag>
                </div>

                <t-card class="printer-detail-drawer__sub-card border-gray-200">
                    <template #header>
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <span class="text-sm font-semibold text-gray-900">打印统计</span>
                            <span class="text-xs text-gray-500">时长单位：秒</span>
                        </div>
                    </template>
                    <t-alert v-if="statisticsError" theme="error" :title="statisticsError" :close-btn="false" />
                    <t-skeleton v-else-if="statisticsLoading" :loading="true" theme="paragraph" />
                    <div v-else-if="statistics" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div v-for="item in statisticCards" :key="item.key" class="rounded-lg bg-gray-100 p-3">
                            <div class="text-xs text-gray-600">{{ item.label }}</div>
                            <div class="mt-1 text-lg font-bold text-gray-900">{{ item.value }}</div>
                        </div>
                    </div>
                    <t-empty v-else description="暂无统计数据" />
                </t-card>

                <t-card class="printer-detail-drawer__sub-card border-gray-200">
                    <template #header>
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <span class="text-sm font-semibold text-gray-900">状态历史</span>
                            <div class="flex flex-wrap items-center gap-2">
                                <t-date-range-picker
                                    v-model="historyRangeModel"
                                    separator="至"
                                    :placeholder="['开始日期', '结束日期']"
                                    value-type="YYYY-MM-DD HH:mm:ss"
                                    style="width: 260px"
                                    :default-time="['00:00:00', '23:59:59']"
                                />
                                <t-button size="small" theme="primary" :loading="historyLoading" @click="handleHistoryQuery">
                                    查询
                                </t-button>
                                <t-button v-if="historyIncrementNotice" size="small" variant="outline" @click="handleHistoryQuery">
                                    刷新历史
                                </t-button>
                            </div>
                        </div>
                    </template>
                    <t-alert v-if="historyError" theme="error" :title="historyError" :close-btn="false" />
                    <t-skeleton v-else-if="historyLoading" :loading="true" theme="paragraph" />
                    <t-table
                        v-else-if="statusHistory.length > 0"
                        class="printer-history-table"
                        :data="statusHistory"
                        :columns="historyColumns"
                        row-key="id"
                        size="small"
                        bordered
                    >
                        <template #status="slotProps">
                            <StatusTag domain="printer" :status="slotProps.row.status" />
                        </template>
                        <template #progress="slotProps">
                            {{ slotProps.row.progress ?? 0 }}%
                        </template>
                        <template #recordedAt="slotProps">
                            {{ formatDateTime(slotProps.row.recordedAt) }}
                        </template>
                    </t-table>
                    <t-empty v-else description="暂无状态历史" />
                    <t-pagination
                        v-if="historyTotal > historyPageSize"
                        class="mt-3"
                        :current="historyPageNum"
                        :page-size="historyPageSize"
                        :total="historyTotal"
                        :show-page-size="false"
                        @change="handleHistoryPageChange"
                    />
                </t-card>
            </div>

            <!-- Moonraker / Mainsail 快捷操作 -->
            <div class="flex flex-col gap-fluid-sm">
                <div class="flex items-center gap-2 text-fluid-sm font-semibold text-gray-900">
                    <span class="text-gray-600">
                        <Monitor />
                    </span>
                    远程控制
                </div>
                <div class="flex flex-col gap-fluid-sm">
                    <t-button v-if="device.ipAddress && device.firmwareType !== 'RRF'" theme="primary" size="large" tag="a" :href="mainsailUrl"
                        target="_blank" rel="noopener noreferrer" class="w-full justify-center h-11 text-fluid-sm">
                        <span>
                            <Monitor />
                        </span>
                        打开 Mainsail 界面
                    </t-button>

                    <!-- 操作按钮网格 - 移动端单列，桌面 3列 -->
                    <div class="printer-detail-drawer__remote-actions">
                        <t-button theme="warning" size="medium" :disabled="actionLoading || !canPause" :loading="actionLoading" @click="handleAction('pause')" class="printer-detail-drawer__remote-action">
                            <span>
                                <VideoPause />
                            </span>
                            暂停
                        </t-button>
                        <t-button theme="success" size="medium" :disabled="actionLoading || !canResume" :loading="actionLoading" @click="handleAction('resume')" class="printer-detail-drawer__remote-action">
                            <span>
                                <VideoPlay />
                            </span>
                            恢复
                        </t-button>
                        <t-button theme="danger" size="medium" :disabled="actionLoading || !canCancel" :loading="actionLoading" @click="handleAction('cancel')" class="printer-detail-drawer__remote-action">
                            <span>
                                <CircleClose />
                            </span>
                            取消
                        </t-button>
                    </div>

                    <div v-if="isFatalError" class="mt-3">
                        <t-divider>
                            <t-tag theme="danger" variant="dark">紧急操作</t-tag>
                        </t-divider>
                        <t-button theme="danger" size="large" class="w-full"
                            :disabled="actionLoading" :loading="actionLoading"
                            @click="handleEmergencyStop">
                            <span>
                                <Warning />
                            </span>
                            紧急停机 (ESTOP)
                        </t-button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 抽屉底部操作区 -->
        <template #footer>
            <div class="flex justify-end p-fluid-md border-t border-gray-200">
                <t-popconfirm v-if="canManageDevice" content="确定要将此设备从该物理位置下架吗？" confirm-btn="确认下架" cancel-btn="取消"
                    theme="danger" @confirm="handleRemove">
                    <template>
                        <t-button theme="danger" variant="outline">
                            <span>
                                <Delete />
                            </span>
                            从看板下架
                        </t-button>
                    </template>
                </t-popconfirm>
            </div>
        </template>
    </t-drawer>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import {
    CloseIcon as Close,
    DeleteIcon as Delete,
    PrintIcon as Printer,
    InfoCircleFilledIcon as InfoFilled,
    DesktopIcon as Monitor,
    PauseIcon as VideoPause,
    PlayIcon as VideoPlay,
    CloseCircleIcon as CircleClose,
    ErrorCircleFilledIcon as Warning,
    LockOnIcon as Lock,
    FileAddIcon as DocumentAdd
} from 'tdesign-icons-vue-next'
import IconNozzle from '../icons/IconNozzle.vue'
import IconBed from '../icons/IconBed.vue'
import IconSpool from '../icons/IconSpool.vue'
import { PRINTER_STATUS, PROGRESS_STATUS_MAP } from '@/utils/constants'
import StatusTag from '@/components/StatusTag.vue'
import { normalizePrinterStatus } from '@/utils/dataAdapters'
import { formatTemp, formatDuration, formatFilament, formatDateTime } from '@/utils/formatters'
import { confirmSafe } from '@/api/printer'
import { startJob } from '@/api/job'
import { message } from '@/utils/message'

defineOptions({ name: 'DeviceDetailDrawer' })

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
    if (isLargeScreen.value) return '560px' // 大屏：固定 560px (35rem)
    return '520px'                          // 桌面：固定 520px (32.5rem)
})

// 响应式描述列表列数
const descriptionColumn = computed(() => {
    return isMobile.value ? 1 : 2
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
    'retry',
    'monitor-change'
])

const historyRangeModel = ref([])
const historyIncrementNotice = ref(false)
const drawerVisible = computed({
    get: () => props.modelValue,
    set: value => handleVisibleChange(value)
})

const historyColumns = computed(() => {
    if (isMobile.value) {
        return [
            { colKey: 'status', title: '状态', width: 82 },
            { colKey: 'filename', title: '文件', width: 112, ellipsis: true },
            { colKey: 'progress', title: '进度', width: 60 },
            { colKey: 'recordedAt', title: '记录时间', width: 148 }
        ]
    }

    return [
        { colKey: 'status', title: '状态', width: 92 },
        { colKey: 'filename', title: '文件', width: 136, ellipsis: true },
        { colKey: 'progress', title: '进度', width: 72 },
        { colKey: 'recordedAt', title: '记录时间', width: 152 }
    ]
})

const statisticCards = computed(() => {
    const stats = props.statistics || {}
    return [
        { key: 'totalJobs', label: '总任务', value: stats.totalJobs ?? 0 },
        { key: 'completedJobs', label: '已完成', value: stats.completedJobs ?? 0 },
        { key: 'failedJobs', label: '失败', value: stats.failedJobs ?? 0 },
        { key: 'successRate', label: '成功率', value: `${Number(stats.successRate || 0).toFixed(1)}%` },
        { key: 'activeJobs', label: '活动任务', value: stats.activeJobs ?? 0 },
        { key: 'totalPrintSeconds', label: '总打印时长', value: `${Number(stats.totalPrintSeconds || 0).toFixed(0)} 秒` },
        { key: 'averagePrintSeconds', label: '平均时长', value: `${Number(stats.averagePrintSeconds || 0).toFixed(0)} 秒` }
    ]
})

watch(() => props.historyRange, value => {
    historyRangeModel.value = Array.isArray(value) ? [...value] : []
}, { immediate: true })

watch(() => props.realTimeData?.updatedAt, (value, previousValue) => {
    if (value && previousValue && value !== previousValue) historyIncrementNotice.value = true
})

watch(() => props.modelValue, visible => {
    if (!visible) historyIncrementNotice.value = false
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
    const sourceState = props.realTimeData?.businessStatus || props.realTimeData?.unifiedState || props.device?.status
    if (String(sourceState || '').toUpperCase() === 'ASSIGNED') return PRINTER_STATUS.IDLE
    return normalizePrinterStatus(sourceState)
})

const monitorValue = computed(() => ({
    ...props.device,
    ...props.monitorConfig,
    ...props.realTimeData
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
const currentJobStatus = computed(() => String(
    props.realTimeData?.currentJobStatus || props.device?.currentJobStatus || ''
).toUpperCase())
/** 当前状态类名 */
const currentStateClass = computed(() => {
    return currentState.value.toLowerCase()
})

/** 是否为打印中状态 */
const isPrintingState = computed(() => {
    return currentState.value === PRINTER_STATUS.PRINTING
})

/** 是否为打印中或相关状态 */
const isPrintingOrRelated = computed(() => {
    const relatedStates = [
        PRINTER_STATUS.PRINTING,
        PRINTER_STATUS.PAUSED
    ]
    return relatedStates.includes(currentState.value)
})

/** 是否为错误状态 */
const isErrorState = computed(() => {
    return currentState.value === PRINTER_STATUS.ERROR
})

/** 是否为致命错误 */
const isFatalError = computed(() => {
    return currentState.value === PRINTER_STATUS.ERROR
})

/** 喷头温度 */
const nozzleTemp = computed(() => {
    return props.realTimeData?.toolTemperature
})

/** 热床温度 */
const bedTemp = computed(() => {
    return props.realTimeData?.bedTemperature
})

/** Mainsail 访问地址 */
const mainsailUrl = computed(() => {
    if (!props.device?.ipAddress) return '#'
    return `http://${props.device.ipAddress}`
})

/** 进度条状态 */
const progressStatus = computed(() => {
    return PROGRESS_STATUS_MAP[currentState.value] || ''
})

/** 是否为已分配状态（等待安全确认） */
const isAssignedState = computed(() => {
    const state = String(props.realTimeData?.state || '').toUpperCase()
    const hasJob = props.realTimeData?.currentJobId || props.device?.currentJobId
    return state === 'ASSIGNED' && !!hasJob
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
        await confirmSafe(props.device.id)
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
    overflow-y: auto;
    scrollbar-color: var(--app-scrollbar-thumb) var(--app-scrollbar-track);
    scrollbar-width: thin;
}

.printer-detail-drawer :deep(.t-drawer__body::-webkit-scrollbar) { width: 8px; }
.printer-detail-drawer :deep(.t-drawer__body::-webkit-scrollbar-track) { background: var(--app-scrollbar-track); }
.printer-detail-drawer :deep(.t-drawer__body::-webkit-scrollbar-thumb) {
    background: var(--app-scrollbar-thumb);
    border: 2px solid transparent;
    border-radius: 999px;
    background-clip: padding-box;
}
.printer-detail-drawer :deep(.t-drawer__body::-webkit-scrollbar-thumb:hover) {
    background: var(--app-scrollbar-thumb-hover);
    background-clip: padding-box;
}

.printer-detail-drawer__content {
    min-width: 0;
}

.printer-detail-drawer__status-card {
    background: var(--app-surface-muted);
    border-color: var(--app-border);
    box-shadow: var(--app-shadow);
}

.printer-detail-drawer__monitor-section {
    padding: var(--app-spacing-4);
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius);
}

.printer-detail-drawer__monitor-section :deep(.t-descriptions) {
    margin-top: var(--app-spacing-3);
}

.printer-detail-drawer__sub-card {
    overflow: hidden;
}

.printer-detail-drawer__sub-card :deep(.t-card__header) {
    padding: var(--app-spacing-3) var(--app-spacing-4);
    background: var(--app-surface-muted);
    border-bottom: 1px solid var(--app-border);
}

.printer-detail-drawer__sub-card :deep(.t-card__body) {
    padding: var(--app-spacing-4);
}

.printer-detail-drawer :deep(.printer-history-table) {
    width: 100%;
    min-width: 0;
}

.printer-detail-drawer :deep(.printer-history-table .t-table__content) {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
}

.printer-detail-drawer :deep(.printer-history-table table) {
    width: 100%;
    table-layout: fixed;
}

.printer-detail-drawer :deep(.printer-history-table td:nth-child(2)) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.printer-detail-drawer__remote-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--app-spacing-2);
}

.printer-detail-drawer__remote-action {
    width: 100%;
    min-height: 40px;
    justify-content: center;
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

/* ============================================
   移动端适配
   ============================================ */
@media (max-width: 767px) {
    :deep(.t-drawer) {
        width: 100% !important;
    }

    .printer-detail-drawer__remote-actions {
        grid-template-columns: 1fr;
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
