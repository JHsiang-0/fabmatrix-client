<template>
  <div class="app-page-shell app-page-background job-queue-page">
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
      <t-alert v-if="queueError && queueData.length" theme="error" :close-btn="false" class="job-queue-inline-error mb-3">
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
        table-content-width="max-content"
        @row-click="openTaskDetail"
        style="width: 100%"
        class="job-queue-table job-table"
      >
        <TdTableColumn prop="id" label="任务 ID" width="130" align="center">
          <template #default="scope">
            <t-tooltip :content="`#${getQueueDisplay(scope.row).jobId}`" class="job-display-tooltip">
              <span class="job-display__secondary job-display__ellipsis font-mono">#{{ getQueueDisplay(scope.row).jobId }}</span>
            </t-tooltip>
          </template>
        </TdTableColumn>

        <TdTableColumn label="文件" min-width="220">
          <template #default="scope">
            <div class="job-display-cell">
              <t-tooltip :content="getQueueDisplay(scope.row).fileName" class="job-display-tooltip">
                <span class="job-display__primary job-display__ellipsis">{{ getQueueDisplay(scope.row).fileName }}</span>
              </t-tooltip>
              <span v-if="getQueueDisplay(scope.row).fileId" class="job-display__secondary job-display__ellipsis">
                文件 ID {{ getQueueDisplay(scope.row).fileId }}
              </span>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn label="打印设备" min-width="210">
          <template #default="scope">
            <div class="job-display-cell">
              <t-tooltip :content="getQueueDisplay(scope.row).printerName" class="job-display-tooltip">
                <span class="job-display__primary job-display__ellipsis">{{ getQueueDisplay(scope.row).printerName }}</span>
              </t-tooltip>
              <t-tooltip :content="getQueueDisplay(scope.row).machineNumber" class="job-display-tooltip">
                <span class="job-display__secondary job-display__ellipsis">{{ getQueueDisplay(scope.row).machineNumber }}</span>
              </t-tooltip>
              <span v-if="getQueueDisplay(scope.row).printerId" class="job-display__secondary job-display__ellipsis">
                打印机 ID {{ getQueueDisplay(scope.row).printerId }}
              </span>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn label="人员" min-width="190">
          <template #default="scope">
            <div class="job-display-cell">
              <t-tooltip :content="getQueueDisplay(scope.row).creatorUsername" class="job-display-tooltip">
                <span class="job-display__primary job-display__ellipsis">创建人：{{ getQueueDisplay(scope.row).creatorUsername }}</span>
              </t-tooltip>
              <t-tooltip :content="getQueueDisplay(scope.row).operatorUsername" class="job-display-tooltip">
                <span class="job-display__secondary job-display__ellipsis">操作员：{{ getQueueDisplay(scope.row).operatorUsername }}</span>
              </t-tooltip>
            </div>
          </template>
        </TdTableColumn>

        <TdTableColumn prop="priority" label="优先级" width="100" align="center">
          <template #default="scope">
            <t-select v-if="scope.row.status === 'QUEUED'" :value="scope.row.priority" size="small"
              :loading="isActionLoading('priority', scope.row)"
              :disabled="actionLoadingKey !== ''"
              @mousedown.stop
              @click.stop
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
            <t-space size="small" class="task-action-group" @mousedown.stop @click.stop>
              <t-button size="small" variant="text" @click.stop="openTaskDetail(scope.row)">详情</t-button>
              <t-button
                size="small"
                theme="primary"
                :loading="isActionLoading('assign', scope.row)"
                :disabled="scope.row.status !== 'QUEUED' || actionLoadingKey !== ''"
                @click.stop="openAssignDialog(scope.row)"
              >
                <span><promotion /></span>
                分配机器
              </t-button>
              <t-dropdown
                trigger="click"
                :options="getQueueActionOptions(scope.row)"
                :disabled="actionLoadingKey !== ''"
                @mousedown.stop
                @click="item => handleQueueAction(scope.row, item)"
              >
                <t-button size="small" variant="text" :disabled="actionLoadingKey !== ''" @mousedown.stop @click.stop>更多</t-button>
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
      <t-alert v-if="activeError && activePageData.length" theme="error" :close-btn="false" class="job-queue-inline-error mb-3">
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
        table-content-width="max-content"
        @row-click="openTaskDetail"
        style="width: 100%"
        class="job-queue-table job-table"
      >
        <TdTableColumn prop="id" label="任务 ID" width="130" align="center">
          <template #default="scope">
            <t-tooltip :content="`#${getActiveDisplay(scope.row).jobId}`" class="job-display-tooltip">
              <span class="job-display__secondary job-display__ellipsis font-mono">#{{ getActiveDisplay(scope.row).jobId }}</span>
            </t-tooltip>
          </template>
        </TdTableColumn>
        <TdTableColumn label="文件" min-width="220">
          <template #default="scope">
            <div class="job-display-cell">
              <t-tooltip :content="getActiveDisplay(scope.row).fileName" class="job-display-tooltip">
                <span class="job-display__primary job-display__ellipsis">{{ getActiveDisplay(scope.row).fileName }}</span>
              </t-tooltip>
              <span v-if="getActiveDisplay(scope.row).fileId" class="job-display__secondary job-display__ellipsis">
                文件 ID {{ getActiveDisplay(scope.row).fileId }}
              </span>
            </div>
          </template>
        </TdTableColumn>
        <TdTableColumn label="打印设备" min-width="210">
          <template #default="scope">
            <div class="job-display-cell">
              <t-tooltip :content="getActiveDisplay(scope.row).printerName" class="job-display-tooltip">
                <span class="job-display__primary job-display__ellipsis">{{ getActiveDisplay(scope.row).printerName }}</span>
              </t-tooltip>
              <t-tooltip :content="getActiveDisplay(scope.row).machineNumber" class="job-display-tooltip">
                <span class="job-display__secondary job-display__ellipsis">{{ getActiveDisplay(scope.row).machineNumber }}</span>
              </t-tooltip>
              <span v-if="getActiveDisplay(scope.row).printerId" class="job-display__secondary job-display__ellipsis">
                打印机 ID {{ getActiveDisplay(scope.row).printerId }}
              </span>
            </div>
          </template>
        </TdTableColumn>
        <TdTableColumn label="人员" min-width="190">
          <template #default="scope">
            <div class="job-display-cell">
              <t-tooltip :content="getActiveDisplay(scope.row).creatorUsername" class="job-display-tooltip">
                <span class="job-display__primary job-display__ellipsis">创建人：{{ getActiveDisplay(scope.row).creatorUsername }}</span>
              </t-tooltip>
              <t-tooltip :content="getActiveDisplay(scope.row).operatorUsername" class="job-display-tooltip">
                <span class="job-display__secondary job-display__ellipsis">操作员：{{ getActiveDisplay(scope.row).operatorUsername }}</span>
              </t-tooltip>
            </div>
          </template>
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
            <t-space size="small" class="task-action-group" @mousedown.stop @click.stop>
              <t-button size="small" variant="text" @click.stop="openTaskDetail(scope.row)">详情</t-button>
              <t-dropdown
                trigger="click"
                :options="getActiveActionOptions(scope.row)"
                :disabled="actionLoadingKey !== ''"
                @mousedown.stop
                @click="item => handleActiveAction(scope.row, item)"
              >
                <t-button size="small" variant="text" :disabled="actionLoadingKey !== ''" @mousedown.stop @click.stop>更多</t-button>
              </t-dropdown>
            </t-space>
          </template>
        </TdTableColumn>
      </TdTable>
      <div v-if="activeTotal > activePageSize" class="job-queue-pagination flex justify-center mt-4">
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
          <t-button @click="assignDialogVisible = false" :disabled="actionLoadingKey !== ''">取消</t-button>
          <t-button theme="success"
            @click="submitAssign"
            :disabled="!selectedPrinterId || actionLoadingKey !== ''"
            :loading="isActionLoading('assign', currentJob)"
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
      :footer="false"
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
          <t-button @click="createTaskDialogVisible = false" :disabled="actionLoadingKey !== ''">关闭</t-button>
          <t-button
            v-if="createTaskResults.some(result => result.status === 'FAILED' && result.retryable)"
            variant="outline"
            theme="warning"
            :loading="isActionLoading('create')"
            :disabled="actionLoadingKey !== ''"
            @click="retryFailedTaskCreations"
          >
            重试失败项
          </t-button>
          <t-button
            v-else
            theme="primary"
            :loading="isActionLoading('create')"
            :disabled="taskFilesLoading || taskFiles.length === 0 || actionLoadingKey !== ''"
            @click="submitCreateTask"
          >
            创建任务
          </t-button>
        </div>
      </template>
    </t-dialog>

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
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import {
  RefreshIcon as Refresh,
  TimeIcon as Clock,
  SendIcon as Promotion,
  CheckIcon as Check
} from 'tdesign-icons-vue-next'
import { cancelJob, assignJobToPrinter, requeueJob, updateJobPriority, startJob, createPrintJob, reconcilePrintJob } from '@/api/job'
import { confirmSafe, getPrinterList, pausePrinter, resumePrinter } from '@/api/printer'
import { getFileTree } from '@/api/printFile'
import { message, confirmMessage } from '@/utils/message'
import { formatDateTime } from '@/utils/formatters'
import { renderIcon } from '@/utils/tdesign'
import { getActiveJobDisplay, getQueueJobDisplay } from '@/utils/jobDisplay'
import { acquireJobActionLock, releaseJobActionLock } from '@/utils/jobAction'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import AsyncState from '@/components/AsyncState.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'
import { useJobStore } from '@/stores/jobStore'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'

