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
      @history-query="handleHistoryQuery"
      @history-page-change="handleHistoryPageChange"
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
        <nav class="printer-management-tabs" aria-label="打印机状态筛选">
          <button
            v-for="tab in printerStatusTabs"
            :key="tab.value || 'all'"
            type="button"
            class="printer-management-tab"
            :class="{ 'printer-management-tab--active': activeStatusFilterKey === tab.value }"
            :aria-pressed="activeStatusFilterKey === tab.value"
            @click="applyStatusTab(tab.value)"
          >
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <div class="printer-management-toolbar-card__controls">
          <t-input
            v-model="keyword"
            class="printer-management-filter__search"
            clearable
            placeholder="按机器名称、IP 地址或编号搜索"
            @enter="handleKeywordEnter"
            @clear="handleKeywordClear"
          >
            <template #prefixIcon><Search /></template>
          </t-input>

          <div class="printer-management-view-toggle" role="group" aria-label="设备列表视图切换">
            <span>视图：</span>
            <div class="printer-management-view-toggle__buttons">
              <t-button
                size="small"
                variant="text"
                :class="{ 'printer-management-view-toggle__active': viewMode === 'list' }"
                aria-label="列表视图"
                @click="viewMode = 'list'"
              >
                <ViewList :size="16" />
              </t-button>
              <t-button
                size="small"
                variant="text"
                :class="{ 'printer-management-view-toggle__active': viewMode === 'grid' }"
                aria-label="网格视图"
                @click="viewMode = 'grid'"
              >
                <GridView :size="16" />
              </t-button>
            </div>
          </div>
        </div>
      </div>
    </section>

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

        <template v-if="viewMode === 'list'">
          <TdTable
            v-if="tableData.length"
            :data="displayTableData"
            :loading="loading"
            height="100%"
            class="printer-management-table printer-table"
            @row-click="handleRowClick"
            row-class-name="printer-management-table__row"
          >
            <TdTableColumn prop="name" label="打印机" width="160" align="center">
              <template #default="scope">
                <div class="printer-management-primary">
                  <div class="printer-management-name">
                    <span class="printer-management-status-dot" :class="`printer-management-status-dot--${getStatusClass(scope.row.status)}`" />
                    <span class="truncate" :title="scope.row.name">{{ scope.row.name }}</span>
                  </div>
                  <span class="printer-management-muted">#{{ scope.row.id }}</span>
                </div>
              </template>
            </TdTableColumn>

            <TdTableColumn label="区域 / 编号" width="112" align="center">
              <template #default="scope">
                <div class="printer-management-primary">
                  <t-tag size="small" variant="light-outline" theme="default">
                    {{ scope.row.zone || getZoneLabel(scope.row) }}
                  </t-tag>
                  <span class="printer-management-muted">{{ scope.row.machineNumber || `#${scope.row.id}` }}</span>
                </div>
              </template>
            </TdTableColumn>

            <TdTableColumn label="网络 / 协议" width="154" align="center">
              <template #default="scope">
                <div class="printer-management-primary">
                  <span>{{ scope.row.ipAddress || '-' }}</span>
                  <span class="printer-management-muted printer-management-uppercase">{{ getFirmwareDisplay(scope.row) }}</span>
                </div>
              </template>
            </TdTableColumn>

            <TdTableColumn label="任务 / 文件" min-width="190" align="center">
              <template #default="scope">
                <div class="printer-management-task">
                  <span class="printer-management-task__icon" :class="{ 'printer-management-task__icon--active': scope.row.currentJobId }">
                    <Printer :size="13" />
                  </span>
                  <div class="printer-management-task__content">
                    <span class="printer-management-task__name" :title="getTaskLabel(scope.row)">{{ getTaskLabel(scope.row) }}</span>
                    <span class="printer-management-muted">{{ getTaskMeta(scope.row) }}</span>
                  </div>
                </div>
              </template>
            </TdTableColumn>

            <TdTableColumn prop="status" label="打印状态" width="112" align="center">
              <template #default="scope">
                <span class="printer-management-status-pill" :class="`printer-management-status-pill--${getStatusClass(scope.row.status)}`">
                  <span class="printer-management-status-pill__dot" />
                  {{ getStatusLabel(scope.row.status) }}
                </span>
              </template>
            </TdTableColumn>

            <TdTableColumn label="进度 / 层数" width="132" align="center">
              <template #default="scope">
                <div class="printer-management-progress">
                  <div class="printer-management-progress__labels">
                    <span>{{ getRemainingText(scope.row) }}</span>
                    <strong>{{ getProgressText(scope.row) }}</strong>
                  </div>
                  <t-progress :percentage="getProgress(scope.row)" :label="false" :stroke-width="4" :status="getProgressStatus(scope.row)" />
                </div>
              </template>
            </TdTableColumn>

            <TdTableColumn label="耗材 / 温度" width="116" align="center">
              <template #default="scope">
                <div class="printer-management-material">
                  <span class="printer-management-material__tag" :class="`printer-management-material__tag--${String(scope.row.currentMaterial || 'unknown').toLowerCase()}`">
                    {{ getMaterialLabel(scope.row) }}
                  </span>
                  <span class="printer-management-muted">{{ getTemperatureLabel(scope.row) }}</span>
                </div>
              </template>
            </TdTableColumn>

            <TdTableColumn label="操作" width="208" align="center" fixed="right">
              <template #default="scope">
                <div class="printer-management-actions">
                  <t-button size="small" variant="text" @click.stop="handleRowClick(scope.row)">详情</t-button>
                  <t-button
                    v-if="shouldShowSafeButton(scope.row)"
                    size="small"
                    theme="warning"
                    :loading="confirmingSafeIds.includes(scope.row.id)"
                    @click.stop="handleConfirmSafe(scope.row)"
                  >
                    确认清理
                  </t-button>
                  <t-button
                    v-else-if="shouldShowStartButton(scope.row)"
                    size="small"
                    theme="primary"
                    :loading="startingJobIds.includes(scope.row.id)"
                    @click.stop="handleStartJob(scope.row)"
                  >
                    启动打印
                  </t-button>
                  <t-button v-else-if="isAdmin" size="small" variant="text" theme="primary" :icon="renderIcon(Edit)" @click.stop="handleEdit(scope.row)">编辑</t-button>
                  <t-popconfirm v-if="isAdmin" :content="getDeleteMessage(scope.row)" theme="danger" @confirm="handleDelete(scope.row.id)">
                    <template #default>
                      <t-button size="small" variant="text" theme="danger" :icon="renderIcon(Delete)" :loading="deletingIds.includes(scope.row.id)" @click.stop>删除</t-button>
                    </template>
                  </t-popconfirm>
                </div>
              </template>
            </TdTableColumn>
          </TdTable>
        </template>

        <div v-else class="printer-grid-view">
          <article v-for="printerItem in displayTableData" :key="printerItem.id" class="printer-grid-card" @click="handleRowClick(printerItem)">
            <div class="printer-grid-card__header">
              <div class="printer-table-primary">
                <span class="printer-management-name">
                  <span class="printer-management-status-dot" :class="`printer-management-status-dot--${getStatusClass(printerItem.status)}`" />
                  <span class="truncate" :title="printerItem.name">{{ printerItem.name }}</span>
                </span>
                <span class="printer-table-secondary">#{{ printerItem.id }} · {{ printerItem.machineNumber || '未分配机位' }}</span>
              </div>
              <span class="printer-management-status-pill" :class="`printer-management-status-pill--${getStatusClass(printerItem.status)}`">
                <span class="printer-management-status-pill__dot" />
                {{ getStatusLabel(printerItem.status) }}
              </span>
            </div>
            <div class="printer-grid-card__body">
              <span>{{ printerItem.ipAddress || '-' }}</span>
              <span>{{ getFirmwareDisplay(printerItem) }}</span>
              <span>{{ getMaterialLabel(printerItem) }} · {{ getTemperatureLabel(printerItem) }}</span>
              <span class="printer-management-muted">{{ getTaskLabel(printerItem) }}</span>
            </div>
            <div class="printer-grid-card__progress">
              <span>打印进度</span>
              <strong>{{ getProgress(printerItem) }}%</strong>
              <t-progress :percentage="getProgress(printerItem)" :label="false" :stroke-width="5" :status="getProgressStatus(printerItem)" />
            </div>
            <div class="printer-grid-card__actions" @click.stop>
              <t-button size="small" variant="text" @click="handleRowClick(printerItem)">详情</t-button>
              <t-button v-if="shouldShowSafeButton(printerItem)" size="small" theme="warning" @click="handleConfirmSafe(printerItem)">确认清理</t-button>
              <t-button v-else-if="shouldShowStartButton(printerItem)" size="small" theme="primary" @click="handleStartJob(printerItem)">启动打印</t-button>
              <t-button v-else-if="isAdmin" size="small" variant="text" theme="primary" :icon="renderIcon(Edit)" @click="handleEdit(printerItem)">编辑</t-button>
              <t-popconfirm v-if="isAdmin" :content="getDeleteMessage(printerItem)" theme="danger" @confirm="handleDelete(printerItem.id)">
                <template #default>
                  <t-button size="small" variant="text" theme="danger" :icon="renderIcon(Delete)" :loading="deletingIds.includes(printerItem.id)" @click.stop>删除</t-button>
                </template>
              </t-popconfirm>
            </div>
          </article>
        </div>
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
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import {
  RefreshIcon as Refresh,
  MapAimingIcon as Aim,
  AddIcon as Plus,
  PrintIcon as Printer,
  EditIcon as Edit,
  DeleteIcon as Delete,
  SearchIcon as Search,
  FolderAddIcon as FolderAdd,
  ViewListIcon as ViewList,
  GridViewIcon as GridView
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
  getPrinterStatistics
} from '@/api/printer'
import { startJob } from '@/api/job'
import { message, confirmMessage } from '@/utils/message'
import { renderIcon } from '@/utils/tdesign'
import { useUserStore } from '@/stores/user'
import { useDeviceStore } from '@/stores/printer/deviceStore'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'
import { PRINTER_STATUS, PRINTER_STATUS_MAP } from '@/utils/constants'
import { normalizePrinterStatus } from '@/utils/dataAdapters'
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
let lastAppliedKeyword = ''
let searchDebounceTimer = null
const statusFilter = ref('')
const statusFilterConfig = Object.fromEntries(Object.entries(PRINTER_STATUS_MAP).map(([value, config]) => [value, {
    label: config.label,
    theme: config.type
  }]))

