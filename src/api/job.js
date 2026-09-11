import request from '@/utils/request'
import {
  mapResponseData,
  normalizePageParams,
  normalizePageResponse,
  normalizePrintJob
} from '@/utils/dataAdapters'
import { toBatchPreviewPayload } from '@/utils/batchDispatch'

/**
 * 打印任务 API 模块
 * @module api/job
 */

/**
 * 获取排队中的任务列表
 * 仅返回 QUEUED 状态的待派发任务
 * @returns {Promise<{code: number, message: string, data: Array<PrintJob>}>} 任务队列
 */
export function getJobQueue() {
  return request({
    url: '/api/v1/print-jobs/queue',
    method: 'get'
  }).then(response => mapResponseData(
    response,
    data => Array.isArray(data) ? data.map(normalizePrintJob) : []
  ))
}

/** 获取任务详情，返回完整 PrintJobVO。 */
export function getJobDetail(id) {
  return request({
    url: `/api/v1/print-jobs/${id}`,
    method: 'get'
  }).then(response => mapResponseData(response, normalizePrintJob))
}

/**
 * 创建打印任务
 * @param {Object} data - 任务参数
 * @param {number|string} data.fileId - 文件ID
 * @param {string} [data.materialType] - 耗材类型
 * @param {string} [data.nozzleSize] - 喷头尺寸
 * @param {number} [data.priority=0] - 优先级（0-100）
 * @param {number|string} [data.printerId] - 指定打印机，仅进入 ASSIGNED，不直接启动
 * @param {string} [data.idempotencyKey] - 幂等键
 * @returns {Promise<{code: number, message: string, data: string}>} 创建结果，data 为新任务 ID
 */
export function createPrintJob(data, options = {}) {
  return request({
    url: '/api/v1/print-jobs',
    method: 'post',
    data,
    ...options
  }).then(response => mapResponseData(response, normalizePrintJob))
}

/**
 * 使用旧任务创建地址，仅用于兼容尚未迁移的后端服务。
 * 新业务代码必须调用 createPrintJob。
 * @deprecated
 */
export function createPrintJobLegacy(data) {
  return request({
    url: '/api/v1/print-jobs/create',
    method: 'post',
    data
  }).then(response => mapResponseData(response, normalizePrintJob))
}

/**
 * 指派任务给指定打印机（仅分配，不触发打印）- 安全模式第一步
 * @param {number|string} jobId - 任务ID
 * @param {number|string} printerId - 打印机ID
 * @returns {Promise<{code: number, message: string, data: PrintJob}>} 指派结果
 */
export function assignJobToPrinter(jobId, printerId) {
  return request({
    url: '/api/v1/print-jobs/safe/assign',
    method: 'post',
    data: { jobId, printerId }
  }).then(response => mapResponseData(response, normalizePrintJob))
}

/**
 * 启动任务打印（现场启动打印）- 安全模式第二步之二
 * @param {number|string} jobId - 任务ID
 * @param {string} [action='START_PRINT'] - 操作类型：'START_PRINT' 或 'UPLOAD_ONLY'
 * @returns {Promise<{code: number, message: string, data: PrintJob}>} 启动结果
 */
export function startJob(jobId, action = 'START_PRINT') {
  return request({
    url: '/api/v1/print-jobs/safe/start',
    method: 'post',
    data: { jobId, action }
  }).then(response => mapResponseData(response, normalizePrintJob))
}

/**
 * 取消/删除打印任务
 * @param {number|string} id - 任务ID
 * @returns {Promise<{code: number, message: string}>} 取消结果
 */
export function cancelJob(id) {
  return request({
    url: `/api/v1/print-jobs/${id}`,
    method: 'delete'
  })
}

/** 将失败任务重新放回队列。 */
export function retryJob(id) {
  return request({ url: `/api/v1/print-jobs/${id}/retry`, method: 'post' })
}

/** 将已分配或待机任务重新放回队列。 */
export function requeueJob(id) {
  return request({ url: `/api/v1/print-jobs/${id}/requeue`, method: 'post' })
}

/** 人工核对 RECONCILING 任务结果。 */
export function reconcilePrintJob(id, data) {
  return request({
    url: `/api/v1/print-jobs/${id}/reconcile`,
    method: 'post',
    data
  }).then(response => mapResponseData(response, normalizePrintJob))
}

/** 调整排队任务优先级，范围 0-100。 */
export function updateJobPriority(id, priority) {
  return request({
    url: `/api/v1/print-jobs/${id}/priority`,
    method: 'put',
    data: { priority }
  })
}

/** 预览用户确认的批量派发计划，不产生上传或打印副作用。 */
export function previewBatchDispatch(data) {
  return request({
    url: '/api/v1/print-jobs/batch/preview',
    method: 'post',
    data: toBatchPreviewPayload(data)
  })
}

/** 确认并执行批量派发计划。 */
export function confirmBatchDispatch(data) {
  return request({
    url: '/api/v1/print-jobs/batch/confirm',
    method: 'post',
    data
  })
}

/** 为批量确认失败项生成新的恢复预览，不复用旧计划。 */
export function retryPreviewBatchDispatch(data) {
  return request({
    url: '/api/v1/print-jobs/batch/retry-preview',
    method: 'post',
    data
  })
}

/**
 * 获取打印任务分页列表（支持高级检索）
 * @param {Object} params - 查询参数
 * @param {number} params.pageNum - 页码
 * @param {number} params.pageSize - 每页大小
 * @param {string} [params.status] - 任务状态
 * @param {number} [params.printerId] - 打印机ID
 * @param {string} [params.startTime] - 开始时间（ISO格式）
 * @param {string} [params.endTime] - 结束时间（ISO格式）
 * @returns {Promise<{code: number, message: string, data: {records: Array<PrintJob>, total: number}}>} 分页结果
 */
export function getJobPage(params = {}) {
  return request({
    url: '/api/v1/print-jobs/page',
    method: 'post',
    data: normalizePageParams(params)
  }).then(response => mapResponseData(
    response,
    data => normalizePageResponse(data, normalizePrintJob)
  ))
}

// ============================================
// Type Definitions (JSDoc)
// ============================================

/**
 * @typedef {Object} PrintJob
 * @property {string} id - 任务ID（JSON 十进制字符串）
 * @property {string} fileId - 关联文件ID（JSON 十进制字符串）
 * @property {string} fileName - 文件名称
 * @property {string} [printerId] - 分配的打印机ID（JSON 十进制字符串）
 * @property {string} [printerName] - 打印机名称
 * @property {string} status - 任务状态（UPLOADING/QUEUED/ASSIGNED/READY/PRINTING/PAUSED/COMPLETED/RECONCILING/FAILED/CANCELLED）
 * @property {number} priority - 优先级（0-100）
 * @property {string} [materialType] - 耗材类型
 * @property {string} [nozzleSize] - 喷头尺寸
 * @property {number} progress - 打印进度（0-100）
 * @property {string} createdAt - 创建时间
 * @property {string} updatedAt - 更新时间
 */
