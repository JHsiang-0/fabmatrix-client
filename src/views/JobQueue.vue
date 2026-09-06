<template>
  <div class="app-page-shell app-page-background">
    <PageHeader title="生产调度队列">
      <template #actions>
      <div class="app-page-toolbar__actions">
        <t-button variant="outline" @click="openCreateTaskDialog" size="medium">
          新建任务
        </t-button>
        <t-button :icon="renderIcon(Refresh)" :loading="loading" @click="fetchQueue" size="medium">
          刷新
        </t-button>
      </div>
      </template>
    </PageHeader>

    <t-tabs v-model:value="activeTab" class="job-queue-tabs">
      <t-tab-panel value="queue" label="待派发任务">
        <section class="job-panel" aria-label="待派发任务">
      <AsyncState
        v-if="queueData.length === 0"
        :loading="queueLoading"
        :error="queueError"
        :empty="!queueLoading && !queueError"
        empty-description="当前没有排队中的任务，机器都在闲着呢！"
        @retry="fetchQueue"
      />
      <t-alert v-if="queueError && queueData.length" theme="error" :close-btn="false" class="mb-3">
        <template #default>{{ queueError.message || queueError }}</template>
        <template #operation>
          <t-button size="small" variant="outline" @click="fetchQueue">重试</t-button>
        </template>
      </t-alert>
      <TdTable
        v-if="queueData.length"
        :data="queueData"
        :loading="queueLoading"
        :height="queueTableHeight"
        style="width: 100%"
        class="job-table"
      >
        <TdTableColumn prop="id" label="任务单号" width="100" align="center">
          <template #default="scope">
            <span class="font-mono font-semibold text-gray-700">#{{ scope.row.id }}</span>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="fileId" label="切片文件ID" width="100" align="center">
          <template #default="scope">
            <t-tag size="small" variant="light-outline">{{ scope.row.fileId }}</t-tag>
          </template>
        </TdTableColumn>

        <TdTableColumn label="耗材要求" width="120" align="center">
          <template #default="scope">
            <t-tag theme="warning" variant="light" size="small">
              {{ scope.row.materialType || '-' }}
            </t-tag>
          </template>
        </TdTableColumn>

        <TdTableColumn label="喷嘴要求" width="100" align="center">
          <template #default="scope">
            <span class="font-medium text-gray-700">{{ formatOptionalUnit(scope.row.nozzleSize, 'mm') }}</span>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="priority" label="优先级" width="100" align="center">
          <template #default="scope">
            <t-select v-if="scope.row.status === 'QUEUED'" :value="scope.row.priority" size="small"
              @change="value => handlePriority(scope.row, value)" style="width: 88px">
              <t-option label="普通" :value="0" />
              <t-option label="优先" :value="50" />
              <t-option label="加急" :value="100" />
            </t-select>
            <t-tag v-else
              :theme="getPriorityType(scope.row.priority)"
              variant="dark"
              size="small"
              class="min-w-10 text-center"
            >
              {{ formatOptional(scope.row.priority) }}
            </t-tag>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="status" label="状态" width="140" align="center">
          <template #default="scope">
            <StatusTag domain="job" :status="scope.row.status" />
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

        <TdTableColumn label="调度操作" width="300" align="center" fixed="right">
          <template #default="scope">
            <t-space size="small">
              <t-button size="small" variant="text" @click="openTaskDetail(scope.row)">详情</t-button>
              <t-button
                size="small"
                theme="primary"
                :disabled="scope.row.status !== 'QUEUED'"
                @click="openAssignDialog(scope.row)"
              >
                <span><promotion /></span>
                分配机器
              </t-button>
              <t-dropdown
                trigger="click"
                :options="getQueueActionOptions(scope.row)"
                @click="item => handleQueueAction(scope.row, item)"
              >
                <t-button size="small" variant="text">更多</t-button>
              </t-dropdown>
            </t-space>
          </template>
        </TdTableColumn>
      </TdTable>

        </section>
      </t-tab-panel>

      <t-tab-panel value="active" label="活动任务">
        <section class="job-panel" aria-label="活动任务">
      <AsyncState
        v-if="activePageData.length === 0"
        :loading="activeLoading"
        :error="activeError"
        :empty="!activeLoading && !activeError"
        empty-description="当前没有活动任务"
        @retry="fetchActive"
      />
      <t-alert v-if="activeError && activePageData.length" theme="error" :close-btn="false" class="mb-3">
        <template #default>{{ activeError.message || activeError }}</template>
        <template #operation>
          <t-button size="small" variant="outline" @click="fetchActive">重试</t-button>
        </template>
      </t-alert>
      <TdTable
        v-if="activePageData.length"
        :data="activePageData"
        :loading="activeLoading"
        :height="activeTableHeight"
        style="width: 100%"
        class="job-table"
      >
        <TdTableColumn prop="id" label="任务单号" width="110" align="center">
          <template #default="scope">
            <span class="font-mono font-semibold text-gray-700">#{{ scope.row.id }}</span>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="fileId" label="切片文件ID" width="120" align="center" />
        <TdTableColumn prop="printerId" label="打印机ID" width="120" align="center">
          <template #default="scope">{{ scope.row.printerId || '未分配' }}</template>
        </TdTableColumn>
        <TdTableColumn prop="status" label="状态" width="140" align="center">
          <template #default="scope">
            <StatusTag domain="job" :status="scope.row.status" />
          </template>
        </TdTableColumn>
        <TdTableColumn prop="progress" label="进度" width="150" align="center">
          <template #default="scope">
            <t-progress v-if="hasValue(scope.row.progress)" :percentage="scope.row.progress" :status="getProgressStatus(scope.row.status, scope.row.progress)" />
            <span v-else>-</span>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="updatedAt" label="最近更新" min-width="160" align="center">
          <template #default="scope">{{ formatDateTime(scope.row.updatedAt) }}</template>
        </TdTableColumn>
        <TdTableColumn label="操作" width="300" align="center" fixed="right">
          <template #default="scope">
            <t-space size="small">
              <t-button size="small" variant="text" @click="openTaskDetail(scope.row)">详情</t-button>
              <t-dropdown
                trigger="click"
                :options="getActiveActionOptions(scope.row)"
                @click="item => handleActiveAction(scope.row, item)"
              >
                <t-button size="small" variant="text">更多</t-button>
              </t-dropdown>
            </t-space>
          </template>
        </TdTableColumn>
      </TdTable>
      <div v-if="activeTotal > activePageSize" class="flex justify-center mt-4">
        <t-pagination
          v-model:current="activePage"
          :page-size="activePageSize"
          :total="activeTotal"
          :show-page-size="false"
          @change="handleActivePageChange"
        />
      </div>
        </section>
      </t-tab-panel>
    </t-tabs>

    <!-- 指派打印机弹窗 -->
    <t-dialog v-model:visible="assignDialogVisible" header="指派打印机"
      width="520px"
      destroy-on-close
    >
      <div class="mb-5">
        <t-alert
          :title="`为任务 #${currentJob?.id} 选择打印机`" theme="info"
          :close-btn="false"

        />
      </div>

      <t-form label-width="100px">
        <t-form-item label="空闲打印机">
          <t-select
            v-model="selectedPrinterId"
            placeholder="请选择可用的打印机"
            style="width: 100%"
            :loading="loadingPrinters"
          >
            <t-option
              v-for="printer in idlePrinters"
              :key="printer.id"
              :label="`${printer.name} (${printer.ipAddress})`"
              :value="printer.id"
            >
              <div class="flex flex-col py-2">
                <span class="font-medium text-gray-900">{{ printer.name }}</span>
                <span class="text-sm text-gray-600 mt-0.5">IP: {{ printer.ipAddress }} | 耗材: {{ printer.currentMaterial }}</span>
              </div>
            </t-option>
          </t-select>

          <t-alert
            v-if="idlePrinters.length === 0 && !loadingPrinters"
            title="当前没有空闲的打印机，请等待其他任务完成" theme="warning"
            :close-btn="false"

            class="mt-3"
          />
        </t-form-item>
      </t-form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <t-button @click="assignDialogVisible = false">取消</t-button>
          <t-button theme="success"
            @click="submitAssign"
            :disabled="!selectedPrinterId"
            :loading="assigning"
          >
            <span><check /></span>
            确认分配
          </t-button>
        </div>
      </template>
    </t-dialog>
    <t-dialog
      v-model:visible="createTaskDialogVisible"
      header="新建打印任务"
      width="560px"
      class="create-task-dialog"
      destroy-on-close
    >
      <t-alert
        v-if="createTaskError"
        theme="error"
        :title="createTaskError"
        :close-btn="false"
        class="mb-4"
      />
      <t-form :data="createTaskForm" :rules="createTaskRules" ref="createTaskFormRef" label-width="92px">
        <t-form-item label="切片文件" name="fileId">
          <t-select
            v-model="createTaskForm.fileId"
            placeholder="请选择当前账号可见的文件"
            :loading="taskFilesLoading"
            :disabled="createTaskSubmitting"
            class="w-full"
          >
            <t-option
              v-for="file in taskFiles"
              :key="file.id"
              :label="file.originalName || `文件 #${file.id}`"
              :value="file.id"
            />
          </t-select>
        </t-form-item>
        <t-form-item label="目标打印机">
          <t-select
            v-model="createTaskForm.printerId"
            placeholder="不指定，进入待派发队列"
            clearable
            :loading="taskPrintersLoading"
            :disabled="createTaskSubmitting"
            class="w-full"
          >
            <t-option
              v-for="printer in taskPrinters"
              :key="printer.id"
              :label="`${printer.name}（${printer.id}）`"
              :value="printer.id"
            />
          </t-select>
          <div class="text-xs text-gray-500 mt-1">指定打印机只进入已派发状态，不会绕过现场安全确认。</div>
        </t-form-item>
        <t-form-item label="优先级" name="priority">
          <t-input-number
            v-model="createTaskForm.priority"
            :min="0"
            :max="100"
            :step="1"
            :disabled="createTaskSubmitting"
            class="w-full"
          />
        </t-form-item>
        <t-form-item label="打印份数" name="copies">
          <t-input-number
            v-model="createTaskForm.copies"
            :min="1"
            :max="99"
            :step="1"
            :disabled="createTaskSubmitting"
            class="w-full"
          />
        </t-form-item>
      </t-form>
      <t-alert
        v-if="createTaskResults.length"
        :theme="createTaskResults.every(result => result.status === 'SUCCESS') ? 'success' : 'warning'"
        :title="createTaskResults.every(result => result.status === 'SUCCESS') ? '任务创建完成' : '部分任务未创建成功'"
        :close-btn="false"
        class="mb-4"
      />
      <div v-if="createTaskResults.length" class="mb-4 space-y-2">
        <div v-for="result in createTaskResults" :key="result.index" class="flex items-center justify-between gap-3 text-sm">
          <span>第 {{ result.index + 1 }} 份</span>
          <span :class="result.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'">
            {{ result.status === 'SUCCESS' ? `已创建任务 #${result.jobId}` : result.message }}
          </span>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <t-button
            variant="outline"
            :disabled="createTaskSubmitting"
            @click="createTaskDialogVisible = false"
          >
            取消
          </t-button>
          <t-button
            v-if="createTaskResults.some(result => result.status === 'FAILED' && result.retryable)"
            variant="outline"
            theme="warning"
            :loading="createTaskSubmitting"
            @click="retryFailedTaskCreations"
          >
            重试失败项
          </t-button>
          <t-button
            v-else
            theme="primary"
            :loading="createTaskSubmitting"
            :disabled="taskFilesLoading || taskFiles.length === 0"
            @click="submitCreateTask"
          >
            确定
          </t-button>
        </div>
      </template>
    </t-dialog>

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
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import {
  RefreshIcon as Refresh,
  TimeIcon as Clock,
  SendIcon as Promotion,
  CheckIcon as Check
} from 'tdesign-icons-vue-next'
import { cancelJob, assignJobToPrinter, requeueJob, updateJobPriority, startJob, createPrintJob } from '@/api/job'
import { confirmSafe, getPrinterList, pausePrinter, resumePrinter } from '@/api/printer'
import { getFileTree } from '@/api/printFile'
import { message, confirmMessage } from '@/utils/message'
import { formatDateTime } from '@/utils/formatters'
import { renderIcon } from '@/utils/tdesign'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import AsyncState from '@/components/AsyncState.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'
import { useJobStore } from '@/stores/jobStore'