const statusOptions = Object.values(PRINTER_STATUS).map(value => ({
  value,
  label: PRINTER_STATUS_MAP[value].label
}))

const viewMode = ref('list')
const printerStatusTabs = computed(() => [
  { value: '', label: '全部' },
  ...statusOptions
])

const activeStatusFilterKey = computed(() => {
  const value = Array.isArray(route.query.status) ? route.query.status[0] : route.query.status
  return statusFilterConfig[value] ? value : ''
})
const activeStatusFilter = computed(() => statusFilterConfig[activeStatusFilterKey.value] || null)

const applyStatusTab = value => {
  statusFilter.value = value
  applyFilters()
}

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
  const realtimeState = realtime?.unifiedState || realtime?.state
  return realtimeState ? { ...printer, status: normalizePrinterStatus(realtimeState) } : printer
}))

// 扫描统计文案
const scanStatsText = computed(() => {
  const total = scanResults.value.length
  const newCount = scanResults.value.filter(d => d.isNewDevice).length
  const existingCount = total - newCount
  return `共扫描到 ${total} 台设备，其中 ${newCount} 台新设备，${existingCount} 台已知设备`
})

const getStatusClass = status => {
  const normalized = String(status || '').toUpperCase()
  if (normalized === PRINTER_STATUS.PRINTING) return 'printing'
  if (normalized === PRINTER_STATUS.IDLE || normalized === PRINTER_STATUS.PREPARING) return 'idle'
  if (normalized === PRINTER_STATUS.PAUSED) return 'paused'
  if (normalized === PRINTER_STATUS.ERROR) return 'attention'
  return 'offline'
}

