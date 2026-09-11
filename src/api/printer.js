import request from '@/utils/request'
import {
  mapResponseData,
  normalizePageParams,
  normalizePageResponse,
  normalizePrinter,
  normalizePrinterDetail,
  normalizeId,
  normalizePrinterStatus
} from '@/utils/dataAdapters'

/**
 * 打印机设备 API 模块
 * @module api/printer
 */

/**
 * 分页查询打印机列表
 * @param {Object} params - 查询参数
 * @param {number} [params.pageNum=1] - 页码
 * @param {number} [params.pageSize=10] - 每页条数
 * @param {string} [params.status] - 设备状态（OFFLINE/IDLE/PREPARING/PRINTING/PAUSED/ERROR/UNKNOWN）
 * @returns {Promise<{code: number, message: string, data: {records: Array<Printer>, total: number, pageNum: number, pageSize: number}}>} 分页结果
 */
export function getPrinterList(params = {}, options = {}) {
  return request({
    url: '/api/v1/printers/page',
    method: 'get',
    params: normalizePageParams(params),
    ...options
  }).then(response => mapResponseData(
    response,
    data => normalizePageResponse(data, normalizePrinter)
  ))
}

/**
 * 查询单个打印机的真实详情。
 * @param {number|string} id - 打印机 ID
 * @returns {Promise<{code: number, message: string, data: Printer}>} 打印机详情
 */
export function getPrinterDetail(id) {
  return request({
    url: `/api/v1/printers/${id}`,
    method: 'get'
  }).then(normalizePrinterDetailResponse)
}

/** 查询单台打印机监控配置及通信健康信息。 */
export function getPrinterMonitor(id) {
  return request({
    url: `/api/v1/printers/${id}/monitor`,
    method: 'get'
  }).then(response => mapResponseData(response, data => data && typeof data === 'object' ? data : null))
}

/** 更新单台打印机是否纳入后台监控。仅 ADMIN 可调用。 */
export function updatePrinterMonitor(id, monitorEnabled) {
  return request({
    url: `/api/v1/printers/${id}/monitor`,
    method: 'put',
    data: { monitorEnabled: monitorEnabled === true }
  }).then(response => mapResponseData(response, data => data && typeof data === 'object' ? data : null))
}

/** 批量更新打印机监控开关。仅 ADMIN 可调用，最多100台。 */
export function updatePrinterMonitorBatch(printerIds, monitorEnabled) {
  return request({
    url: '/api/v1/printers/monitor/batch',
    method: 'put',
    data: {
      printerIds: Array.isArray(printerIds) ? printerIds : [],
      monitorEnabled: monitorEnabled === true
    }
  })
}

/**
 * 规范化单个打印机响应中的 Long 类型 ID。
 */
function normalizePrinterResponse(response) {
  return mapResponseData(response, normalizePrinter)
}

function normalizePrinterDetailResponse(response) {
  return mapResponseData(response, normalizePrinterDetail)
}

const normalizeStatusHistory = record => {
  if (!record || typeof record !== 'object') return record
  const normalized = { ...record }
  if (Object.prototype.hasOwnProperty.call(normalized, 'id')) normalized.id = normalizeId(normalized.id)
  if (Object.prototype.hasOwnProperty.call(normalized, 'printerId')) normalized.printerId = normalizeId(normalized.printerId)
  if (Object.prototype.hasOwnProperty.call(normalized, 'status')) normalized.status = normalizePrinterStatus(normalized.status)
  if (Object.prototype.hasOwnProperty.call(normalized, 'progress')) {
    const progress = Number(normalized.progress)
    normalized.progress = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0
  }
  return normalized
}

const normalizeStatistics = data => {
  if (!data || typeof data !== 'object') return data
  const normalized = { ...data }
  if (Object.prototype.hasOwnProperty.call(normalized, 'printerId')) normalized.printerId = normalizeId(normalized.printerId)
  const numberFields = ['totalJobs', 'completedJobs', 'failedJobs', 'cancelledJobs', 'activeJobs', 'totalPrintSeconds', 'averagePrintSeconds']
  numberFields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(normalized, field)) {
      const value = Number(normalized[field])
      normalized[field] = Number.isFinite(value) && value >= 0 ? value : 0
    }
  })
  if (Object.prototype.hasOwnProperty.call(normalized, 'successRate')) {
    const successRate = Number(normalized.successRate)
    normalized.successRate = Number.isFinite(successRate) ? Math.min(Math.max(successRate, 0), 100) : 0
  }
  return normalized
}

/** 查询打印机状态历史，记录按 recordedAt 倒序返回。 */
export function getPrinterStatusHistory(id, params = {}) {
  const query = normalizePageParams(params)
  return request({
    url: `/api/v1/printers/${id}/history`,
    method: 'get',
    params: {
      ...query,
      ...(params.from ? { from: params.from } : {}),
      ...(params.to ? { to: params.to } : {})
    }
  }).then(response => mapResponseData(
    response,
    data => normalizePageResponse(data, normalizeStatusHistory)
  ))
}

/** 查询打印机任务统计，时长单位为秒。 */
export function getPrinterStatistics(id, params = {}) {
  return request({
    url: `/api/v1/printers/${id}/statistics`,
    method: 'get',
    params: {
      ...(params.from ? { from: params.from } : {}),
      ...(params.to ? { to: params.to } : {})
    }
  }).then(response => mapResponseData(response, normalizeStatistics))
}

