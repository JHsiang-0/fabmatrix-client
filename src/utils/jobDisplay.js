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

export const JOB_DISPLAY_SOURCE = Object.freeze({
  CURRENT: '当前资源',
  SNAPSHOT: '任务快照',
  UNAVAILABLE: '关联不可用',
  UNASSIGNED: '未分配',
  MISSING: '字段缺失'
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
  ? `关联不可用${label} #${idText(id)}`
  : `字段缺失${label}`

const unknownUser = id => hasDisplayValue(id)
  ? `关联不可用用户 #${idText(id)}`
  : '字段缺失用户'

const displayFileName = (job, mode) => (
  pickDisplayValue(job, mode, 'fileName', 'fileNameSnapshot')
  || missingResource('文件', job?.fileId)
)

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
  const printer = getPrinterDetailDisplay(job, normalizedMode)

  return {
    jobId: idText(job.id),
    fileId: idText(job.fileId),
    printerId: idText(job.printerId),
    userId: idText(job.userId),
    operatorId: idText(job.operatorId),
    fileName: displayFileName(job, normalizedMode),
    printerName: printer.printerName,
    machineNumber: printer.machineNumber,
    creatorUsername: displayUser(job, normalizedMode, 'creatorUsername', 'creatorUsernameSnapshot', 'userId', false),
    operatorUsername: displayUser(job, normalizedMode, 'operatorUsername', 'operatorUsernameSnapshot', 'operatorId', true)
  }
}

export const getQueueJobDisplay = job => getJobDisplay(job, JOB_DISPLAY_MODE.CURRENT)

export const getActiveJobDisplay = job => getJobDisplay(job, JOB_DISPLAY_MODE.CURRENT)

export const getHistoryJobDisplay = job => getJobDisplay(job, JOB_DISPLAY_MODE.HISTORY)

const getDetailField = (job, mode, currentField, snapshotField, idField, missingValue, unassignedValue = missingValue) => {
  const fields = isHistoryMode(mode)
    ? [[snapshotField, JOB_DISPLAY_SOURCE.SNAPSHOT], [currentField, JOB_DISPLAY_SOURCE.CURRENT]]
    : [[currentField, JOB_DISPLAY_SOURCE.CURRENT], [snapshotField, JOB_DISPLAY_SOURCE.SNAPSHOT]]
  const selected = fields.find(([field]) => hasDisplayValue(job?.[field]))

  if (selected) {
    return { value: displayText(job[selected[0]]), source: selected[1] }
  }
  if (!hasDisplayValue(job?.[idField])) {
    return {
      value: unassignedValue,
      source: unassignedValue === '未分配' ? JOB_DISPLAY_SOURCE.UNASSIGNED : JOB_DISPLAY_SOURCE.MISSING
    }
  }
  return { value: missingValue(job?.[idField]), source: JOB_DISPLAY_SOURCE.UNAVAILABLE }
}

const detailMissingFile = id => missingResource('文件', id)
const detailMissingPrinter = id => missingResource('打印机', id)
const detailMissingUser = id => unknownUser(id)

const getPrinterDetailDisplay = (job, mode) => {
  const current = [displayText(job?.printerName), displayText(job?.machineNumber)]
  const snapshot = [displayText(job?.printerNameSnapshot), displayText(job?.machineNumberSnapshot)]
  const hasCurrent = current.some(Boolean)
  const hasSnapshot = snapshot.some(Boolean)
  let source
  let values

  if (isHistoryMode(mode) && hasSnapshot) {
    source = JOB_DISPLAY_SOURCE.SNAPSHOT
    values = snapshot
  } else if (hasCurrent) {
    source = JOB_DISPLAY_SOURCE.CURRENT
    values = current
  } else if (hasSnapshot) {
    source = JOB_DISPLAY_SOURCE.SNAPSHOT
    values = snapshot
  } else if (hasDisplayValue(job?.printerId)) {
    source = JOB_DISPLAY_SOURCE.UNAVAILABLE
    values = [detailMissingPrinter(job?.printerId), detailMissingPrinter(job?.printerId)]
  } else {
    source = JOB_DISPLAY_SOURCE.UNASSIGNED
    values = ['未分配', '未分配']
  }

  return {
    printerName: values[0] || '字段缺失打印机名称',
    machineNumber: values[1] || '字段缺失机器编号',
    source
  }
}

/**
 * 任务详情可读摘要适配器。
 *
 * 终态任务默认按 history 展示执行时快照，活动任务默认按 current 展示当前关联资源。
 * 每个可读字段同时返回来源，避免用户通过技术 ID 推断关联是否仍然存在。
 * @param {Object} job PrintJobSummaryVO/PrintJobDetailVO
 * @param {'current'|'history'|'snapshot-first'} [mode]
 * @returns {{fileName: string, printerName: string, machineNumber: string, creatorUsername: string, operatorUsername: string, sources: Object, mode: string}}
 */
export function getJobDetailDisplay(job = {}, mode = JOB_DISPLAY_MODE.CURRENT) {
  const normalizedMode = isHistoryMode(mode) ? JOB_DISPLAY_MODE.HISTORY : JOB_DISPLAY_MODE.CURRENT
  const base = getJobDisplay(job, normalizedMode)
  const fileName = getDetailField(job, normalizedMode, 'fileName', 'fileNameSnapshot', 'fileId', detailMissingFile, '字段缺失文件')
  const printer = getPrinterDetailDisplay(job, normalizedMode)
  const creatorUsername = getDetailField(job, normalizedMode, 'creatorUsername', 'creatorUsernameSnapshot', 'userId', detailMissingUser, '字段缺失用户')
  const operatorUsername = getDetailField(job, normalizedMode, 'operatorUsername', 'operatorUsernameSnapshot', 'operatorId', detailMissingUser, '未分配')

  return {
    ...base,
    fileName: fileName.value,
    printerName: printer.printerName,
    machineNumber: printer.machineNumber,
    creatorUsername: creatorUsername.value,
    operatorUsername: operatorUsername.value,
    sources: {
      fileName: fileName.source,
      printerName: printer.source,
      machineNumber: printer.source,
      creatorUsername: creatorUsername.source,
      operatorUsername: operatorUsername.source
    },
    mode: normalizedMode
  }
}

export { hasDisplayValue }
