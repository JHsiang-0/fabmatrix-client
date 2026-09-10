<template>
  <div class="batch-dispatch-page app-page-background">
    <PageHeader title="批量手动派发" description="先选择文件和打印机生成预览，确认后才会创建任务或启动打印。">
      <template #actions>
        <t-tag theme="default" variant="outline" title="v3 自动派单尚未开放，不会发送自动派单请求">
          v3 自动派单：规划中
        </t-tag>
        <t-button variant="outline" :loading="loadingResources" @click="loadResources">刷新资源</t-button>
      </template>
    </PageHeader>

    <t-steps :current="currentStep" readonly class="mb-4">
      <t-step-item title="选择资源" content="选择可见文件和打印机" />
      <t-step-item title="配置策略" content="选择分配策略与动作" />
      <t-step-item title="无副作用预览" content="确认冲突和执行范围" />
      <t-step-item title="确认执行" content="按计划幂等执行" />
      <t-step-item title="逐项结果" content="查看成功与恢复项" />
    </t-steps>

    <template v-if="currentStep === 0">
      <section class="dispatch-panel" aria-labelledby="batch-upload-title">
        <div class="dispatch-panel__heading"><h2 id="batch-upload-title">批量上传</h2></div>
        <p class="hint">支持最多 100 个 .gcode、.g、.3mf、.stl 文件；单个文件不超过 1GB，批量会按单请求约 1GB 自动分组，结果按文件分别返回。</p>
        <t-upload theme="file" multiple :auto-upload="false" accept=".gcode,.g,.3mf,.stl"
          :files="uploadFiles" @select-change="handleFileChange" />
        <t-progress v-if="uploading" class="mt-3" :percentage="uploadProgress" />
        <t-space class="mt-3">
          <t-button theme="primary" :loading="uploading" :disabled="!uploadFiles.length" @click="uploadSelected">
            {{ uploading ? '上传中…' : '批量上传' }}
          </t-button>
          <t-button v-if="uploading" variant="outline" @click="cancelUpload">取消上传</t-button>
        </t-space>
        <t-alert v-if="uploadResult" class="mt-3" :theme="uploadFailureCount ? 'warning' : 'success'"
          :title="`上传完成：成功 ${uploadSuccessCount} 个，失败 ${uploadFailureCount} 个`"
          :close-btn="false">
          <div v-if="uploadUnknownCount" class="mt-2">部分请求结果未知，请刷新文件列表确认后再重试，避免重复入库。</div>
          <template #operation>
            <t-button v-if="retryableUploadFiles.length" variant="text" size="small" @click="retryFailedUploads">
              重试失败项（{{ retryableUploadFiles.length }}）
            </t-button>
          </template>
        </t-alert>
      </section>

      <div class="selection-grid">
        <section class="dispatch-panel" :aria-label="`选择文件（${selectedFileIds.length}）`">
          <div class="dispatch-panel__heading"><h2>选择文件（{{ selectedFileIds.length }}）</h2></div>
          <t-checkbox-group v-model="selectedFileIds" class="selection-group">
            <t-checkbox v-for="file in files" :key="file.id" :value="file.id" class="selection-row">
              <span>{{ file.originalName || `文件 #${file.id}` }}</span>
              <small>{{ file.visibility === 'PUBLIC' ? '公共' : '个人' }} · {{ file.id }}</small>
            </t-checkbox>
          </t-checkbox-group>
          <t-empty v-if="!files.length" description="暂无文件，请先批量上传或刷新。" />
        </section>

        <section class="dispatch-panel" :aria-label="`选择打印机（${selectedPrinterIds.length}）`">
          <div class="dispatch-panel__heading"><h2>选择打印机（{{ selectedPrinterIds.length }}）</h2></div>
          <t-checkbox-group v-model="selectedPrinterIds" class="selection-group">
            <t-checkbox v-for="printer in printers" :key="printer.id" :value="printer.id" class="selection-row">
              <span>{{ printer.name }}</span>
              <small>{{ printer.ipAddress }} · {{ printer.status }}</small>
            </t-checkbox>
          </t-checkbox-group>
          <t-empty v-if="!printers.length" description="暂无打印机，请先添加设备。" />
        </section>
      </div>

      <div class="step-actions">
        <t-button theme="primary" :disabled="!selectedFileIds.length || !selectedPrinterIds.length" @click="goToStrategy">
          下一步：配置策略
        </t-button>
      </div>
    </template>

    <section v-else-if="currentStep === 1" class="dispatch-panel step-panel" aria-labelledby="dispatch-strategy-title">
      <div class="dispatch-panel__heading"><h2 id="dispatch-strategy-title">配置策略</h2></div>
      <t-alert theme="info" :close-btn="false" class="mb-4">
        已选择 {{ selectedFileIds.length }} 个文件和 {{ selectedPrinterIds.length }} 台打印机，请选择分配策略和确认后的动作。
      </t-alert>
      <t-form layout="vertical" class="options-form">
        <t-form-item label="分配策略">
          <t-select v-model="strategy" class="option-select">
            <t-option value="ONE_TO_ONE" label="一文件一打印机" />
            <t-option value="ROUND_ROBIN" label="轮询分配" />
            <t-option value="AUTO_MATCH" label="本次智能匹配" />
          </t-select>
        </t-form-item>
        <t-form-item label="确认后的动作">
          <t-select v-model="action" class="option-select">
            <t-option value="UPLOAD_ONLY" label="仅上传到打印机" />
            <t-option value="QUEUE" label="创建排队任务" />
            <t-option value="START_AFTER_CONFIRM" label="安全确认后启动" />
          </t-select>
        </t-form-item>
      </t-form>
      <div class="step-actions">
        <t-button variant="outline" @click="goToSelection">上一步</t-button>
        <t-button theme="primary" :loading="previewing" @click="preview">
          {{ previewing ? '生成中…' : '生成派发预览' }}
        </t-button>
      </div>
    </section>

    <section v-else-if="currentStep === 2 || currentStep === 3" class="dispatch-panel" aria-labelledby="dispatch-preview-title">
      <div class="dispatch-panel__heading"><h2 id="dispatch-preview-title">无副作用预览</h2></div>
      <p class="hint">计划 {{ previewData.planId }} · 版本 {{ previewData.version }} · 动作 {{ previewData.action || action }}。</p>
      <t-alert v-if="previewExpired" class="mb-3" theme="warning" title="预览已过期，请重新生成" :close-btn="false" />
      <t-alert v-if="previewData.conflicts?.length" class="mb-3" theme="warning" title="存在不可分配冲突" :close-btn="false">
        <div v-for="conflict in previewData.conflicts" :key="conflict.itemId || conflict.code || conflict.message">
          {{ conflict.message || conflict.reasonCode || conflict.code || '资源冲突' }}
        </div>
      </t-alert>
      <div v-for="item in previewData.items || []" :key="item.itemId" class="preview-row">
        <span>{{ item.fileName || `文件 #${item.fileId}` }} → {{ item.printerName || (item.printerId ? `打印机 #${item.printerId}` : '未分配') }}</span>
        <t-tag :theme="item.canExecute ? 'success' : 'danger'" variant="light">
          {{ item.message || item.reasonCode || (item.canExecute ? '可执行' : '存在冲突') }}
        </t-tag>
      </div>
      <t-alert v-if="executableItemIds.length" class="mb-3" theme="warning" title="确认前请检查影响范围" :close-btn="false">
        本次将按“{{ previewData.action || action }}”处理 {{ executableItemIds.length }} 项可执行明细；确认后由后端按计划版本和令牌幂等执行。
      </t-alert>
      <div class="step-actions">
        <t-button variant="outline" :disabled="confirming" @click="goToStrategy">返回配置</t-button>
        <t-button theme="primary" :disabled="previewExpired || confirming || confirmData || !executableItemIds.length" :loading="confirming" @click="confirm">
        {{ confirming ? '执行中…' : `确认执行（${executableItemIds.length}项）` }}
        </t-button>
      </div>
    </section>

    <section v-else class="dispatch-panel" aria-labelledby="dispatch-result-title">
      <div class="dispatch-panel__heading"><h2 id="dispatch-result-title">逐项结果</h2></div>
      <t-alert class="mb-3" theme="info" :title="`执行完成：计划状态 ${confirmData.planStatus || confirmData.status || '—'}`" :close-btn="false">
        成功 {{ confirmSuccessCount }} 项，失败 {{ confirmFailureCount }} 项
        <span v-if="confirmData.repeated">（重复确认已返回原结果）</span>
        <t-space class="mt-2">
          <t-button v-if="retryableConfirmItems.length" variant="outline" size="small" @click="retryFailedConfirmItems">
            重新预览可恢复项（{{ retryableConfirmItems.length }}）
          </t-button>
          <span v-if="existingJobItems.length">需打开已有任务 {{ existingJobItems.length }} 项，请在结果明细中逐项处理。</span>
        </t-space>
      </t-alert>
      <t-tabs v-if="confirmData?.items?.length" v-model="resultTab" class="mt-3">
        <t-tab-panel value="all" :label="`全部结果（${confirmData.items.length}）`" />
        <t-tab-panel value="success" :label="`成功项（${confirmSuccessCount}）`" />
        <t-tab-panel value="retryable" :label="`可恢复失败（${retryableConfirmItems.length}）`" />
        <t-tab-panel value="existing" :label="`已有任务（${existingJobItems.length}）`" />
      </t-tabs>
      <t-empty v-if="confirmData?.items?.length && !visibleConfirmItems.length" class="mt-3" description="当前分类暂无结果" />
      <t-table v-if="visibleConfirmItems.length" class="mt-3" :data="visibleConfirmItems" :columns="confirmColumns"
        row-key="itemId" bordered size="small">
        <template #status="{ row }">
          <t-tag :theme="resultTheme(row)" variant="light">{{ row.status }}</t-tag>
        </template>
        <template #message="{ row }">
          {{ row.message || '—' }}
        </template>
        <template #retryable="{ row }">
          {{ row.retryable ? '是' : '否' }}
        </template>
        <template #source="{ row }">
          {{ row.sourcePlanId ? `${row.sourcePlanId} / ${row.sourceItemId}` : '—' }}
        </template>
        <template #recovery="{ row }">
          <t-button v-if="row.jobId && row.recoveryAction === 'OPEN_EXISTING_JOB'" variant="text" size="small" @click="openExistingJob(row)">
            打开任务
          </t-button>
          <span v-else>—</span>
        </template>
      </t-table>
      <div class="step-actions">
        <t-button variant="outline" @click="goToSelection">重新选择资源</t-button>
        <t-button v-if="confirmData && !previewExpired" variant="outline" :loading="confirming" @click="replayConfirm">
          再次获取执行结果
        </t-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, confirmMessage } from '@/utils/message'
