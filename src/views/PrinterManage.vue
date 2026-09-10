<template>
  <div class="app-page-shell app-page-background printer-manage-page">
    <!-- 设备详情抽屉 -->
    <DeviceDetailDrawer
      v-model="detailDrawerVisible"
      :device="selectedDevice"
      :real-time-data="selectedDeviceRealTimeData"
      :detail-loading="detailLoading"
      :detail-error="detailError"
      :status-history="printerHistory"
      :history-loading="historyLoading"
      :history-error="historyError"
      :history-total="historyTotal"
      :history-page-num="historyPageNum"
      :history-page-size="historyPageSize"
      :history-range="historyRange"
      :statistics="printerStatistics"
      :statistics-loading="statisticsLoading"
      :statistics-error="statisticsError"
      :monitor-config="monitorConfig"
      :monitor-loading="monitorLoading"
      :monitor-error="monitorError"
      :monitor-updating="monitorUpdatingIds.includes(selectedDevice?.id)"
      :can-manage-monitor="isAdmin"
      @history-query="handleHistoryQuery"
      @history-page-change="handleHistoryPageChange"
      @monitor-change="handleDetailMonitorChange"
      @closed="clearPrinterDetailContext"
      @retry="retryPrinterDetail"
    />

    <!-- 页面标题与操作栏 -->
    <PageHeader title="打印机管理">
      <template #filter>
      <div v-if="activeStatusFilter" class="app-page-toolbar__filter">
        <t-tag :theme="activeStatusFilter.theme" variant="light">
          当前筛选：{{ activeStatusFilter.label }}
        </t-tag>
        <t-button variant="text" size="small" @click="clearStatusFilter">显示全部</t-button>
      </div>
      </template>
      <template #actions>
      <div class="app-page-toolbar__actions printer-page-actions">
        <t-button v-if="isAdmin" :theme="batchMonitorTarget ? 'success' : 'warning'" variant="outline"
          :disabled="selectedPrinterIds.length === 0 || monitorActionLoading" :loading="monitorActionLoading"
          @click="handleBatchMonitorToggle">
          {{ batchMonitorTarget ? '启用监控' : '停用监控' }}{{ selectedPrinterIds.length ? ` (${selectedPrinterIds.length})` : '' }}
        </t-button>
        <t-button size="medium" theme="default" variant="base" :icon="renderIcon(Refresh)" :loading="loading" @click="fetchData">
          刷新
        </t-button>
        <t-button size="medium" theme="warning" variant="base" :icon="renderIcon(FolderAdd)" @click="openUnallocatedDialog">
          未分配设备
        </t-button>
        <t-button v-if="isAdmin" size="medium" theme="success" variant="base" :icon="renderIcon(Aim)" @click="openScanDialog">
          扫描局域网设备
        </t-button>
        <t-button v-if="isAdmin" size="medium" theme="primary" :icon="renderIcon(Plus)" @click="handleAdd">
          新增打印机
        </t-button>
      </div>
      </template>
    </PageHeader>

    <section class="printer-management-toolbar-card" aria-label="打印机筛选和视图工具栏">
      <div class="printer-management-toolbar-card__top">
        <t-radio-group
          v-model="statusFilter"
          class="printer-management-tabs"
          variant="default-filled"
          size="small"
          aria-label="打印机状态筛选"
          @change="applyStatusTab"
        >
          <t-radio-button
            v-for="tab in printerStatusTabs"
            :key="tab.value || 'all'"
            :value="tab.value"
          >
            {{ tab.label }}
          </t-radio-button>
        </t-radio-group>

        <div class="printer-management-toolbar-card__controls">
          <t-input
            v-model="keyword"
            class="printer-management-filter__search"
            clearable
            placeholder="按机器名称、IP 地址或编号搜索"
            @enter="applyFilters"
            @clear="applyFilters"
          >
            <template #prefixIcon><search /></template>
          </t-input>
          <t-button theme="primary" size="medium" @click="applyFilters">查询</t-button>
        </div>
      </div>
    </section>

    <!-- 数据表格 -->
    <t-card class="printer-manage-card app-page-card">
      <div class="printer-manage-card__table">
        <AsyncState
          v-if="tableData.length === 0"
          :loading="loading"
          :error="loadError"
          :empty="!loading && !loadError"
          empty-description="暂无打印机"
          @retry="fetchData"
        />
        <t-alert v-if="loadError && tableData.length" theme="error" :close-btn="false" class="mb-3">
          <template #default>{{ loadError }}</template>
          <template #operation>
            <t-button size="small" variant="outline" @click="fetchData">重试</t-button>
          </template>
        </t-alert>
        <TdTable
          v-if="tableData.length"
          :data="displayTableData"
          :loading="loading"
          height="100%"
          style="width: 100%"
          class="printer-management-table printer-table"
          hover
          @row-click="handleRowClick"
          @selection-change="handlePrinterSelectionChange"
          row-class-name="printer-table-row"
        >
        <TdTableColumn v-if="isAdmin" type="selection" width="52" align="center" />
        <TdTableColumn prop="id" label="ID" width="80" align="center">
          <template #default="scope">
            <span class="font-mono font-semibold text-gray-600">{{ scope.row.id }}</span>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="name" label="机器名称" min-width="150">
          <template #default="scope">
            <div class="printer-management-primary">
              <div class="printer-management-name">
                <span class="printer-management-status-dot" :class="`printer-management-status-dot--${getStatusClass(scope.row.status)}`" />
                <span class="printer-management-ellipsis" :title="scope.row.name">{{ scope.row.name }}</span>
              </div>
              <span class="printer-management-muted">#{{ scope.row.id }}</span>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="machineNumber" label="机器编号" width="110" align="center">
          <template #default="scope">
            <span class="font-mono text-sm">{{ scope.row.machineNumber || `#${scope.row.id}` }}</span>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="ipAddress" label="IP 地址" width="160">
          <template #default="scope">
            <t-tag size="small" variant="light-outline" theme="default">{{ scope.row.ipAddress }}</t-tag>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="status" label="当前状态" width="120" align="center">
          <template #default="scope">
            <span class="printer-management-status-card">
              <StatusTag domain="printer" :status="scope.row.status" />
            </span>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="connectionStatus" label="通信状态" width="150" align="center">
          <template #default="scope">
            <div class="printer-management-connection">
              <t-tag size="small" :theme="getConnectionTheme(scope.row.connectionStatus)" variant="light">
                {{ getConnectionLabel(scope.row.connectionStatus) }}
              </t-tag>
              <span v-if="scope.row.connectionStatus === 'OFFLINE' && scope.row.lastCommunicationError"
                class="printer-management-ellipsis printer-management-muted" :title="scope.row.lastCommunicationError">
                {{ scope.row.lastCommunicationError }}
              </span>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn label="监控" width="110" align="center">
          <template #default="scope">
            <t-switch class="printer-management-monitor" :value="scope.row.monitorEnabled === true" :disabled="!isAdmin || monitorUpdatingIds.includes(scope.row.id)"
              :loading="monitorUpdatingIds.includes(scope.row.id)" @click.stop @change="value => handleMonitorChange(scope.row, value)" />
          </template>
        </TdTableColumn>

        <TdTableColumn label="最近通信" width="180" align="center">
          <template #default="scope">
            <div class="printer-management-recent">
              <span>{{ formatDateTime(scope.row.lastSeenAt) }}</span>
              <span v-if="Number(scope.row.consecutiveFailureCount) > 0" class="printer-management-recent__failure">
                连续失败 {{ scope.row.consecutiveFailureCount }} 次
              </span>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="firmwareType" label="协议" width="100" align="center">
          <template #default="scope">{{ scope.row.firmwareType || '-' }}</template>
        </TdTableColumn>

        <TdTableColumn label="当前任务" width="180" align="center">
          <template #default="scope">
            <div class="printer-management-task">
              <span class="printer-management-task__icon" :class="{ 'printer-management-task__icon--active': scope.row.currentJobId }">
                <printer size="13" />
              </span>
              <div class="printer-management-task__content">
                <span v-if="scope.row.currentJobId" class="printer-management-task__name" :title="scope.row.currentJobFileName || `任务 #${scope.row.currentJobId}`">
                  {{ scope.row.currentJobFileName || `任务 #${scope.row.currentJobId}` }}
                </span>
                <span v-else class="printer-management-muted">无活动任务</span>
                <span v-if="scope.row.currentJobId" class="printer-management-muted">任务 #{{ scope.row.currentJobId }}</span>
                <t-progress v-if="scope.row.currentJobId && scope.row.progress !== undefined" :percentage="getProgress(scope.row)" :label="false" :stroke-width="4" :status="getProgressStatus(scope.row)" />
              </div>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn label="操作" width="280" align="center" fixed="right">
          <template #default="scope">
            <div class="flex items-center justify-center gap-1">
              <t-button size="small" variant="text" @click.stop="handleRowClick(scope.row)">
                详情
              </t-button>
              <!-- 确认热床已清理按钮 -->
              <t-button
                v-if="shouldShowSafeButton(scope.row)"
                size="small" theme="warning"
                @click="handleConfirmSafe(scope.row)"
                :loading="confirmingSafeIds.includes(scope.row.id)"
              >
                <span><check /></span>
                确认清理
              </t-button>
              <!-- 启动打印按钮 -->
              <t-button
                v-if="shouldShowStartButton(scope.row)"
                size="small" theme="success"
                @click="handleStartJob(scope.row)"
                :loading="startingJobIds.includes(scope.row.id)"
              >
                <span><printer /></span>
                启动打印
              </t-button>
              <!-- 编辑按钮 -->
              <t-button v-if="isAdmin" size="small" theme="primary" @click="handleEdit(scope.row)">
                <span><edit /></span>
                编辑
              </t-button>
              <!-- 删除按钮 -->
              <t-popconfirm v-if="isAdmin" :content="getDeleteMessage(scope.row)"
                theme="danger"
                @confirm="handleDelete(scope.row.id)"
              >
                <template #default>
                  <t-button size="small" theme="danger" variant="outline" aria-label="删除打印机" :loading="deletingIds.includes(scope.row.id)">
                    <span><delete /></span>
                    删除
                  </t-button>
                </template>
              </t-popconfirm>
            </div>
          </template>
        </TdTableColumn>
        </TdTable>
      </div>

      <template #footer>
        <div class="printer-management-table-footer">
          <span class="printer-management-table-summary">共 <strong>{{ total }}</strong> 台设备</span>
          <t-pagination
            v-model:current="queryParams.pageNum"
            v-model:pageSize="queryParams.pageSize"
            :total="total"
            :show-page-size="false"
            :total-content="false"
            @change="fetchData"
          />
        </div>
      </template>
    </t-card>

    <!-- 新增/编辑弹窗 -->
    <t-dialog v-model:visible="dialogVisible" :header="isEdit ? '编辑打印机' : '新增打印机'"
      width="520px"
      destroy-on-close
    >
      <t-form :data="form" :rules="rules" ref="formRef" label-width="100px">
        <t-form-item label="机器名称" name="name">
          <t-input v-model="form.name" placeholder="例：Klipper-01">
            <template #prefixIcon>
              <span><printer /></span>
            </template>
          </t-input>
        </t-form-item>

        <t-form-item label="IP 地址" name="ipAddress">
          <t-input v-model="form.ipAddress" placeholder="例：192.168.1.10">
            <template #prefixIcon>
              <span><link /></span>
            </template>
          </t-input>
        </t-form-item>

        <t-form-item label="设备协议" name="firmwareType">
          <t-select v-model="form.firmwareType" placeholder="请选择设备协议" style="width: 100%">
            <t-option label="RRF 3.7" value="RRF" />
            <t-option label="Klipper / Moonraker" value="KLIPPER" />
          </t-select>
        </t-form-item>

        <t-form-item label="当前耗材" name="currentMaterial">
          <t-select v-model="form.currentMaterial" placeholder="请选择装载耗材" style="width: 100%">
            <t-option label="PLA" value="PLA" />
            <t-option label="PETG" value="PETG" />
            <t-option label="ABS" value="ABS" />
            <t-option label="TPU" value="TPU" />
          </t-select>
        </t-form-item>

        <t-form-item label="喷嘴大小" name="nozzleSize">
          <div class="flex items-center gap-3">
            <t-input-number
              v-model="form.nozzleSize"
              :precision="2"
              :step="0.1"
              :min="0.2"
              :max="1.2"
              style="width: 150px"
            />
            <span class="text-sm text-gray-600">mm</span>
          </div>
        </t-form-item>
      </t-form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <t-button @click="dialogVisible = false">取消</t-button>
          <t-button theme="primary" @click="submitForm" :loading="submitLoading">
            <span><check /></span>
            确定
          </t-button>
        </div>
      </template>
    </t-dialog>

    <!-- 未分配设备抽屉 -->
    <t-drawer v-model:visible="unallocatedDialogVisible" header="未分配设备" size="720px" destroy-on-close>
      <AsyncState
        v-if="unallocatedLoading || unallocatedError || unallocatedPrinters.length === 0"
        :loading="unallocatedLoading"
        :error="unallocatedError"
        :empty="unallocatedPrinters.length === 0"
        empty-description="暂无未分配设备"
        @retry="loadUnallocatedPrinters"
      />
      <t-table
        v-else
        :data="unallocatedPrinters"
        :columns="unallocatedColumns"
        row-key="id"
        bordered
        hover
      >
        <template #status="slotProps">
          <StatusTag domain="printer" :status="slotProps.row.status" />
        </template>
        <template #position>
          <t-button size="small" variant="text" @click="goToDashboard">前往看板管理位置</t-button>
        </template>
      </t-table>
      <template #footer>
        <t-button @click="unallocatedDialogVisible = false">关闭</t-button>
      </template>
    </t-drawer>

    <!-- 扫描局域网设备弹窗 -->
    <t-dialog v-model:visible="scanDialogVisible" header="扫描局域网设备"
      width="800px"
      destroy-on-close
    >
      <!-- 扫描输入区 -->
      <div class="mb-4">
        <t-form label-width="90px">
          <t-form-item label="网段前缀">
            <t-input
              v-model="subnet"
              placeholder="例：192.168.1"
              size="medium"
              :disabled="isScanning"
            >
              <template #suffix>
                <t-button theme="primary"
                  @click="handleScan"
                  :loading="isScanning"
                >
                  <span><search /></span>
                  {{ isScanning ? '扫描中...' : '开始扫描' }}
                </t-button>
              </template>
            </t-input>
          </t-form-item>
        </t-form>
      </div>

      <!-- 加载状态 -->
      <div v-if="isScanning" class="text-center py-8">
        <t-skeleton :rows="5" animated />
        <p class="mt-4 text-sm text-gray-600">正在扫描局域网设备，请稍候...</p>
      </div>

      <!-- 扫描结果表格 -->
      <div v-else-if="scanResults.length > 0" class="bg-white rounded-lg">
        <!-- 统计文案 -->
        <div class="mb-4">
          <t-alert
            :title="scanStatsText" theme="info"
            :close-btn="false"

          />
        </div>

        <!-- 结果表格 -->
        <TdTable
          ref="scanTableRef"
          :data="scanResults"
          style="width: 100%"
          class="rounded-lg overflow-hidden"
          @selection-change="handleSelectionChange"
        >
          <TdTableColumn type="selection" width="50" align="center" />

          <TdTableColumn label="设备类型" width="120" align="center">
            <template #default="scope">
              <t-tag
                :theme="scope.row.isNewDevice ? 'success' : 'primary'"
                variant="light"
                size="small"
              >
                {{ scope.row.isNewDevice ? '全新设备' : '已知设备' }}
              </t-tag>
            </template>
          </TdTableColumn>

          <TdTableColumn prop="status" label="设备状态" width="120" align="center">
            <template #default="scope">
              <StatusTag domain="printer" :status="scope.row.status" />
            </template>
          </TdTableColumn>

          <TdTableColumn label="MAC 地址" width="140" align="center">
            <template #default="scope">
              <span class="font-mono text-sm font-medium text-gray-700">{{ scope.row.macAddress }}</span>
            </template>
          </TdTableColumn>

          <TdTableColumn prop="firmwareType" label="协议" width="130" align="center">
            <template #default="scope">
              <t-tag size="small" variant="light-outline" theme="default">
                {{ scope.row.firmwareType || '-' }}
              </t-tag>
            </template>
          </TdTableColumn>

          <TdTableColumn label="IP 地址" width="130" align="center">
            <template #default="scope">
              <t-tag size="small" variant="light-outline" theme="default">
                {{ scope.row.ipAddress }}
              </t-tag>
            </template>
          </TdTableColumn>

          <TdTableColumn label="机器名称" min-width="150">
            <template #default="scope">
              <t-input
                v-model="scope.row.name"
                size="small"
                placeholder="请输入机器名称"
              >
                <template #prefixIcon>
                  <span><printer /></span>
                </template>
              </t-input>
            </template>
          </TdTableColumn>

          <TdTableColumn label="建议名称" width="120" align="center">
            <template #default="scope">
              <span class="text-sm text-gray-600">{{ scope.row.suggestedName }}</span>
            </template>
          </TdTableColumn>
        </TdTable>
      </div>

      <!-- 空状态 -->
      <t-empty
        v-else-if="hasScanned && !isScanning"
        description="该网段未发现设备"

      >
        <template #description>
          <p>该网段未发现设备</p>
          <p class="mt-2 text-sm text-gray-400">请检查网段是否正确或设备是否在线</p>
        </template>
      </t-empty>

      <template #footer>
        <div class="flex justify-end gap-3">
          <t-button @click="scanDialogVisible = false">关闭</t-button>
          <t-button theme="success"
            :disabled="selectedDevices.length === 0"
            @click="handleBatchAdd"
            :loading="isBatchAdding"
          >
            <span><folder-add /></span>
            批量导入/同步 ({{ selectedDevices.length }})
          </t-button>
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import {
  RefreshIcon as Refresh,
  MapAimingIcon as Aim,
  AddIcon as Plus,
  PrintIcon as Printer,
  EditIcon as Edit,
  DeleteIcon as Delete,
  CheckIcon as Check,
  SearchIcon as Search,
  FolderAddIcon as FolderAdd
} from 'tdesign-icons-vue-next'
import {
  getPrinterList,
  addPrinter,
  updatePrinter,
  deletePrinter,
  scanPrinters,
  batchAddPrinters,
  getUnallocatedPrinters,
  confirmSafe,
  getPrinterStatusHistory,
  getPrinterStatistics,
  getPrinterMonitor,
  updatePrinterMonitor,
  updatePrinterMonitorBatch
} from '@/api/printer'
import { startJob } from '@/api/job'
import { message, confirmMessage } from '@/utils/message'
import { renderIcon } from '@/utils/tdesign'
import { useUserStore } from '@/stores/user'
import { useDeviceStore } from '@/stores/printer/deviceStore'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'
import { PRINTER_STATUS, PRINTER_STATUS_MAP } from '@/utils/constants'
import { normalizePrinterStatus } from '@/utils/dataAdapters'
import { formatDateTime } from '@/utils/formatters'
import DeviceDetailDrawer from '@/components/device/DeviceDetailDrawer.vue'
import AsyncState from '@/components/AsyncState.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'

