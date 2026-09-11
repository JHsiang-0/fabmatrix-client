<template>
  <div class="app-page-shell app-page-background job-history-page">
    <PageHeader title="打印历史记录">
      <template #actions>
      <div class="app-page-toolbar__actions">
        <t-button :icon="renderIcon(Refresh)" :loading="loading" @click="handleQuery" size="medium">
          刷新
        </t-button>
      </div>
      </template>
    </PageHeader>

    <section class="history-workspace" aria-label="打印历史工作区">
      <!-- 顶部检索区 -->
      <QueryToolbar class="history-filter-toolbar" label="打印历史筛选条件">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-700 whitespace-nowrap">任务状态</span>
            <t-select v-model="queryForm.status" placeholder="请选择状态" clearable style="width: 160px">
              <t-option label="已完成" value="COMPLETED" />
              <t-option label="失败" value="FAILED" />
              <t-option label="已取消" value="CANCELLED" />
            </t-select>
          </div>

          <div v-if="userStore.isAdmin" class="flex items-center gap-2">
            <span class="text-sm text-gray-700 whitespace-nowrap">创建人</span>
            <t-select
              v-model="queryForm.userId"
              placeholder="请选择创建人"
              clearable
              :loading="creatorLoading"
              style="width: 180px"
            >
              <t-option
                v-for="user in creatorOptions"
                :key="String(user.id)"
                :label="`${user.username}（${user.id}）`"
                :value="user.id"
              />
            </t-select>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-700 whitespace-nowrap">文件名</span>
            <t-input v-model="queryForm.fileName" placeholder="请输入文件名" clearable style="width: 180px" />
          </div>

          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-700 whitespace-nowrap">打印机 ID</span>
            <t-input v-model="queryForm.printerId" placeholder="请输入设备 ID" clearable style="width: 140px" />
          </div>

          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-700 whitespace-nowrap">时间范围</span>
            <t-date-range-picker
              v-model="queryForm.dateRange"
              separator="至"
              :placeholder="['开始日期', '结束日期']"
              value-type="YYYY-MM-DD HH:mm:ss"
              style="width: 280px"
              :default-time="['00:00:00', '23:59:59']"
            />
          </div>

          <div class="flex items-center gap-2 ml-auto">
            <t-button theme="primary" @click="handleQuery" :loading="loading">
              <span><search /></span>
              查询
            </t-button>
            <t-button @click="handleReset">
              <span><refresh /></span>
              重置
            </t-button>
          </div>
        </div>
      </QueryToolbar>

      <!-- 数据表格区 -->
      <div class="history-content">
        <AsyncState
          v-if="loading || (loadError && tableData.length === 0)"
          :loading="loading"
          :error="loadError"
          @retry="fetchData"
        />
        <t-empty v-else-if="tableData.length === 0" description="暂无打印历史记录" />
        <t-alert v-if="loadError && tableData.length" theme="error" :close-btn="false" class="history-inline-error mb-3">
          <template #default>{{ loadError }}</template>
          <template #operation>
            <t-button size="small" variant="outline" @click="fetchData">重试</t-button>
          </template>
        </t-alert>
        <div v-if="tableData.length" class="history-table-wrapper">
          <TdTable
            :data="tableData"
            @row-click="openTaskDetail"
            :loading="loading"
            height="100%"
            table-content-width="max-content"
            style="width: 100%"
            class="history-table history-management-table"
            hover
          >
        <TdTableColumn prop="id" label="任务 ID" width="130" align="center">
          <template #default="scope">
            <t-tooltip :content="`#${getHistoryDisplay(scope.row).jobId}`" class="job-display-tooltip">
              <span class="job-display__secondary job-display__ellipsis font-mono">#{{ getHistoryDisplay(scope.row).jobId }}</span>
            </t-tooltip>
          </template>
        </TdTableColumn>

        <TdTableColumn label="文件" min-width="220">
          <template #default="scope">
            <div class="job-display-cell">
              <t-tooltip :content="getHistoryDisplay(scope.row).fileName" class="job-display-tooltip">
                <span class="job-display__primary job-display__ellipsis">{{ getHistoryDisplay(scope.row).fileName }}</span>
              </t-tooltip>
              <span v-if="getHistoryDisplay(scope.row).fileId" class="job-display__secondary job-display__ellipsis">
                文件 ID {{ getHistoryDisplay(scope.row).fileId }}
              </span>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn label="打印设备" min-width="210">
          <template #default="scope">
            <div class="job-display-cell">
              <t-tooltip :content="getHistoryDisplay(scope.row).printerName" class="job-display-tooltip">
                <span class="job-display__primary job-display__ellipsis">{{ getHistoryDisplay(scope.row).printerName }}</span>
              </t-tooltip>
              <t-tooltip :content="getHistoryDisplay(scope.row).machineNumber" class="job-display-tooltip">
                <span class="job-display__secondary job-display__ellipsis">{{ getHistoryDisplay(scope.row).machineNumber }}</span>
              </t-tooltip>
              <span v-if="getHistoryDisplay(scope.row).printerId" class="job-display__secondary job-display__ellipsis">
                打印机 ID {{ getHistoryDisplay(scope.row).printerId }}
              </span>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn label="人员" min-width="190">
          <template #default="scope">
            <div class="job-display-cell">
              <t-tooltip :content="getHistoryDisplay(scope.row).creatorUsername" class="job-display-tooltip">
                <span class="job-display__primary job-display__ellipsis">创建人：{{ getHistoryDisplay(scope.row).creatorUsername }}</span>
              </t-tooltip>
              <t-tooltip :content="getHistoryDisplay(scope.row).operatorUsername" class="job-display-tooltip">
                <span class="job-display__secondary job-display__ellipsis">操作员：{{ getHistoryDisplay(scope.row).operatorUsername }}</span>
              </t-tooltip>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="status" label="状态" width="120" align="center">
          <template #default="scope">
            <StatusTag domain="job" :status="scope.row.status" />
          </template>
        </TdTableColumn>

        <TdTableColumn prop="progress" label="打印进度" width="140" align="center">
          <template #default="scope">
            <t-progress
              v-if="hasValue(scope.row.progress)"
              :percentage="scope.row.progress"
              :status="getProgressStatus(scope.row.status, scope.row.progress)"
              :stroke-width="6"
              :label="true"
            />
            <span v-else>-</span>
          </template>
        </TdTableColumn>

        <TdTableColumn label="创建时间" min-width="160" prop="createdAt" align="center">
          <template #default="scope">
            <div class="flex items-center justify-center gap-2 text-sm text-gray-600">
              <span><clock /></span>
              <span>{{ formatDateTime(scope.row.createdAt) }}</span>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn label="结束时间" min-width="160" prop="completedAt" align="center">
          <template #default="scope">
            <div class="flex items-center justify-center gap-2 text-sm text-gray-600">
              <span><timer /></span>
              <span>{{ scope.row.completedAt ? formatDateTime(scope.row.completedAt) : '-' }}</span>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="errorReason" label="报错原因" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            <t-tooltip v-if="scope.row.errorReason" :content="String(scope.row.errorReason)" class="job-display-tooltip">
              <span class="job-display__error job-display__ellipsis">{{ scope.row.errorReason }}</span>
            </t-tooltip>
            <span v-else class="job-display__secondary">-</span>
          </template>
        </TdTableColumn>

        <TdTableColumn label="操作" width="100" align="center" fixed="right">
          <template #default="scope">
            <t-button size="small" variant="text" @click.stop="openTaskDetail(scope.row)">详情</t-button>
          </template>
        </TdTableColumn>
          </TdTable>
        </div>

        <!-- 底部分页区 -->
        <div class="history-pagination-footer mt-4 flex justify-center px-4">
          <t-pagination
            v-model:current="pagination.pageNum"
            v-model:pageSize="pagination.pageSize"
            :total="pagination.total"
            :show-page-size="false"
            @change="handlePaginationChange"
          />
        </div>
      </div>
    </section>
    <TaskDetailDrawer
      v-model="detailDrawerVisible"
      :task="selectedJob"
      :loading="detailLoading"
      :error="detailErrorText"
      :reconcile-loading="reconcileSubmitting"
      :reconcile-success-key="reconcileSuccessKey"
      :reconcile-stale="reconcileStale"
      @update:model-value="handleTaskDetailVisibility"
      @reconcile="handleReconcile"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import {
  RefreshIcon as Refresh,
  SearchIcon as Search,
  TimeIcon as Clock,
  TaskTimeIcon as Timer
} from 'tdesign-icons-vue-next'
import { getAdminUsers } from '@/api/user'
import { getJobPage, reconcilePrintJob } from '@/api/job'
import { message } from '@/utils/message'
import { formatDateTime } from '@/utils/formatters'
import { renderIcon } from '@/utils/tdesign'
import { getHistoryJobDisplay } from '@/utils/jobDisplay'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import AsyncState from '@/components/AsyncState.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import QueryToolbar from '@/components/layout/QueryToolbar.vue'
import StatusTag from '@/components/StatusTag.vue'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'
import { useJobStore } from '@/stores/jobStore'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'
import { useUserStore } from '@/stores/user'

