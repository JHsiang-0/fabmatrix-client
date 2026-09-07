<template>
  <div class="app-page-shell app-page-background job-queue-page">
    <div class="job-queue-page__header">
      <div class="job-queue-page__title-group">
        <h1 class="app-route-title">生产调度中心</h1>
        <div class="job-queue-summary" aria-label="任务状态摘要">
          <span class="job-queue-summary__item job-queue-summary__item--blue">待派发 {{ queuedCount }}</span>
          <span class="job-queue-summary__item job-queue-summary__item--amber">调度中 {{ dispatchingCount }}</span>
          <span class="job-queue-summary__item job-queue-summary__item--orange">已暂停 {{ pausedCount }}</span>
        </div>
      </div>
      <div class="app-page-toolbar__actions">
        <t-button variant="outline" size="medium" @click="openCreateTaskDialog">新建任务</t-button>
        <t-button :icon="renderIcon(Refresh)" :loading="loading" size="medium" @click="fetchQueue">刷新</t-button>
      </div>
    </div>

    <section class="job-queue-card">
      <div class="job-queue-tabs-row">
        <nav class="job-queue-tabs" aria-label="任务队列视图">
          <button
            v-for="tab in queueTabs"
            :key="tab.value"
            type="button"
            class="job-queue-tab"
            :class="{ 'job-queue-tab--active': activeTab === tab.value }"
            @click="handleTabChange(tab.value)"
          >
            {{ tab.label }}
            <span class="job-queue-tab__count">{{ tab.count }}</span>
          </button>
        </nav>
        <div v-if="activeTab === 'queue'" class="job-queue-view-toggle" role="group" aria-label="视图切换">
          <t-button variant="text" size="small" :class="{ 'job-queue-view-toggle--active': viewMode === 'list' }" aria-label="列表视图" @click="viewMode = 'list'">
            <List />
          </t-button>
          <t-button variant="text" size="small" :class="{ 'job-queue-view-toggle--active': viewMode === 'grid' }" aria-label="网格视图" @click="viewMode = 'grid'">
            <Grid />
          </t-button>
        </div>
      </div>

      <div v-if="activeTab === 'queue'" class="job-queue-filters">
        <div class="job-queue-filters__fields">
          <t-input
            v-model="filters.keyword"
            class="job-queue-filters__search"
            placeholder="通过任务单号/切片文件名检索..."
            clearable
            size="medium"
            @input="handleSearch"
            @keyup.enter="handleSearch"
          >
            <template #prefixIcon><Search /></template>
          </t-input>
          <t-select v-model="filters.machineModel" class="job-queue-filters__select" placeholder="按机型过滤" clearable size="medium" @change="handleSearch">
            <t-option v-for="model in machineModels" :key="model" :label="model" :value="model" />
          </t-select>
          <t-select v-model="filters.nozzleSize" class="job-queue-filters__select" placeholder="喷嘴规格" clearable size="medium" @change="handleSearch">
            <t-option label="0.2mm（高精度）" value="0.2" />
            <t-option label="0.4mm（常规）" value="0.4" />
            <t-option label="0.6mm（高速 / 耐磨）" value="0.6" />
            <t-option label="0.8mm（粗打）" value="0.8" />
          </t-select>
          <t-select v-model="filters.materialType" class="job-queue-filters__select" placeholder="材质筛选" clearable size="medium" @change="handleSearch">
            <t-option v-for="material in materialOptions" :key="material" :label="material" :value="material" />
          </t-select>
        </div>
      </div>

      <div v-if="activeTab === 'queue'" class="job-queue-table-area">
        <div v-if="queueLoading" class="job-queue-state">
          <Refresh :size="40" class="is-loading" />
          <p>加载中...</p>
        </div>
        <AsyncState
          v-else-if="queueError && queueData.length === 0"
          :loading="queueLoading"
          :error="queueError"
          :empty="false"
          @retry="fetchQueue"
        />
        <div v-else-if="queueError && queueData.length" class="job-queue-inline-error">
          <t-alert theme="error" :close-btn="false">
            <template #default>{{ queueError.message || queueError }}</template>
            <template #operation><t-button size="small" variant="outline" @click="fetchQueue">重试</t-button></template>
          </t-alert>
        </div>
        <div v-else-if="pagedQueueData.length === 0" class="job-queue-state">
          <Coffee :size="56" />
          <p>当前没有符合条件的待派发任务</p>
        </div>
        <div v-else-if="viewMode === 'list'" class="job-queue-list-view">
          <TdTable
            class="job-queue-table"
            :data="pagedQueueData"
            :loading="queueLoading"
            style="width: 100%"
            hover
            @selection-change="handleSelectionChange"
            @row-click="openTaskDetail"
          >
            <TdTableColumn type="selection" width="44" align="center" />
            <TdTableColumn label="任务单号 / 3D切片模型" min-width="250">
              <template #default="scope">
                <div class="job-name-cell">
                  <div class="job-name-cell__icon"><Document :size="18" /></div>
                  <div class="job-name-cell__content">
                    <div class="job-name-cell__title">
                      <span :title="getJobFileName(scope.row)">{{ getJobFileName(scope.row) }}</span>
                      <t-tag size="small" :theme="getFileTagType(scope.row.materialType)">G-Code</t-tag>
                    </div>
                    <div class="job-name-cell__subtext">#{{ scope.row.id }} · {{ formatJobFileSize(scope.row) }}</div>
                  </div>
                </div>
              </template>
            </TdTableColumn>
            <TdTableColumn label="适配机型 | 喷嘴 | 热床" min-width="180">
              <template #default="scope">
                <div class="job-compatibility">
                  <strong>{{ getJobMachineModel(scope.row) }}</strong>
                  <span>{{ formatJobNozzle(scope.row) }} · {{ formatJobBed(scope.row) }}</span>
                </div>
              </template>
            </TdTableColumn>
            <TdTableColumn label="持续工时" width="105" align="center">
              <template #default="scope"><span class="job-mono">{{ formatJobDuration(scope.row) }}</span></template>
            </TdTableColumn>
            <TdTableColumn label="预估耗材 & 材质" width="145">
              <template #default="scope">
                <div class="job-material">
                  <strong>{{ formatJobWeight(scope.row) }}</strong>
                  <t-tag :theme="getFileTagType(scope.row.materialType)" size="small">{{ scope.row.materialType || '任意' }}</t-tag>
                </div>
              </template>
            </TdTableColumn>
            <TdTableColumn prop="priority" label="优先级" width="100" align="center">
              <template #default="scope">
                <t-input-number
                  :value="Number(scope.row.priority ?? 0)"
                  :min="0"
                  :max="100"
                  :step="1"
                  :decimal-places="0"
                  size="small"
                  style="width: 82px"
                  @change="value => handlePriority(scope.row, value)"
                />
              </template>
            </TdTableColumn>
            <TdTableColumn prop="createdAt" label="创建时间" width="145">
              <template #default="scope">{{ formatDateTime(scope.row.createdAt) }}</template>
            </TdTableColumn>
            <TdTableColumn prop="status" label="队列状态" width="115" align="center">
              <template #default="scope"><t-tag :theme="getStatusType(scope.row.status)" variant="light" size="small">{{ getStatusLabel(scope.row.status) }}</t-tag></template>
            </TdTableColumn>
            <TdTableColumn label="调度操作" width="190" align="center" fixed="right">
              <template #default="scope">
                <div class="task-action-group">
                  <t-button size="small" variant="text" @click.stop="openTaskDetail(scope.row)">详情</t-button>
                  <t-button size="small" variant="outline" theme="primary" @click.stop="openAssignDialog(scope.row)">分配机位</t-button>
                  <t-dropdown trigger="click" :options="getQueueActionOptions(scope.row)" @click="item => handleQueueAction(scope.row, item)">
                    <t-button size="small" variant="outline" aria-label="更多调度操作" @click.stop>更多</t-button>
                  </t-dropdown>
                </div>
              </template>
            </TdTableColumn>
          </TdTable>
        </div>
        <div v-else class="job-queue-grid-view">
          <article v-for="job in pagedQueueData" :key="job.id" class="job-card" :class="{ 'job-card--selected': selectedJobIds.includes(job.id) }">
            <div class="job-card__header">
              <t-checkbox :checked="selectedJobIds.includes(job.id)" @click.stop="toggleJobSelection(job.id)" />
              <t-tag :theme="getStatusType(job.status)" variant="light" size="small">{{ getStatusLabel(job.status) }}</t-tag>
            </div>
            <div class="job-card__title" :title="getJobFileName(job)">{{ getJobFileName(job) }}</div>
            <div class="job-card__meta">#{{ job.id }} · {{ getJobMachineModel(job) }}</div>
            <div class="job-card__stats"><span>{{ formatJobDuration(job) }}</span><span>{{ formatJobWeight(job) }}</span><t-tag :theme="getFileTagType(job.materialType)" size="small">{{ job.materialType || '任意' }}</t-tag></div>
            <div class="job-card__actions">
              <t-button size="small" variant="text" @click="openTaskDetail(job)">详情</t-button>
              <t-button size="small" variant="outline" theme="primary" @click="openAssignDialog(job)">分配机位</t-button>
              <t-dropdown trigger="click" :options="getQueueActionOptions(job)" @click="item => handleQueueAction(job, item)">
                <t-button size="small" variant="outline" aria-label="更多调度操作">更多</t-button>
              </t-dropdown>
            </div>
          </article>
        </div>
      </div>

      <div v-else class="job-queue-table-area job-queue-table-area--active">
        <AsyncState
          v-if="activePageData.length === 0"
          :loading="activeLoading"
          :error="activeError"
          :empty="!activeLoading && !activeError"
          empty-description="当前没有活动任务"
          @retry="fetchActive"
        />
        <t-alert v-if="activeError && activePageData.length" theme="error" :close-btn="false" class="job-queue-inline-error">
          <template #default>{{ activeError.message || activeError }}</template>
          <template #operation><t-button size="small" variant="outline" @click="fetchActive">重试</t-button></template>
        </t-alert>
        <TdTable v-if="activePageData.length" :data="activePageData" :loading="activeLoading" class="job-queue-table" style="width: 100%" hover @row-click="openTaskDetail">
          <TdTableColumn prop="id" label="任务单号" width="110" align="center"><template #default="scope"><span class="job-mono">#{{ scope.row.id }}</span></template></TdTableColumn>
          <TdTableColumn prop="fileId" label="切片文件ID" width="120" align="center" />
          <TdTableColumn prop="printerId" label="打印机ID" width="120" align="center"><template #default="scope">{{ scope.row.printerId || '未分配' }}</template></TdTableColumn>
          <TdTableColumn prop="status" label="状态" width="140" align="center"><template #default="scope"><t-tag :theme="getStatusType(scope.row.status)" variant="light" size="small">{{ getStatusLabel(scope.row.status) }}</t-tag></template></TdTableColumn>
          <TdTableColumn prop="progress" label="进度" width="150" align="center"><template #default="scope"><t-progress v-if="hasValue(scope.row.progress)" :percentage="scope.row.progress" :status="getProgressStatus(scope.row.status, scope.row.progress)" /><span v-else>-</span></template></TdTableColumn>
          <TdTableColumn prop="updatedAt" label="最近更新" min-width="160" align="center"><template #default="scope">{{ formatDateTime(scope.row.updatedAt) }}</template></TdTableColumn>
          <TdTableColumn label="操作" width="190" align="center" fixed="right"><template #default="scope"><div class="task-action-group"><t-button size="small" variant="text" @click.stop="openTaskDetail(scope.row)">详情</t-button><t-dropdown trigger="click" :options="getActiveActionOptions(scope.row)" @click="item => handleActiveAction(scope.row, item)"><t-button size="small" variant="outline" aria-label="更多操作" @click.stop>更多</t-button></t-dropdown></div></template></TdTableColumn>
        </TdTable>
      </div>

      <footer v-if="activeTab === 'queue'" class="job-queue-footer">
        <div class="job-queue-footer__batch">
          <t-button variant="outline" size="small" :disabled="cancelableSelectedCount === 0" :icon="renderIcon(Delete)" @click="handleBatchCancel">批量移出</t-button>
          <span>{{ selectedJobIds.length }} 已选择</span>
          <span class="job-queue-footer__divider">|</span>
          <span class="job-queue-footer__health">在线空闲打印机：<strong>{{ idlePrinterCount }} 台</strong></span>
        </div>
        <div class="job-queue-footer__pagination">
          <span>共 {{ filteredQueueData.length }} 条调度工单</span>
          <t-pagination v-model:current="pagination.pageNum" v-model:pageSize="pagination.pageSize" :total="filteredQueueData.length" :page-size-options="[20, 50, 100]" :total-content="false" @change="handlePageChange" />
        </div>
      </footer>
      <footer v-else-if="activeTotal > activePageSize" class="job-queue-footer job-queue-footer--active">
        <span>共 {{ activeTotal }} 条活动工单</span>
        <t-pagination v-model:current="activePage" :page-size="activePageSize" :total="activeTotal" :show-page-size="false" :total-content="false" @change="handleActivePageChange" />
      </footer>
    </section>

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
import { computed, reactive, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import {
  DeleteIcon as Delete,
  FileIcon as Document,
  GridViewIcon as Grid,
  SearchIcon as Search,
  ViewListIcon as List,
  RefreshIcon as Refresh,
  FileIcon as Coffee,
  CheckIcon as Check
} from 'tdesign-icons-vue-next'
import { cancelJob, assignJobToPrinter, requeueJob, updateJobPriority, startJob, createPrintJob } from '@/api/job'
import { confirmSafe, getPrinterList, pausePrinter, resumePrinter } from '@/api/printer'
import { getFileTree } from '@/api/printFile'
import { message, confirmMessage } from '@/utils/message'
import { formatDateTime, formatDuration, formatFileSize } from '@/utils/formatters'
import { renderIcon } from '@/utils/tdesign'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import AsyncState from '@/components/AsyncState.vue'
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue'
import { useJobStore } from '@/stores/jobStore'

defineOptions({ name: 'JobQueue' })

const jobStore = useJobStore()
const {
  queueJobs: queueData,
  activeJobs,
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
const detailErrorText = computed(() => detailError.value?.message || '')
const fetchActive = () => jobStore.fetchActive()

const activeTab = ref('queue')
const viewMode = ref('list')
const selectedJobIds = ref([])
const idlePrinterCount = ref(0)
const filters = reactive({
  keyword: '',
  machineModel: '',
  nozzleSize: '',
  materialType: ''
})
const pagination = reactive({
  pageNum: 1,
  pageSize: 20
})
const machineModels = ['拓竹 A1', '拓竹 X1-Carbon', '拓竹 P1S', '创想三维 K1 Max']
const materialOptions = ['PLA', 'PLA-CF', 'ABS', 'ASA', 'PETG', 'TPU']

const queuedCount = computed(() => queueData.value.length)
const dispatchingCount = computed(() => activeJobs.value.filter(job => job.status !== 'PAUSED').length)
const pausedCount = computed(() => activeJobs.value.filter(job => job.status === 'PAUSED').length)

const filteredQueueData = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()

  return queueData.value.filter(job => {
    if (keyword && ![job.id, job.fileId, job.fileName, getJobFileName(job)].some(value => String(value || '').toLowerCase().includes(keyword))) return false
    if (filters.machineModel && getJobMachineModel(job) !== filters.machineModel) return false
    if (filters.nozzleSize && String(job.nozzleSize ?? '') !== filters.nozzleSize) return false
    if (filters.materialType && String(job.materialType || '').toUpperCase() !== filters.materialType.toUpperCase()) return false
    return true
  })
})

