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
      :action-loading="detailActionLoading"
      :show-analytics="true"
      @analytics-open="handleAnalyticsOpen"
      @action="handlePrinterAction"
      @emergency-stop="handleEmergencyStop"
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
        <t-button v-if="isAdmin && selectedPrinterRows.length > 0" :theme="batchMonitorTarget ? 'success' : 'warning'" variant="outline"
          :disabled="monitorActionLoading" :loading="monitorActionLoading"
          @click="handleBatchMonitorToggle">
          {{ batchMonitorTarget ? '启用监控' : '停用监控' }} ({{ selectedPrinterRows.length }})
        </t-button>
        <t-button size="medium" theme="default" variant="base" :icon="renderIcon(Refresh)" :loading="loading" @click="fetchData">
          刷新
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
          size="medium"
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
            borderless
            clearable
            placeholder="搜索机器名称"
            size="medium"
            @input="scheduleKeywordSearch"
            @enter="applyFilters"
            @clear="applyFilters"
          >
            <template #prefixIcon><search /></template>
          </t-input>
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
          :selected-row-keys="selectedPrinterIds"
          table-content-width="1180px"
          height="100%"
          style="width: 100%"
          class="printer-management-table printer-table"
          hover
          @row-click="handleRowClick"
          @selection-change="handlePrinterSelectionChange"
          row-class-name="printer-table-row"
        >
        <TdTableColumn v-if="isAdmin" type="selection" width="52" align="center" fixed="left" />

        <TdTableColumn prop="name" label="机器名称" min-width="150">
          <template #default="scope">
            <div class="printer-management-primary">
              <div class="printer-management-name">
                <span class="printer-management-status-dot" :class="`printer-management-status-dot--${getStatusClass(scope.row.effectiveStatus)}`" />
                <span class="printer-management-ellipsis" :title="scope.row.name">{{ scope.row.name }}</span>
              </div>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="machineNumber" label="机器编号" width="168" align="center">
          <template #default="scope">
            <div
              v-if="isAdmin && editingMachineNumberId === scope.row.id"
              class="printer-machine-number-editor"
              @click.stop
            >
              <t-input
                v-model="machineNumberDraft"
                size="small"
                maxlength="50"
                autofocus
                placeholder="自定义编号"
                :disabled="machineNumberSavingId === scope.row.id"
                @enter="saveMachineNumber(scope.row)"
              />
              <t-button
                theme="primary"
                variant="text"
                shape="square"
                size="small"
                aria-label="保存机器编号"
                :loading="machineNumberSavingId === scope.row.id"
                @click.stop="saveMachineNumber(scope.row)"
              >
                <check />
              </t-button>
              <t-button
                theme="default"
                variant="text"
                shape="square"
                size="small"
                aria-label="取消编辑机器编号"
                :disabled="machineNumberSavingId === scope.row.id"
                @click.stop="cancelMachineNumberEdit"
              >
                <close />
              </t-button>
            </div>
            <button
              v-else-if="isAdmin"
              type="button"
              class="printer-machine-number-value"
              title="点击编辑机器编号"
              @click.stop="startMachineNumberEdit(scope.row)"
            >
              <span class="font-mono text-sm">{{ scope.row.machineNumber || '-' }}</span>
              <edit class="printer-machine-number-value__edit" />
            </button>
            <span v-else class="font-mono text-sm">{{ scope.row.machineNumber || '-' }}</span>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="ipAddress" label="IP 地址" width="160">
          <template #default="scope">
            <t-tag size="small" variant="light-outline" theme="default">{{ scope.row.ipAddress }}</t-tag>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="status" label="当前状态" width="120" align="center">
          <template #default="scope">
            <div class="printer-management-state">
              <StatusTag domain="printer" :status="scope.row.effectiveStatus" />
              <span v-if="showLastKnownStatus(scope.row)" class="printer-management-muted">
                最后：{{ getStatusLabel(scope.row.lastKnownStatus) }}
              </span>
            </div>
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
          <template #default="scope">{{ getFirmwareLabel(scope.row.firmwareType) }}</template>
        </TdTableColumn>

        <TdTableColumn label="当前任务" width="220" align="center">
          <template #default="scope">
            <div class="printer-management-task">
              <span class="printer-management-task__icon" :class="{ 'printer-management-task__icon--active': hasObservedTask(scope.row) }">
                <printer size="13" />
              </span>
              <div class="printer-management-task__content">
                <div v-if="hasObservedTask(scope.row)" class="printer-management-task__heading">
                  <span class="printer-management-task__name" :title="getObservedTaskName(scope.row)">
                    {{ getObservedTaskName(scope.row) }}
                  </span>
                  <t-tag v-if="isExternalTask(scope.row)" size="small" theme="warning" variant="light">外部任务</t-tag>
                  <t-tag v-else-if="isUnknownTask(scope.row)" size="small" theme="default" variant="light">来源待确认</t-tag>
                </div>
                <span v-else class="printer-management-muted">无活动任务</span>
                <span v-if="isExternalTask(scope.row) && scope.row.currentJobId" class="printer-management-muted">
                  平台任务 #{{ scope.row.currentJobId }} 仍待启动
                </span>
                <span v-else-if="isUnknownTask(scope.row) && scope.row.currentJobId" class="printer-management-muted">
                  未关联平台任务 #{{ scope.row.currentJobId }}
                </span>
                <span v-else-if="scope.row.currentJobId" class="printer-management-muted">平台任务 #{{ scope.row.currentJobId }}</span>
                <t-progress v-if="hasObservedTask(scope.row) && scope.row.progress !== undefined" :percentage="getProgress(scope.row)" :label="false" :stroke-width="4" :status="getProgressStatus(scope.row)" />
              </div>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn label="操作" width="280" align="center" fixed="right">
          <template #default="scope">
            <div class="flex items-center justify-center gap-1">
              <!-- 确认热床已清理按钮 -->
              <t-button
                v-if="shouldShowSafeButton(scope.row)"
                size="small" theme="warning"
                @click.stop="handleConfirmSafe(scope.row)"
                :loading="confirmingSafeIds.includes(scope.row.id)"
              >
                <span><check /></span>
                确认清理
              </t-button>
              <!-- 启动打印按钮 -->
              <t-button
                v-if="shouldShowStartButton(scope.row)"
                size="small" theme="success"
                @click.stop="handleStartJob(scope.row)"
                :loading="startingJobIds.includes(scope.row.id)"
              >
                <span><printer /></span>
                启动打印
              </t-button>
              <!-- 编辑按钮 -->
              <t-button v-if="isAdmin" size="small" theme="primary" @click.stop="handleEdit(scope.row)">
                <span><edit /></span>
                编辑
              </t-button>
              <!-- 删除按钮 -->
              <t-popconfirm v-if="isAdmin" :content="getDeleteMessage(scope.row)"
                theme="danger"
                @click.stop
                @confirm="handleDelete(scope.row.id)"
              >
                <template #default>
                  <t-button size="small" theme="danger" variant="outline" aria-label="删除打印机" :loading="deletingIds.includes(scope.row.id)" @click.stop>
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
            @change="handlePaginationChange"
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

        <t-form-item label="机器编号" name="machineNumber" help="仅支持字母、数字、下划线和短横线，最多 50 位">
          <t-input v-model="form.machineNumber" maxlength="50" placeholder="例：A-01（可选）" />
        </t-form-item>

        <t-form-item label="IP 地址" name="ipAddress">
          <t-input v-model="form.ipAddress" placeholder="例：192.168.1.10">
            <template #prefixIcon>
              <span><link /></span>
            </template>
          </t-input>
        </t-form-item>

        <t-form-item label="设备协议" name="firmwareType">
          <t-radio-group v-model="form.firmwareType" variant="default-filled" size="medium" class="printer-firmware-options">
            <t-radio-button value="RRF">RRF</t-radio-button>
            <t-radio-button value="KLIPPER">Klipper</t-radio-button>
          </t-radio-group>
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

    <!-- 局域网设备扫描抽屉 -->
    <t-drawer
      v-model:visible="scanDialogVisible"
      class="printer-scan-drawer"
      header="扫描局域网设备"
      size="660px"
      :close-btn="!isScanning && !isBatchAdding"
      destroy-on-close
    >
      <div class="printer-scan-drawer__content">
        <div class="printer-scan-subnet-section">
          <div class="printer-scan-subnet-heading">
            <span class="printer-scan-subnet-title">扫描网段</span>
            <t-tag
              class="printer-scan-subnet-range"
              size="small"
              theme="default"
              variant="light"
              :aria-label="scanSubnetRangeLabel"
              :title="scanSubnetRangeLabel"
            >
              {{ scanSubnetRangeLabel }}
            </t-tag>
          </div>
          <div class="printer-scan-subnet-control">
            <div class="printer-scan-subnet-segments" role="group" aria-label="扫描网段前三段">
              <template v-for="(segment, index) in subnetSegments" :key="`subnet-segment-${index}`">
                <t-input
                  v-model="subnetSegments[index]"
                  class="printer-scan-subnet-segment"
                  size="medium"
                  inputmode="numeric"
                  maxlength="3"
                  autocomplete="off"
                  :aria-label="`网段第${index + 1}段`"
                  :disabled="isScanning || isBatchAdding"
                  @input="value => handleSubnetSegmentInput(index, value)"
                  @enter="handleScan"
                />
                <span v-if="index < subnetSegments.length - 1" class="printer-scan-subnet-separator" aria-hidden="true">.</span>
              </template>
            </div>
            <t-button
              class="printer-scan-subnet-button"
              size="medium"
              theme="primary"
              :loading="isScanning"
              :disabled="isScanning || isBatchAdding"
              @click="handleScan"
            >
              <span><search /></span>
              {{ isScanning ? '扫描中...' : '开始扫描' }}
            </t-button>
          </div>
          <p
            v-if="!subnetIsValid"
            class="printer-scan-subnet-hint printer-scan-subnet-hint--error"
            role="alert"
            aria-live="polite"
          >
            {{ subnetValidationMessage }}
          </p>
        </div>

        <t-divider class="printer-scan-drawer__divider" />

        <div class="printer-scan-drawer__result-region">
          <div v-if="isScanning" class="printer-scan-drawer__state" role="status" aria-live="polite">
            <t-loading text="正在扫描局域网设备，请稍候..." />
          </div>
          <t-alert v-else-if="scanError" theme="error" :close-btn="false">
            <template #default>{{ scanError }}</template>
            <template #operation>
              <t-button size="small" variant="outline" @click="handleScan">重试</t-button>
            </template>
          </t-alert>
          <t-empty v-else-if="hasScanned && !scanResults.length" class="printer-scan-drawer__empty" description="该网段未发现设备">
            <template #description>
              <p>该网段未发现设备</p>
              <p class="mt-2 text-sm text-gray-400">请检查网段是否正确或设备是否在线</p>
            </template>
          </t-empty>
          <div v-else-if="scanResults.length" class="printer-scan-drawer__results">
            <t-alert :title="scanStatsText" theme="info" :close-btn="false" />
            <div class="printer-scan-drawer__selection-bar">
              <t-checkbox
                :checked="allScanSelected"
                :indeterminate="scanSelectionIndeterminate"
                :disabled="isBatchAdding"
                @change="handleScanSelectAll"
              >
                全选
              </t-checkbox>
              <span aria-live="polite">已选择 {{ selectedDevices.length }} 台</span>
            </div>
            <div class="printer-scan-drawer__list" aria-label="扫描结果">
              <article v-for="device in scanResults" :key="device.scanKey" class="printer-scan-card">
                <div class="printer-scan-card__primary">
                  <t-checkbox
                    :checked="isScanDeviceSelected(device)"
                    :disabled="isBatchAdding"
                    :aria-label="`选择 ${device.suggestedName || device.ipAddress || '设备'}`"
                    @click.stop
                    @change="checked => toggleScanDevice(device, checked)"
                  />
                  <t-tooltip :content="device.suggestedName || '未命名设备'">
                    <t-input
                      v-model="device.suggestedName"
                      class="printer-scan-card__name"
                      size="small"
                      borderless
                      :disabled="isBatchAdding"
                      placeholder="请输入设备名称"
                      @click.stop
                    />
                  </t-tooltip>
                  <t-tag :theme="getDiscoveryStatus(device).theme" variant="light" size="small">
                    {{ getDiscoveryStatus(device).label }}
                  </t-tag>
                  <t-tag
                    v-if="device.batchResult?.success"
                    theme="success"
                    variant="light"
                    size="small"
                  >
                    导入成功
                  </t-tag>
                </div>
                <div class="printer-scan-card__meta">
                  <t-tooltip :content="device.ipAddress || '-'">
                    <span>IP {{ device.ipAddress || '-' }}</span>
                  </t-tooltip>
                  <span>协议 {{ getFirmwareLabel(device.firmwareType) }}</span>
                  <t-tooltip :content="device.macAddress || '-'">
                    <span>MAC {{ device.macAddress || '-' }}</span>
                  </t-tooltip>
                </div>
                <t-alert
                  v-if="device.batchResult && !device.batchResult.success"
                  class="printer-scan-card__failure"
                  theme="error"
                  title="导入失败"
                  :close-btn="false"
                >
                  <t-tooltip :content="device.batchResult.reason">
                    <span class="printer-scan-card__failure-reason">{{ device.batchResult.reason }}</span>
                  </t-tooltip>
                </t-alert>
              </article>
            </div>
          </div>
          <t-empty v-else class="printer-scan-drawer__empty" description="输入网段后开始扫描" />
        </div>
      </div>

      <template #footer>
        <div class="printer-scan-drawer__footer">
          <t-button :disabled="isScanning || isBatchAdding" @click="scanDialogVisible = false">关闭</t-button>
          <t-button
            theme="success"
            :disabled="selectedDevices.length === 0 || isScanning || isBatchAdding"
            :loading="isBatchAdding"
            @click="handleBatchAdd"
          >
            <span><folder-add /></span>
            批量导入/同步 ({{ selectedDevices.length }})
          </t-button>
        </div>
      </template>
    </t-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
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
  CloseIcon as Close,
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
  confirmSafe,
  getPrinterStatusHistory,
  getPrinterStatistics,
  getPrinterMonitor,
  updatePrinterMonitor,
  updatePrinterMonitorBatch,
  pausePrinter,
  resumePrinter,
  cancelPrinter,
  emergencyStopPrinter
} from '@/api/printer'
import { startJob } from '@/api/job'
import { message, confirmMessage } from '@/utils/message'
import { renderIcon } from '@/utils/tdesign'
import { useUserStore } from '@/stores/user'
import { useDeviceStore } from '@/stores/printer/deviceStore'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'
import { PRINTER_STATUS, PRINTER_STATUS_MAP } from '@/utils/constants'
import {
  normalizePrinterStatus,
  resolveEffectivePrinterStatus,
  resolveLastKnownPrinterStatus
} from '@/utils/dataAdapters'
import { formatDateTime } from '@/utils/formatters'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard'
import {
  applyBatchUpsertResult,
  createScanDeviceKey,
  getDiscoveryStats,
  getDiscoveryStatus
} from '@/utils/printerDiscovery'
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
let keywordDebounceTimer = null
const printerListRequestGuard = createLatestRequestGuard()
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
const detailActionLoading = ref(false)
const editingMachineNumberId = ref(null)
const machineNumberDraft = ref('')
const machineNumberSavingId = ref(null)

