<template>
  <div class="grid-map-shell" :class="{ 'is-edit-mode': isEditMode }">
    <div class="grid-map-scroll" ref="scrollHost">
      <div class="grid-map-content" :style="contentStyle">
        <!-- 行标签与网格使用同一组视觉轨道，保证过道插入后仍然对齐。 -->
        <div class="grid-map-row-rail">
          <div class="grid-map-corner" aria-hidden="true"></div>
          <div class="grid-map-row-header" :style="rowTemplateStyle">
            <div v-for="(row, rowIndex) in visualRows" :key="`label-${rowIndex}`"
              class="grid-map-row-label" :class="{ 'is-aisle': row.type === 'aisle' }">
              {{ row.type === 'aisle' ? row.label : `${formatRowLabel(row.number)}${rowSuffix}` }}
            </div>
          </div>
        </div>

        <div class="grid-map-body">
          <div class="grid-map-column-header" :style="columnTemplateStyle">
            <div v-for="(column, colIndex) in visualColumns" :key="`header-${colIndex}`"
              class="grid-map-column-label" :class="{ 'is-aisle': column.type === 'aisle' }">
              {{ column.type === 'aisle' ? column.label : column.number }}
            </div>
          </div>

          <div class="grid-map-canvas" :class="{ 'is-edit-mode': isEditMode }" :style="gridStyle">
            <template v-for="(row, rowIndex) in visualRows" :key="`row-${rowIndex}`">
              <GridCell v-for="(column, colIndex) in visualColumns" :key="`cell-${rowIndex}-${colIndex}`"
                :cell-type="getCellType(row, column)" :aisle-label="getAisleLabel(row, column)"
                :device="getDevice(row, column)" :real-time-data="getRealTimeData(row, column)"
                :row-index="rowIndex" :col-index="colIndex" :slot-label="getSlotLabel(row, column)"
                :is-dragging="isDragging(row, column)" :is-drag-over="isDragOver(rowIndex, colIndex)"
                :is-edit-mode="isEditMode" @dragstart="handleDragStart" @dragend="handleDragEnd"
                @dragenter="handleDragEnter" @dragleave="handleDragLeave" @drop="handleDrop"
                @click="handleCellClick" />
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import GridCell from './GridCell.vue'
import { formatGridRowLabel as formatRowLabel, getPhysicalColumn, getPhysicalRow, getVisualColumns, getVisualRows } from '@/utils/gridLayout'

defineOptions({ name: 'GridMap' })

const props = defineProps({
  deviceMatrix: { type: Array, required: true },
  devices: { type: Array, default: () => [] },
  realTimeStatus: { type: Object, default: () => ({}) },
  gridConfig: { type: Object, required: true },
  isEditMode: { type: Boolean, default: false },
  rowSuffix: { type: String, default: '排' },
  aisleLabel: { type: String, default: '过道' },
  draggedDevice: { type: Object, default: null },
  dragOverCell: { type: Object, default: null }
})

const emit = defineEmits(['dragstart', 'dragend', 'dragenter', 'dragleave', 'drop', 'cell-click'])
const scrollHost = ref(null)
const visualColumns = computed(() => getVisualColumns(props.gridConfig))
const visualRows = computed(() => getVisualRows(props.gridConfig))

const deviceByPosition = computed(() => {
  const map = new Map()
  if (props.devices.length) {
    props.devices.forEach(device => {
      const key = `${device?.gridRow},${device?.gridCol}`
      if (device?.gridRow != null && device?.gridCol != null && !map.has(key)) map.set(key, device)
    })
    return map
  }
  props.deviceMatrix.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
    const device = typeof cell === 'object' && cell !== null ? cell : null
    const rowNumber = getPhysicalRow(rowIndex + 1, props.gridConfig)
    const colNumber = getPhysicalColumn(colIndex + 1, props.gridConfig)
    if (device && rowNumber && colNumber) map.set(`${rowNumber},${colNumber}`, device)
  }))
  return map
})