const pagedQueueData = computed(() => {
  const start = (pagination.pageNum - 1) * pagination.pageSize
  return filteredQueueData.value.slice(start, start + pagination.pageSize)
})

const queueTabs = computed(() => [
  { value: 'queue', label: '待派发任务', count: queuedCount.value },
  { value: 'active', label: '活动任务', count: activeTotal.value }
])

const cancelableSelectedCount = computed(() => selectedJobIds.value
  .map(id => queueData.value.find(job => String(job.id) === String(id)))
  .filter(job => job && canCancel(job.status)).length)

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

const getJobFileName = job => job.fileName || `文件 #${job.fileId}`

const getJobMachineModel = job => job.machineModel || job.printerModel || job.printerName || (job.printerId ? `设备 ${job.printerId}` : '未指定')

const formatJobNozzle = job => {
  const nozzleSize = Number(job.nozzleSize)
  return Number.isFinite(nozzleSize) && nozzleSize > 0 ? `${nozzleSize.toFixed(1)}mm` : '喷嘴 --'
}

const formatJobBed = job => {
  const bedTemp = Number(job.bedTemp)
  return Number.isFinite(bedTemp) ? `热床 ${bedTemp}℃` : '热床 --'
}

const formatJobDuration = job => {
  const duration = Number(job.estTime ?? job.estimatedSeconds ?? job.duration)
  return Number.isFinite(duration) ? formatDuration(duration) : '--'
}