// ===== 表单与弹窗状态 =====
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)

const defaultForm = {
  id: null,
  name: '',
  machineNumber: '',
  ipAddress: '',
  firmwareType: 'KLIPPER',
  currentMaterial: 'ABS',
  nozzleSize: 1.2
}
const form = reactive({ ...defaultForm })

const rules = {
  name: [{ required: true, message: '请输入机器名称', trigger: 'blur' }],
  machineNumber: [
    { max: 50, message: '机器编号最多 50 位', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_-]*$/, message: '机器编号仅支持字母、数字、下划线和短横线', trigger: 'blur' }
  ],
  ipAddress: [{ required: true, message: '请输入IP地址', trigger: 'blur' }]
}

// ===== 扫描状态 =====
const scanDialogVisible = ref(false)
const subnetSegments = ref(['192', '168', '0'])
const isScanning = ref(false)
const hasScanned = ref(false)
const scanResults = ref([])
const scanError = ref('')
const isBatchAdding = ref(false)
const selectedScanKeys = ref([])

const isValidSubnetSegment = segment => {
  const value = String(segment ?? '')
  return /^\d{1,3}$/.test(value) && Number(value) >= 0 && Number(value) <= 255
}

const invalidSubnetSegmentIndex = computed(() => subnetSegments.value.findIndex(segment => !isValidSubnetSegment(segment)))
const subnetIsValid = computed(() => invalidSubnetSegmentIndex.value === -1)
const subnetValidationMessage = computed(() => invalidSubnetSegmentIndex.value === -1
  ? ''
  : `第${invalidSubnetSegmentIndex.value + 1}段请输入 0–255 的整数`)