defineOptions({ name: 'PrinterManage' })

// ===== 列表与分页状态 =====
const loading = ref(false)
const loadError = ref('')
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const deviceStore = useDeviceStore()
const realtimeStore = useRealtimeStore()
const { statusMap } = storeToRefs(realtimeStore)
const isAdmin = computed(() => userStore.isAdmin)
const tableData = ref([])
const total = ref(0)
const queryParams = reactive({
  pageNum: 1,
  pageSize: 20
})

const keyword = ref('')
const statusFilter = ref('')
const statusFilterConfig = Object.fromEntries(Object.entries(PRINTER_STATUS_MAP).map(([value, config]) => [value, {
    label: config.label,
    theme: config.type
  }]))

const statusOptions = Object.values(PRINTER_STATUS).map(value => ({
  value,
  label: PRINTER_STATUS_MAP[value].label
}))
const printerStatusTabs = [{ value: '', label: '全部' }, ...statusOptions]

const activeStatusFilterKey = computed(() => {
  const value = Array.isArray(route.query.status) ? route.query.status[0] : route.query.status
  return statusFilterConfig[value] ? value : ''
})
const activeStatusFilter = computed(() => statusFilterConfig[activeStatusFilterKey.value] || null)

// ===== 设备详情抽屉状态 =====
const detailDrawerVisible = ref(false)
const selectedDevice = ref(null)
const selectedDeviceRealTimeData = computed(() => {
  return selectedDevice.value ? statusMap.value.get(String(selectedDevice.value.id)) || null : null
})
const detailLoading = ref(false)
const detailError = ref('')
const PRINTER_DETAIL_CONTEXT_KEY = 'farm-ui:printer-detail'
const printerHistory = ref([])
const historyLoading = ref(false)
const historyError = ref('')
const historyTotal = ref(0)
const historyPageNum = ref(1)
const historyPageSize = ref(10)
const historyRange = ref([])
const printerStatistics = ref(null)
const statisticsLoading = ref(false)
const statisticsError = ref('')
const monitorConfig = ref(null)
const monitorLoading = ref(false)
const monitorError = ref('')
const monitorUpdatingIds = ref([])
const monitorBatchLoading = ref(false)
const selectedPrinterIds = ref([])