defineOptions({ name: 'JobHistory' })

const loading = ref(false)
const loadError = ref('')
const creatorLoading = ref(false)
const creatorOptions = ref([])
const userStore = useUserStore()
const jobStore = useJobStore()
const realtimeStore = useRealtimeStore()
const detailLoading = computed(() => jobStore.detailLoading)
const detailErrorText = computed(() => jobStore.detailError?.message || '')
const tableData = ref([])
const detailDrawerVisible = ref(false)
const selectedJob = ref(null)
const reconcileSubmitting = ref(false)
const reconcileSuccessKey = ref(0)
const reconcileStale = ref(false)
const JOB_HISTORY_DETAIL_CONTEXT_KEY = 'farm-ui:job-history-detail'
const getHistoryDisplay = getHistoryJobDisplay
const historyRequestGuard = createLatestRequestGuard()
let historyRefreshScheduled = false

const openTaskDetail = job => {
  selectedJob.value = job
  reconcileStale.value = false
  sessionStorage.setItem(JOB_HISTORY_DETAIL_CONTEXT_KEY, String(job.id))
  detailDrawerVisible.value = true
  jobStore.fetchJobDetail(job.id).then(detail => {
    if (detail && selectedJob.value && String(selectedJob.value.id) === String(job.id)) selectedJob.value = detail
  }).catch(() => {
    // 保留列表中的真实任务数据，详情请求错误由请求层统一提示。
  })
}

