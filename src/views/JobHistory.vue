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
              <t-option label="排队中" value="QUEUED" />
              <t-option label="上传中" value="UPLOADING" />
              <t-option label="已分配待确认" value="ASSIGNED" />
              <t-option label="已上传待机" value="READY" />
              <t-option label="打印中" value="PRINTING" />
              <t-option label="已暂停" value="PAUSED" />
              <t-option label="已完成" value="COMPLETED" />
              <t-option label="失败" value="FAILED" />
              <t-option label="状态核对中" value="RECONCILING" />
              <t-option label="已取消" value="CANCELLED" />
            </t-select>
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
            :height="historyTableHeight"
            style="width: 100%"
            class="history-table history-management-table"
            hover
          >
        <TdTableColumn prop="id" label="任务ID" width="100" align="center">
          <template #default="scope">
            <span class="font-mono font-semibold text-gray-700">#{{ scope.row.id }}</span>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="fileId" label="关联文件ID" width="100" align="center">
          <template #default="scope">
            <t-tag size="small" variant="light-outline">{{ scope.row.fileId }}</t-tag>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="printerId" label="分配设备ID" width="100" align="center">
          <template #default="scope">
            <t-tag size="small" variant="light-outline" v-if="scope.row.printerId">{{ scope.row.printerId }}</t-tag>
            <span v-else>-</span>
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
            <span v-if="scope.row.errorReason" class="text-red-600 text-sm">{{ scope.row.errorReason }}</span>
            <span v-else>-</span>
          </template>
        </TdTableColumn>

        <TdTableColumn label="操作" width="300" align="center" fixed="right">
          <template #default="scope">
            <t-button size="small" variant="text" @click.stop="openTaskDetail(scope.row)">详情</t-button>
            <t-button v-if="scope.row.status === 'FAILED'" size="small" theme="primary" variant="text"
              @click="handleRetry(scope.row.id)">重试</t-button>
            <t-button v-if="['ASSIGNED', 'READY'].includes(scope.row.status)" size="small" theme="warning" variant="text"
              @click="handleRequeue(scope.row.id)">重新排队</t-button>
            <t-select v-if="scope.row.status === 'QUEUED'" :value="scope.row.priority" size="small"
              @change="value => handlePriority(scope.row, value)" style="width: 88px">
              <t-option label="普通" :value="0" />
              <t-option label="优先" :value="50" />
              <t-option label="加急" :value="100" />
            </t-select>
            <t-popconfirm content="确定要取消这个任务吗？"
              theme="danger"
              @confirm="handleCancel(scope.row.id)"
              :disabled="!canCancel(scope.row.status)"
            >
              <template>
                <t-button
                  size="small" theme="danger" variant="outline"
                  :disabled="!canCancel(scope.row.status)"
                >
                  <span><circle-close /></span>
                  取消
                </t-button>
              </template>
            </t-popconfirm>
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
      @update:model-value="handleTaskDetailVisibility"
      @reconcile="handleReconcile"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import {
  RefreshIcon as Refresh,
  SearchIcon as Search,
  TimeIcon as Clock,
  TaskTimeIcon as Timer,
  CloseCircleIcon as CircleClose
} from 'tdesign-icons-vue-next'
import { getJobPage, cancelJob, retryJob, requeueJob, updateJobPriority, reconcilePrintJob } from '@/api/job'
import { message } from '@/utils/message'
import { formatDateTime } from '@/utils/formatters'
import { renderIcon } from '@/utils/tdesign'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import AsyncState from '@/components/AsyncState.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import QueryToolbar from '@/components/layout/QueryToolbar.vue'
import StatusTag from '@/components/StatusTag.vue'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'
import { useJobStore } from '@/stores/jobStore'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'

defineOptions({ name: 'JobHistory' })

const loading = ref(false)
const loadError = ref('')
const jobStore = useJobStore()
const realtimeStore = useRealtimeStore()
const detailLoading = computed(() => jobStore.detailLoading)
const detailErrorText = computed(() => jobStore.detailError?.message || '')
const tableData = ref([])
const historyTableHeight = computed(() => tableData.value.length > 8
  ? '100%'
  : undefined)
const detailDrawerVisible = ref(false)
const selectedJob = ref(null)
const reconcileSubmitting = ref(false)
const JOB_HISTORY_DETAIL_CONTEXT_KEY = 'farm-ui:job-history-detail'