import { batchUploadFiles, getFileList, getFileTree } from '@/api/printFile'
import { getPrinterList } from '@/api/printer'
import { previewBatchDispatch, confirmBatchDispatch, retryPreviewBatchDispatch } from '@/api/job'
import { createBatchPreviewRequest, normalizeBatchConfirmResult } from '@/utils/batchDispatch'
import {
  getUploadFailureState,
  isBatchUploadSuccess,
  MAX_UPLOAD_REQUEST_BYTES,
  normalizeBatchUploadResult,
  validateBatchUploadSelection
} from '@/utils/batchUpload'
import { chunkItemsByBytes, runUploadQueue } from '@/utils/uploadQueue'
import { useJobStore } from '@/stores/jobStore'
import PageHeader from '@/components/layout/PageHeader.vue'

const route = useRoute()
const router = useRouter()
const jobStore = useJobStore()
const files = ref([])
const printers = ref([])
const selectedFileIds = ref([])
const selectedPrinterIds = ref([])
const uploadFiles = ref([])
const uploadResult = ref(null)
const lastBatchUploadFiles = ref([])
const uploadController = ref(null)
const previewData = ref(null)
const confirmData = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const loadingResources = ref(false)
const previewing = ref(false)
const confirming = ref(false)
const previewExpired = ref(false)
const previewExpiresAt = ref(null)
const recoveryHistory = ref([])
const resultTab = ref('all')
const strategy = ref('ONE_TO_ONE')
const action = ref('QUEUE')
const activeStep = ref(0)
let previewExpiryTimer = null