const formatJobWeight = job => {
  const weight = Number(job.filamentWeight)
  return Number.isFinite(weight) ? `${weight}g` : '--'
}

const formatJobFileSize = job => formatFileSize(job.fileSize)

const getStatusType = status => {
  const map = {
    UPLOADING: 'warning',
    QUEUED: 'primary',
    ASSIGNED: 'warning',
    READY: 'primary',
    PRINTING: 'success',
    PAUSED: 'warning',
    COMPLETED: 'default',
    FAILED: 'danger',
    RECONCILING: 'warning'
  }
  return map[status] || 'default'
}

const getStatusLabel = status => {
  const map = {
    UPLOADING: '上传中',
    QUEUED: '排队中',
    ASSIGNED: '已分配待确认',
    READY: '已上传待机',
    PRINTING: '打印中',
    PAUSED: '已暂停',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELLED: '已取消',
    RECONCILING: '状态核对中'
  }
  return map[status] || status
}

const getFileTagType = materialType => {
  const types = { PLA: 'success', 'PLA-CF': 'default', ABS: 'warning', ASA: 'warning', PETG: 'primary', TPU: 'default' }
  return types[String(materialType || '').toUpperCase()] || 'default'
}

const handleSearch = () => {
  pagination.pageNum = 1
  selectedJobIds.value = []
}