const scanSubnetRangeLabel = computed(() => subnetIsValid.value
  ? `范围 ${subnetSegments.value.join('.')}.1 – ${subnetSegments.value.join('.')}.254`
  : '范围待校验')

// ===== 现场操作状态 =====
const confirmingSafeIds = ref([])
const startingJobIds = ref([])
const deletingIds = ref([])

const displayTableData = computed(() => tableData.value.map(printer => {
  const realtime = statusMap.value.get(String(printer.id))
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
    'farmJobId',
    'filename',
    'observedFilename',
    'taskSource',
    'taskMatchReason',
    'progress'
  ]
  if (realtime) {
    healthFields.forEach(field => {
      if (realtime[field] !== undefined) merged[field] = realtime[field]
    })
    const realtimeState = realtime.businessStatus || realtime.unifiedState || realtime.state
    if (realtimeState) merged.businessStatus = normalizePrinterStatus(realtimeState)
  }
  merged.effectiveStatus = resolveEffectivePrinterStatus(merged)
  merged.lastKnownStatus = resolveLastKnownPrinterStatus(merged) || merged.lastKnownStatus
  return merged
}))

const selectedPrinterRows = computed(() => {
  const selectedIds = new Set(selectedPrinterIds.value.map(id => String(id)))
  return displayTableData.value.filter(printer => selectedIds.has(String(printer.id)))
})