defineOptions({ name: 'JobQueue' })

const jobStore = useJobStore()
const realtimeStore = useRealtimeStore()
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
const getQueueDisplay = getQueueJobDisplay
const getActiveDisplay = getActiveJobDisplay

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
const reconcileSubmitting = ref(false)
const reconcileSuccessKey = ref(0)
const reconcileStale = ref(false)

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
  reconcileStale.value = false
  const jobId = String(job.id)
  sessionStorage.setItem(JOB_QUEUE_DETAIL_CONTEXT_KEY, jobId)
  detailDrawerVisible.value = true

  try {
    const detail = await jobStore.fetchJobDetail(job.id)
    if (detail && selectedJob.value && String(selectedJob.value.id) === jobId) {
      selectedJob.value = detail
    }
  } catch {
    // 保留列表中的真实任务数据，详情请求错误由请求层统一提示。
  }
}

const handleTaskDetailVisibility = visible => {
  if (!visible) {
    jobStore.invalidateJobDetailRequest()
    detailDrawerVisible.value = false
    selectedJob.value = null
    reconcileStale.value = false
    sessionStorage.removeItem(JOB_QUEUE_DETAIL_CONTEXT_KEY)
  }
}

const refreshReconcileContext = async job => {
  const refreshResults = await Promise.allSettled([
    jobStore.fetchJobDetail(job.id),
    jobStore.fetchQueue(),
    jobStore.fetchActive(),
    realtimeStore.refreshPrinterSnapshot()
  ])
  const [detailResult, queueResult, activeResult, printerResult] = refreshResults
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
  if (queueResult.status === 'rejected') message.warning('待派发任务列表刷新失败，请稍后手动刷新')
  if (activeResult.status === 'rejected') message.warning('活动任务列表刷新失败，请稍后手动刷新')
  if (printerResult.status === 'rejected') message.warning('打印机状态刷新失败，请稍后手动刷新看板')

  return refreshResults
}