const handleTaskDetailVisibility = visible => {
  if (!visible) {
    jobStore.invalidateJobDetailRequest()
    detailDrawerVisible.value = false
    selectedJob.value = null
    reconcileStale.value = false
    sessionStorage.removeItem(JOB_HISTORY_DETAIL_CONTEXT_KEY)
  }
}

const refreshReconcileContext = async job => {
  const refreshResults = await Promise.allSettled([
    jobStore.fetchJobDetail(job.id),
    fetchData({ rethrow: true }),
    jobStore.fetchQueue(),
    jobStore.fetchActive(),
    realtimeStore.refreshPrinterSnapshot()
  ])
  const [detailResult, historyResult, queueResult, activeResult, printerResult] = refreshResults
  const isCurrentJob = selectedJob.value && String(selectedJob.value.id) === String(job.id)

  if (isCurrentJob) {
    if (detailResult.status === 'rejected') {
      reconcileStale.value = true
      message.error('任务详情刷新失败，已保留旧详情并锁定人工核对操作')
    } else if (detailResult.status === 'fulfilled' && detailResult.value) {
      selectedJob.value = detailResult.value
      reconcileStale.value = false
    } else {
      reconcileStale.value = true
      message.error('任务详情刷新失败，已保留旧详情并锁定人工核对操作')
    }
  }
  if (historyResult.status === 'rejected') message.warning('打印历史列表刷新失败，请稍后手动刷新')
  if (queueResult.status === 'rejected') message.warning('待派发任务列表刷新失败，请稍后手动刷新')
  if (activeResult.status === 'rejected') message.warning('活动任务列表刷新失败，请稍后手动刷新')
  if (printerResult.status === 'rejected') message.warning('打印机状态刷新失败，请稍后手动刷新看板')

  return refreshResults
}

