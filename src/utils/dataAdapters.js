import {
  FIRMWARE_TYPES,
  JOB_STATUS,
  JOB_STATUS_VALUES,
  PAGINATION,
  PRINTER_STATUS,
  PRINTER_STATUS_VALUES
} from './constants.js'

const identity = value => value

const toPositiveInteger = (value, fallback) => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

const toNonNegativeInteger = value => {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

const normalizeEnum = (value, values, aliases = {}) => {
  if (value === undefined || value === null || value === '') return null
  const normalized = String(value).trim().toUpperCase()
  const canonical = aliases[normalized] || normalized
  return values.includes(canonical) ? canonical : null
}

/**
 * 规范化分页请求参数。
 * 前端始终发送 pageNum/pageSize，兼容逻辑只存在于响应适配层。
 */
export function normalizePageParams(params = {}) {
  const pageNum = toPositiveInteger(params.pageNum, PAGINATION.DEFAULT_PAGE_NUM)
  const requestedPageSize = toPositiveInteger(params.pageSize, PAGINATION.DEFAULT_PAGE_SIZE)
  const pageSize = Math.min(requestedPageSize, PAGINATION.MAX_PAGE_SIZE)

  return {
    ...params,
    pageNum,
    pageSize
  }
}

/**
 * 规范化文件分页查询参数，固定使用后端约定的 fileName，不兼容旧 keyword。
 */
export function normalizePrintFilePageParams(params = {}) {
  const fileName = typeof params.fileName === 'string' ? params.fileName.trim() : undefined
  const materialType = typeof params.materialType === 'string'
    ? params.materialType.trim().toUpperCase()
    : undefined

  return normalizePageParams({
    pageNum: params.pageNum,
    pageSize: params.pageSize,
    fileName: fileName || undefined,
    materialType: materialType || undefined,
    parentId: params.parentId ?? null,
    folder: typeof params.folder === 'boolean' ? params.folder : undefined
  })
}

/**
 * 统一分页响应，兼容后端迁移前的 current/size 字段。
 * 服务端提供 pages 时必须以服务端值为准，计算值只用于历史响应兜底。
 */
export function normalizePageResponse(data, normalizeRecord = identity) {
  const source = data && typeof data === 'object' ? data : {}
  const pageNum = toPositiveInteger(
    source.pageNum ?? source.current,
    PAGINATION.DEFAULT_PAGE_NUM
  )
  const requestedPageSize = toPositiveInteger(
    source.pageSize ?? source.size,
    PAGINATION.DEFAULT_PAGE_SIZE
  )
  const pageSize = Math.min(requestedPageSize, PAGINATION.MAX_PAGE_SIZE)
  const total = Math.max(Number(source.total) || 0, 0)
  const records = Array.isArray(source.records) ? source.records : []
  const serverPages = toNonNegativeInteger(source.pages)

  return {
    records: records.map(normalizeRecord),
    total,
    pageNum,
    pageSize,
    pages: serverPages ?? Math.ceil(total / pageSize)
  }
}

/**
 * 只转换统一响应中的 data，保留 code/message/timestamp。
 */
export function mapResponseData(response, mapper) {
  if (!response || typeof response !== 'object') return response

  return {
    ...response,
    data: mapper(response.data)
  }
}

/**
 * Long 类型 ID 在 JavaScript 中统一按字符串处理，避免大整数精度丢失。
 */
export function normalizeId(value) {
  if (value === undefined || value === null || value === '') return value ?? null
  return String(value)
}

const normalizeIdFields = (record, fields) => {
  if (!record || typeof record !== 'object') return record

  const normalized = { ...record }
  fields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(normalized, field)) {
      normalized[field] = normalizeId(normalized[field])
    }
  })
  return normalized
}

/**
 * 规范化 PrinterVO/实时设备状态。
 * 历史聚合状态仅在适配边界转换；ONLINE 明确降级为 UNKNOWN，避免进入持久化领域。
 */
export function normalizePrinterStatus(value) {
  return normalizeEnum(value, PRINTER_STATUS_VALUES, {
    ONLINE: PRINTER_STATUS.UNKNOWN,
    STANDBY: PRINTER_STATUS.IDLE,
    STARTING: PRINTER_STATUS.PREPARING,
    FAULT: PRINTER_STATUS.ERROR,
    SYS_ERROR: PRINTER_STATUS.ERROR,
    PRINT_ERROR: PRINTER_STATUS.ERROR
  }) || PRINTER_STATUS.UNKNOWN
}

/**
 * 规范化固件协议。RRF 必须保留为 RRF，不得用默认值覆盖。
 */
export function normalizeFirmwareType(value) {
  return normalizeEnum(value, FIRMWARE_TYPES, {
    KLIPPER: 'KLIPPER',
    MARLIN: null
  })
}

/**
 * 规范化 PrintJobVO 状态，兼容历史 PENDING/CANCELED 命名。
 */
export function normalizeJobStatus(value) {
  return normalizeEnum(value, JOB_STATUS_VALUES, {
    PENDING: JOB_STATUS.QUEUED,
    CANCELED: JOB_STATUS.CANCELLED,
    PREPARING: JOB_STATUS.UPLOADING
  })
}

export function normalizePrinter(record) {
  const normalized = normalizeIdFields(record, ['id', 'currentJobId'])
  if (!normalized || typeof normalized !== 'object') return normalized

  if (Object.prototype.hasOwnProperty.call(normalized, 'status')) {
    normalized.status = normalizePrinterStatus(normalized.status)
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'firmwareType')) {
    normalized.firmwareType = normalizeFirmwareType(normalized.firmwareType)
  }

  return normalized
}