defineOptions({ name: 'JobQueue' })

const jobStore = useJobStore()
const {
  queueJobs: queueData,
  activePageJobs: activePageData,
  activeLoading,
  activePage,
  activePageSize,
  activeTotal,
  queueError,
  activeError,
  detailLoading,
  detailError
} = storeToRefs(jobStore)
const queueLoading = computed(() => jobStore.queueLoading)
const loading = computed(() => jobStore.queueLoading || jobStore.activeLoading)
const queueTableHeight = computed(() => queueData.value.length > 8
  ? '100%'
  : undefined)
const activeTableHeight = computed(() => activePageData.value.length > 8
  ? '100%'
  : undefined)
const detailErrorText = computed(() => detailError.value?.message || '')
const fetchActive = () => jobStore.fetchActive()

// 派单弹窗状态
const assignDialogVisible = ref(false)
const assigning = ref(false)
const currentJob = ref(null)
const selectedPrinterId = ref(null)
const idlePrinters = ref([])
const loadingPrinters = ref(false)
const detailDrawerVisible = ref(false)
const selectedJob = ref(null)
const JOB_QUEUE_DETAIL_CONTEXT_KEY = 'farm-ui:job-queue-detail'
const createTaskDialogVisible = ref(false)
const createTaskSubmitting = ref(false)
const createTaskError = ref('')
const createTaskFormRef = ref(null)
const taskFiles = ref([])
const taskPrinters = ref([])
const taskFilesLoading = ref(false)
const taskPrintersLoading = ref(false)
const activeTab = ref('queue')
const createTaskResults = ref([])
const createTaskBatchKey = ref('')
const actionLoadingKey = ref('')

