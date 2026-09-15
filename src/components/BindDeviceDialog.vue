<template>
  <t-dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="`绑定设备至 ${targetSlotLabel}`"
    width="min(760px, calc(100vw - 32px))"
    destroy-on-close
    :footer="false"
    :close-on-overlay-click="false"
  >
    <!-- 搜索框 -->
    <div class="bind-device-dialog__search">
      <t-input
        v-model="searchKeyword"
        placeholder="请输入 IP 或机器编号搜索"
        clearable
        class="w-full"
      >
        <template #prefixIcon>
          <Search />
        </template>
      </t-input>
    </div>

    <!-- 未分配设备列表 -->
    <TdTable
      v-if="loading || filteredList.length > 0"
      :loading="loading"
      :data="filteredList"
      height="320"
      class="bind-device-dialog__table"
      highlight-current-row
      @row-click="handleRowClick"
    >
      <TdTableColumn prop="machineNumber" label="机器编号" width="120">
        <template #default="{ row }">
          {{ row.machineNumber || '-' }}
        </template>
      </TdTableColumn>
      <TdTableColumn prop="ipAddress" label="IP地址" width="125" />
      <TdTableColumn prop="macAddress" label="MAC地址" width="145" />
      <TdTableColumn prop="name" label="设备名称" width="130" show-overflow-tooltip />
      <TdTableColumn prop="status" label="状态" width="85">
        <template #default="{ row }">
          <StatusTag domain="printer" :status="row.status" :show-icon="false" />
        </template>
      </TdTableColumn>
    </TdTable>

    <!-- 空状态提示 -->
    <div v-else class="bind-device-dialog__empty">
      <t-empty description="暂无可绑定的设备" />
    </div>
  </t-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { confirmMessage } from '@/utils/message'
import { getUnallocatedPrinters } from '@/api/printer'
import { SearchIcon as Search } from 'tdesign-icons-vue-next'
import TdTable from './TdTable.vue'
import TdTableColumn from './TdTableColumn.vue'
import StatusTag from './StatusTag.vue'
import { mergeDraftAvailableDevices } from '@/utils/dashboardBinding'

defineOptions({ name: 'BindDeviceDialog' })

const props = defineProps({
  /** 弹窗可见性 */
  visible: {
    type: Boolean,
    default: false
  },
  /** 目标槽位标签 */
  targetSlotLabel: {
    type: String,
    default: ''
  },
  /** 已应用布局草稿坐标的完整设备列表 */
  draftDevices: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:visible', 'confirm'])

// ============================================
// Reactive State
// ============================================

/** 未分配设备列表 */
const unallocatedList = ref([])
/** 加载状态 */
const loading = ref(false)
/** 搜索关键词 */
const searchKeyword = ref('')

// ============================================
// Constants
// ============================================

// ============================================
// Computed Properties
// ============================================

/**
 * 根据搜索关键词过滤未分配设备列表
 */
const availableList = computed(() => mergeDraftAvailableDevices(
  unallocatedList.value,
  props.draftDevices
))

const filteredList = computed(() => {
  if (!searchKeyword.value.trim()) {
    return availableList.value
  }

  const keyword = searchKeyword.value.toLowerCase().trim()
  return availableList.value.filter(device => {
    const ipMatch = String(device.ipAddress || '').toLowerCase().includes(keyword)
    const machineNumMatch = String(device.machineNumber || '').toLowerCase().includes(keyword)
    const nameMatch = String(device.name || '').toLowerCase().includes(keyword)
    return ipMatch || machineNumMatch || nameMatch
  })
})

// ============================================
// Watchers
// ============================================

/** 监听弹窗打开，自动获取数据 */
watch(() => props.visible, (newVal) => {
  if (newVal) {
    fetchUnallocatedDevices()
    searchKeyword.value = ''
  }
})

// ============================================
// Methods
// ============================================

/**
 * 获取未分配位置的设备列表
 */
async function fetchUnallocatedDevices() {
  loading.value = true
  try {
    const res = await getUnallocatedPrinters()
    unallocatedList.value = res.data || []
  } catch (error) {
    console.error('获取未分配设备失败:', error)
    unallocatedList.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 处理表格行点击 - 直接确认绑定
 * @param {Object} row - 点击的行数据
 */
function handleRowClick(row) {
  if (!row) return

  confirmMessage(
    `确定要将设备 "${row.name}" 绑定到 ${props.targetSlotLabel} 吗？`,
    '确认绑定',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    }
  ).then(() => {
    emit('confirm', row.id)
  }).catch(() => {
    // 用户取消，不做任何操作
  })
}
</script>

<style scoped>
.bind-device-dialog__search {
  margin-bottom: var(--app-spacing-3);
}

.bind-device-dialog__table {
  width: 100%;
  height: 320px;
}

.bind-device-dialog__table :deep(.t-table th),
.bind-device-dialog__table :deep(.t-table td) {
  height: 42px;
  padding-top: var(--app-spacing-2);
  padding-bottom: var(--app-spacing-2);
  white-space: nowrap;
}

.bind-device-dialog__table :deep(.t-table tbody tr) {
  cursor: pointer;
}

.bind-device-dialog__table :deep(.t-table tbody td) {
  transition: background-color 160ms ease, box-shadow 160ms ease;
}

.bind-device-dialog__table :deep(.t-table tbody tr:hover td) {
  background: var(--td-bg-color-container-hover);
}

.bind-device-dialog__table :deep(.t-table tbody tr:hover td:first-child) {
  box-shadow: inset 3px 0 var(--td-brand-color);
}

.bind-device-dialog__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}
</style>
