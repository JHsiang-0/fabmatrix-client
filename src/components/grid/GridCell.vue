<template>
    <!--
        GridCell 组件 - 响应式网格单元
        根据设备类型显示不同视图：
        - aisle（过道）：占位符
        - empty（空槽位）：可点击绑定设备
        - device（设备）：显示设备状态卡片

        响应式优化：
        1. 移动端：紧凑布局，精简信息
        2. 平板：标准布局
        3. 桌面：完整信息展示
    -->

    <!-- 过道占位 -->
    <div v-if="cellType === 'aisle'"
        class="flex items-center justify-center h-full bg-amber-50 border border-dashed border-amber-200 rounded"
        :class="{ 'min-h-[60px] sm:min-h-[80px] lg:min-h-[100px]': true }"
    >
        <div class="hidden sm:block w-1 h-4/5 bg-repeat-y bg-[length:4px_8px] bg-gradient-to-b from-gray-400 via-gray-400 to-transparent opacity-40"
             style="background-image: repeating-linear-gradient(to bottom, var(--app-text-placeholder) 0, var(--app-text-placeholder) 4px, transparent 4px, transparent 8px);"></div>
    </div>

    <!-- 空槽位 -->
    <div v-else-if="cellType === 'empty'"
        class="flex flex-col items-center justify-center h-full bg-gray-50 border border-dashed border-gray-200 rounded cursor-default transition-all"
        :class="{
            'min-h-[60px] sm:min-h-[80px] lg:min-h-[100px]': true,
            'ring-1 ring-green-400 bg-green-50 border-green-300': isDragOver,
            'cursor-pointer bg-amber-50 border-amber-300': isEditMode
        }"
        @click="handleClick" @dragenter="handleDragEnter" @dragleave="handleDragLeave" @dragover.prevent="handleDragOver"
        @drop="handleDrop"
    >
        <div class="text-xs sm:text-sm font-medium text-gray-500">{{ slotLabel }}</div>
        <div v-if="!isEditMode" class="text-gray-400 text-xs sm:text-sm">
            <span>空</span>
        </div>
        <div v-if="isEditMode" class="flex flex-col items-center gap-1 text-gray-600 text-xs">
            <span class="w-4 h-4 sm:w-5 sm:h-5">
                <Plus />
            </span>
            <span class="hidden sm:inline">点击绑定</span>
        </div>
    </div>

    <!-- 设备卡片 - 响应式企业级风格 -->
    <div v-else
        class="flex flex-col h-full p-1.5 sm:p-2 cursor-pointer transition-all relative overflow-hidden rounded-md border"
        :class="[statusClass, {
            'opacity-70 cursor-grabbing shadow-sm': isDragging,
            'border-dashed cursor-grab': isEditMode,
            'min-h-[60px] sm:min-h-[80px] lg:min-h-[100px]': true
        }]"
        :draggable="isEditMode"
        @dragstart="handleDragStart" @dragend="handleDragEnd" @dragenter="handleDragEnter"
        @dragleave="handleDragLeave" @dragover.prevent="handleDragOver" @drop="handleDrop" @click="handleClick"
    >
        <!-- 卡片头部：设备编号 -->
        <div class="flex justify-between items-center mb-0.5 sm:mb-1">
            <div class="text-xs sm:text-sm font-bold text-gray-900 truncate">{{ device.machineNumber || device.name || `#${device.id}` }}</div>
        </div>

        <!-- 错误提示 - 移动端精简显示 -->
        <div v-if="(hasSystemError || hasPrintError) && realTimeData?.systemMessage"
            class="flex-1 mb-0.5 min-h-6 sm:min-h-8 max-h-6 sm:max-h-8"
        >
            <div class="flex items-start gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-red-50 border border-red-300 rounded text-[10px] sm:text-xs text-red-700 leading-tight flex-1 overflow-hidden"
                 :title="realTimeData.systemMessage"
            >
                <span class="shrink-0 mt-0.5 w-3 h-3 sm:w-4 sm:h-4">
                    <WarningFilled />
                </span>
                <span class="line-clamp-1 sm:line-clamp-2">{{ truncateText(realTimeData.systemMessage, 40) }}</span>
            </div>
        </div>

        <!-- 卡片主体：温度信息 - 响应式布局 -->
        <div v-else class="flex flex-col gap-0.5 sm:gap-1 mb-0.5 flex-1 min-h-6 sm:min-h-8"
        >
            <!-- 喷头温度 - 精简显示 -->
            <div class="flex items-center gap-1 sm:gap-1.5">
                <div class="w-3 h-3 sm:w-3.5 sm:h-3.5 flex items-center justify-center text-gray-500">
                    <IconNozzle class="w-full h-full" />
                </div>
                <div class="flex items-baseline gap-0.5 text-[10px] sm:text-xs font-semibold text-gray-700"
                >
                    <span class="text-gray-900">{{ nozzleTemp }}</span>
                    <span class="text-gray-400">/</span>
                    <span class="text-gray-500 text-[8px] sm:text-[10px]">{{ nozzleTarget }}</span>
                </div>
            </div>

            <!-- 热床温度 - 精简显示 -->
            <div class="flex items-center gap-1 sm:gap-1.5">
                <div class="w-3 h-3 sm:w-3.5 sm:h-3.5 flex items-center justify-center text-gray-500">
                    <IconBed class="w-full h-full" />
                </div>
                <div class="flex items-baseline gap-0.5 text-[10px] sm:text-xs font-semibold text-gray-700"
                >
                    <span class="text-gray-900">{{ bedTemp }}</span>
                    <span class="text-gray-400">/</span>
                    <span class="text-gray-500 text-[8px] sm:text-[10px]">{{ bedTarget }}</span>
                </div>
            </div>
        </div>

        <!-- 卡片底部：状态或进度 - 响应式字体 -->
        <div class="flex justify-center items-center pt-1 border-t border-dashed border-gray-300 mt-auto h-5 sm:h-5.5"
        >
            <!-- 打印中显示大百分比 -->
            <div v-if="isPrinting" class="text-lg sm:text-2xl font-bold text-gray-600 leading-none"
            >
                {{ progressPercent }}%
            </div>
            <!-- 其他状态显示状态文本 -->
            <div v-else class="text-[10px] sm:text-xs font-bold text-gray-900 uppercase tracking-wider"
            >
                {{ statusText }}
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { AddIcon as Plus, ErrorCircleFilledIcon as WarningFilled } from 'tdesign-icons-vue-next'
import IconNozzle from '../icons/IconNozzle.vue'
import IconBed from '../icons/IconBed.vue'
import { PRINTER_STATE, PRINTER_STATE_MAP } from '@/utils/constants'