// ===== 表单与弹窗状态 =====
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)

const defaultForm = {
  id: null,
  name: '',
  ipAddress: '',
  firmwareType: 'KLIPPER',
  currentMaterial: 'ABS',
  nozzleSize: 1.2
}
const form = reactive({ ...defaultForm })

const rules = {
  name: [{ required: true, message: '请输入机器名称', trigger: 'blur' }],
  ipAddress: [{ required: true, message: '请输入IP地址', trigger: 'blur' }]
}

// ===== 扫描状态 =====
const scanDialogVisible = ref(false)
const subnet = ref('192.168.1')
const isScanning = ref(false)
const hasScanned = ref(false)
const scanResults = ref([])
const isBatchAdding = ref(false)
const selectedDevices = ref([])
const scanTableRef = ref(null)
const unallocatedDialogVisible = ref(false)
const unallocatedPrinters = ref([])
const unallocatedLoading = ref(false)
const unallocatedError = ref('')
const unallocatedColumns = [
  { colKey: 'name', title: '机器名称', ellipsis: true },
  { colKey: 'ipAddress', title: 'IP 地址', width: 150 },
  { colKey: 'status', title: '状态', width: 100, cell: 'status' },
  { colKey: 'firmwareType', title: '协议', width: 100 },
  { colKey: 'position', title: '位置', width: 140, cell: 'position' }
]