const getZoneLabel = printer => {
  const zone = String(printer.zone || '').trim()
  if (zone) return zone.endsWith('区') ? zone : `${zone}区`
  return '未分区'
}

const getFirmwareDisplay = printer => {
  const firmwareType = String(printer.firmwareType || '').trim().toUpperCase()
  return firmwareType || '未配置'
}

const getTaskLabel = printer => {
  if (printer.currentJobFileName) return printer.currentJobFileName
  if (printer.currentJobId) return `任务 #${printer.currentJobId}`
  return '暂无打印任务'
}

const getTaskMeta = printer => printer.currentJobId ? `任务 #${printer.currentJobId}` : '等待分配任务'

const getProgress = printer => {
  const progress = Number(printer.progress)
  if (!Number.isFinite(progress)) return 0
  return Math.min(100, Math.max(0, Math.round(progress)))
}

const getProgressText = printer => {
  const currentLayer = Number(printer.currentLayer)
  const totalLayers = Number(printer.totalLayers)
  if (Number.isFinite(currentLayer) && Number.isFinite(totalLayers) && totalLayers > 0) {
    return `${currentLayer}/${totalLayers} 层`
  }
  return `${getProgress(printer)}%`
}

const getRemainingText = printer => {
  const progress = getProgress(printer)
  if (progress >= 100) return '已完成'
  if (progress > 0) return '进行中'
  return '--'
}