const handleReconcile = async payload => {
  const job = selectedJob.value
  if (reconcileSubmitting.value || reconcileStale.value || !job || job.status !== 'RECONCILING') return

  reconcileSubmitting.value = true
  try {
    await reconcilePrintJob(job.id, payload)
    message.success('人工核对已提交')
    await refreshReconcileContext(job)
    if (selectedJob.value && String(selectedJob.value.id) === String(job.id)) reconcileSuccessKey.value += 1
  } catch (error) {
    console.error('人工核对请求失败:', error)
    if (!error?.toastShown) message.error(error?.message || '人工核对失败')
    await refreshReconcileContext(job)
  } finally {
    reconcileSubmitting.value = false
  }
}

const restoreTaskDetailContext = () => {
  const jobId = sessionStorage.getItem(JOB_HISTORY_DETAIL_CONTEXT_KEY)
  if (!jobId || selectedJob.value) return

  const job = tableData.value.find(item => String(item.id) === jobId)
  if (job) openTaskDetail(job)
}

// 查询表单
const queryForm = reactive({
  status: '',
  userId: '',
  fileName: '',
  dateRange: [],
  printerId: '',
})

const HISTORY_STATUSES = Object.freeze(['COMPLETED', 'FAILED', 'CANCELLED'])

// 分页信息
const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

const hasValue = value => value !== undefined && value !== null && value !== ''

// 获取进度条状态
const getProgressStatus = (status, progress) => {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'exception'
  if (status === 'PAUSED' || status === 'CANCELLED') return 'warning'
  if (progress === 100) return 'success'
  return ''
}

// 构建请求参数
const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    timeField: 'COMPLETED_AT'
  }

  if (queryForm.status) {
    params.status = queryForm.status
  } else {
    params.statuses = [...HISTORY_STATUSES]
  }

  if (queryForm.dateRange && queryForm.dateRange.length === 2) {
    params.startTime = toIsoLocalTime(queryForm.dateRange[0])
    params.endTime = toIsoLocalTime(queryForm.dateRange[1])
  }

  if (queryForm.printerId) {
    params.printerId = queryForm.printerId
  }

  if (queryForm.userId) {
    params.userId = queryForm.userId
  }

  if (queryForm.fileName) {
    params.fileName = queryForm.fileName
  }

  return params
}

const toIsoLocalTime = value => String(value || '').replace(' ', 'T')

const loadCreatorOptions = async () => {
  if (!userStore.isAdmin) return
  creatorLoading.value = true
  try {
    const response = await getAdminUsers({ pageNum: 1, pageSize: 100 })
    creatorOptions.value = response.data?.records || []
  } catch {
    // 用户列表仅用于管理员辅助筛选；失败时历史页仍可正常查询。
    creatorOptions.value = []
  } finally {
    creatorLoading.value = false
  }
}

// 查询数据
const handleQuery = async () => {
  pagination.pageNum = 1
  await fetchData()
}

// 重置查询
const handleReset = () => {
  queryForm.status = ''
  queryForm.userId = ''
  queryForm.fileName = ''
  queryForm.dateRange = []
  queryForm.printerId = ''
  pagination.pageNum = 1
  fetchData()
}

// TDesign 分页在页码或每页条数变化时统一返回分页信息。
const handlePaginationChange = ({ current, pageSize }) => {
  pagination.pageNum = current
  pagination.pageSize = pageSize
  fetchData()
}

