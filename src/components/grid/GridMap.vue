<template>
    <div ref="mapViewport" class="grid-map-viewport" :style="viewportStyle">
      <div class="grid-map" :class="{ 'is-edit-mode': isEditMode }" :style="gridMapStyle">
        <div class="grid-map__row-rail">
            <div class="grid-map__corner"></div>
            <div class="grid-map__rows" :style="rowGridStyle">
                <template v-for="(row, rowIndex) in visualRows" :key="`label-${rowIndex}`">
                    <t-dropdown
                        v-if="isEditMode"
                        :options="getAxisMenuOptions('row', row)"
                        trigger="context-menu"
                        @click="item => handleContextMenuClick(item, 'row', row)"
                    >
                        <div class="grid-map__row-label" :class="getRowLabelClass(row)">
                            {{ row.type === 'aisle' ? row.label : formatRowLabel(row.number) + rowSuffix }}
                        </div>
                    </t-dropdown>
                    <div v-else class="grid-map__row-label" :class="getRowLabelClass(row)">
                        {{ row.type === 'aisle' ? row.label : formatRowLabel(row.number) + rowSuffix }}
                    </div>
                </template>
            </div>
            <div v-if="isEditMode" class="grid-map__dimension-controls grid-map__row-controls">
                <t-button shape="square" size="small" variant="outline" :icon="renderIcon(AddIcon)" aria-label="增加行"
                    title="增加行" :disabled="gridConfig.rowCount >= 30" @click.stop="emitDimensionChange('row', 1)" />
                <t-button shape="square" size="small" variant="outline" :icon="renderIcon(MinusIcon)" aria-label="减少行"
                    title="减少行" :disabled="gridConfig.rowCount <= 1" @click.stop="emitDimensionChange('row', -1)" />
            </div>
        </div>

        <div class="grid-map__body">
            <div class="grid-map__header-row">
                <div class="grid-map__column-header" :style="columnGridStyle">
                    <template v-for="(column, columnIndex) in visualColumns" :key="`header-${columnIndex}`">
                        <t-dropdown
                            v-if="isEditMode"
                            :options="getAxisMenuOptions('column', column)"
                            trigger="context-menu"
                            @click="item => handleContextMenuClick(item, 'column', column)"
                        >
                            <div class="grid-map__column-label" :class="getColumnLabelClass(column)">
                                {{ column.type === 'aisle' ? (column.label || aisleLabel) : column.number }}
                            </div>
                        </t-dropdown>
                        <div v-else class="grid-map__column-label" :class="getColumnLabelClass(column)">
                            {{ column.type === 'aisle' ? (column.label || aisleLabel) : column.number }}
                        </div>
                    </template>
                </div>
                <div v-if="isEditMode" class="grid-map__dimension-controls grid-map__column-controls">
                    <t-button shape="square" size="small" variant="outline" :icon="renderIcon(AddIcon)" aria-label="增加列"
                        title="增加列" :disabled="gridConfig.columnCount >= 60" @click.stop="emitDimensionChange('column', 1)" />
                    <t-button shape="square" size="small" variant="outline" :icon="renderIcon(MinusIcon)" aria-label="减少列"
                        title="减少列" :disabled="gridConfig.columnCount <= 1" @click.stop="emitDimensionChange('column', -1)" />
                </div>
            </div>

            <div class="grid-map__device-grid" :style="gridStyle">
                <template v-for="(row, rowIndex) in deviceMatrix" :key="`row-${rowIndex}`">
                    <GridCell v-for="(cell, colIndex) in row" :key="`cell-${rowIndex}-${colIndex}`"
                        :cell-type="getCellType(cell, rowIndex, colIndex)" :device="getDevice(cell)"
                        :real-time-data="getRealTimeData(cell)" :row-index="rowIndex" :col-index="colIndex"
                        :aisle-axis="getAisleAxis(rowIndex, colIndex)"
                        :slot-label="getSlotLabel(rowIndex, colIndex)" :is-dragging="isDragging(cell)"
                        :is-drag-over="isDragOver(rowIndex, colIndex)" :is-edit-mode="isEditMode"
                        @dragstart="handleDragStart" @dragend="handleDragEnd" @dragenter="handleDragEnter"
                        @dragleave="handleDragLeave" @drop="handleDrop" @click="handleCellClick" />
                </template>
            </div>
        </div>
      </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { AddIcon, MinusIcon } from 'tdesign-icons-vue-next'
