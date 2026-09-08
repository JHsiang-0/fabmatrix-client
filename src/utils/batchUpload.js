export const MAX_BATCH_UPLOAD_FILES = 100
export const MAX_UPLOAD_FILE_BYTES = 1024 * 1024 * 1024
export const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_FILE_BYTES
export const BATCH_UPLOAD_EXTENSIONS = Object.freeze(['gcode', 'g', '3mf', 'stl'])
const RETRYABLE_UPLOAD_STATUSES = new Set([408, 429])

export const getUploadFailureState = error => {
  const status = Number(error?.response?.status ?? error?.status)
  const retryable = RETRYABLE_UPLOAD_STATUSES.has(status) || (status >= 500 && status <= 599)

  if (retryable) {
    return {
      errorCode: status,
      retryable: true,
      requiresRefresh: false,
      message: `上传请求失败（HTTP ${status}），可重试`
    }
  }
  if (error?.response || Number.isInteger(status)) {
    return {
      errorCode: status,
      retryable: false,
      requiresRefresh: false,
      message: error?.message || `上传请求失败（HTTP ${status}），请检查文件和权限`
    }
  }
  return {
    errorCode: null,
    retryable: false,
    requiresRefresh: true,
    message: '上传结果未知，请刷新文件列表确认后再重试，避免重复入库'
  }
}

export const isSupportedBatchUploadFile = file => (
  Boolean(file?.name) && BATCH_UPLOAD_EXTENSIONS.some(extension => (
    file.name.toLowerCase().endsWith(`.${extension}`)
  ))
)

export const validateBatchUploadSelection = (files, existingNames = []) => {
  const candidates = Array.isArray(files) ? files : []
  const accepted = []
  const rejected = []
  const names = new Set(existingNames.map(name => String(name).toLowerCase()))

  candidates.slice(0, MAX_BATCH_UPLOAD_FILES).forEach(file => {
    const fileName = String(file?.name || '')
    const normalizedName = fileName.toLowerCase()
    if (!isSupportedBatchUploadFile(file)) {
      rejected.push({ file, reason: '文件类型不支持' })
      return
    }
    if (names.has(normalizedName)) {
      rejected.push({ file, reason: '当前目录已存在同名文件' })
      return
    }
    if ((Number(file?.size) || 0) > MAX_UPLOAD_FILE_BYTES) {
      rejected.push({ file, reason: '单个文件大小不能超过 1GB' })
      return
    }
    accepted.push(file)
    names.add(normalizedName)
  })

  if (candidates.length > MAX_BATCH_UPLOAD_FILES) {
    rejected.push({ file: null, reason: `单次最多选择 ${MAX_BATCH_UPLOAD_FILES} 个文件` })
  }
  return { files: accepted, rejected }
}

export const normalizeBatchUploadResult = data => ({
  items: (Array.isArray(data?.items) ? data.items : []).map((item, fallbackIndex) => ({
    index: Number.isInteger(item?.index) ? item.index : fallbackIndex,
    fileId: item?.fileId ?? null,
    fileName: item?.fileName || '',
    status: normalizeBatchUploadStatus(item?.status),
    errorCode: item?.errorCode ?? null,
    message: item?.message || '',
    retryable: item?.retryable === true,
    requiresRefresh: item?.requiresRefresh === true
  }))
})

const normalizeBatchUploadStatus = status => {
  const normalized = String(status || 'FAILED').toUpperCase()
  return normalized === 'SUCCEEDED' ? 'SUCCESS' : normalized
}

export const isBatchUploadSuccess = item => item?.status === 'SUCCESS'