// 获取数据
const fetchData = async ({ rethrow = false } = {}) => {
  const requestId = historyRequestGuard.begin()
  if (requestId === null) return
  loading.value = true
  loadError.value = ''
  try {
    const params = buildParams()
    const res = await getJobPage(params)
    if (!historyRequestGuard.isCurrent(requestId)) return
    if (res.code === 200) {
      // 成功响应允许 data=null，按空结果处理，不提示接口异常。
      tableData.value = res.data?.records || []
      pagination.total = res.data?.total || 0
      restoreTaskDetailContext()
    } else {
      const responseError = new Error(res.message || '打印历史加载失败，请重试')
      responseError.toastShown = true
      loadError.value = responseError.message
      message.error(responseError.message)
      if (rethrow) throw responseError
    }
  } catch (error) {
    if (!historyRequestGuard.isCurrent(requestId)) return
    console.error('获取打印历史记录失败:', error)
    loadError.value = error?.message || '打印历史加载失败，请重试'
    if (!error?.toastShown) message.error(error?.message || '获取打印历史记录失败')
    if (rethrow) throw error
  } finally {
    if (historyRequestGuard.isCurrent(requestId)) loading.value = false
  }
}

// 终态实时事件只使当前查询失效；筛选、页码和每页条数仍由当前页面状态控制。
watch(() => jobStore.historyInvalidationVersion, () => {
  if (historyRefreshScheduled) return
  historyRefreshScheduled = true
  queueMicrotask(() => {
    historyRefreshScheduled = false
    void fetchData()
  })
})

onBeforeUnmount(() => historyRequestGuard.invalidate())

// 初始化数据
fetchData()
loadCreatorOptions()
</script>

<style scoped>
.history-workspace {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: var(--app-spacing-4);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-large);
}

.history-filter-toolbar {
  flex: 0 0 auto;
  margin-bottom: var(--app-spacing-4);
}

.job-history-page {
  gap: var(--app-spacing-3);
}

.history-content {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.history-inline-error {
  flex: 0 0 auto;
}

.history-table-wrapper {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.history-table {
  flex: 1 1 auto;
  display: block;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.history-management-table :deep(.t-table) {
  width: 100%;
  min-width: 0;
}

.history-management-table :deep(.t-table__content) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: auto;
  scrollbar-color: var(--app-border-strong) transparent;
  scrollbar-width: thin;
}

.history-management-table :deep(.t-table th) {
  height: 44px;
  padding: 0 var(--app-spacing-3);
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  font-weight: 600;
  background: var(--app-surface-muted);
}

.history-management-table :deep(.t-table td) {
  height: 58px;
  padding: var(--app-spacing-2) var(--app-spacing-3);
  border-bottom-color: var(--app-border);
}

.history-management-table :deep(.t-table__body tr) {
  transition: background-color 160ms ease;
}

.history-management-table :deep(.t-table__body tr:hover > td) {
  background: var(--app-surface-hover);
}

.history-management-table :deep(.t-table__body tr:hover > td:first-child) {
  box-shadow: inset 3px 0 0 var(--td-brand-color);
}

.job-display-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.job-display-tooltip {
  display: block;
  min-width: 0;
  max-width: 100%;
}

.job-display__ellipsis {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-display__primary {
  color: var(--app-text-primary);
  font-weight: 600;
}

.job-display__secondary {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.job-display__error {
  color: var(--td-error-color-7);
  font-size: var(--td-font-size-body-small);
}

.history-pagination-footer {
  flex: 0 0 auto;
  padding-top: var(--app-spacing-1);
  border-top: 1px solid var(--app-border);
}

@media (max-width: 900px) {
  .history-workspace {
    padding: var(--app-spacing-3);
  }

  .history-filter-toolbar :deep(.t-select),
  .history-filter-toolbar :deep(.t-input),
  .history-filter-toolbar :deep(.t-date-range-picker) {
    max-width: 100%;
  }
}

@media (max-width: 640px) {
  .history-filter-toolbar :deep(.flex.items-center.gap-2) {
    width: 100%;
  }

  .history-filter-toolbar :deep(.flex.items-center.gap-2.ml-auto) {
    margin-left: 0;
  }

  .history-filter-toolbar :deep(.flex.items-center.gap-2.ml-auto) > * {
    flex: 1 1 0;
  }
}
</style>