const currentStep = computed(() => {
  if (confirmData.value) return 4
  if (confirming.value) return 3
  if (previewData.value) return 2
  return activeStep.value
})

const executableItemIds = computed(() => (previewData.value?.items || [])
  .filter(item => item.canExecute)
  .map(item => item.itemId)
  .filter(itemId => itemId !== undefined && itemId !== null))

const retryableUploadFiles = computed(() => (uploadResult.value?.items || [])
  .filter(item => item.retryable && lastBatchUploadFiles.value[item.index])
  .map(item => lastBatchUploadFiles.value[item.index]))

const uploadSuccessCount = computed(() => (uploadResult.value?.items || []).filter(isBatchUploadSuccess).length)
const uploadFailureCount = computed(() => (uploadResult.value?.items || []).filter(item => !isBatchUploadSuccess(item)).length)
const uploadUnknownCount = computed(() => (uploadResult.value?.items || []).filter(item => item.requiresRefresh).length)
const confirmSuccessCount = computed(() => (confirmData.value?.items || []).filter(item => item.success).length)
const confirmFailureCount = computed(() => (confirmData.value?.items || []).filter(item => !item.success).length)
const visibleConfirmItems = computed(() => {
  const items = confirmData.value?.items || []
  if (resultTab.value === 'success') return items.filter(item => item.success)
  if (resultTab.value === 'retryable') return retryableConfirmItems.value
  if (resultTab.value === 'existing') return existingJobItems.value
  return items
})
const retryableConfirmItems = computed(() => (confirmData.value?.items || [])
  .filter(item => item.itemId && item.retryable && !item.jobId && !item.recoveryAction))