/**
 * 规范化打印机详情聚合响应。
 * 后端详情契约返回 { printer, realtimeStatus, currentJob }，列表返回 PrinterVO；
 * 页面统一接收 PrinterVO 字段并保留两个聚合字段，避免把聚合对象误当成设备。
 */
export function normalizePrinterDetail(data) {
  if (!data || typeof data !== 'object') return data
  if (!data.printer || typeof data.printer !== 'object') return normalizePrinter(data)

  return {
    ...normalizePrinter(data.printer),
    realtimeStatus: data.realtimeStatus || null,
    currentJob: data.currentJob || null
  }
}

export function normalizePrintFile(record) {
  const normalized = normalizeIdFields(record, ['id', 'parentId', 'userId', 'ownerId'])

  if (normalized && typeof normalized === 'object') {
    normalized.visibility = normalized.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE'
    if (normalized.userId === null || normalized.userId === undefined) {
      normalized.userId = normalized.ownerId ?? null
    }
    const capabilityFields = ['canManage', 'canUpload', 'canCreate', 'canDelete', 'canMove', 'canPrint', 'canDownload']
    capabilityFields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(normalized, field)) normalized[field] = normalized[field] === true
    })
    if (Object.prototype.hasOwnProperty.call(normalized, 'level')) {
      const level = Number(normalized.level)
      normalized.level = Number.isInteger(level) && level > 0 ? level : (normalized.parentId == null ? 1 : 2)
    }
  }

  if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'folder')) {
    normalized.folder = normalized.folder === true || normalized.folder === 1
  } else if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'isFolder')) {
    normalized.folder = normalized.isFolder === true || normalized.isFolder === 1
    delete normalized.isFolder
  }

  if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'estimatedSeconds')) {
    if (!Object.prototype.hasOwnProperty.call(normalized, 'estTime')) {
      normalized.estTime = normalized.estimatedSeconds
    }
    delete normalized.estimatedSeconds
  }

  if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'estTime')) {
    const estTime = Number(normalized.estTime)
    normalized.estTime = Number.isFinite(estTime) && estTime >= 0 ? estTime : 0
  }

  if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'filamentLength')) {
    const filamentLength = Number(normalized.filamentLength)
    normalized.filamentLength = Number.isFinite(filamentLength) && filamentLength >= 0
      ? filamentLength
      : 0
  }

  if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'successRate')) {
    const successRate = Number(normalized.successRate)
    normalized.successRate = Number.isFinite(successRate)
      ? Math.min(Math.max(successRate, 0), 100)
      : 0
  }

  return normalized
}

/** 规范化文件批量移动结果，兼容旧字段并统一为 movedCount/failedCount。 */
export function normalizeBatchMoveResult(data) {
  const source = data && typeof data === 'object' ? data : {}
  const items = Array.isArray(source.items) ? source.items.map(item => ({
    id: normalizeId(item?.id),
    success: item?.success === true,
    reason: item?.reason ?? null
  })) : []
  const movedCount = Number.isInteger(Number(source.movedCount))
    ? Number(source.movedCount)
    : Number.isInteger(Number(source.successCount))
      ? Number(source.successCount)
      : items.filter(item => item.success).length
  const failedCount = Number.isInteger(Number(source.failedCount))
    ? Number(source.failedCount)
    : Number.isInteger(Number(source.failureCount))
      ? Number(source.failureCount)
      : items.filter(item => !item.success).length

  return {
    totalCount: Number.isInteger(Number(source.totalCount)) ? Number(source.totalCount) : items.length,
    movedCount,
    failedCount,
    items,
    message: source.message ?? null
  }
}

export function normalizePrintJob(record) {
  if (record !== null && typeof record !== 'object') return normalizeId(record)

  const normalized = normalizeIdFields(record, [
    'id',
    'fileId',
    'printerId',
    'userId',
    'operatorId'
  ])

  if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'progress')) {
    const progress = Number(normalized.progress)
    normalized.progress = Number.isFinite(progress)
      ? Math.min(Math.max(progress, 0), 100)
      : 0
  }

  if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'status')) {
    const status = normalizeJobStatus(normalized.status)
    if (status) normalized.status = status
    else delete normalized.status
  }

  if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'endedAt')) {
    if (!Object.prototype.hasOwnProperty.call(normalized, 'completedAt')) {
      normalized.completedAt = normalized.endedAt
    }
    delete normalized.endedAt
  }

  return normalized
}

export function normalizeUser(record) {
  if (record !== null && typeof record !== 'object') return normalizeId(record)
  return normalizeIdFields(record, ['id', 'userId'])
}

/**
 * 规范化操作日志安全视图，只保留正式契约字段，避免误渲染后端内部扩展字段。
 */
export function normalizeAuditLog(record) {
  if (!record || typeof record !== 'object') return null

  return {
    id: normalizeId(record.id),
    actorId: normalizeId(record.actorId),
    actorUsername: record.actorUsername ?? null,
    actorRole: record.actorRole ?? null,
    action: record.action ?? null,
    targetType: record.targetType ?? null,
    targetId: normalizeId(record.targetId),
    targetLabel: record.targetLabel ?? null,
    result: record.result ?? null,
    errorCode: record.errorCode ?? null,
    occurredAt: record.occurredAt ?? null,
    traceId: record.traceId ?? null
  }
}
