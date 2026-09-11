import { cloneMockData } from './data.js'

const removeFields = (value, fields) => {
  const data = cloneMockData(value)
  fields.forEach(field => delete data[field])
  return data
}

const normalizePublicLongIds = (value, fields) => {
  const data = cloneMockData(value)
  fields.forEach(field => {
    if (data[field] !== undefined && data[field] !== null) data[field] = String(data[field])
  })
  return data
}

const SEMANTIC_ID_FIELDS = new Set([
  'id', 'printerId', 'currentJobId', 'jobId', 'fileId', 'userId', 'operatorId',
  'retryOfJobId', 'rootJobId',
  'conflicts', 'outOfBoundsPrinters', 'changedPositions', 'unallocatedPrinters'
])

/** 在 Mock 的 HTTP/WS 边界保留语义 ID 原字符串，绝不触碰计数、版本和时间字段。 */
export const toPublicSemanticIds = value => {
  if (Array.isArray(value)) return value.map(toPublicSemanticIds)
  if (!value || typeof value !== 'object') return value
  const result = {}
  Object.entries(value).forEach(([key, item]) => {
    if (SEMANTIC_ID_FIELDS.has(key)) {
      result[key] = normalizeSemanticIdValue(item)
    } else {
      result[key] = toPublicSemanticIds(item)
    }
  })
  return result
}

const normalizeSemanticIdValue = value => {
  if (Array.isArray(value)) return value.map(normalizeSemanticIdValue)
  if (value && typeof value === 'object') return toPublicSemanticIds(value)
  return value == null ? value : String(value)
}

/**
 * 将内部文件对象转换为正式 PrintFileVO，下载地址等内部字段不得出现在响应中。
 */
export const toPublicFile = file => normalizePublicLongIds(removeFields(file, [
  'safeName',
  'fileUrl',
  'rustfsKey',
  'apiKey',
  'isFolder',
  'estimatedSeconds'
]), ['id', 'parentId', 'userId'])

/**
 * 将内部打印机对象转换为正式 PrinterVO，避免输出人为拼接的任务摘要。
 */
export const toPublicPrinter = printer => normalizePublicLongIds(removeFields(printer, [
  'apiKey',
  'currentJobStatus',
  'currentJobFileName'
]), ['id', 'currentJobId'])

/**
 * 将内部任务对象转换为正式 PrintJobSummaryVO，不输出内部嵌套资源或旧结束时间。
 * 可读摘要由任务路由在 Mock 边界按当前关联资源补齐。
 */
export const toPublicJob = job => normalizePublicLongIds(removeFields(job, [
  'endedAt'
]), ['id', 'fileId', 'printerId', 'userId', 'operatorId', 'retryOfJobId', 'rootJobId'])
