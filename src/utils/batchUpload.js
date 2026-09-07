export const MAX_BATCH_UPLOAD_FILES = 100
export const MAX_BATCH_UPLOAD_BYTES = 250 * 1024 * 1024
export const BATCH_UPLOAD_EXTENSIONS = Object.freeze(['gcode', 'g', '3mf', 'stl'])

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
  let totalBytes = 0

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
    accepted.push(file)
    names.add(normalizedName)
    totalBytes += Number(file.size) || 0
  })

  if (candidates.length > MAX_BATCH_UPLOAD_FILES) {
    rejected.push({ file: null, reason: `单次最多选择 ${MAX_BATCH_UPLOAD_FILES} 个文件` })
  }
  if (totalBytes > MAX_BATCH_UPLOAD_BYTES) {
    return {
      files: [],
      rejected: [...rejected, { file: null, reason: '批量文件总大小不能超过 250MB' }]
    }
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
    retryable: item?.retryable === true
  }))
})

const normalizeBatchUploadStatus = status => {
  const normalized = String(status || 'FAILED').toUpperCase()
  return normalized === 'SUCCEEDED' ? 'SUCCESS' : normalized
}

export const isBatchUploadSuccess = item => item?.status === 'SUCCESS'