const handleTabChange = tab => {
  activeTab.value = tab
  handleSearch()
  if (tab === 'active') fetchActive()
}

const handlePageChange = ({ current, pageSize }) => {
  pagination.pageNum = current
  pagination.pageSize = pageSize
  selectedJobIds.value = []
}

const handleSelectionChange = selection => {
  selectedJobIds.value = selection.map(item => typeof item === 'object' ? item.id : item)
}

const toggleJobSelection = id => {
  const index = selectedJobIds.value.findIndex(item => String(item) === String(id))
  if (index >= 0) selectedJobIds.value.splice(index, 1)
  else selectedJobIds.value.push(id)
}

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
    const printerResponse = await getPrinterList({ pageNum: 1, pageSize: 100 })
    idlePrinterCount.value = (printerResponse.data?.records || [])
      .filter(printer => printer.status === 'IDLE').length
    selectedJobIds.value = []
    pagination.pageNum = 1
    restoreTaskDetailContext()
  } catch {
    // 请求层已统一提示
  }
}

const handleBatchCancel = async () => {
  const selectedJobs = selectedJobIds.value
    .map(id => queueData.value.find(job => String(job.id) === String(id)))
    .filter(job => job && canCancel(job.status))

  if (!selectedJobs.length) return

  try {
    await confirmMessage(
      `确定要移出选中的 ${selectedJobs.length} 个任务吗？`,
      '批量移出确认',
      { confirmButtonText: '确定移出', cancelButtonText: '取消', type: 'warning' }
    )
    const results = await Promise.allSettled(selectedJobs.map(job => cancelJob(job.id)))
    const successCount = results.filter(result => result.status === 'fulfilled').length
    const failedCount = results.length - successCount
    if (failedCount) message.warning(`已移出 ${successCount} 个任务，${failedCount} 个任务处理失败`)
    else message.success(`已移出 ${successCount} 个任务`)
    selectedJobIds.value = []
    await fetchQueue()
  } catch (error) {
    if (error !== 'cancel') console.error('批量移出任务失败:', error)
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
.job-queue-page {
  --queue-primary: var(--app-primary);
  --queue-border: var(--app-border);
  --queue-text: var(--app-text-primary);
  --queue-muted: var(--app-text-secondary);
  min-width: 0;
}

.job-queue-page__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-4);
  min-height: 3rem;
  margin-bottom: var(--app-spacing-3);
}