const getProgressStatus = printer => {
  const status = String(printer.status || '').toUpperCase()
  if (status === PRINTER_STATUS.ERROR) return 'error'
  if (getProgress(printer) >= 100) return 'success'
  return 'active'
}

const getMaterialLabel = printer => printer.currentMaterial ? `Ext ${printer.currentMaterial}` : 'Ext ?'

const getTemperatureLabel = printer => {
  const temperature = printer.nozzleTemperature ?? printer.toolTemperature ?? printer.hotendTemperature
  return Number.isFinite(Number(temperature)) ? `${temperature}°C` : '--'
}

// 获取状态标签类型
const getStatusLabel = (status) => {
  return PRINTER_STATUS_MAP[String(status || '').toUpperCase()]?.label || '未知'
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
  if (deviceId) loadPrinterDetail(deviceId)
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
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  lastAppliedKeyword = keyword.value.trim()
  queryParams.pageNum = 1
  const query = { ...route.query }
  if (statusFilter.value) query.status = statusFilter.value
  else delete query.status
  router.replace({ path: route.path, query })
  if (statusFilter.value === activeStatusFilterKey.value) fetchData()
}

const scheduleKeywordSearch = () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null
    applyFilters()
  }, 400)
}

const handleKeywordEnter = () => {
  applyFilters()
}

const handleKeywordClear = () => {
  keyword.value = ''
  applyFilters()
}

const clearStatusFilter = () => {
  statusFilter.value = ''
  applyFilters()
}

watch(keyword, value => {
  if (value.trim() === lastAppliedKeyword) return
  scheduleKeywordSearch()
})

onBeforeUnmount(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})

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
  gap: 0.75rem;
}

.printer-manage-page :deep(.app-page-header__title) {
  font-size: 1.375rem;
  line-height: 1.4;
}

.printer-management-toolbar-card {
  flex: 0 0 auto;
  padding: 0.5rem 0.75rem;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--app-radius);
}

