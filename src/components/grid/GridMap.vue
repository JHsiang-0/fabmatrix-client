<template>
    <div class="flex shrink-0 gap-2" :class="{ 'is-edit-mode': isEditMode }">
        <!-- 行标签 -->
        <div class="flex flex-col shrink-0">
            <!-- 对齐填充层 - 与列标题高度一致 -->
            <div class="h-7"></div>

            <div class="grid gap-3" style="grid-template-rows: repeat(4, 120px);">
                <div v-for="row in gridConfig.ROWS" :key="`label-${row}`"
                    class="flex items-center justify-center w-10 bg-gray-100 border border-dashed border-gray-300 rounded text-sm font-medium text-gray-600"
                    :class="{ 'bg-gray-50 border-gray-300 text-gray-700 font-bold': isEditMode }"
                    style="writing-mode: vertical-rl; text-orientation: mixed; min-height: 120px;">
                    {{ formatRowLabel(row) }}{{ rowSuffix }}
                </div>
            </div>
        </div>

        <!-- 网格主体 -->
        <div class="flex flex-col shrink-0 overflow-visible">
            <!-- 列标题 -->
            <div class="grid gap-3 mb-2" style="grid-template-columns: repeat(13, 100px);">
                <div v-for="col in gridConfig.TOTAL_COLS" :key="`header-${col}`"
                    class="flex items-center justify-center h-7 bg-gray-100 border border-dashed border-gray-300 rounded text-xs font-medium text-gray-600"
                    :class="[
                        col === gridConfig.AISLE_COL ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold' : '',
                        isEditMode && col !== gridConfig.AISLE_COL ? 'bg-gray-50 border-gray-300 text-gray-700 font-bold' : '',
                        isEditMode && col === gridConfig.AISLE_COL ? 'bg-amber-100 border-amber-400 text-amber-800' : ''
                    ]">
                    <template v-if="col === gridConfig.AISLE_COL">{{ aisleLabel }}</template>
                    <template v-else>{{ getPhysicalCol(col) }}</template>
                </div>
            </div>

            <!-- 设备网格 - 4行 x 13列 - 统一容器 -->
            <div class="grid gap-3 shrink-0"
                :class="{ 'bg-gray-100 rounded': isEditMode }"
                style="grid-template-columns: repeat(13, 100px); grid-template-rows: repeat(4, 120px);">
                <template v-for="(row, rowIndex) in deviceMatrix" :key="`row-${rowIndex}`">
                    <GridCell v-for="(cell, colIndex) in row" :key="`cell-${rowIndex}-${colIndex}`"
                        :cell-type="getCellType(cell, colIndex)" :device="getDevice(cell)"
                        :real-time-data="getRealTimeData(cell)" :row-index="rowIndex" :col-index="colIndex"
                        :slot-label="getSlotLabel(rowIndex, colIndex)" :is-dragging="isDragging(cell)"
                        :is-drag-over="isDragOver(rowIndex, colIndex)" :is-edit-mode="isEditMode"
                        @dragstart="handleDragStart" @dragend="handleDragEnd" @dragenter="handleDragEnter"
                        @dragleave="handleDragLeave" @drop="handleDrop" @click="handleCellClick" />
                </template>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import GridCell from './GridCell.vue'
import { formatRowLabel } from '@/utils/formatters'

defineOptions({ name: 'GridMap' })

// ============================================
// Props
// ============================================

const props = defineProps({
    /** 设备矩阵数据 */
    deviceMatrix: {
        type: Array,
        required: true
    },
    /** 实时状态数据 Map */
    realTimeStatus: {
        type: Object,
        default: () => ({})
    },
    /** 网格配置 */
    gridConfig: {
        type: Object,
        required: true
    },
    /** 是否编辑模式 */
    isEditMode: {
        type: Boolean,
        default: false
    },
    /** 行标签后缀 */
    rowSuffix: {
        type: String,
        default: '排'
    },
    /** 过道标签 */
    aisleLabel: {
        type: String,
        default: '过道'
    },
    /** 正在拖拽的设备 */
    draggedDevice: {
        type: Object,
        default: null
    },
    /** 拖拽悬停位置 */
    dragOverCell: {
        type: Object,
        default: null
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
    'cell-click'
])

// ============================================
// Computed
// ============================================

/** 过道列索引（0-based） */
const aisleColIndex = computed(() => props.gridConfig.AISLE_COL - 1)

// ============================================
// Methods
// ============================================

/**
 * 获取单元格类型
 */
function getCellType(cell, colIndex) {
    if (colIndex === aisleColIndex.value) return 'aisle'
    if (cell === null) return 'empty'
    return 'device'
}

/**
 * 获取设备对象
 */
function getDevice(cell) {
    return typeof cell === 'object' && cell !== null ? cell : null
}

/**
 * 获取实时状态数据
 */
function getRealTimeData(cell) {
    const device = getDevice(cell)
    if (!device) return null
    return props.realTimeStatus[String(device.id)]
}

/**
 * 获取槽位标签
 */
function getSlotLabel(rowIndex, colIndex) {
    if (colIndex === aisleColIndex.value) return ''
    const row = rowIndex + 1
    const col = getPhysicalCol(colIndex + 1)
    return formatRowLabel(row) + '-' + col.toString().padStart(2, '0')
}

/**
 * 根据网格列号获取物理列号（排除过道）
 */
function getPhysicalCol(gridCol) {
    if (gridCol < props.gridConfig.AISLE_COL) {
        return gridCol
    }
    return gridCol - 1
}

/**
 * 判断设备是否正在拖拽中
 */
function isDragging(cell) {
    if (!props.draggedDevice || typeof cell !== 'object' || cell === null) return false
    return cell.id === props.draggedDevice.id
}

/**
 * 判断指定单元格是否处于拖拽悬停状态
 */
function isDragOver(rowIndex, colIndex) {
    if (!props.dragOverCell) return false
    return props.dragOverCell.row === rowIndex && props.dragOverCell.col === colIndex
}

// ============================================
// Event Handlers
// ============================================

function handleDragStart(device, rowIndex, colIndex) {
    emit('dragstart', device, rowIndex, colIndex)
}

function handleDragEnd() {
    emit('dragend')
}

function handleDragEnter(rowIndex, colIndex) {
    emit('dragenter', rowIndex, colIndex)
}

function handleDragLeave() {
    emit('dragleave')
}

function handleDrop(rowIndex, colIndex) {
    emit('drop', rowIndex, colIndex)
}

function handleCellClick(device, rowIndex, colIndex) {
    emit('cell-click', device, rowIndex, colIndex)
}
</script>

<style scoped>
/* 编辑模式网格背景 */
.is-edit-mode :deep(.device-matrix) {
    background-image: linear-gradient(to right, var(--app-border) 1px, transparent 1px),
        linear-gradient(to bottom, var(--app-border) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: center center;
}
</style>
