<script setup>
import { computed, provide, shallowRef, useAttrs } from 'vue'
import { Table } from 'tdesign-vue-next'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  data: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  height: { type: [String, Number], default: undefined },
  rowKey: { type: String, default: 'id' }
})

const emit = defineEmits(['row-click', 'selection-change'])
const attrs = useAttrs()
const registeredColumns = shallowRef([])

provide('farm-table-register-column', column => {
  registeredColumns.value = [...registeredColumns.value, column]
  return () => {
    registeredColumns.value = registeredColumns.value.filter(item => item !== column)
  }
})

const columns = computed(() => registeredColumns.value.map((column, index) => {
  if (column.type === 'selection') {
    return {
      colKey: 'row-select',
      type: 'multiple',
      width: column.width || 48,
      fixed: column.fixed,
      checkProps: column.checkProps
    }
  }

  return {
    colKey: column.prop || `column-${index}`,
    title: column.label,
    width: column.width,
    minWidth: column.minWidth,
    align: column.align,
    fixed: column.fixed,
    ellipsis: column.showOverflowTooltip,
    cell: column.slot
      ? (_h, { row, rowIndex }) => {
        const content = column.slot({ row, $index: rowIndex, rowIndex })
        // 条件插槽在更新期间可能返回 false/true，过滤掉非 VNode 值，避免 TDesign
        // 在 TR 重绘时尝试创建非法 VNode。
        return Array.isArray(content) ? content.filter(Boolean) : content
      }
      : undefined
  }
}))

const tableAttrs = computed(() => {
  const {
    class: className,
    style,
    rowClassName,
    'row-class-name': legacyRowClassName,
    'highlight-current-row': highlightCurrentRow,
    highlightCurrentRow: highlightCurrentRowCamel,
    border,
    bordered,
    stripe,
    ...rest
  } = attrs
  void className
  void style
  return {
    ...rest,
    data: props.data,
    columns: columns.value,
    loading: props.loading,
    height: props.height,
    rowKey: props.rowKey,
    rowClassName: rowClassName || legacyRowClassName,
    activeRowType: highlightCurrentRow || highlightCurrentRowCamel ? 'single' : undefined,
    bordered: bordered ?? border,
    stripe,
    onRowClick: context => emit('row-click', context.row, context),
    onSelectChange: (keys, context) => emit('selection-change', context?.selectedRowData || keys, context)
  }
})
</script>

<template>
  <div class="td-table-adapter" :class="attrs.class" :style="attrs.style">
    <!-- 先让 TdTableColumn 完成注册，再挂载 TDesign Table。 -->
    <Table v-if="columns.length" v-bind="tableAttrs" />
    <!-- 保留列组件插槽，确保 TdTableColumn 在 Table 首次挂载前完成列注册。 -->
    <span class="hidden" aria-hidden="true"><slot /></span>
  </div>
</template>

<style scoped>
.td-table-adapter {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: visible;
}

.td-table-adapter :deep(.t-table) {
  display: block;
  height: 100%;
  min-width: 0;
  overflow: visible;
}

.td-table-adapter :deep(.t-table__content) {
  min-width: 0;
  overflow-x: auto;
  overflow-y: auto;
  scrollbar-color: var(--app-scrollbar-thumb) var(--app-scrollbar-track);
  scrollbar-width: thin;
}

.td-table-adapter :deep(.t-table__content::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

.td-table-adapter :deep(.t-table__content::-webkit-scrollbar-track) {
  background: var(--app-scrollbar-track);
}

.td-table-adapter :deep(.t-table__content::-webkit-scrollbar-thumb) {
  background: var(--app-scrollbar-thumb);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}

.td-table-adapter :deep(.t-table__content::-webkit-scrollbar-thumb:hover) {
  background: var(--app-scrollbar-thumb-hover);
  background-clip: padding-box;
}
</style>