const handleReconcile = async payload => {
  const job = selectedJob.value
  if (reconcileSubmitting.value || reconcileStale.value || !job || job.status !== 'RECONCILING') return

  reconcileSubmitting.value = true
  actionLoadingKey.value = `reconcile:${job.id}`
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
    actionLoadingKey.value = ''
  }
}

const restoreTaskDetailContext = () => {
  const jobId = sessionStorage.getItem(JOB_QUEUE_DETAIL_CONTEXT_KEY)
  if (!jobId || selectedJob.value) return

  const job = [...queueData.value, ...activePageData.value].find(item => String(item.id) === jobId)
  if (job) openTaskDetail(job)
  else openTaskDetail({ id: jobId })
}

const hasValue = value => value !== undefined && value !== null && value !== ''

const formatOptional = value => hasValue(value) ? value : '-'

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
  if (createTaskSubmitting.value || actionLoadingKey.value) return
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

  actionLoadingKey.value = `create:${createTaskBatchKey.value}`
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
    actionLoadingKey.value = ''
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
  const cancelableStatuses = ['QUEUED', 'ASSIGNED', 'UPLOADING', 'READY', 'PRINTING', 'PAUSED']
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
  } catch {
    // 请求层已统一提示
  } finally {
    restoreTaskDetailContext()
  }
}