const existingJobItems = computed(() => (confirmData.value?.items || [])
  .filter(item => item.jobId && item.recoveryAction === 'OPEN_EXISTING_JOB'))
const confirmColumns = [
  { colKey: 'fileId', title: '文件 ID', width: 120 },
  { colKey: 'printerId', title: '打印机 ID', width: 120 },
  { colKey: 'jobId', title: '任务 ID', width: 120 },
  { colKey: 'status', title: '状态', width: 120 },
  { colKey: 'errorCode', title: '错误码', width: 120 },
  { colKey: 'message', title: '说明' },
  { colKey: 'retryable', title: '可重试', width: 100 },
  { colKey: 'source', title: '恢复来源' },
  { colKey: 'recovery', title: '恢复操作', width: 110 }
]

function collectFolderIds(nodes, result = []) {
  nodes.forEach(node => {
    if (node?.folder === true || node?.folder === 1) result.push(node.id)
    if (Array.isArray(node?.children)) collectFolderIds(node.children, result)
  })
  return result
}

function resultTheme(item) {
  return item.success ? 'success' : 'danger'
}

function stopPreviewExpiryTimer() {
  if (previewExpiryTimer) {
    clearTimeout(previewExpiryTimer)
    previewExpiryTimer = null
  }
}

function startPreviewExpiryTimer(expiresAt) {
  stopPreviewExpiryTimer()
  const expires = Date.parse(expiresAt || '')
  if (!Number.isFinite(expires)) {
    previewExpired.value = false
    return
  }
  const update = () => {
    previewExpired.value = Date.now() >= expires
    if (!previewExpired.value) previewExpiryTimer = setTimeout(update, 1000)
  }
  update()
}

function invalidatePreview() {
  previewData.value = null
  confirmData.value = null
  previewExpiresAt.value = null
  previewExpired.value = false
  stopPreviewExpiryTimer()
}

function goToStrategy() {
  if (!selectedFileIds.value.length || !selectedPrinterIds.value.length) {
    message.warning('请至少选择一个文件和一台打印机')
    return
  }
  activeStep.value = 1
}

function goToSelection() {
  if (confirming.value) return
  invalidatePreview()
  activeStep.value = 0
}

function queryIds(value) {
  if (!value) return []
  return String(value).split(',').map(item => item.trim()).filter(Boolean)
}

async function loadResources() {
  loadingResources.value = true
  try {
    const [treeResponse, printerResponse] = await Promise.all([
      getFileTree(),
      getPrinterList({ pageNum: 1, pageSize: 100 })
    ])
    const tree = Array.isArray(treeResponse?.data) ? treeResponse.data : []
    const folderIds = collectFolderIds(tree)
    const folderPages = await Promise.all([
      // 保留根目录查询，以兼容迁移未覆盖的历史根文件。
      getFileList({ pageNum: 1, pageSize: 100, parentId: null, folder: false }),
      ...folderIds.map(folderId => getFileList({
        pageNum: 1,
        pageSize: 100,
        parentId: folderId,
        folder: false
      }))
    ])
    const seenFileIds = new Set()
    files.value = folderPages.flatMap(page => page?.data?.records || [])
      .filter(file => file.canPrint === true)
      .filter(file => {
        const id = String(file.id)
        if (seenFileIds.has(id)) return false
        seenFileIds.add(id)
        return true
      })
    printers.value = printerResponse?.data?.records || []
  } catch (error) {
    console.error('加载批量派发资源失败:', error)
    message.error('加载文件或打印机失败')
  } finally {
    loadingResources.value = false
  }
}