.printer-management-toolbar-card__top,
.printer-management-toolbar-card__controls {
  display: flex;
  align-items: center;
  min-width: 0;
}

.printer-management-toolbar-card__top {
  justify-content: space-between;
  gap: 1rem;
}

.printer-management-toolbar-card__controls {
  flex: 0 0 auto;
  gap: 0.75rem;
}

.printer-management-tabs {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 2.5rem;
  gap: 0.25rem;
  overflow-x: auto;
}

.printer-management-tab {
  display: inline-flex;
  flex: 0 0 5.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  height: 2.5rem;
  width: 5.5rem;
  padding: 0 0.85rem;
  color: var(--td-text-color-secondary);
  font-size: 0.8125rem;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.printer-management-tab:hover,
.printer-management-tab--active {
  color: var(--td-brand-color-6);
}

.printer-management-tab--active { border-bottom-color: var(--td-brand-color-6); }

.printer-management-filter__search {
  flex: 0 1 16rem;
  width: 16rem;
  min-width: 0;
}

.printer-management-view-toggle,
.printer-management-view-toggle__buttons {
  display: flex;
  align-items: center;
}

.printer-management-view-toggle {
  flex: 0 0 auto;
  gap: 0.5rem;
}

.printer-management-view-toggle__buttons {
  padding: 0.125rem;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: var(--td-radius-small);
}

.printer-management-view-toggle__buttons :deep(.t-button) {
  width: 2rem;
  min-height: 1.75rem;
  padding: 0;
  color: var(--td-text-color-secondary);
}

.printer-management-view-toggle__buttons :deep(.printer-management-view-toggle__active) {
  color: var(--td-brand-color-6);
  background: var(--td-bg-color-container);
  box-shadow: var(--td-shadow-1);
}

.printer-manage-card {
  min-height: 0;
}

.printer-manage-card :deep(.t-card__body) {
  padding: 0;
}

.printer-manage-card :deep(.t-card__footer) {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--td-border-level-1-color);
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

.printer-management-table :deep(.t-table),
.printer-management-table :deep(.t-table__content) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.printer-management-table :deep(.t-table__content) {
  overflow-x: auto;
  overflow-y: auto;
}

.printer-management-table :deep(.t-table__content > table) {
  width: 100%;
  min-width: 1100px;
}

.printer-management-table :deep(.t-table__header tr),
.printer-management-table :deep(.t-table__body tr) {
  height: 3.5rem;
}

.printer-management-table :deep(th),
.printer-management-table :deep(td) {
  color: var(--td-text-color-primary);
  font-size: 0.8125rem;
  text-align: center;
}

.printer-management-table :deep(.t-table__header th) {
  color: var(--td-text-color-secondary);
  font-weight: 500;
  background: var(--td-bg-color-secondarycontainer);
}

.printer-management-table__row :deep(td) {
  cursor: pointer;
}

.printer-management-primary,
.printer-management-name,
.printer-management-task,
.printer-management-material,
.printer-management-actions {
  display: flex;
  align-items: center;
}

.printer-management-primary,
.printer-management-material {
  flex-direction: column;
  gap: 0.25rem;
}

.printer-management-name {
  max-width: 100%;
  gap: 0.35rem;
  font-weight: 600;
}

.printer-management-muted,
.printer-table-secondary {
  color: var(--td-text-color-placeholder);
  font-size: 0.75rem;
}

.printer-management-uppercase {
  text-transform: uppercase;
}

.printer-management-status-dot,
.printer-management-status-pill__dot {
  flex: 0 0 auto;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
}

.printer-management-status-dot--printing,
.printer-management-status-pill--printing .printer-management-status-pill__dot {
  background: var(--td-brand-color-6);
}

.printer-management-status-dot--idle,
.printer-management-status-pill--idle .printer-management-status-pill__dot {
  background: var(--td-success-color-6);
}

.printer-management-status-dot--paused,
.printer-management-status-pill--paused .printer-management-status-pill__dot {
  background: var(--td-warning-color-6);
}

.printer-management-status-dot--attention,
.printer-management-status-pill--attention .printer-management-status-pill__dot {
  background: var(--td-error-color-6);
}

.printer-management-status-dot--offline,
.printer-management-status-pill--offline .printer-management-status-pill__dot {
  background: var(--td-text-color-placeholder);
}

.printer-management-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  white-space: nowrap;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: var(--td-radius-small);
}

