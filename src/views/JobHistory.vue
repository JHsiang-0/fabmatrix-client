<template>
  <div class="app-page-shell app-page-background">
    <PageHeader title="打印历史记录">
      <template #actions>
      <div class="app-page-toolbar__actions">
        <t-button :icon="renderIcon(Refresh)" :loading="loading" @click="handleQuery" size="medium">
          刷新
        </t-button>
      </div>
      </template>
    </PageHeader>

    <t-card class="history-card app-page-card" aria-label="打印历史工作区">
      <div class="history-card__body">
        <!-- 顶部筛选区 -->
        <QueryToolbar class="history-filter-toolbar" label="打印历史筛选条件">
          <t-form
            class="history-filter-form"
            :data="queryForm"
            layout="inline"
            label-align="right"
            @submit="handleQuery"
          >
            <t-form-item label="任务状态" name="status">
              <t-select v-model="queryForm.status" placeholder="请选择状态" clearable class="history-filter-status">
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
            </t-form-item>

            <t-form-item label="打印机 ID" name="printerId">
              <t-input
                v-model="queryForm.printerId"
                placeholder="请输入设备 ID"
                clearable
                class="history-filter-printer"
                @enter="handleQuery"
              />
            </t-form-item>

            <t-form-item label="时间范围" name="dateRange">
              <t-date-range-picker
                v-model="queryForm.dateRange"
                separator="至"
                :placeholder="['开始日期', '结束日期']"
                value-type="YYYY-MM-DD HH:mm:ss"
                class="history-filter-date"
                :default-time="['00:00:00', '23:59:59']"
              />
            </t-form-item>

            <t-form-item label="操作" class="history-filter-actions">
              <t-space size="small">
                <t-button theme="primary" type="submit" :loading="loading">
                  <template #icon><search /></template>
                  查询
                </t-button>
                <t-button variant="outline" @click="handleReset">
                  <template #icon><refresh /></template>
                  重置
                </t-button>
              </t-space>
            </t-form-item>
          </t-form>
        </QueryToolbar>

      <!-- 数据内容区：只允许这里滚动，避免表格内容推动底部分页。 -->
      <div class="history-content">
        <div v-if="loading || (loadError && tableData.length === 0)" class="history-state">
          <AsyncState
            :loading="loading"
            :error="loadError"
            @retry="fetchData"
          />
        </div>
        <div v-else-if="tableData.length === 0" class="history-state">
          <t-empty description="暂无打印历史记录" />
        </div>
        <t-alert v-if="loadError && tableData.length" theme="error" :close-btn="false" class="history-inline-error">
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
            style="width: 100%"
            class="history-table"
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
      </div>
      </div>

      <!-- 底部分页区 -->
      <template #footer>
        <div class="history-pagination-footer">
          <span>共 {{ pagination.total }} 条数据</span>
          <t-pagination
            v-model:current="pagination.pageNum"
            v-model:pageSize="pagination.pageSize"
            :total="pagination.total"
            :show-page-size="false"
            :total-content="false"
            @change="handlePaginationChange"
          />
        </div>
      </template>
    </t-card>
    <TaskDetailDrawer
      v-model="detailDrawerVisible"
      :task="selectedJob"
      :loading="detailLoading"
      :error="detailErrorText"
      @update:model-value="handleTaskDetailVisibility"
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
import { getJobPage, cancelJob, retryJob, requeueJob, updateJobPriority } from '@/api/job'
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

defineOptions({ name: 'JobHistory' })

const loading = ref(false)
const loadError = ref('')
const jobStore = useJobStore()
const detailLoading = computed(() => jobStore.detailLoading)
const detailErrorText = computed(() => jobStore.detailError?.message || '')
const tableData = ref([])
const detailDrawerVisible = ref(false)
const selectedJob = ref(null)
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
.history-card {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.history-card :deep(.t-card__body) {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.history-card :deep(.t-card__footer) {
  flex: 0 0 auto;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  overflow: visible;
  padding: var(--app-spacing-3) var(--app-spacing-5);
}

.history-card__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.history-filter-toolbar {
  flex: 0 0 auto;
  margin-bottom: var(--app-spacing-4);
}

.history-filter-toolbar :deep(.app-query-toolbar__fields) {
  flex: 1 1 100%;
  min-width: 0;
}

.history-filter-form {
  width: 100%;
  min-width: 0;
}

.history-filter-form :deep(.t-form__item) {
  min-width: 0;
}

.history-filter-form :deep(.t-form__item:last-child) {
  margin-right: 0;
}

.history-filter-status {
  width: 160px;
}

.history-filter-printer {
  width: 140px;
}

.history-filter-date {
  width: 280px;
}

.history-filter-actions {
  margin-left: auto !important;
}

.history-content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.history-state {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  min-height: 14rem;
}

.history-inline-error {
  flex: 0 0 auto;
  margin-bottom: var(--app-spacing-3);
}

.history-table-wrapper {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.history-table {
  display: block;
  flex: 1 1 auto;
  height: auto !important;
  min-width: 0;
  min-height: 0;
}

.history-table :deep(.t-table) {
  height: auto !important;
  min-width: 1120px;
}

.history-table :deep(.t-table__content) {
  overflow: visible !important;
}

.history-pagination-footer {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: var(--app-spacing-4);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: visible;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  white-space: nowrap;
}

.history-pagination-footer :deep(.t-pagination) {
  flex: 0 0 auto;
  width: auto !important;
  max-width: 100%;
  margin-left: auto;
  overflow: visible;
}

.history-pagination-footer :deep(.t-pagination__total) {
  display: none !important;
}

@media (max-width: 640px) {
  .history-card :deep(.t-card__footer) {
    padding: var(--app-spacing-3);
  }

  .history-pagination-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .history-pagination-footer :deep(.t-pagination) {
    align-self: flex-end;
    max-width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 900px) {
  .history-filter-actions {
    margin-left: 0 !important;
  }
}

@media (max-width: 640px) {
  .history-filter-toolbar {
    padding: var(--app-spacing-3);
  }

  .history-filter-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--app-spacing-3);
  }

  .history-filter-form :deep(.t-form__item) {
    display: flex;
    margin: 0;
  }

  .history-filter-form :deep(.t-form__label) {
    flex: 0 0 5rem;
  }

  .history-filter-form :deep(.t-form__controls) {
    flex: 1;
    min-width: 0;
  }

  .history-filter-status,
  .history-filter-printer,
  .history-filter-date {
    width: 100%;
  }

  .history-filter-actions {
    justify-content: flex-end;
  }
}
</style>