function handleFileChange(selectedUploadFiles) {
  const selectedFiles = (Array.isArray(selectedUploadFiles) ? selectedUploadFiles : [])
    .map(file => file?.raw || file)
    .filter(Boolean)
  const validation = validateBatchUploadSelection(selectedFiles, files.value.map(file => file.originalName))
  uploadFiles.value = validation.files
  if (validation.rejected.length) {
    message.warning(validation.rejected.map(item => item.reason).join('；'))
  }
  uploadResult.value = null
}

async function uploadSelected() {
  uploading.value = true
  uploadProgress.value = 0
  const files = [...uploadFiles.value]
  lastBatchUploadFiles.value = files
  uploadController.value = new AbortController()
  try {
    const chunks = chunkItemsByBytes(files, MAX_UPLOAD_REQUEST_BYTES)
    const chunkLoaded = new Map()
    const totalBytes = files.reduce((total, file) => total + (Number(file.size) || 0), 0)
    const queueResults = await runUploadQueue(chunks, async (chunk, chunkIndex) => {
      const chunkProgress = event => {
        chunkLoaded.set(chunkIndex, event?.loaded || 0)
        const loaded = [...chunkLoaded.values()].reduce((total, value) => total + value, 0)
        if (totalBytes) uploadProgress.value = Math.min(Math.round((loaded / totalBytes) * 100), 99)
      }
      return batchUploadFiles(chunk, null, chunkProgress, {
        signal: uploadController.value.signal
      })
    }, {
      concurrency: 3,
      signal: uploadController.value.signal
    })
    const items = []
    queueResults.forEach((queueResult, chunkIndex) => {
      const chunk = chunks[chunkIndex]
      const offset = chunks.slice(0, chunkIndex).reduce((total, currentChunk) => total + currentChunk.length, 0)
      if (queueResult.status === 'fulfilled') {
        normalizeBatchUploadResult(queueResult.value.data).items.forEach(item => {
          const file = chunk[item.index]
          items.push({ ...item, index: offset + item.index, fileName: item.fileName || file?.name || '' })
        })
      } else {
        const failure = getUploadFailureState(queueResult.reason)
        chunk.forEach((file, itemIndex) => items.push({
          index: offset + itemIndex,
          fileId: null,
          fileName: file.name,
          status: 'FAILED',
          errorCode: failure.errorCode,
          message: failure.message,
          retryable: failure.retryable,
          requiresRefresh: failure.requiresRefresh
        }))
      }
    })
    uploadResult.value = normalizeBatchUploadResult({ items: items.sort((left, right) => left.index - right.index) })
    if (uploadUnknownCount.value) message.warning('批量上传部分结果未知，请刷新文件列表确认后再处理')
    else message.success('批量上传处理完成')
    uploadFiles.value = []
    await loadResources()
  } catch (error) {
    console.error('批量上传失败:', error)
    if (error?.name === 'CanceledError' || error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
      message.info('批量上传已取消')
    } else {
      const failure = getUploadFailureState(error)
      if (failure.requiresRefresh) message.warning(failure.message)
      else message.error(failure.message)
    }
  } finally {
    uploadController.value = null
    uploading.value = false
    uploadProgress.value = 0
  }
}

function cancelUpload() {
  uploadController.value?.abort()
}

async function retryFailedUploads() {
  if (!retryableUploadFiles.value.length || uploading.value) return
  uploadFiles.value = retryableUploadFiles.value
  await uploadSelected()
}

async function preview() {
  if (!selectedFileIds.value.length || !selectedPrinterIds.value.length) {
    message.warning('请至少选择一个文件和一台打印机')
    return
  }
  if (selectedFileIds.value.length > 100 || selectedPrinterIds.value.length > 100) {
    message.warning('单次预览最多选择 100 个文件和 100 台打印机')
    return
  }
  previewing.value = true
  invalidatePreview()
  const previewRequest = createBatchPreviewRequest({
    fileIds: selectedFileIds.value,
    printerIds: selectedPrinterIds.value,
    strategy: strategy.value,
    action: action.value
  })
  try {
    const response = await previewBatchDispatch(previewRequest)
    previewData.value = response?.data || null
    previewExpiresAt.value = previewData.value?.expiresAt || null
    startPreviewExpiryTimer(previewExpiresAt.value)
  } catch (error) {
    console.error('生成批量派发预览失败:', error)
    message.error(error?.message || '生成预览失败')
  } finally {
    previewing.value = false
  }
}