const createTaskForm = ref({
  fileId: undefined,
  printerId: undefined,
  priority: 0,
  copies: 1
})

const createTaskRules = {
  fileId: [{ required: true, message: '请选择切片文件', trigger: 'change' }],
  priority: [{ required: true, message: '请输入优先级', trigger: 'change' }],
  copies: [{ required: true, message: '请输入打印份数', trigger: 'change' }]
}

const openTaskDetail = async job => {
  selectedJob.value = job
  const jobId = String(job.id)
  sessionStorage.setItem(JOB_QUEUE_DETAIL_CONTEXT_KEY, jobId)
  detailDrawerVisible.value = true

  try {
    const detail = await jobStore.fetchJobDetail(job.id)
    if (selectedJob.value && String(selectedJob.value.id) === jobId) {
      selectedJob.value = detail
    }
  } catch {
    // 保留列表中的真实任务数据，详情请求错误由请求层统一提示。
  }
}

const handleTaskDetailVisibility = visible => {
  if (!visible) {
    detailDrawerVisible.value = false
    selectedJob.value = null
    sessionStorage.removeItem(JOB_QUEUE_DETAIL_CONTEXT_KEY)
  }
}

const restoreTaskDetailContext = () => {
  const jobId = sessionStorage.getItem(JOB_QUEUE_DETAIL_CONTEXT_KEY)
  if (!jobId || selectedJob.value) return

  const job = queueData.value.find(item => String(item.id) === jobId)
  if (job) openTaskDetail(job)
}