.job-queue-page__title-group {
  display: flex;
  align-items: baseline;
  gap: var(--app-spacing-4);
  min-width: 0;
}

.job-queue-page__title-group h1 {
  margin: 0;
  color: var(--queue-text);
  white-space: nowrap;
}

.job-queue-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-spacing-2);
  color: var(--queue-muted);
  font-size: var(--td-font-size-body-small);
  font-weight: 500;
}

.job-queue-summary__item {
  padding: 0.2rem 0.5rem;
  border-radius: var(--app-radius-small);
  white-space: nowrap;
}

.job-queue-summary__item--blue { color: var(--app-primary-active); background: var(--app-primary-light); }
.job-queue-summary__item--amber,
.job-queue-summary__item--orange { color: var(--app-warning-active); background: var(--app-warning-light); }

.job-queue-card {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--app-surface);
  border: 1px solid var(--queue-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow);
}

.job-queue-tabs-row {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-4);
  min-height: 3.25rem;
  padding: 0.5rem var(--app-spacing-4) 0;
  border-bottom: 1px solid var(--queue-border);
}

.job-queue-tabs {
  display: flex;
  align-items: stretch;
  gap: var(--app-spacing-6);
  min-width: 0;
}

.job-queue-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--app-spacing-2);
  padding: 0.625rem 0.25rem 0.75rem;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--queue-muted);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: var(--td-font-size-body-medium);
  white-space: nowrap;
}