const isActionLoading = (action, job = null) => job
  ? actionLoadingKey.value === `${action}:${job.id}`
  : actionLoadingKey.value.startsWith(`${action}:`)

const handleActivePageChange = ({ current }) => {
  activePage.value = current
  return jobStore.fetchActive({ pageNum: current })
}

const executeLockedJobAction = async (job, requestAction, successText) => {
  try {
    await requestAction()
    message.success(successText)
    await fetchQueue()
  } catch (error) {
    console.error(`${successText}失败:`, error)
    message.error(error?.message || `${successText}失败`)
    await fetchQueue()
  }
}

const runJobAction = async (job, action, requestAction, successText) => {
  if (!acquireJobActionLock({ actionLoadingKey, action, jobId: job.id })) return false
  try {
    return await executeLockedJobAction(job, requestAction, successText)
  } finally {
    releaseJobActionLock({ actionLoadingKey, action, jobId: job.id })
  }
}

const runConfirmedJobAction = async (job, action, prompt, requestAction, successText) => {
  if (!acquireJobActionLock({ actionLoadingKey, action, jobId: job.id })) return false
  try {
    await confirmMessage(prompt.message, prompt.title, prompt.options)
    return await executeLockedJobAction(job, requestAction, successText)
  } catch (error) {
    if (error !== 'cancel') console.error(`${successText}失败:`, error)
    return false
  } finally {
    releaseJobActionLock({ actionLoadingKey, action, jobId: job.id })
  }
}

const confirmCancel = job => runConfirmedJobAction(job, 'cancel', {
  message: `确定取消任务 #${job.id}？取消后将无法继续当前任务。`,
  title: '取消任务确认',
  options: { confirmButtonText: '确认取消', cancelButtonText: '返回', type: 'danger' }
}, () => cancelJob(job.id), '任务已取消')

const handlePause = job => runConfirmedJobAction(job, 'pause', {
  message: `确认暂停任务 #${job.id}？设备将收到暂停请求。`,
  title: '暂停打印确认',
  options: { confirmButtonText: '暂停打印', cancelButtonText: '取消', type: 'warning' }
}, () => pausePrinter(job.printerId), '暂停请求已发送')

const handleResume = job => runConfirmedJobAction(job, 'resume', {
  message: `确认恢复任务 #${job.id}？设备将继续执行当前打印。`,
  title: '恢复打印确认',
  options: { confirmButtonText: '恢复打印', cancelButtonText: '取消', type: 'warning' }
}, () => resumePrinter(job.printerId), '恢复请求已发送')

const handleRequeue = async id => {
  const job = [...queueData.value, ...activePageData.value].find(item => String(item.id) === String(id))
  if (!job) return
  return runJobAction(job, 'requeue', () => requeueJob(id), '任务已重新排队')
}