defineOptions({ name: 'GridCell' })

// ============================================
// Props
// ============================================

const props = defineProps({
    /** 单元格类型: 'aisle' | 'empty' | 'device' */
    cellType: {
        type: String,
        required: true
    },
    /** 设备对象（仅 device 类型时有值） */
    device: {
        type: Object,
        default: null
    },
    /** 实时状态数据（仅 device 类型时有值） */
    realTimeData: {
        type: Object,
        default: null
    },
    /** 行索引 */
    rowIndex: {
        type: Number,
        required: true
    },
    /** 列索引 */
    colIndex: {
        type: Number,
        required: true
    },
    /** 槽位标签（如 'A-01'） */
    slotLabel: {
        type: String,
        default: ''
    },
    /** 是否正在拖拽中 */
    isDragging: {
        type: Boolean,
        default: false
    },
    /** 是否拖拽悬停 */
    isDragOver: {
        type: Boolean,
        default: false
    },
    /** 是否编辑模式 */
    isEditMode: {
        type: Boolean,
        default: false
    }
})

// ============================================
// Emits
// ============================================

const emit = defineEmits([
    'dragstart',
    'dragend',
    'dragenter',
    'dragleave',
    'drop',
    'click'
])

// ============================================
// Computed - 状态相关
// ============================================

/** 当前状态 - 严格使用 unifiedState 字段 */
const status = computed(() => {
    if (!props.realTimeData) return PRINTER_STATE.UNKNOWN
    return props.realTimeData.unifiedState || PRINTER_STATE.UNKNOWN
})

/** 状态文本 - 使用 PRINTER_STATE_MAP */
const statusText = computed(() => {
    return PRINTER_STATE_MAP[status.value]?.label || '未知'
})