// ===== 现场操作状态 =====
const confirmingSafeIds = ref([])
const startingJobIds = ref([])
const deletingIds = ref([])

const displayTableData = computed(() => tableData.value.map(printer => {
  const realtime = statusMap.value.get(String(printer.id))
  if (!realtime) return printer

  const merged = { ...printer }
  const healthFields = [
    'connectionStatus',
    'lastSeenAt',
    'lastCommunicationError',
    'consecutiveFailureCount',
    'lastKnownStatus',
    'lastProtocolState',
    'lastDeviceUptime',
    'currentJobId',
    'currentJobFileName',
    'currentJobStatus',
    'progress'
  ]
  healthFields.forEach(field => {
    if (realtime[field] !== undefined) merged[field] = realtime[field]
  })
  const realtimeState = realtime.businessStatus || realtime.unifiedState || realtime.state
  if (realtimeState && String(realtimeState).toUpperCase() !== PRINTER_STATUS.OFFLINE) {
    merged.status = normalizePrinterStatus(realtimeState)
  }
  return merged
}))

const selectedPrinterRows = computed(() => {
  const selectedIds = new Set(selectedPrinterIds.value.map(id => String(id)))
  return displayTableData.value.filter(printer => selectedIds.has(String(printer.id)))
})

// 混合选择时统一执行启用，全部已启用时执行停用。
const batchMonitorTarget = computed(() => (
  selectedPrinterRows.value.length > 0
    ? !selectedPrinterRows.value.every(printer => printer.monitorEnabled === true)
    : true
))