const hasValue = value => value !== undefined && value !== null && value !== ''

const formatOptional = value => hasValue(value) ? value : '-'

const formatOptionalUnit = (value, unit) => hasValue(value) ? `${value}${unit}` : '-'

const flattenTaskFiles = (nodes, result = []) => {
  nodes.forEach(node => {
    if (node.folder !== true) {
      result.push({
        id: node.id,
        originalName: node.name,
        fileSize: node.fileSize,
        materialType: node.materialType
      })
    }
    if (Array.isArray(node.children)) flattenTaskFiles(node.children, result)
  })
  return result
}

const loadCreateTaskResources = async () => {
  taskFilesLoading.value = true
  taskPrintersLoading.value = true
  createTaskError.value = ''
  const [fileResult, printerResult] = await Promise.allSettled([
    getFileTree(),
    getPrinterList({ pageNum: 1, pageSize: 100, status: 'IDLE' })
  ])

  if (fileResult.status === 'fulfilled') {
    taskFiles.value = flattenTaskFiles(Array.isArray(fileResult.value.data) ? fileResult.value.data : [])
  } else {
    taskFiles.value = []
    createTaskError.value = '文件列表加载失败，请重试'
  }
  if (printerResult.status === 'fulfilled') {
    taskPrinters.value = (printerResult.value.data?.records || []).filter(printer => printer.status === 'IDLE')
  } else {
    taskPrinters.value = []
    createTaskError.value = createTaskError.value
      ? `${createTaskError.value}；空闲打印机列表加载失败，仍可创建待派发任务`
      : '空闲打印机列表加载失败，仍可创建待派发任务'
  }

  taskFilesLoading.value = false
  taskPrintersLoading.value = false
}