/**
 * 新增打印机设备
 * @param {Object} data - 打印机数据
 * @returns {Promise<Object>} 新增结果
 */
export function addPrinter(data) {
  return request({
    url: '/api/v1/printers/add',
    method: 'post',
    data
  }).then(normalizePrinterResponse)
}

/**
 * 更新打印机信息
 * @param {Object} data - 打印机数据
 * @returns {Promise<Object>} 更新结果
 */
export function updatePrinter(data) {
  return request({
    url: '/api/v1/printers/update',
    method: 'put',
    data
  }).then(normalizePrinterResponse)
}

/**
 * 删除打印机设备
 * @param {number|string} id - 设备ID
 * @returns {Promise<Object>} 删除结果
 */
export function deletePrinter(id) {
  return request({
    url: `/api/v1/printers/delete/${id}`,
    method: 'delete'
  })
}

/**
 * 扫描局域网内的打印机设备
 * @param {string} subnet - 子网地址（如：192.168.1）
 * @returns {Promise<{code: number, message: string, data: Array<ScannedDevice>}>} 扫描结果
 */
export function scanPrinters(subnet) {
  return request({
    url: '/api/v1/printers/scan',
    method: 'get',
    params: { subnet }
  })
}

/**
 * 批量添加/同步打印机设备
 * @param {Array<Object>} devices - 设备数组
 * @param {string} devices[].ipAddress - IP地址
 * @param {string} devices[].macAddress - MAC地址
 * @param {string} devices[].name - 设备名称
 * @returns {Promise<{code: number, message: string, data: Array<Printer>}>} 批量添加结果
 */
export function batchAddPrinters(devices) {
  return request({
    url: '/api/v1/printers/batch-add',
    method: 'post',
    data: devices
  })
}

// ============================================
// 数字孪生看板 - 设备位置管理 API
// ============================================

/**
 * 获取未分配位置的设备列表
 * @returns {Promise<{code: number, message: string, data: Array<Printer>}>} 未分配设备列表
 */
export function getUnallocatedPrinters() {
  return request({
    url: '/api/v1/printers/unallocated',
    method: 'get'
  }).then(response => mapResponseData(
    response,
    data => Array.isArray(data) ? data.map(normalizePrinter) : []
  ))
}

/**
 * 批量更新设备位置（绑定/解绑/移动）
 * @param {Array<Object>} positions - 位置更新数组
 * @param {number} positions[].id - 设备ID
 * @param {number|null} positions[].gridRow - 网格行号（null表示解绑）
 * @param {number|null} positions[].gridCol - 网格列号（null表示解绑）
 * @returns {Promise<{code: number, message: string}>} 更新结果
 */
export function batchUpdatePositions(positions) {
  return request({
    url: '/api/v1/printers/positions',
    method: 'put',
    data: positions
  })
}

/**
 * 暂停打印机当前任务。
 * @param {number|string} printerId - 打印机ID
 * @returns {Promise<{code: number, message: string, data: null}>} 操作结果
 */
export function pausePrinter(printerId) {
  return request({
    url: `/api/v1/control/${printerId}/pause`,
    method: 'post'
  })
}

/** 恢复打印机当前暂停任务。 */
export function resumePrinter(printerId) {
  return request({
    url: `/api/v1/control/${printerId}/resume`,
    method: 'post'
  })
}

/** 取消打印机当前任务。 */
export function cancelPrinter(printerId) {
  return request({
    url: `/api/v1/control/${printerId}/cancel`,
    method: 'post'
  })
}

/**
 * 对打印机执行紧急停机。
 * @param {number|string} printerId - 打印机ID
 * @returns {Promise<{code: number, message: string, data: null}>} 操作结果
 */
export function emergencyStopPrinter(printerId) {
  return request({
    url: `/api/v1/control/${printerId}/emergency-stop`,
    method: 'post'
  })
}

/**
 * 确认打印机热床已清理完毕 - 安全模式第二步之一
 * @param {number} printerId - 打印机ID
 * @returns {Promise<{code: number, message: string, data: Printer}>} 更新结果
 */
export function confirmSafe(printerId) {
  return request({
    url: '/api/v1/print-jobs/safe/confirm',
    method: 'post',
    data: { printerId }
  }).then(normalizePrinterResponse)
}

// ============================================
// Type Definitions (JSDoc)
// ============================================

/**
 * @typedef {Object} Printer
 * @property {number} id - 设备唯一标识
 * @property {string} name - 设备名称
 * @property {string} machineNumber - 机器编号（如 A-01）
 * @property {string} ipAddress - IP地址
 * @property {string} macAddress - MAC地址
 * @property {string} firmwareType - 固件类型（KLIPPER/RRF）
 * @property {string} status - 设备状态（OFFLINE/IDLE/PREPARING/PRINTING/PAUSED/ERROR/UNKNOWN）
 * @property {number} [currentJobId] - 当前任务ID
 * @property {string} [currentMaterial] - 当前耗材类型
 * @property {string} [nozzleSize] - 喷头尺寸
 * @property {number} [gridRow] - 网格行号
 * @property {number} [gridCol] - 网格列号
 * @property {string} createdAt - 创建时间
 * @property {string} updatedAt - 更新时间
 */

/**
 * @typedef {Object} ScannedDevice
 * @property {string} ipAddress - IP地址
 * @property {string} macAddress - MAC地址
 * @property {boolean} isNewDevice - 是否为新设备
 * @property {string} status - 设备状态
 * @property {string} suggestedName - 建议的设备名称
 */