const monitorActionLoading = computed(() => (
  monitorBatchLoading.value || selectedPrinterIds.value.some(id => monitorUpdatingIds.value.includes(id))
))

const getConnectionLabel = status => ({
  ONLINE: '在线',
  OFFLINE: '离线',
  UNKNOWN: '未知'
}[String(status || 'UNKNOWN').toUpperCase()] || '未知')

const getConnectionTheme = status => ({
  ONLINE: 'success',
  OFFLINE: 'danger',
  UNKNOWN: 'default'
}[String(status || 'UNKNOWN').toUpperCase()] || 'default')

// 扫描统计文案
const scanStatsText = computed(() => {
  const total = scanResults.value.length
  const newCount = scanResults.value.filter(d => d.isNewDevice).length
  const existingCount = total - newCount
  return `共扫描到 ${total} 台设备，其中 ${newCount} 台新设备，${existingCount} 台已知设备`
})

// 获取状态标签类型
const getStatusLabel = (status) => {
  return PRINTER_STATUS_MAP[String(status || '').toUpperCase()]?.label || '未知'
}

const getStatusClass = status => String(status || 'UNKNOWN').toLowerCase()

const getProgress = printer => {
  const progress = Number(printer.progress)
  if (!Number.isFinite(progress)) return 0
  return Math.min(100, Math.max(0, Math.round(progress)))
}

const getProgressStatus = printer => {
  if (String(printer.status || '').toUpperCase() === PRINTER_STATUS.ERROR) return 'error'
  if (getProgress(printer) >= 100) return 'success'
  return 'active'
}

// 判断是否应该显示"确认清理"按钮
const shouldShowSafeButton = (printer) => {
  return printer.currentJobStatus === 'ASSIGNED' && !printer.isSafeToPrint
}

// 判断是否应该显示"启动打印"按钮
const shouldShowStartButton = (printer) => {
  return printer.currentJobStatus === 'ASSIGNED' && printer.isSafeToPrint && printer.currentJobId
}

// 确认热床已清理
const handleConfirmSafe = async (printer) => {
  try {
    await confirmMessage(
      `确认 ${printer.name} 热床已清理完毕，可以开始打印了吗？`,
      '安全确认',
      {
        confirmButtonText: '已确认清理',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    confirmingSafeIds.value.push(printer.id)
    await confirmSafe(printer.id)
    message.success('安全确认成功！')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('安全确认失败:', error)
    }
  } finally {
    const index = confirmingSafeIds.value.indexOf(printer.id)
    if (index > -1) {
      confirmingSafeIds.value.splice(index, 1)
    }
  }
}

// 启动打印
const handleStartJob = async (printer) => {
  if (!printer.currentJobId) {
    message.warning('该设备没有分配的任务')
    return
  }

  try {
    await confirmMessage(
      `确认启动 ${printer.name} 的打印任务 #${printer.currentJobId}？`,
      '启动打印确认',
      {
        confirmButtonText: '启动打印',
        cancelButtonText: '取消',
        type: 'primary'
      }
    )

    startingJobIds.value.push(printer.id)
    await startJob(printer.currentJobId)
    message.success('打印任务已启动！')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('启动打印失败:', error)
    }
  } finally {
    const index = startingJobIds.value.indexOf(printer.id)
    if (index > -1) {
      startingJobIds.value.splice(index, 1)
    }
  }
}

// 表格行点击事件
const handlePrinterSelectionChange = rows => {
  selectedPrinterIds.value = Array.isArray(rows)
    ? rows.map(row => row?.id).filter(Boolean)
    : []
}

const handleRowClick = (row) => {
  selectedDevice.value = row
  sessionStorage.setItem(PRINTER_DETAIL_CONTEXT_KEY, String(row.id))
  detailError.value = ''
  historyPageNum.value = 1
  historyRange.value = []
  printerHistory.value = []
  historyTotal.value = 0
  historyError.value = ''
  printerStatistics.value = null
  statisticsError.value = ''
  detailDrawerVisible.value = true
  loadPrinterDetail(row.id)
  loadPrinterMonitor(row.id)
  loadPrinterAnalytics(row.id)
}

const loadPrinterDetail = async deviceId => {
  detailLoading.value = true
  detailError.value = ''
  try {
    const detail = await deviceStore.fetchDeviceDetail(deviceId)
    if (String(selectedDevice.value?.id) === String(deviceId) && detail) {
      selectedDevice.value = detail
    }
  } catch (error) {
    if (String(selectedDevice.value?.id) === String(deviceId)) {
      detailError.value = error?.message || '打印机详情加载失败，请重试'
    }
  } finally {
    if (String(selectedDevice.value?.id) === String(deviceId)) detailLoading.value = false
  }
}

const retryPrinterDetail = () => {
  const deviceId = selectedDevice.value?.id
  if (deviceId) {
    loadPrinterDetail(deviceId)
    loadPrinterMonitor(deviceId)
  }
}