const openCreateTaskDialog = () => {
  createTaskForm.value = {
    fileId: undefined,
    printerId: undefined,
    priority: 0,
    copies: 1
  }
  createTaskResults.value = []
  createTaskError.value = ''
  createTaskBatchKey.value = `task-${Date.now()}`
  createTaskDialogVisible.value = true
  loadCreateTaskResources()
}

const getCreateTaskError = error => error?.message || '任务创建失败，可使用相同幂等键重试'

const isRetryableCreateTaskError = error => {
  const status = error?.response?.status ?? error?.status
  return ![400, 401, 403, 404, 409, 422].includes(status)
}

const submitCreateTask = async (retryOnly = false) => {
  if (createTaskSubmitting.value) return
  try {
    await createTaskFormRef.value?.validate()
  } catch {
    return
  }

  const indexes = retryOnly
    ? createTaskResults.value
      .filter(result => result.status === 'FAILED' && result.retryable)
      .map(result => result.index)
    : Array.from({ length: createTaskForm.value.copies }, (_, index) => index)
  if (!indexes.length) return

  createTaskSubmitting.value = true
  const nextResults = retryOnly ? createTaskResults.value.slice() : []
  try {
    for (const index of indexes) {
      try {
        const response = await createPrintJob({
          fileId: createTaskForm.value.fileId,
          priority: createTaskForm.value.priority,
          ...(createTaskForm.value.printerId ? { printerId: createTaskForm.value.printerId } : {}),
          idempotencyKey: `${createTaskBatchKey.value}-${index}`
        })
        if (!hasValue(response.data)) {
          throw new Error('服务端未返回任务 ID')
        }
        const existingIndex = nextResults.findIndex(result => result.index === index)
        const result = { index, status: 'SUCCESS', jobId: response.data, message: '任务创建成功', retryable: false }
        if (existingIndex > -1) nextResults.splice(existingIndex, 1, result)
        else nextResults.push(result)
      } catch (error) {
        const existingIndex = nextResults.findIndex(result => result.index === index)
        const result = {
          index,
          status: 'FAILED',
          jobId: null,
          message: getCreateTaskError(error),
          retryable: isRetryableCreateTaskError(error)
        }
        if (existingIndex > -1) nextResults.splice(existingIndex, 1, result)
        else nextResults.push(result)
      }
    }
    createTaskResults.value = nextResults.sort((left, right) => left.index - right.index)
    const successCount = nextResults.filter(result => result.status === 'SUCCESS').length
    const failedCount = nextResults.filter(result => result.status === 'FAILED').length
    if (successCount > 0) await fetchQueue()
    if (failedCount === 0) message.success(`已创建 ${successCount} 个任务`)
    else if (successCount > 0) message.warning(`已创建 ${successCount} 个任务，${failedCount} 个任务失败`)
    else message.error('任务创建失败，请检查失败项')
  } finally {
    createTaskSubmitting.value = false
  }
}

const retryFailedTaskCreations = () => submitCreateTask(true)