import { renderIcon } from '@/utils/tdesign'
import GridCell from './GridCell.vue'
import { formatRowLabel } from '@/utils/formatters'
import { calculateGridFit, getPhysicalColumn, getPhysicalRow, getVisualColumns, getVisualRows } from '@/utils/gridLayout'

defineOptions({ name: 'GridMap' })

const props = defineProps({
    deviceMatrix: { type: Array, required: true },
    realTimeStatus: { type: Object, default: () => ({}) },
    gridConfig: { type: Object, required: true },
    isEditMode: { type: Boolean, default: false },
    rowSuffix: { type: String, default: '排' },
    aisleLabel: { type: String, default: '过道' },
    draggedDevice: { type: Object, default: null },
    dragOverCell: { type: Object, default: null }
})

const emit = defineEmits([
    'dragstart', 'dragend', 'dragenter', 'dragleave', 'drop', 'cell-click',
    'dimension-change', 'aisle-context'
])

const mapViewport = ref(null)
const containerWidth = ref(0)
const containerHeight = ref(0)
let resizeObserver

const visualColumns = computed(() => getVisualColumns(props.gridConfig))
const visualRows = computed(() => getVisualRows(props.gridConfig))
const columnGridTemplate = computed(() => visualColumns.value
    .map(column => `${column.type === 'aisle' ? Number(column.width || column.size || 100) : Number(props.gridConfig.CELL_MIN_WIDTH) || 100}px`)
    .join(' '))
const rowGridTemplate = computed(() => visualRows.value
    .map(row => `${row.type === 'aisle' ? Number(row.height || row.size || 80) : Number(props.gridConfig.CELL_HEIGHT) || 140}px`)
    .join(' '))
const columnGridStyle = computed(() => ({ gridTemplateColumns: columnGridTemplate.value }))
const rowGridStyle = computed(() => ({ gridTemplateRows: rowGridTemplate.value }))
const gridStyle = computed(() => ({ gridTemplateColumns: columnGridTemplate.value, gridTemplateRows: rowGridTemplate.value }))
const gridFit = computed(() => calculateGridFit(props.gridConfig, {
    width: containerWidth.value,
    height: containerHeight.value,
    isEditMode: props.isEditMode
}))
const viewportStyle = computed(() => ({ height: `${gridFit.value.displayHeight}px` }))
const gridMapStyle = computed(() => ({
    width: `${gridFit.value.naturalWidth}px`,
    height: `${gridFit.value.naturalHeight}px`,
    transform: `scale(${gridFit.value.scale})`
}))

function updateContainerSize() {
    const viewport = mapViewport.value
    const parent = viewport?.parentElement
    const scrollRegion = parent?.parentElement
    containerWidth.value = parent?.clientWidth || viewport?.clientWidth || 0
    containerHeight.value = scrollRegion?.clientHeight || 0
}

onMounted(async () => {
    await nextTick()
    updateContainerSize()
    if (typeof ResizeObserver === 'undefined') return
    resizeObserver = new ResizeObserver(updateContainerSize)
    if (mapViewport.value) resizeObserver.observe(mapViewport.value)
    if (mapViewport.value?.parentElement) resizeObserver.observe(mapViewport.value.parentElement)
    if (mapViewport.value?.parentElement?.parentElement) resizeObserver.observe(mapViewport.value.parentElement.parentElement)
})

onUnmounted(() => resizeObserver?.disconnect())

function getCellType(cell, rowIndex, colIndex) {
    if (getAisleAxis(rowIndex, colIndex)) return 'aisle'
    if (cell === null) return 'empty'
    return 'device'
}

function getAisleAxis(rowIndex, colIndex) {
    const rowIsAisle = visualRows.value[rowIndex]?.type === 'aisle'
    const columnIsAisle = visualColumns.value[colIndex]?.type === 'aisle'
    if (rowIsAisle && columnIsAisle) return 'cross'
    if (rowIsAisle) return 'row'
    if (columnIsAisle) return 'column'
    return null
}

function getDevice(cell) { return typeof cell === 'object' && cell !== null ? cell : null }

function getRealTimeData(cell) {
    const device = getDevice(cell)
    return device ? props.realTimeStatus[String(device.id)] : null
}

function getSlotLabel(rowIndex, colIndex) {
    const physicalRow = getPhysicalRow(rowIndex + 1, props.gridConfig)
    const physicalColumn = getPhysicalColumn(colIndex + 1, props.gridConfig)
    if (physicalRow === null || physicalColumn === null) return ''
    return formatRowLabel(physicalRow) + '-' + physicalColumn.toString().padStart(2, '0')
}