const loadPrinterMonitor = async deviceId => {
  monitorLoading.value = true
  monitorError.value = ''
  try {
    const response = await getPrinterMonitor(deviceId)
    if (String(selectedDevice.value?.id) === String(deviceId)) {
      monitorConfig.value = response?.data || null
    }
  } catch (error) {
    if (String(selectedDevice.value?.id) === String(deviceId)) {
      monitorError.value = error?.message || '监控配置加载失败，请重试'
    }
  } finally {
    if (String(selectedDevice.value?.id) === String(deviceId)) monitorLoading.value = false
  }
}

const updateMonitorRows = (ids, enabled) => {
  const idSet = new Set(ids.map(id => String(id)))
  tableData.value = tableData.value.map(row => idSet.has(String(row.id))
    ? { ...row, monitorEnabled: enabled }
    : row)
}

const handleMonitorChange = (printer, enabled) => {
  if (!isAdmin.value || monitorUpdatingIds.value.includes(printer.id)) return
  return updateMonitorForIds([printer.id], enabled, printer)
}

const updateMonitorForIds = async (ids, enabled, printer = null) => {
  const normalizedIds = ids.filter(Boolean)
  if (normalizedIds.length === 0) {
    message.warning('请先选择打印机')
    return
  }
  if (monitorBatchLoading.value || normalizedIds.some(id => monitorUpdatingIds.value.includes(id))) return

  if (normalizedIds.length === 1) {
    monitorUpdatingIds.value.push(normalizedIds[0])
  } else {
    monitorBatchLoading.value = true
  }

  try {
    if (normalizedIds.length === 1) await updatePrinterMonitor(normalizedIds[0], enabled)
    else await updatePrinterMonitorBatch(normalizedIds, enabled)
    updateMonitorRows(normalizedIds, enabled)
    if (printer && String(selectedDevice.value?.id) === String(printer.id)) {
      monitorConfig.value = { ...monitorConfig.value, monitorEnabled: enabled }
    }
    selectedPrinterIds.value = []
    message.success(enabled ? '监控已启用' : '监控已停用')
    await fetchData()
  } catch (error) {
    if (!error?.toastShown) message.error(error?.message || '监控配置更新失败')
  } finally {
    if (normalizedIds.length === 1) {
      const index = monitorUpdatingIds.value.indexOf(normalizedIds[0])
      if (index > -1) monitorUpdatingIds.value.splice(index, 1)
    } else {
      monitorBatchLoading.value = false
    }
  }
}

const handleBatchMonitorToggle = () => updateMonitorForIds([...selectedPrinterIds.value], batchMonitorTarget.value)

const handleDetailMonitorChange = enabled => {
  const printer = selectedDevice.value
  if (printer) return updateMonitorForIds([printer.id], enabled, printer)
}

const loadPrinterAnalytics = async deviceId => {
  historyLoading.value = true
  statisticsLoading.value = true
  historyError.value = ''
  statisticsError.value = ''
  const params = {
    pageNum: historyPageNum.value,
    pageSize: historyPageSize.value
  }
  if (historyRange.value.length === 2) {
    params.from = historyRange.value[0]
    params.to = historyRange.value[1]
  }
  try {
    const [historyResult, statisticsResult] = await Promise.allSettled([
      getPrinterStatusHistory(deviceId, params),
      getPrinterStatistics(deviceId, {
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {})
      })
    ])
    if (String(selectedDevice.value?.id) !== String(deviceId)) return

    if (historyResult.status === 'fulfilled') {
      printerHistory.value = historyResult.value.data?.records || []
      historyTotal.value = historyResult.value.data?.total || 0
    } else {
      historyError.value = historyResult.reason?.message || '状态历史加载失败，请重试'
    }
    if (statisticsResult.status === 'fulfilled') {
      printerStatistics.value = statisticsResult.value.data || null
    } else {
      statisticsError.value = statisticsResult.reason?.message || '打印机统计加载失败，请重试'
    }
  } finally {
    if (String(selectedDevice.value?.id) === String(deviceId)) {
      historyLoading.value = false
      statisticsLoading.value = false
    }
  }
}

const handleHistoryQuery = range => {
  historyRange.value = Array.isArray(range) ? range : []
  historyPageNum.value = 1
  if (selectedDevice.value?.id) loadPrinterAnalytics(selectedDevice.value.id)
}

const handleHistoryPageChange = ({ current, pageSize }) => {
  historyPageNum.value = current
  historyPageSize.value = pageSize
  if (selectedDevice.value?.id) loadPrinterAnalytics(selectedDevice.value.id)
}

const clearPrinterDetailContext = () => {
  detailDrawerVisible.value = false
  sessionStorage.removeItem(PRINTER_DETAIL_CONTEXT_KEY)
  selectedDevice.value = null
  detailLoading.value = false
  detailError.value = ''
  printerHistory.value = []
  historyLoading.value = false
  historyError.value = ''
  historyTotal.value = 0
  historyPageNum.value = 1
  printerStatistics.value = null
  statisticsLoading.value = false
  statisticsError.value = ''
  monitorConfig.value = null
  monitorLoading.value = false
  monitorError.value = ''
}

const restorePrinterDetailContext = () => {
  const printerId = sessionStorage.getItem(PRINTER_DETAIL_CONTEXT_KEY)
  if (!printerId || selectedDevice.value) return

  const printer = tableData.value.find(item => String(item.id) === printerId)
  if (printer) handleRowClick(printer)
}

// 加载分页数据
const fetchData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getPrinterList({
      ...queryParams,
      ...(activeStatusFilterKey.value ? { status: activeStatusFilterKey.value } : {}),
      ...(keyword.value.trim() ? { name: keyword.value.trim() } : {})
    })
    tableData.value = res.data?.records || []
    total.value = res.data?.total || 0
    restorePrinterDetailContext()
  } catch (error) {
    loadError.value = error?.message || '打印机列表加载失败，请重试'
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  queryParams.pageNum = 1
  const query = { ...route.query }
  if (statusFilter.value) query.status = statusFilter.value
  else delete query.status
  router.replace({ path: route.path, query })
  if (statusFilter.value === activeStatusFilterKey.value) fetchData()
}