const handlePriority = async (job, value) => {
  const priority = Number(value)
  return runJobAction(job, 'priority', async () => {
    await updateJobPriority(job.id, priority)
    job.priority = priority
  }, '优先级已更新')
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
  if (!selectedPrinterId.value || !currentJob.value || actionLoadingKey.value) return
  const job = currentJob.value
  if (!acquireJobActionLock({ actionLoadingKey, action: 'assign', jobId: job.id })) return
  assigning.value = true
  try {
    await assignJobToPrinter(job.id, selectedPrinterId.value)
    message.success('任务分配成功！请等待操作员确认安全后启动打印')
    assignDialogVisible.value = false
    await fetchQueue()
  } catch {
    // 报错信息会被拦截器弹窗，同时恢复服务端任务状态。
    await fetchQueue()
  } finally {
    assigning.value = false
    releaseJobActionLock({ actionLoadingKey, action: 'assign', jobId: job.id })
  }
}

const handleConfirmSafe = job => runConfirmedJobAction(job, 'confirm-safe', {
  message: `请确认打印机 #${job.printerId} 的热床已清理且可以安全打印。`,
  title: '现场安全确认',
  options: { confirmButtonText: '确认安全', cancelButtonText: '返回检查', type: 'warning' }
}, () => confirmSafe(job.printerId), '已确认安全，可以启动打印')

const handleStart = job => runConfirmedJobAction(job, 'start', {
  message: `确认启动任务 #${job.id}？这会向打印机发送上传并启动请求。`,
  title: '启动打印确认',
  options: { confirmButtonText: '启动打印', cancelButtonText: '取消', type: 'danger' }
}, () => startJob(job.id, 'START_PRINT'), '启动请求已发送，请观察设备状态')

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

.job-queue-page {
  gap: var(--app-spacing-3);
}

.job-queue-page :deep(.app-page-header__actions),
.job-queue-page :deep(.app-page-toolbar__actions) {
  flex-wrap: wrap;
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
  padding: var(--app-spacing-4);
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

.job-queue-table :deep(.t-table) {
  width: 100%;
  min-width: 0;
}

.job-queue-table :deep(.t-table__content) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: auto;
  scrollbar-color: var(--app-border-strong) transparent;
  scrollbar-width: thin;
}

.job-queue-table :deep(.t-table th) {
  height: 44px;
  padding: 0 var(--app-spacing-3);
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  font-weight: 600;
  background: var(--app-surface-muted);
}

.job-queue-table :deep(.t-table td) {
  height: 58px;
  padding: var(--app-spacing-2) var(--app-spacing-3);
  color: var(--app-text-primary);
  border-bottom-color: var(--app-border);
}

.job-queue-table :deep(.t-table__body tr) {
  transition: background-color 160ms ease;
}

.job-queue-table :deep(.t-table__body tr:hover > td) {
  background: var(--app-surface-hover);
}

.job-queue-table :deep(.t-table__body tr:hover > td:first-child) {
  box-shadow: inset 3px 0 0 var(--td-brand-color);
}

.job-queue-inline-error {
  flex: 0 0 auto;
  margin-bottom: var(--app-spacing-3);
}

.task-action-group {
  flex-wrap: wrap;
  justify-content: center;
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

.job-queue-pagination {
  flex: 0 0 auto;
  padding-top: var(--app-spacing-1);
}

.job-queue-page :deep(.t-dialog__body) {
  max-height: min(60vh, 520px);
  overflow-y: auto;
}

@media (max-width: 900px) {
  .job-panel {
    padding: var(--app-spacing-3);
  }

  .job-queue-page :deep(.app-page-toolbar__actions) {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .job-queue-page :deep(.app-page-toolbar__actions) {
    justify-content: stretch;
  }

  .job-queue-page :deep(.app-page-toolbar__actions) > * {
    flex: 1 1 0;
  }

  .job-queue-tabs :deep(.t-tabs__nav-item) {
    min-width: 0;
  }

  .task-action-group {
    gap: var(--app-spacing-1);
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: rotate 1s linear infinite;
}
</style>