.printer-management-status-pill--printing { color: var(--td-brand-color-6); }
.printer-management-status-pill--idle { color: var(--td-success-color-6); }
.printer-management-status-pill--paused { color: var(--td-warning-color-6); }
.printer-management-status-pill--attention { color: var(--td-error-color-6); }
.printer-management-status-pill--offline { color: var(--td-text-color-secondary); }

.printer-management-task {
  min-width: 0;
  justify-content: center;
  gap: 0.5rem;
  text-align: left;
}

.printer-management-task__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  color: var(--td-text-color-placeholder);
  background: var(--td-bg-color-secondarycontainer);
  border-radius: var(--td-radius-small);
}

.printer-management-task__icon--active {
  color: var(--td-brand-color-6);
  background: var(--td-brand-color-1);
}

.printer-management-task__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.printer-management-task__name {
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.printer-management-progress {
  min-width: 7rem;
}

.printer-management-progress__labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
  color: var(--td-text-color-secondary);
  font-size: 0.6875rem;
}

.printer-management-progress__labels strong {
  color: var(--td-text-color-primary);
  font-weight: 500;
}

.printer-management-material__tag {
  padding: 0.15rem 0.35rem;
  color: var(--td-text-color-secondary);
  font-size: 0.6875rem;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: var(--td-radius-small);
}

.printer-management-material__tag--abs,
.printer-management-material__tag--pla {
  color: var(--td-success-color-7);
  background: var(--td-success-color-1);
}

.printer-management-actions {
  justify-content: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.printer-management-table-footer {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: 1rem;
  min-width: 0;
  overflow: visible;
}

.printer-management-table-summary {
  flex: 0 0 auto;
  color: var(--td-text-color-secondary);
  font-size: 0.8125rem;
  white-space: nowrap;
}

.printer-management-table-summary strong {
  color: var(--td-text-color-primary);
}

.printer-management-table-footer :deep(.t-pagination) {
  width: max-content;
  min-width: max-content;
  justify-self: end;
}

.printer-grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 0.75rem;
  padding: 0.75rem;
  overflow: auto;
}

.printer-grid-card {
  display: flex;
  min-height: 12rem;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.printer-grid-card:hover {
  border-color: var(--td-brand-color-4);
  box-shadow: var(--td-shadow-1);
}

.printer-grid-card__header,
.printer-grid-card__progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.printer-grid-card__body {
  display: grid;
  gap: 0.45rem;
  color: var(--td-text-color-secondary);
  font-size: 0.8125rem;
}

.printer-grid-card__progress {
  flex-wrap: wrap;
  margin-top: auto;
  color: var(--td-text-color-secondary);
  font-size: 0.75rem;
}

.printer-grid-card__progress :deep(.t-progress) {
  width: 100%;
}

.printer-grid-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
}

.printer-filter-bar { display: none; }

.printer-manage-card :deep(.t-table__empty) {
  min-height: 12rem;
}

@media (max-width: 768px) {
  .printer-management-toolbar-card__top {
    align-items: stretch;
    flex-direction: column;
  }

  .printer-management-toolbar-card__controls {
    align-items: center;
    justify-content: space-between;
  }

  .printer-management-filter__search {
    width: 100%;
    flex: 1 1 auto;
  }

  .printer-management-view-toggle {
    justify-content: flex-end;
  }

  .printer-management-table-footer {
    align-items: center;
    flex-direction: row;
  }
}
</style>