const applyStatusTab = value => {
  statusFilter.value = value || ''
  applyFilters()
}

const clearStatusFilter = () => {
  statusFilter.value = ''
  applyFilters()
}

watch(() => route.query.status, value => {
  statusFilter.value = Array.isArray(value) ? value[0] || '' : value || ''
  queryParams.pageNum = 1
  fetchData()
}, { immediate: true })

// 点击新增按钮
const handleAdd = () => {
  isEdit.value = false
  Object.assign(form, defaultForm)
  dialogVisible.value = true
}

// 点击编辑按钮
const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    name: row.name,
    ipAddress: row.ipAddress,
    firmwareType: row.firmwareType || 'KLIPPER',
    currentMaterial: row.currentMaterial,
    nozzleSize: row.nozzleSize
  })
  dialogVisible.value = true
}

// 提交表单
const submitForm = async () => {
  await formRef.value.validate()
  submitLoading.value = true
  try {
    const payload = {
      id: form.id,
      name: form.name,
      ipAddress: form.ipAddress,
      firmwareType: form.firmwareType,
      currentMaterial: form.currentMaterial,
      nozzleSize: form.nozzleSize
    }

    if (isEdit.value) {
      await updatePrinter(payload)
      message.success('修改成功')
    } else {
      await addPrinter(payload)
      message.success('新增成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch {
    // 错误在拦截器处理
  } finally {
    submitLoading.value = false
  }
}

// 删除数据
const handleDelete = async (id) => {
  if (deletingIds.value.includes(id)) return
  deletingIds.value.push(id)
  try {
    await deletePrinter(id)
    message.success('删除成功')
    if (tableData.value.length === 1 && queryParams.pageNum > 1) {
      queryParams.pageNum--
    }
    fetchData()
  } catch (error) {
    message.error(error?.message || '删除失败，请刷新后重试')
  } finally {
    const index = deletingIds.value.indexOf(id)
    if (index > -1) deletingIds.value.splice(index, 1)
  }
}

const getDeleteMessage = printer => {
  const currentState = getStatusLabel(printer.status)
  return printer.currentJobId
    ? `该设备当前为“${currentState}”，并关联任务 #${printer.currentJobId}。删除可能被服务端拒绝，确定继续吗？`
    : `确定删除设备“${printer.name || printer.ipAddress}”吗？`
}

const openUnallocatedDialog = () => {
  unallocatedDialogVisible.value = true
  loadUnallocatedPrinters()
}

const loadUnallocatedPrinters = async () => {
  unallocatedLoading.value = true
  unallocatedError.value = ''
  try {
    unallocatedPrinters.value = await getUnallocatedPrinters()
  } catch (error) {
    unallocatedError.value = error?.message || '未分配设备加载失败，请重试'
  } finally {
    unallocatedLoading.value = false
  }
}

const goToDashboard = () => {
  unallocatedDialogVisible.value = false
  router.push({ name: 'fullscreen-dashboard' })
}

// ===== 局域网扫描逻辑 =====
const openScanDialog = () => {
  scanResults.value = []
  selectedDevices.value = []
  hasScanned.value = false
  scanDialogVisible.value = true
}

// 表格多选变化
const handleSelectionChange = (selection) => {
  selectedDevices.value = selection
}

const handleScan = async () => {
  if (!subnet.value) {
    message.warning('请输入网段前缀')
    return
  }
  isScanning.value = true
  hasScanned.value = false
  selectedDevices.value = []
  try {
    const res = await scanPrinters(subnet.value)
    // 为每个设备添加 name 字段（默认使用 suggestedName）
    scanResults.value = (res.data || []).map(device => ({
      ...device,
      name: device.suggestedName || ''
    }))
    hasScanned.value = true
  } catch {
    // 拦截器处理错误
  } finally {
    isScanning.value = false
  }
}

const handleBatchAdd = async () => {
  if (selectedDevices.value.length === 0) return

  // 构造符合新 API 契约的请求体
  const devicesToSubmit = selectedDevices.value.map(device => ({
    ipAddress: device.ipAddress,
    macAddress: device.macAddress,
    name: device.name || device.suggestedName,
    firmwareType: device.firmwareType
  }))

  isBatchAdding.value = true
  try {
    const res = await batchAddPrinters(devicesToSubmit)
    // 解析后端返回的 message
    const result = res.data || {}
    const resultMessage = res.message || result.message || '批量处理完成'
    if (result.failedCount > 0) {
      message.warning(`${resultMessage}：新增 ${result.insertedCount || 0} 台，更新 ${result.updatedCount || 0} 台，失败 ${result.failedCount} 台`)
    } else {
      message.success(`${resultMessage}：新增 ${result.insertedCount || 0} 台，更新 ${result.updatedCount || 0} 台`)
    }
    scanDialogVisible.value = false
    fetchData() // 刷新设备列表
  } catch (error) {
    // 拦截器会处理错误，但如果有特定错误信息可以在这里显示
    const errorMsg = error.response?.data?.message || '批量处理失败'
    message.error(errorMsg)
  } finally {
    isBatchAdding.value = false
  }
}

</script>

<style scoped>
.printer-manage-page {
  gap: var(--app-spacing-3);
}

.printer-page-actions {
  gap: var(--app-spacing-2);
}

.printer-management-toolbar-card {
  flex: 0 0 auto;
  padding: var(--app-spacing-2) var(--app-spacing-3);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow);
}

.printer-management-toolbar-card__top,
.printer-management-toolbar-card__controls {
  display: flex;
  align-items: center;
  min-width: 0;
}

.printer-management-toolbar-card__top {
  justify-content: space-between;
  gap: var(--app-spacing-4);
}

.printer-management-toolbar-card__controls {
  flex: 0 0 auto;
  gap: var(--app-spacing-2);
}

.printer-management-tabs {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 0;
  min-height: 40px;
  overflow-x: auto;
  scrollbar-width: none;
}

.printer-management-tabs::-webkit-scrollbar {
  display: none;
}

.printer-management-tabs :deep(.t-radio-button) {
  flex: 0 0 auto;
  min-width: 64px;
  height: 34px;
  justify-content: center;
  color: var(--app-text-secondary);
  border: 0;
  box-shadow: none;
}

.printer-management-tabs :deep(.t-radio-button::before),
.printer-management-tabs :deep(.t-radio-button.t-is-checked + .t-radio-button::before) {
  display: none;
}

.printer-management-tabs :deep(.t-radio-button:hover) {
  color: var(--app-primary);
}

.printer-management-tabs :deep(.t-radio-button.t-is-checked) {
  color: var(--app-primary);
  background: var(--app-primary-light);
  border: 0;
  box-shadow: none;
}

.printer-management-filter__search {
  flex: 0 1 280px;
  width: 280px;
  min-width: 0;
}

.printer-manage-card {
  min-height: 0;
}

.printer-manage-card :deep(.t-card__body) {
  padding: 0;
}

.printer-manage-card :deep(.t-card__footer) {
  padding: var(--app-spacing-3) var(--app-spacing-4);
  border-top: 1px solid var(--app-border);
}

.printer-manage-card__table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.printer-table {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.printer-management-table :deep(.t-table__content) {
  overflow-x: auto;
  overflow-y: auto;
}

.printer-management-table :deep(.t-table__header tr),
.printer-management-table :deep(.t-table__body tr) {
  height: 52px;
}

.printer-management-table :deep(th),
.printer-management-table :deep(td) {
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-small);
}

.printer-management-table :deep(.t-table__header th) {
  color: var(--app-text-secondary);
  font-weight: 500;
  background: var(--app-surface-muted);
}

.printer-management-table :deep(.t-table__body tr) {
  transition: background-color 0.18s ease;
}

.printer-management-table :deep(.t-table__body tr:hover > td) {
  background: var(--app-surface-hover);
}

.printer-management-table :deep(.t-table__body tr:hover > td:first-child) {
  box-shadow: inset 3px 0 var(--app-primary);
}

.printer-table-row :deep(td) {
  cursor: pointer;
}

.printer-management-primary,
.printer-management-name,
.printer-management-connection,
.printer-management-recent,
.printer-management-task,
.printer-management-task__content {
  display: flex;
  min-width: 0;
}

.printer-management-primary,
.printer-management-connection,
.printer-management-recent {
  align-items: center;
  flex-direction: column;
  gap: var(--app-spacing-1);
}

.printer-management-name {
  align-items: center;
  max-width: 100%;
  gap: var(--app-spacing-1);
  font-weight: 600;
}

.printer-management-ellipsis,
.printer-management-task__name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.printer-management-muted {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.printer-management-status-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.printer-management-status-dot--printing { background: var(--app-primary); }
.printer-management-status-dot--idle { background: var(--app-success); }
.printer-management-status-dot--preparing,
.printer-management-status-dot--paused { background: var(--app-warning); }
.printer-management-status-dot--error { background: var(--app-danger); }
.printer-management-status-dot--offline,
.printer-management-status-dot--unknown { background: var(--app-text-placeholder); }

.printer-management-status-card {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: var(--app-spacing-1) var(--app-spacing-2);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-small);
}

.printer-management-connection,
.printer-management-recent {
  text-align: center;
}

.printer-management-recent__failure {
  color: var(--app-warning);
  font-size: var(--td-font-size-body-small);
}

.printer-management-task {
  align-items: center;
  justify-content: center;
  gap: var(--app-spacing-2);
  text-align: left;
}

.printer-management-task__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--app-text-placeholder);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-small);
}