async function confirm(replay = false) {
  if (confirming.value || (!replay && confirmData.value) || !previewData.value || previewExpired.value || !executableItemIds.value.length) {
    message.warning(previewExpired.value ? '预览已过期，请重新生成' : '当前没有可执行的预览项')
    return
  }
  if (!replay) {
    try {
      await confirmMessage(
        '确认后将按预览结果创建任务或上传/启动，请确认打印机和文件均正确。',
        '确认批量派发',
        { confirmButtonText: '确认执行', cancelButtonText: '返回检查', type: 'warning' }
      )
    } catch {
      return
    }
  }

  confirming.value = true
  try {
    const response = await confirmBatchDispatch({
      planId: previewData.value.planId,
      version: previewData.value.version,
      itemIds: executableItemIds.value,
      confirmationToken: previewData.value.confirmationToken
    })
    confirmData.value = normalizeBatchConfirmResult(response?.data)
    jobStore.applyBatchConfirmResults(confirmData.value)
    message.success('批量派发已处理')
    await loadResources()
  } catch (error) {
    console.error('确认批量派发失败:', error)
    message.error(error?.message || '确认执行失败，请刷新预览')
  } finally {
    confirming.value = false
  }
}

function replayConfirm() {
  return confirm(true)
}

async function retryFailedConfirmItems() {
  const items = retryableConfirmItems.value
  if (!items.length || !confirmData.value?.planId) return
  const sourceItemIds = items.map(item => item.itemId).sort()
  const retryKey = `batch-retry:${confirmData.value.planId}:${sourceItemIds.join(',')}`
  try {
    const response = await retryPreviewBatchDispatch({
      sourcePlanId: confirmData.value.planId,
      sourceItemIds,
      retryKey
    })
    recoveryHistory.value.push({ planId: confirmData.value.planId, itemIds: sourceItemIds })
    confirmData.value = null
    previewData.value = response?.data || null
    previewExpiresAt.value = previewData.value?.expiresAt || null
    startPreviewExpiryTimer(previewExpiresAt.value)
    message.success('已生成新的失败项恢复预览，请确认执行')
  } catch (error) {
    console.error('生成失败项恢复预览失败:', error)
    message.error(error?.message || '生成恢复预览失败')
  }
}

async function openExistingJob(item) {
  if (!item?.jobId) return
  sessionStorage.setItem('farm-ui:job-history-detail', String(item.jobId))
  await router.push({ name: 'tasks-history' })
}

onMounted(async () => {
  await loadResources()
  const visibleIds = new Set(files.value.map(file => String(file.id)))
  selectedFileIds.value = queryIds(route.query.fileIds).filter(id => visibleIds.has(String(id)))
})

watch([selectedFileIds, selectedPrinterIds, strategy, action], () => {
  invalidatePreview()
  if (activeStep.value > 1) activeStep.value = 1
}, { deep: true })
onUnmounted(stopPreviewExpiryTimer)
</script>

<style scoped>
.batch-dispatch-page { display: flex; flex-direction: column; min-height: 100%; overflow: visible; color: var(--app-text-primary); gap: var(--app-spacing-4); }
.hint { color: var(--app-text-secondary); margin: 6px 0 12px; }
.dispatch-panel { min-width: 0; padding: var(--app-spacing-5); background: var(--app-surface); border: 1px solid var(--app-border); border-radius: var(--app-radius-large); }
.dispatch-panel__heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--app-spacing-4); }
.dispatch-panel__heading h2 { margin: 0; color: var(--app-text-primary); font-size: var(--td-font-size-title-medium); font-weight: 700; }
.selection-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.selection-row, .preview-row { display: flex; gap: 10px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--app-border-subtle); }
.selection-row span { flex: 1; }
small { color: var(--app-text-placeholder); }
.options-form { max-width: 560px; }
.option-select { width: 280px; }
.step-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
@media (max-width: 800px) {
  .selection-grid { grid-template-columns: 1fr; }
  .option-select { width: 100%; }
  .step-actions { justify-content: stretch; }
  .step-actions :deep(.t-button) { flex: 1 1 auto; }
}
</style>