// 获取优先级标签类型
const getPriorityType = (priority) => {
  if (priority >= 80) return 'danger'
  if (priority >= 50) return 'warning'
  if (priority >= 20) return 'primary'
  return 'default'
}

const getProgressStatus = (status, progress) => {
  if (status === 'PAUSED') return 'warning'
  if (progress === 100) return 'success'
  return ''
}

// 判断任务是否可以取消
const canCancel = (status) => {
  const cancelableStatuses = ['QUEUED', 'ASSIGNED', 'UPLOADING', 'READY', 'PRINTING', 'PAUSED', 'RECONCILING']
  return cancelableStatuses.includes(status)
}

const getQueueActionOptions = job => {
  const options = []
  if (['ASSIGNED', 'READY'].includes(job.status)) options.push({ content: '重新排队', value: 'requeue' })
  if (['ASSIGNED', 'READY'].includes(job.status) && job.printerId) {
    options.push({ content: '确认安全', value: 'confirm-safe', theme: 'warning' })
    options.push({ content: '启动打印', value: 'start', theme: 'success' })
  }
  if (canCancel(job.status)) options.push({ content: '取消任务', value: 'cancel', theme: 'error' })
  return options.length ? options : [{ content: '暂无可用操作', value: 'none', disabled: true }]
}

const getActiveActionOptions = job => {
  const options = []
  if (['ASSIGNED', 'READY'].includes(job.status)) options.push({ content: '重新排队', value: 'requeue' })
  if (['ASSIGNED', 'READY'].includes(job.status) && job.printerId) {
    options.push({ content: '确认安全', value: 'confirm-safe', theme: 'warning' })
    options.push({ content: '启动打印', value: 'start', theme: 'success' })
  }
  if (job.status === 'PRINTING' && job.printerId) options.push({ content: '暂停打印', value: 'pause', theme: 'warning' })
  if (job.status === 'PAUSED' && job.printerId) options.push({ content: '恢复打印', value: 'resume', theme: 'success' })
  if (canCancel(job.status)) options.push({ content: '取消任务', value: 'cancel', theme: 'error' })
  return options.length ? options : [{ content: '暂无可用操作', value: 'none', disabled: true }]
}

const confirmCancel = async job => {
  try {
    await confirmMessage(
      `确定取消任务 #${job.id}？取消后将无法继续当前任务。`,
      '取消任务确认',
      { confirmButtonText: '确认取消', cancelButtonText: '返回', type: 'danger' }
    )
    await handleCancel(job)
  } catch (error) {
    if (error !== 'cancel') console.error('取消任务失败:', error)
  }
}

const handleQueueAction = async (job, item) => {
  switch (item.value) {
    case 'requeue': return handleRequeue(job.id)
    case 'confirm-safe': return handleConfirmSafe(job)
    case 'start': return handleStart(job)
    case 'cancel': return confirmCancel(job)
    default: return undefined
  }
}

const handleActiveAction = async (job, item) => {
  switch (item.value) {
    case 'requeue': return handleRequeue(job.id)
    case 'confirm-safe': return handleConfirmSafe(job)
    case 'start': return handleStart(job)
    case 'pause': return handlePause(job)
    case 'resume': return handleResume(job)
    case 'cancel': return confirmCancel(job)
    default: return undefined
  }
}

const fetchQueue = async () => {
  try {
    await jobStore.refresh()
    restoreTaskDetailContext()
  } catch {
    // 请求层已统一提示
  }
}

const handleActivePageChange = ({ current }) => {
  activePage.value = current
}

const runJobAction = async (job, action, requestAction, successText) => {
  const key = `${action}:${job.id}`
  if (actionLoadingKey.value) return
  actionLoadingKey.value = key
  try {
    await requestAction()
    message.success(successText)
    await fetchQueue()
  } catch (error) {
    console.error(`${successText}失败:`, error)
    message.error(error?.message || `${successText}失败`)
    await fetchQueue()
  } finally {
    actionLoadingKey.value = ''
  }
}

const handleCancel = job => runJobAction(job, 'cancel', () => cancelJob(job.id), '任务已取消')