.job-queue-tab:hover,
.job-queue-tab--active {
  color: var(--queue-primary);
}

.job-queue-tab--active {
  border-bottom-color: var(--queue-primary);
  font-weight: 600;
}

.job-queue-tab__count {
  min-width: 1.25rem;
  padding: 0.1rem 0.375rem;
  border-radius: 999px;
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  font-size: var(--td-font-size-body-small);
  text-align: center;
}

.job-queue-tab--active .job-queue-tab__count {
  color: var(--queue-primary);
  background: var(--app-primary-light);
}

.job-queue-view-toggle {
  display: flex;
  align-items: center;
  padding: 0.125rem;
  border: 1px solid var(--queue-border);
  border-radius: var(--app-radius-small);
  background: var(--app-surface-muted);
}

.job-queue-view-toggle :deep(.t-button) {
  min-width: 2rem;
  color: var(--app-text-placeholder);
}

.job-queue-view-toggle :deep(.job-queue-view-toggle--active) {
  color: var(--queue-primary);
  background: var(--app-surface);
}

.job-queue-filters {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding: var(--app-spacing-3) var(--app-spacing-4);
  border-bottom: 1px solid var(--queue-border);
}

.job-queue-filters__fields {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-spacing-2);
  min-width: 0;
}

.job-queue-filters__search { width: min(22rem, 100%); }
.job-queue-filters__select { width: 10.5rem; }

.job-queue-table-area {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.job-queue-list-view,
.job-queue-table-area--active :deep(.td-table-adapter) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.job-queue-table {
  min-width: 0;
  min-height: 100%;
}

.job-queue-table :deep(.t-table) { min-width: 1050px; }
.job-queue-table :deep(.t-table th) {
  color: var(--queue-muted);
  background: var(--app-surface-muted);
  font-weight: 500;
}

.job-queue-table :deep(.t-table td),
.job-queue-table :deep(.t-table th) {
  height: 4.25rem;
  padding: 0.625rem 0.75rem;
  border-color: var(--app-border);
}

.job-queue-table :deep(.t-table__content) {
  overflow: auto;
  scrollbar-color: var(--app-scrollbar-thumb) var(--app-scrollbar-track);
  scrollbar-width: thin;
}

.job-queue-table :deep(.t-table__body tr) {
  transition: background-color 0.18s ease;
}

.job-queue-table :deep(.t-table__body tr:hover > td) {
  background: var(--app-surface-hover);
}

.job-queue-table :deep(.t-table__body tr:hover > td:first-child) {
  box-shadow: inset 3px 0 var(--app-primary);
}

.job-queue-state {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: var(--app-spacing-3);
  min-height: 14rem;
  color: var(--app-text-placeholder);
}

.job-queue-state p { margin: 0; }
.job-queue-inline-error { padding: var(--app-spacing-4); }

.job-name-cell {
  display: flex;
  align-items: center;
  gap: var(--app-spacing-3);
  min-width: 0;
}

.job-name-cell__icon {
  display: flex;
  flex: 0 0 2rem;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-small);
  color: var(--app-primary);
  background: var(--app-primary-light);
}

