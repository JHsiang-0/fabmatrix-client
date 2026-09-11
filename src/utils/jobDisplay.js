/**
 * 任务列表可读摘要适配器。
 *
 * queue/active 使用当前关联资源优先，history 使用执行时快照优先。
 * 适配器只读取服务端已返回的字段，不通过 ID 反查资源，也不将 ID 转成 Number。
 */

export const JOB_DISPLAY_MODE = Object.freeze({
  CURRENT: 'current',
  HISTORY: 'history'
})

const isHistoryMode = mode => mode === JOB_DISPLAY_MODE.HISTORY || mode === 'snapshot-first'

const hasDisplayValue = value => value !== undefined
  && value !== null
  && String(value).trim() !== ''

const displayText = value => hasDisplayValue(value) ? String(value) : ''

const idText = value => hasDisplayValue(value) ? String(value) : ''

const pickDisplayValue = (job, mode, currentField, snapshotField) => {
  const fields = isHistoryMode(mode)
    ? [snapshotField, currentField]
    : [currentField, snapshotField]
  return fields.map(field => displayText(job?.[field])).find(Boolean) || ''
}

const missingResource = (label, id) => hasDisplayValue(id)
  ? `已删除${label} #${idText(id)}`
  : `未知${label}`

const unknownUser = id => hasDisplayValue(id)
  ? `未知用户 #${idText(id)}`
  : '未知用户'

const displayFileName = (job, mode) => (
  pickDisplayValue(job, mode, 'fileName', 'fileNameSnapshot')
  || missingResource('文件', job?.fileId)
)

const hasHistoricalPrinterIdentity = job => (
  hasDisplayValue(job?.printerId)
  || hasDisplayValue(job?.printerNameSnapshot)
  || hasDisplayValue(job?.machineNumberSnapshot)
)

const displayPrinterPart = (job, mode, field, snapshotField) => {
  const hasPrinter = isHistoryMode(mode)
    ? hasHistoricalPrinterIdentity(job)
    : hasDisplayValue(job?.printerId)

  if (!hasPrinter) return '未分配'
  return pickDisplayValue(job, mode, field, snapshotField)
    || missingResource('打印机', job?.printerId)
}

const displayUser = (job, mode, currentField, snapshotField, idField, unassignedWhenMissing) => {
  const username = pickDisplayValue(job, mode, currentField, snapshotField)
  if (username) return username
  if (unassignedWhenMissing && !hasDisplayValue(job?.[idField])) return '未分配'
  return unknownUser(job?.[idField])
}

/**
 * @param {Object} job PrintJobSummaryVO/PrintJobDetailVO
 * @param {'current'|'history'|'snapshot-first'} mode
 * @returns {{jobId: string, fileId: string, printerId: string, userId: string, operatorId: string, fileName: string, printerName: string, machineNumber: string, creatorUsername: string, operatorUsername: string}}
 */
export function getJobDisplay(job = {}, mode = JOB_DISPLAY_MODE.CURRENT) {
  const normalizedMode = isHistoryMode(mode) ? JOB_DISPLAY_MODE.HISTORY : JOB_DISPLAY_MODE.CURRENT

  return {
    jobId: idText(job.id),
    fileId: idText(job.fileId),
    printerId: idText(job.printerId),
    userId: idText(job.userId),
    operatorId: idText(job.operatorId),
    fileName: displayFileName(job, normalizedMode),
    printerName: displayPrinterPart(job, normalizedMode, 'printerName', 'printerNameSnapshot'),
    machineNumber: displayPrinterPart(job, normalizedMode, 'machineNumber', 'machineNumberSnapshot'),
    creatorUsername: displayUser(job, normalizedMode, 'creatorUsername', 'creatorUsernameSnapshot', 'userId', false),
    operatorUsername: displayUser(job, normalizedMode, 'operatorUsername', 'operatorUsernameSnapshot', 'operatorId', true)
  }
}

export const getQueueJobDisplay = job => getJobDisplay(job, JOB_DISPLAY_MODE.CURRENT)

export const getActiveJobDisplay = job => getJobDisplay(job, JOB_DISPLAY_MODE.CURRENT)

export const getHistoryJobDisplay = job => getJobDisplay(job, JOB_DISPLAY_MODE.HISTORY)

export { hasDisplayValue }