const selectedVisiblePrinterIds = computed(() => selectedPrinterRows.value.map(printer => printer.id))

const selectedDevices = computed(() => {
  const selectedKeys = new Set(selectedScanKeys.value)
  return scanResults.value.filter(device => selectedKeys.has(device.scanKey))
})

const scanDeviceKeys = computed(() => scanResults.value.map(device => device.scanKey))
const allScanSelected = computed(() => (
  scanDeviceKeys.value.length > 0 && selectedDevices.value.length === scanDeviceKeys.value.length
))
const scanSelectionIndeterminate = computed(() => (
  selectedDevices.value.length > 0 && !allScanSelected.value
))

// 混合选择时统一执行启用，全部已启用时执行停用。
const batchMonitorTarget = computed(() => (
  selectedPrinterRows.value.length > 0
    ? !selectedPrinterRows.value.every(printer => printer.monitorEnabled === true)
    : true
))

const monitorActionLoading = computed(() => (
  monitorBatchLoading.value || selectedVisiblePrinterIds.value.some(id => monitorUpdatingIds.value.includes(id))
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

const getFirmwareLabel = firmwareType => String(firmwareType || '').toUpperCase() === 'KLIPPER'
  ? 'Klipper'
  : String(firmwareType || '').toUpperCase() === 'RRF' ? 'RRF' : '-'

// 扫描统计文案
const scanStatsText = computed(() => {
  const stats = getDiscoveryStats(scanResults.value)
  return `共扫描到 ${stats.total} 台设备：${stats.newCount} 台新设备，${stats.existingCount} 台已知设备，${stats.unknownCount} 台未知 MAC`
})

// 获取状态标签类型
const getStatusLabel = (status) => {
  return PRINTER_STATUS_MAP[String(status || '').toUpperCase()]?.label || '未知'
}

const getStatusClass = status => String(status || 'UNKNOWN').toLowerCase()
const showLastKnownStatus = printer => (
  [PRINTER_STATUS.OFFLINE, PRINTER_STATUS.UNKNOWN].includes(printer?.effectiveStatus)
  && !!resolveLastKnownPrinterStatus(printer)
)

const getProgress = printer => {
  const progress = Number(printer.progress)
  if (!Number.isFinite(progress)) return 0
  return Math.min(100, Math.max(0, Math.round(progress)))
}

const getProgressStatus = printer => {
  if (String(printer.effectiveStatus || printer.status || '').toUpperCase() === PRINTER_STATUS.ERROR) return 'error'
  if (getProgress(printer) >= 100) return 'success'
  return 'active'
}

const getTaskSource = printer => String(printer?.taskSource || '').toUpperCase()
const isExternalTask = printer => getTaskSource(printer) === 'EXTERNAL'
const isUnknownTask = printer => getTaskSource(printer) === 'UNKNOWN'
const hasObservedTask = printer => (
  isExternalTask(printer)
  || isUnknownTask(printer)
  || Boolean(printer?.currentJobId)
)
const getObservedTaskName = printer => {
  if (isExternalTask(printer) || isUnknownTask(printer)) {
    return printer?.observedFilename || printer?.filename || '设备端打印文件'
  }
  return printer?.currentJobFileName || `任务 #${printer?.currentJobId}`
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
    if (!printer.currentJobId) {
      message.error('当前打印机没有可确认的绑定任务')
      return
    }
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
    await confirmSafe(printer.currentJobId, printer.id)
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

const clearPrinterSelection = () => {
  selectedPrinterIds.value = []
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
}

const MACHINE_NUMBER_PATTERN = /^[A-Za-z0-9_-]*$/

const startMachineNumberEdit = printer => {
  if (!isAdmin.value || machineNumberSavingId.value) return
  editingMachineNumberId.value = printer.id
  machineNumberDraft.value = printer.machineNumber || ''
}

const cancelMachineNumberEdit = () => {
  if (machineNumberSavingId.value) return
  editingMachineNumberId.value = null
  machineNumberDraft.value = ''
}

const saveMachineNumber = async printer => {
  if (!isAdmin.value || machineNumberSavingId.value === printer.id) return

  const machineNumber = machineNumberDraft.value.trim()
  if (machineNumber.length > 50) {
    message.warning('机器编号最多 50 位')
    return
  }
  if (!MACHINE_NUMBER_PATTERN.test(machineNumber)) {
    message.warning('机器编号仅支持字母、数字、下划线和短横线')
    return
  }
  if (machineNumber === String(printer.machineNumber || '')) {
    cancelMachineNumberEdit()
    return
  }

  machineNumberSavingId.value = printer.id
  try {
    await updatePrinter({
      id: printer.id,
      name: printer.name,
      machineNumber: machineNumber || null,
      ipAddress: printer.ipAddress,
      firmwareType: printer.firmwareType,
      currentMaterial: printer.currentMaterial,
      nozzleSize: printer.nozzleSize
    })
    printer.machineNumber = machineNumber || null
    if (String(selectedDevice.value?.id) === String(printer.id)) {
      selectedDevice.value = { ...selectedDevice.value, machineNumber: machineNumber || null }
    }
    message.success('机器编号已更新')
    editingMachineNumberId.value = null
    machineNumberDraft.value = ''
  } catch (error) {
    if (!error?.toastShown) message.error(error?.message || '机器编号更新失败')
  } finally {
    machineNumberSavingId.value = null
  }
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
    clearPrinterSelection()
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

const handleBatchMonitorToggle = () => updateMonitorForIds([...selectedVisiblePrinterIds.value], batchMonitorTarget.value)

const handleDetailMonitorChange = enabled => {
  const printer = selectedDevice.value
  if (printer) return updateMonitorForIds([printer.id], enabled, printer)
}

const refreshSelectedPrinter = async printerId => {
  await Promise.all([
    fetchData(),
    loadPrinterDetail(printerId)
  ])
}

const handlePrinterAction = async (action, printer) => {
  if (!printer?.id || detailActionLoading.value) return

  const actionConfig = {
    pause: { label: '暂停打印', request: pausePrinter, type: 'warning' },
    resume: { label: '恢复打印', request: resumePrinter, type: 'warning' },
    cancel: { label: '取消任务', request: cancelPrinter, type: 'danger' }
  }[action]
  if (!actionConfig) return

  try {
    await confirmMessage(
      `确定要对 ${printer.machineNumber || printer.name} 执行“${actionConfig.label}”吗？`,
      '操作确认',
      {
        confirmButtonText: actionConfig.label,
        cancelButtonText: '返回',
        type: actionConfig.type
      }
    )
    detailActionLoading.value = true
    await actionConfig.request(printer.id)
    await refreshSelectedPrinter(printer.id)
    message.success(`${actionConfig.label}成功`)
  } catch (error) {
    if (error !== 'cancel' && !error?.toastShown) {
      message.error(error?.message || `${actionConfig.label}失败`)
    }
  } finally {
    detailActionLoading.value = false
  }
}

const handleEmergencyStop = async printer => {
  if (!printer?.id || detailActionLoading.value) return

  try {
    await confirmMessage(
      `紧急停机会立即停止 ${printer.machineNumber || printer.name}，确定继续吗？`,
      '紧急停机确认',
      { confirmButtonText: '确认急停', cancelButtonText: '返回', type: 'danger' }
    )
    detailActionLoading.value = true
    await emergencyStopPrinter(printer.id)
    await refreshSelectedPrinter(printer.id)
    message.success('紧急停机成功')
  } catch (error) {
    if (error !== 'cancel' && !error?.toastShown) {
      message.error(error?.message || '紧急停机失败')
    }
  } finally {
    detailActionLoading.value = false
  }
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

const handleAnalyticsOpen = () => {
  if (selectedDevice.value?.id) loadPrinterAnalytics(selectedDevice.value.id)
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
  detailActionLoading.value = false
}

const restorePrinterDetailContext = () => {
  const printerId = sessionStorage.getItem(PRINTER_DETAIL_CONTEXT_KEY)
  if (!printerId || selectedDevice.value) return

  const printer = tableData.value.find(item => String(item.id) === printerId)
  if (printer) handleRowClick(printer)
}

// 加载分页数据
const fetchData = async () => {
  const requestId = printerListRequestGuard.begin()
  if (requestId === null) return
  clearPrinterSelection()
  loading.value = true
  loadError.value = ''
  try {
    const res = await getPrinterList({
      ...queryParams,
      ...(activeStatusFilterKey.value ? { status: activeStatusFilterKey.value } : {}),
      ...(keyword.value.trim() ? { name: keyword.value.trim() } : {})
    })
    if (!printerListRequestGuard.isCurrent(requestId)) return
    tableData.value = res.data?.records || []
    total.value = res.data?.total || 0
    restorePrinterDetailContext()
  } catch (error) {
    if (!printerListRequestGuard.isCurrent(requestId)) return
    loadError.value = error?.message || '打印机列表加载失败，请重试'
  } finally {
    if (printerListRequestGuard.isCurrent(requestId)) loading.value = false
  }
}

const clearKeywordDebounce = () => {
  if (keywordDebounceTimer) {
    clearTimeout(keywordDebounceTimer)
    keywordDebounceTimer = null
  }
}

const applyFilters = () => {
  clearKeywordDebounce()
  clearPrinterSelection()
  queryParams.pageNum = 1
  const query = { ...route.query }
  if (statusFilter.value) query.status = statusFilter.value
  else delete query.status
  router.replace({ path: route.path, query })
  if (statusFilter.value === activeStatusFilterKey.value) fetchData()
}

const scheduleKeywordSearch = () => {
  clearKeywordDebounce()
  keywordDebounceTimer = setTimeout(() => {
    keywordDebounceTimer = null
    applyFilters()
  }, 300)
}

const applyStatusTab = value => {
  statusFilter.value = value || ''
  applyFilters()
}

const clearStatusFilter = () => {
  statusFilter.value = ''
  applyFilters()
}

const handlePaginationChange = () => {
  clearPrinterSelection()
  fetchData()
}

watch(() => route.query.status, value => {
  statusFilter.value = Array.isArray(value) ? value[0] || '' : value || ''
  queryParams.pageNum = 1
  fetchData()
}, { immediate: true })

onUnmounted(() => {
  clearKeywordDebounce()
  printerListRequestGuard.invalidate()
})

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
    machineNumber: row.machineNumber || '',
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
      machineNumber: form.machineNumber.trim() || null,
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
  const currentState = getStatusLabel(printer.effectiveStatus || printer.status)
  return printer.currentJobId
    ? `该设备当前为“${currentState}”，并关联任务 #${printer.currentJobId}。删除可能被服务端拒绝，确定继续吗？`
    : `确定删除设备“${printer.name || printer.ipAddress}”吗？`
}

// ===== 局域网扫描逻辑 =====
const openScanDialog = () => {
  scanResults.value = []
  selectedScanKeys.value = []
  scanError.value = ''
  hasScanned.value = false
  scanDialogVisible.value = true
}

const isScanDeviceSelected = device => selectedScanKeys.value.includes(device.scanKey)

const toggleScanDevice = (device, checked) => {
  const next = new Set(selectedScanKeys.value)
  if (checked) next.add(device.scanKey)
  else next.delete(device.scanKey)
  selectedScanKeys.value = [...next]
}

const handleScanSelectAll = checked => {
  selectedScanKeys.value = checked ? [...scanDeviceKeys.value] : []
}

const handleSubnetSegmentInput = (index, value) => {
  const rawValue = typeof value === 'string' ? value : value?.target?.value ?? ''
  subnetSegments.value[index] = String(rawValue).slice(0, 3)
}

const handleScan = async () => {
  if (isScanning.value || isBatchAdding.value) return
  if (!subnetIsValid.value) {
    message.warning(subnetValidationMessage.value)
    return
  }
  const subnet = `${subnetSegments.value.join('.')}`
  isScanning.value = true
  hasScanned.value = false
  scanError.value = ''
  selectedScanKeys.value = []
  try {
    const res = await scanPrinters(subnet)
    const devices = res?.data ?? res
    scanResults.value = (Array.isArray(devices) ? devices : []).map((device, index) => ({
      ...device,
      suggestedName: device.suggestedName || '',
      scanKey: createScanDeviceKey(device, index),
      batchResult: null
    }))
    hasScanned.value = true
  } catch (error) {
    scanError.value = error?.message || '扫描设备失败，请重试'
    hasScanned.value = true
    scanResults.value = []
  } finally {
    isScanning.value = false
  }
}

const handleBatchAdd = async () => {
  if (selectedDevices.value.length === 0 || isBatchAdding.value || isScanning.value) return

  const submittedDevices = [...selectedDevices.value]
  const devicesToSubmit = submittedDevices.map(device => {
    const payload = {
      ipAddress: device.ipAddress,
      firmwareType: device.firmwareType,
      isNewDevice: device.isNewDevice === true,
      suggestedName: device.suggestedName || ''
    }
    if (device.macAddress !== undefined && device.macAddress !== null && device.macAddress !== '') {
      payload.macAddress = device.macAddress
    }
    if (device.apiKey !== undefined && device.apiKey !== null && device.apiKey !== '') {
      payload.apiKey = device.apiKey
    }
    return payload
  })

  isBatchAdding.value = true
  try {
    const res = await batchAddPrinters(devicesToSubmit)
    const result = res.data || {}
    const resultMessage = res.message || result.message || '批量处理完成'
    const batchOutcome = applyBatchUpsertResult(scanResults.value, submittedDevices, result)
    scanResults.value = batchOutcome.devices
    selectedScanKeys.value = batchOutcome.failedKeys
    const failedCount = Math.max(Number(result.failedCount || 0), batchOutcome.failedKeys.length)
    const hasFailures = failedCount > 0
    if (hasFailures) {
      message.warning(`${resultMessage}：新增 ${result.insertedCount || 0} 台，更新 ${result.updatedCount || 0} 台，失败 ${failedCount} 台`)
      return
    }
    message.success(`${resultMessage}：新增 ${result.insertedCount || 0} 台，更新 ${result.updatedCount || 0} 台`)
    scanDialogVisible.value = false
    await fetchData()
  } catch (error) {
    const errorMsg = error.response?.data?.message || error?.message || '批量处理失败'
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
  min-height: 32px;
  overflow-x: auto;
  scrollbar-width: none;
}

.printer-management-tabs::-webkit-scrollbar {
  display: none;
}

.printer-management-tabs :deep(.t-radio-button) {
  flex: 0 0 auto;
  min-width: 64px;
  height: 32px;
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

.printer-management-filter__search :deep(.t-input) {
  background: var(--app-surface-muted);
  border-radius: var(--app-radius);
}

.printer-management-filter__search :deep(.t-input:hover) {
  background: var(--app-surface-hover);
}

.printer-management-filter__search :deep(.t-input.t-input--focused) {
  box-shadow: 0 0 0 2px var(--app-primary-light);
}

.printer-firmware-options {
  width: 100%;
}

.printer-firmware-options :deep(.t-radio-button) {
  flex: 1 1 0;
  justify-content: center;
}

.printer-machine-number-editor,
.printer-machine-number-value {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
}

.printer-machine-number-editor {
  width: 100%;
  gap: 2px;
}

.printer-machine-number-editor :deep(.t-input__wrap) {
  min-width: 0;
  flex: 1 1 auto;
}

.printer-machine-number-editor :deep(.t-input) {
  padding-right: var(--app-spacing-2);
  padding-left: var(--app-spacing-2);
  font-family: var(--td-font-family-mono, ui-monospace, SFMono-Regular, Consolas, monospace);
}

.printer-machine-number-value {
  max-width: 100%;
  padding: 3px var(--app-spacing-1);
  gap: var(--app-spacing-1);
  color: var(--app-text-primary);
  background: transparent;
  border: 0;
  border-radius: var(--app-radius-small);
  cursor: pointer;
}

.printer-machine-number-value:hover,
.printer-machine-number-value:focus-visible {
  color: var(--app-primary);
  background: var(--app-primary-light);
  outline: none;
}

.printer-machine-number-value__edit {
  width: 14px;
  height: 14px;
  color: currentColor;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.printer-machine-number-value:hover .printer-machine-number-value__edit,
.printer-machine-number-value:focus-visible .printer-machine-number-value__edit {
  opacity: 1;
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
  height: 46px;
}

.printer-management-table :deep(th),
.printer-management-table :deep(td) {
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-small);
  vertical-align: middle;
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
.printer-management-state,
.printer-management-recent {
  align-items: center;
  flex-direction: column;
  gap: var(--app-spacing-1);
}

.printer-management-state {
  display: flex;
  min-width: 0;
  justify-content: center;
  line-height: 1.2;
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

.printer-management-task__heading {
  display: flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: var(--app-spacing-1);
}

.printer-management-task__heading .printer-management-task__name {
  flex: 1 1 auto;
}

.printer-management-task__heading :deep(.t-tag) {
  flex: 0 0 auto;
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

.printer-scan-drawer :deep(.t-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.printer-scan-drawer__content,
.printer-scan-drawer__results {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: var(--app-spacing-3);
}

.printer-scan-drawer__content {
  height: 100%;
  flex: 1 1 auto;
  overflow: hidden;
}

.printer-scan-subnet-section {
  display: flex;
  min-width: 0;
  width: 100%;
  flex-direction: column;
  gap: var(--app-spacing-2);
}

.printer-scan-subnet-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-spacing-2);
}

.printer-scan-subnet-title {
  flex: 0 0 auto;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-medium);
  font-weight: 600;
  line-height: var(--td-line-height-body-medium);
}

.printer-scan-subnet-range {
  min-width: 0;
  max-width: min(100%, 360px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.printer-scan-subnet-range :deep(.t-tag__text) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.printer-scan-subnet-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: var(--app-spacing-2);
  min-width: 0;
  width: 100%;
}

.printer-scan-subnet-segments {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-spacing-1);
  min-width: 0;
}

.printer-scan-subnet-segment {
  flex: 0 0 60px;
  width: 60px;
}

.printer-scan-subnet-separator {
  display: inline-flex;
  flex: 0 0 12px;
  width: 12px;
  height: var(--td-comp-size-m);
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-title-medium);
  line-height: 1;
}

.printer-scan-subnet-button {
  flex: 0 0 auto;
  margin-left: auto;
}

.printer-scan-subnet-hint {
  min-width: 0;
  margin: 0;
  color: var(--app-danger);
  font-size: var(--td-font-size-body-small);
  line-height: 1.5;
  text-align: left;
}

.printer-scan-drawer__divider {
  flex: 0 0 auto;
  margin: var(--app-spacing-1) 0;
}

.printer-scan-drawer__result-region {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--app-spacing-3);
  overflow: hidden;
}

.printer-scan-drawer__state {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
}

.printer-scan-drawer__empty {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
}

.printer-scan-drawer__results {
  overflow: hidden;
  flex: 1 1 auto;
}

.printer-scan-drawer__selection-bar,
.printer-scan-drawer__footer,
.printer-scan-card__primary,
.printer-scan-card__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-spacing-2);
}

.printer-scan-card__failure {
  min-width: 0;
  margin-top: var(--app-spacing-2);
}

.printer-scan-card__failure :deep(.t-alert__content),
.printer-scan-card__failure :deep(.t-alert__description) {
  min-width: 0;
  max-width: 100%;
}

.printer-scan-card__failure-reason {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.printer-scan-drawer__selection-bar {
  justify-content: space-between;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.printer-scan-drawer__list {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--app-spacing-2);
  overflow-y: auto;
}

.printer-scan-card {
  min-width: 0;
  padding: var(--app-spacing-2) var(--app-spacing-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-surface);
}

.printer-scan-card__primary {
  min-width: 0;
}

.printer-scan-card__name {
  min-width: 0;
  flex: 1 1 auto;
}

.printer-scan-card__name :deep(.t-input) {
  min-width: 0;
}

.printer-scan-card__meta {
  padding-left: 28px;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-caption);
}

.printer-scan-card__meta > span,
.printer-scan-card__meta :deep(.t-tooltip) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.printer-scan-drawer__footer {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.printer-scan-drawer :deep(.t-drawer__content-wrapper) {
  max-width: 100vw;
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

  .printer-scan-card__meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
}

@media (max-width: 768px) {
  .printer-scan-drawer :deep(.t-drawer__content-wrapper) {
    width: 100vw !important;
  }

  .printer-scan-subnet-segment {
    flex-basis: 60px;
    width: 60px;
  }

  .printer-scan-subnet-button {
    flex: 0 0 auto;
    width: auto;
    max-width: 100%;
    margin-left: auto;
  }

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