.job-name-cell__content { min-width: 0; }

.job-name-cell__title {
  display: flex;
  align-items: center;
  gap: var(--app-spacing-2);
  min-width: 0;
  color: var(--queue-text);
  font-size: var(--td-font-size-body-medium);
  font-weight: 600;
}

.job-name-cell__title > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-name-cell__title :deep(.t-tag) { flex-shrink: 0; }

.job-name-cell__subtext {
  margin-top: 0.25rem;
  overflow: hidden;
  color: var(--app-text-placeholder);
  font-size: var(--td-font-size-body-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-compatibility,
.job-material {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  line-height: 1.2;
}

.job-compatibility strong,
.job-material strong { color: var(--queue-text); font-size: var(--td-font-size-body-small); }
.job-compatibility span { color: var(--queue-muted); font-size: var(--td-font-size-body-small); }
.job-mono { font-variant-numeric: tabular-nums; }

.task-action-group {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-spacing-1);
  white-space: nowrap;
}

.job-queue-grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  align-content: start;
  gap: var(--app-spacing-3);
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: var(--app-spacing-4);
  overflow: auto;
}

.job-card {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-3);
  min-width: 0;
  padding: var(--app-spacing-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.job-card:hover {
  background: var(--app-surface-hover);
  border-color: var(--app-primary);
  box-shadow: var(--app-shadow);
}

.job-card--selected { border-color: var(--app-primary); background: var(--app-primary-light); }

.job-card__header,
.job-card__stats,
.job-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-2);
}

.job-card__title {
  overflow: hidden;
  color: var(--queue-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-card__meta { color: var(--app-text-placeholder); font-size: var(--td-font-size-body-small); }
.job-card__stats { justify-content: flex-start; color: var(--queue-muted); font-size: var(--td-font-size-body-small); }
.job-card__actions { justify-content: flex-end; margin-top: auto; }

.job-queue-footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-4);
  min-height: 3.5rem;
  padding: 0.5rem var(--app-spacing-4);
  border-top: 1px solid var(--queue-border);
  background: var(--app-surface);
}

.job-queue-footer__batch,
.job-queue-footer__pagination {
  display: flex;
  align-items: center;
  gap: var(--app-spacing-3);
  min-width: 0;
  color: var(--queue-muted);
  font-size: var(--td-font-size-body-small);
  white-space: nowrap;
}

.job-queue-footer__pagination { margin-left: auto; }
.job-queue-footer__pagination :deep(.t-pagination) { flex-shrink: 0; }
.job-queue-footer__divider { color: var(--app-border-strong); }
.job-queue-footer__health strong { color: var(--app-success-active); }

.create-task-dialog :deep(.t-dialog__body) {
  max-height: min(60vh, 520px);
  overflow-y: auto;
}

.create-task-dialog :deep(.t-dialog__footer) { flex-shrink: 0; }

@media (max-width: 900px) {
  .job-queue-page__title-group { align-items: flex-start; flex-direction: column; gap: var(--app-spacing-2); }
  .job-queue-tabs-row { align-items: flex-start; flex-direction: column; padding-top: var(--app-spacing-3); }
  .job-queue-view-toggle { align-self: flex-end; margin-top: calc(var(--app-spacing-3) * -1); }
  .job-queue-footer { align-items: flex-start; flex-direction: column; }
  .job-queue-footer__pagination { width: 100%; justify-content: space-between; margin-left: 0; }
}

@media (max-width: 640px) {
  .job-queue-page__header { align-items: flex-start; flex-direction: column; }
  .job-queue-page__header .app-page-toolbar__actions { width: 100%; justify-content: flex-end; }
  .job-queue-filters__search,
  .job-queue-filters__select { width: 100%; }
  .job-queue-tabs { gap: var(--app-spacing-3); max-width: 100%; overflow-x: auto; }
}
</style>