/** 状态样式类 - 企业级配色方案 */
const statusClass = computed(() => {
    const state = status.value
    const stateClassMap = {
        [PRINTER_STATE.UNKNOWN]: 'bg-gray-100 border-gray-400 shadow-sm',
        [PRINTER_STATE.FAULT]: 'bg-red-100 border-red-500 shadow-sm',
        [PRINTER_STATE.SYS_ERROR]: 'bg-orange-100 border-orange-500 shadow-sm',
        [PRINTER_STATE.STARTING]: 'bg-yellow-100 border-yellow-500 shadow-sm',
        [PRINTER_STATE.STANDBY]: 'bg-blue-50 border-blue-500 shadow-sm',
        [PRINTER_STATE.PRINTING]: 'bg-blue-100 border-blue-600 shadow-sm',
        [PRINTER_STATE.PAUSED]: 'bg-amber-100 border-amber-500 shadow-sm',
        [PRINTER_STATE.COMPLETED]: 'bg-green-100 border-green-500 shadow-sm',
        [PRINTER_STATE.PRINT_ERROR]: 'bg-purple-100 border-purple-500 shadow-sm',
        [PRINTER_STATE.CANCELLED]: 'bg-gray-200 border-gray-500 shadow-sm'
    }
    return stateClassMap[state] || 'bg-gray-100 border-gray-400 shadow-sm'
})

/** 是否正在打印中 */
const isPrinting = computed(() => status.value === PRINTER_STATE.PRINTING)

/** 是否显示系统错误信息（硬件故障或系统错误） */
const hasSystemError = computed(() => {
    return status.value === PRINTER_STATE.FAULT || status.value === PRINTER_STATE.SYS_ERROR
})

/** 是否显示打印错误 */
const hasPrintError = computed(() => {
    return status.value === PRINTER_STATE.PRINT_ERROR
})

// ============================================
// Computed - 温度相关
// ============================================

/** 喷头温度 */
const nozzleTemp = computed(() => {
    if (!props.realTimeData?.extruder?.temperature) return '--'
    return Math.round(props.realTimeData.extruder.temperature)
})

/** 喷头目标温度 */
const nozzleTarget = computed(() => {
    if (!props.realTimeData?.extruder?.target) return '--'
    return Math.round(props.realTimeData.extruder.target)
})

/** 热床温度 */
const bedTemp = computed(() => {
    if (!props.realTimeData?.heaterBed?.temperature) return '--'
    return Math.round(props.realTimeData.heaterBed.temperature)
})

/** 热床目标温度 */
const bedTarget = computed(() => {
    if (!props.realTimeData?.heaterBed?.target) return '--'
    return Math.round(props.realTimeData.heaterBed.target)
})

// ============================================
// Computed - 打印进度相关
// ============================================

/** 打印进度百分比 */
const progressPercent = computed(() => {
    if (!props.realTimeData?.progress) return 0
    return Math.round(props.realTimeData.progress)
})

// ============================================
// Methods
// ============================================

/** 截断文本 */
function truncateText(text, maxLength) {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
}

// ============================================
// Event Handlers
// ============================================

function handleDragStart(event) {
    // 只有编辑模式下才允许拖拽
    if (!props.isEditMode) {
        event.preventDefault()
        return
    }
    // 设置拖拽效果
    event.dataTransfer.effectAllowed = 'move'
    emit('dragstart', props.device, props.rowIndex, props.colIndex)
}

function handleDragEnd() {
    emit('dragend')
}

function handleDragEnter(event) {
    // 防止默认行为，允许放置
    event.preventDefault()
    emit('dragenter', props.rowIndex, props.colIndex)
}

function handleDragOver(event) {
    // 防止默认行为，允许放置
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
}

function handleDragLeave() {
    emit('dragleave')
}

function handleDrop(event) {
    event.preventDefault()
    emit('drop', props.rowIndex, props.colIndex)
}

function handleClick() {
    emit('click', props.device, props.rowIndex, props.colIndex)
}
</script>

<style scoped>
/* 设备卡片深度选择器样式 */
:deep(.line-clamp-2) {
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

/* 移动端优化：减少卡片内边距 */
@media (max-width: 767px) {
    .device-card {
        padding: 0.25rem;
    }

    .device-card .machine-number {
        font-size: 0.625rem;
    }

    .device-card .temp-display {
        font-size: 0.625rem;
    }
}

/* 平板优化：标准尺寸 */
@media (min-width: 768px) and (max-width: 1279px) {
    .device-card {
        padding: 0.375rem;
    }
}

/* 桌面优化：舒适尺寸 */
@media (min-width: 1280px) {
    .device-card {
        padding: 0.5rem;
    }
}
</style>