.printer-management-task__icon--active {
  color: var(--app-primary);
  background: var(--app-primary-light);
}

.printer-management-task__content {
  flex-direction: column;
  gap: 2px;
}

.printer-management-task__content :deep(.t-progress) {
  width: 96px;
}

.printer-management-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-4);
  min-width: 0;
}

.printer-management-table-summary {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  white-space: nowrap;
}

.printer-management-table-summary strong {
  color: var(--app-text-primary);
}

.printer-management-table-footer :deep(.t-pagination) {
  min-width: 0;
}

.printer-filter-bar {
  display: none;
}

@media (max-width: 1100px) {
  .printer-manage-page :deep(.app-page-header__actions) {
    flex: 1 1 100%;
    width: 100%;
    min-width: 0;
    justify-content: flex-start;
    overflow: hidden;
  }

  .printer-page-actions {
    flex-wrap: nowrap;
    width: 100%;
    min-width: 0;
    justify-content: flex-start;
    overflow-x: auto;
  }

  .printer-page-actions :deep(.t-button) {
    flex: 0 0 auto;
  }

  .printer-management-toolbar-card__top {
    align-items: stretch;
    flex-direction: column;
    gap: var(--app-spacing-2);
  }

  .printer-management-tabs {
    flex: 0 0 40px;
    flex-wrap: nowrap;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .printer-management-toolbar-card__controls {
    width: 100%;
  }

  .printer-management-filter__search {
    flex: 1 1 auto;
    width: auto;
  }
}

@media (max-width: 768px) {
  .printer-management-toolbar-card__top {
    align-items: stretch;
    flex-direction: column;
    gap: var(--app-spacing-2);
  }

  .printer-management-toolbar-card__controls {
    width: 100%;
  }

  .printer-management-filter__search {
    width: 100%;
    flex: 1 1 auto;
  }

  .printer-page-actions {
    width: 100%;
  }

  .printer-page-actions :deep(.t-button) {
    flex: 1 1 auto;
  }

  .printer-management-table-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .printer-management-table-footer :deep(.t-pagination) {
    align-self: flex-end;
  }
}
</style>