const handlePause = job => confirmMessage(
  `确认暂停任务 #${job.id}？设备将收到暂停请求。`,
  '暂停打印确认',
  { confirmButtonText: '暂停打印', cancelButtonText: '取消', type: 'warning' }
).then(() => runJobAction(job, 'pause', () => pausePrinter(job.printerId), '暂停请求已发送'))
  .catch(error => {
    if (error !== 'cancel') console.error('暂停打印失败:', error)
  })

const handleResume = job => confirmMessage(
  `确认恢复任务 #${job.id}？设备将继续执行当前打印。`,
  '恢复打印确认',
  { confirmButtonText: '恢复打印', cancelButtonText: '取消', type: 'warning' }
).then(() => runJobAction(job, 'resume', () => resumePrinter(job.printerId), '恢复请求已发送'))
  .catch(error => {
    if (error !== 'cancel') console.error('恢复打印失败:', error)
  })

const handleRequeue = async id => {
  try {
    await requeueJob(id)
    message.success('任务已重新排队')
    fetchQueue()
  } catch {
    // 错误在拦截器处理，重新读取服务端状态，覆盖可能已过期的列表数据。
    await fetchQueue()
  }
}

const handlePriority = async (job, value) => {
  const priority = Number(value)
  try {
    await updateJobPriority(job.id, priority)
    job.priority = priority
    message.success('优先级已更新')
  } catch {
    await fetchQueue()
  }
}

const openAssignDialog = async (job) => {
  currentJob.value = job
  selectedPrinterId.value = null
  assignDialogVisible.value = true

  loadingPrinters.value = true
  try {
    const res = await getPrinterList({ pageNum: 1, pageSize: 100 })
    const allPrinters = res.data?.records || []
    idlePrinters.value = allPrinters.filter(p => p.status === 'IDLE')
  } catch {
    message.error('获取打印机列表失败')
  } finally {
    loadingPrinters.value = false
  }
}

const submitAssign = async () => {
  if (!selectedPrinterId.value) return
  assigning.value = true
  try {
    await assignJobToPrinter(currentJob.value.id, selectedPrinterId.value)
    message.success('任务分配成功！请等待操作员确认安全后启动打印')
    assignDialogVisible.value = false
    fetchQueue()
  } catch {
    // 报错信息会被拦截器弹窗，同时恢复服务端任务状态。
    await fetchQueue()
  } finally {
    assigning.value = false
  }
}

const handleConfirmSafe = async job => {
  try {
    await confirmMessage(
      `请确认打印机 #${job.printerId} 的热床已清理且可以安全打印。`,
      '现场安全确认',
      { confirmButtonText: '确认安全', cancelButtonText: '返回检查', type: 'warning' }
    )
    await confirmSafe(job.printerId)
    message.success('已确认安全，可以启动打印')
    await fetchQueue()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('确认打印安全失败:', error)
      await fetchQueue()
    }
  }
}

const handleStart = async job => {
  try {
    await confirmMessage(
      `确认启动任务 #${job.id}？这会向打印机发送上传并启动请求。`,
      '启动打印确认',
      { confirmButtonText: '启动打印', cancelButtonText: '取消', type: 'danger' }
    )
    await startJob(job.id, 'START_PRINT')
    message.success('启动请求已发送，请观察设备状态')
    await fetchQueue()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('启动打印失败:', error)
      await fetchQueue()
    }
  }
}

onMounted(() => {
  fetchQueue()
})
</script>

<style scoped>
.job-queue-tabs {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.job-queue-tabs :deep(.t-tabs__content),
.job-queue-tabs :deep(.t-tab-panel) {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.job-queue-tabs :deep(.t-tabs__content) { flex-direction: column; }
.job-queue-tabs :deep(.t-tab-panel) { flex-direction: column; }

.job-panel {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: var(--app-spacing-5);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-large);
}

.job-table {
  flex: 1 1 auto;
  display: block;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: rotate 1s linear infinite;
}

.create-task-dialog :deep(.t-dialog__body) {
  max-height: min(60vh, 520px);
  overflow-y: auto;
}

.create-task-dialog :deep(.t-dialog__footer) {
  flex-shrink: 0;
}
</style>