const openTaskDetail = job => {
  selectedJob.value = job
  sessionStorage.setItem(JOB_HISTORY_DETAIL_CONTEXT_KEY, String(job.id))
  detailDrawerVisible.value = true
  jobStore.fetchJobDetail(job.id).then(detail => {
    if (selectedJob.value && String(selectedJob.value.id) === String(job.id)) selectedJob.value = detail
  }).catch(() => {
    // 保留列表中的真实任务数据，详情请求错误由请求层统一提示。
  })
}

const handleTaskDetailVisibility = visible => {
  if (!visible) {
    detailDrawerVisible.value = false
    selectedJob.value = null
    sessionStorage.removeItem(JOB_HISTORY_DETAIL_CONTEXT_KEY)
  }
}

const handleReconcile = async payload => {
  const job = selectedJob.value
  if (reconcileSubmitting.value || !job || job.status !== 'RECONCILING') return

  reconcileSubmitting.value = true
  try {
    await reconcilePrintJob(job.id, payload)
    message.success('人工核对已提交')

    const refreshResults = await Promise.allSettled([
      jobStore.fetchJobDetail(job.id),
      fetchData(),
      realtimeStore.refreshPrinterSnapshot()
    ])
    const detailResult = refreshResults[0]
    if (detailResult.status === 'fulfilled' && selectedJob.value && String(selectedJob.value.id) === String(job.id)) {
      selectedJob.value = detailResult.value
    }
  } catch (error) {
    if (!error?.toastShown) message.error(error?.message || '人工核对失败')
    await fetchData()
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
  dateRange: [],
  printerId: '',
})

// 分页信息
const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

// 判断任务是否可以取消
const canCancel = (status) => {
  const cancelableStatuses = ['QUEUED', 'ASSIGNED', 'UPLOADING', 'READY', 'PRINTING', 'PAUSED', 'RECONCILING']
  return cancelableStatuses.includes(status)
}

const hasValue = value => value !== undefined && value !== null && value !== ''

// 获取进度条状态
const getProgressStatus = (status, progress) => {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'exception'
  if (status === 'PAUSED' || status === 'CANCELLED') return 'warning'
  if (progress === 100) return 'success'
  return ''
}

// 取消任务
const handleCancel = async (id) => {
  try {
    await cancelJob(id)
    message.success('任务已取消')
    fetchData()
  } catch (error) {
    console.error('取消任务失败:', error)
    message.error('取消任务失败')
    await fetchData()
  }
}

const handleRetry = async id => {
  try {
    await retryJob(id)
    message.success('任务已重新加入队列')
    fetchData()
  } catch (error) {
    console.error('重试任务失败:', error)
    await fetchData()
  }
}

const handleRequeue = async id => {
  try {
    await requeueJob(id)
    message.success('任务已重新排队')
    fetchData()
  } catch (error) {
    console.error('重新排队失败:', error)
    await fetchData()
  }
}

const handlePriority = async (job, value) => {
  const priority = Number(value)
  try {
    await updateJobPriority(job.id, priority)
    job.priority = priority
    message.success('优先级已更新')
  } catch (error) {
    console.error('更新优先级失败:', error)
    fetchData()
  }
}

// 构建请求参数
const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }

  if (queryForm.status) {
    params.status = queryForm.status
  }

  if (queryForm.dateRange && queryForm.dateRange.length === 2) {
    params.startTime = queryForm.dateRange[0]
    params.endTime = queryForm.dateRange[1]
  }

  if (queryForm.printerId) {
    params.printerId = queryForm.printerId
  }

  return params
}

// 查询数据
const handleQuery = async () => {
  pagination.pageNum = 1
  await fetchData()
}

// 重置查询
const handleReset = () => {
  queryForm.status = ''
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
const fetchData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const params = buildParams()
    const res = await getJobPage(params)
    if (res.code === 200) {
      // 成功响应允许 data=null，按空结果处理，不提示接口异常。
      tableData.value = res.data?.records || []
      pagination.total = res.data?.total || 0
      restoreTaskDetailContext()
    } else {
      loadError.value = res.message || '打印历史加载失败，请重试'
      message.error(res.message || '获取数据失败')
    }
  } catch (error) {
    console.error('获取打印历史记录失败:', error)
    loadError.value = error?.message || '打印历史加载失败，请重试'
    message.error('获取打印历史记录失败')
  } finally {
    loading.value = false
  }
}

// 初始化数据
fetchData()
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
  min-width: 1260px;
}

.history-management-table :deep(.t-table__content) {
  overflow: auto;
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