const columnTemplate = computed(() => visualColumns.value.map(column => (
  column.type === 'aisle' ? `${column.width}px` : `${props.gridConfig.CELL_MIN_WIDTH}px`
)).join(' '))
const rowTemplate = computed(() => visualRows.value.map(row => (
  row.type === 'aisle' ? `${row.height}px` : `${props.gridConfig.CELL_HEIGHT}px`
)).join(' '))
const columnTemplateStyle = computed(() => ({ gridTemplateColumns: columnTemplate.value }))
const rowTemplateStyle = computed(() => ({ gridTemplateRows: rowTemplate.value }))
const gridStyle = computed(() => ({ gridTemplateColumns: columnTemplate.value, gridTemplateRows: rowTemplate.value }))
const contentStyle = computed(() => ({ minWidth: 'max-content', minHeight: 'max-content' }))

function getCellType(row, column) {
  if (row.type === 'aisle' || column.type === 'aisle') return 'aisle'
  return getDevice(row, column) ? 'device' : 'empty'
}

function getAisleLabel(row, column) {
  if (row.type === 'aisle' && column.type === 'aisle') return `${row.label}/${column.label}`
  if (row.type === 'aisle') return row.label || props.aisleLabel
  if (column.type === 'aisle') return column.label || props.aisleLabel
  return ''
}

function getDevice(row, column) {
  if (row.type !== 'device' || column.type !== 'device') return null
  return deviceByPosition.value.get(`${row.number},${column.number}`) || null
}

function getRealTimeData(row, column) {
  const device = getDevice(row, column)
  return device ? props.realTimeStatus[String(device.id)] : null
}

function getSlotLabel(row, column) {
  if (row.type !== 'device' || column.type !== 'device') return ''
  return `${formatRowLabel(row.number)}-${String(column.number).padStart(2, '0')}`
}

function isDragging(row, column) {
  const device = getDevice(row, column)
  return Boolean(device && props.draggedDevice && String(device.id) === String(props.draggedDevice.id))
}

function isDragOver(rowIndex, colIndex) {
  return Boolean(props.dragOverCell
    && props.dragOverCell.row === rowIndex
    && props.dragOverCell.col === colIndex)
}

function handleDragStart(device, rowIndex, colIndex) { emit('dragstart', device, rowIndex, colIndex) }
function handleDragEnd() { emit('dragend') }
function handleDragEnter(rowIndex, colIndex) { emit('dragenter', rowIndex, colIndex) }
function handleDragLeave() { emit('dragleave') }
function handleDrop(rowIndex, colIndex) { emit('drop', rowIndex, colIndex) }
function handleCellClick(device, rowIndex, colIndex) { emit('cell-click', device, rowIndex, colIndex) }

function handleScroll() {
  // 保留可观测的内部滚动容器，避免大布局把页面宽度撑开。
}

onMounted(() => scrollHost.value?.addEventListener('scroll', handleScroll, { passive: true }))
onBeforeUnmount(() => scrollHost.value?.removeEventListener('scroll', handleScroll))
</script>

<style scoped>
.grid-map-shell {
  width: 100%;
  min-width: 0;
}

.grid-map-scroll {
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
}

.grid-map-content {
  display: flex;
  gap: 0.75rem;
  min-width: max-content;
  padding-bottom: 0.25rem;
}

.grid-map-row-rail {
  display: flex;
  flex-direction: column;
  flex: 0 0 2.5rem;
  gap: 0.75rem;
}

.grid-map-corner {
  height: 1.75rem;
}

.grid-map-row-header,
.grid-map-canvas,
.grid-map-column-header {
  display: grid;
  gap: 0.75rem;
}

.grid-map-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.grid-map-column-header {
  margin-bottom: 0.125rem;
}

.grid-map-row-label,
.grid-map-column-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 1.75rem;
  overflow: hidden;
  border: 1px dashed #d1d5db;
  border-radius: 0.375rem;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.grid-map-row-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.grid-map-row-label.is-aisle,
.grid-map-column-label.is-aisle {
  background: #fffbeb;
  border-color: #fcd34d;
  color: #b45309;
}

.grid-map-canvas {
  flex: 0 0 auto;
}

.grid-map-canvas.is-edit-mode {
  padding: 0.25rem;
  border-radius: 0.375rem;
  background-color: #f3f4f6;
  background-image: linear-gradient(to right, #e5e7eb 1px, transparent 1px),
    linear-gradient(to bottom, #e5e7eb 1px, transparent 1px);
  background-position: center;
  background-size: 20px 20px;
}
</style>