function getRowLabelClass(row) { return row.type === 'aisle' ? 'is-aisle' : 'is-device' }
function getColumnLabelClass(column) { return column.type === 'aisle' ? 'is-aisle' : 'is-device' }

function getAxisMenuOptions(axis, item) {
    if (item.type === 'aisle') {
        return [
            { content: `编辑${axis === 'row' ? '行' : '列'}过道`, value: 'edit-aisle' },
            { content: `删除${axis === 'row' ? '行' : '列'}过道`, value: 'remove-aisle' }
        ]
    }
    return [{ content: `在第 ${item.number} ${axis === 'row' ? '行' : '列'}后设置为过道`, value: 'add-aisle' }]
}

function handleContextMenuClick(item, axis, target) {
    emit('aisle-context', {
        action: item.value,
        axis,
        index: target.number ?? target.afterIndex,
        aisle: target.type === 'aisle' ? target : null
    })
}

function emitDimensionChange(axis, delta) { emit('dimension-change', { axis, delta }) }
function isDragging(cell) { return Boolean(props.draggedDevice && typeof cell === 'object' && cell?.id === props.draggedDevice.id) }
function isDragOver(rowIndex, colIndex) { return Boolean(props.dragOverCell && props.dragOverCell.row === rowIndex && props.dragOverCell.col === colIndex) }
function handleDragStart(device, rowIndex, colIndex) { emit('dragstart', device, rowIndex, colIndex) }
function handleDragEnd() { emit('dragend') }
function handleDragEnter(rowIndex, colIndex) { emit('dragenter', rowIndex, colIndex) }
function handleDragLeave() { emit('dragleave') }
function handleDrop(rowIndex, colIndex) { emit('drop', rowIndex, colIndex) }
function handleCellClick(device, rowIndex, colIndex) { emit('cell-click', device, rowIndex, colIndex) }
</script>

<style scoped>
.grid-map-viewport { width: 100%; min-width: 0; overflow: visible; }
.grid-map { display: flex; gap: 8px; min-width: 0; min-height: 0; transform-origin: left top; }
.grid-map__row-rail, .grid-map__body { flex: 0 0 auto; }
.grid-map__row-rail { display: flex; flex-direction: column; width: 40px; }
.grid-map__corner { height: 28px; margin-bottom: 8px; }
.grid-map__rows, .grid-map__device-grid, .grid-map__column-header { display: grid; gap: 12px; }
.grid-map__rows :deep(.t-dropdown), .grid-map__column-header :deep(.t-dropdown) {
    display: block; min-width: 0; width: 100%; height: 100%;
}
.grid-map__row-label, .grid-map__column-label {
    display: flex; align-items: center; justify-content: center; min-width: 0; overflow: hidden;
    color: var(--app-text-secondary); background: var(--app-surface-muted);
    border: 1px dashed var(--app-border); border-radius: var(--app-radius);
    font-size: var(--td-font-size-body-small); font-weight: 500; text-overflow: ellipsis; white-space: nowrap;
}
.grid-map__row-label { height: 100%; writing-mode: vertical-rl; text-orientation: mixed; }
.grid-map__row-label.is-aisle, .grid-map__column-label.is-aisle {
    color: var(--app-warning); background: var(--app-warning-light); border-color: var(--app-warning);
}
.grid-map__header-row { display: flex; align-items: stretch; gap: 8px; margin-bottom: 8px; }
.grid-map__column-header { flex: 0 0 auto; }
.grid-map__column-label { height: 28px; }
.grid-map__dimension-controls { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; gap: 4px; }
.grid-map__row-controls { height: 32px; margin-top: 8px; }
.grid-map__column-controls { align-self: center; width: 68px; }
.grid-map__device-grid { flex: 0 0 auto; }
.is-edit-mode .grid-map__row-label.is-device, .is-edit-mode .grid-map__column-label.is-device {
    color: var(--app-primary-active); background: var(--app-primary-light-hover);
    border-color: var(--app-primary); font-weight: 700; cursor: context-menu;
}
.is-edit-mode .grid-map__row-label.is-aisle, .is-edit-mode .grid-map__column-label.is-aisle { font-weight: 700; cursor: context-menu; }
.is-edit-mode .grid-map__device-grid {
    background: var(--app-page-background); border-radius: var(--app-radius);
    box-shadow: inset 0 0 0 1px var(--app-border);
}
@media (max-width: 767px) {
    .grid-map { gap: 4px; }
    .grid-map__row-rail { width: 32px; }
    .grid-map__rows, .grid-map__device-grid, .grid-map__column-header { gap: 6px; }
}
</style>
