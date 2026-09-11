const PREVIEW_STRATEGIES = Object.freeze(['ONE_TO_ONE', 'ROUND_ROBIN', 'AUTO_MATCH'])
const PREVIEW_ACTIONS = Object.freeze(['UPLOAD_ONLY', 'QUEUE', 'START_AFTER_CONFIRM'])
const SUCCESS_STATUSES = Object.freeze(['ASSIGNED', 'UPLOADING', 'READY', 'SUCCEEDED'])

function normalizeIds(ids) {
  return (Array.isArray(ids) ? ids : [])
    .map(id => String(id).trim())
    .filter(Boolean)
}

function normalizeOptionalId(value) {
  return value == null ? null : String(value)
}

function createRequestId() {
  return `batch-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function resolvePrinterId(strategy, printerIds, index) {
  if (strategy === 'AUTO_MATCH' || !printerIds.length) return null
  if (strategy === 'ROUND_ROBIN') return printerIds[index % printerIds.length]
  return printerIds[index] ?? null
}

export function acquireBatchConfirmLock({ confirming, actionLoadingKey, planId }) {
  if (confirming.value || actionLoadingKey.value) return false
  confirming.value = true
  actionLoadingKey.value = `confirm:${planId}`
  return true
}

export function releaseBatchConfirmLock({ confirming, actionLoadingKey }) {
  confirming.value = false
  actionLoadingKey.value = ''
}

/**
 * 构造批量预览的前端上下文。后端请求仍只使用交接文档冻结的四个字段。
 */
export function createBatchPreviewRequest({
  fileIds = [],
  printerIds = [],
  strategy = 'ONE_TO_ONE',
  action = 'QUEUE',
  requestId = createRequestId()
} = {}) {
  const normalizedFileIds = normalizeIds(fileIds)
  const normalizedPrinterIds = normalizeIds(printerIds)
  const normalizedStrategy = PREVIEW_STRATEGIES.includes(strategy) ? strategy : 'ONE_TO_ONE'
  const normalizedAction = PREVIEW_ACTIONS.includes(action) ? action : 'QUEUE'

  return {
    requestId,
    fileIds: normalizedFileIds,
    printerIds: normalizedPrinterIds,
    strategy: normalizedStrategy,
    action: normalizedAction,
    items: normalizedFileIds.map((fileId, index) => ({
      fileId,
      printerId: resolvePrinterId(normalizedStrategy, normalizedPrinterIds, index)
    }))
  }
}

export function toBatchPreviewPayload(previewRequest) {
  return {
    fileIds: previewRequest.fileIds,
    printerIds: previewRequest.printerIds,
    strategy: previewRequest.strategy,
    action: previewRequest.action
  }
}

export function isBatchConfirmItemSuccessful(item) {
  return SUCCESS_STATUSES.includes(String(item?.status || '').toUpperCase())
}

export function normalizeBatchConfirmResult(data = {}) {
  return {
    planId: data.planId ?? null,
    status: data.status ?? null,
    repeated: data.repeated === true,
    items: (Array.isArray(data.items) ? data.items : []).map(item => {
      return {
        itemId: item?.itemId ?? null,
        fileId: normalizeOptionalId(item?.fileId),
        fileName: item?.fileName ?? null,
        printerId: normalizeOptionalId(item?.printerId),
        printerName: item?.printerName ?? null,
        printerStatus: item?.printerStatus ?? null,
        canExecute: item?.canExecute ?? null,
        status: item?.status ?? null,
        reasonCode: item?.reasonCode ?? null,
        message: item?.message ?? null,
        jobId: item?.jobId == null ? null : String(item.jobId),
        sourcePlanId: item?.sourcePlanId ?? null,
        sourceItemId: item?.sourceItemId ?? null,
        recoveryAction: item?.recoveryAction ?? null,
        attemptCount: item?.attemptCount ?? null,
        retryable: item?.retryable ?? null
      }
    })
  }
}
