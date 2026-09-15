import request from '@/utils/request'
import {
  mapResponseData,
  normalizePrintFilePageParams,
  normalizePageResponse,
  normalizePrintFile,
  normalizePrintJob,
  normalizeBatchMoveResult
} from '@/utils/dataAdapters'
import { REQUEST_TIMEOUT } from '@/utils/constants'
import { shouldRefreshPresignedUrl } from '@/utils/fileDownload'
import { normalizeBatchUploadResult } from '@/utils/batchUpload'

/**
 * 打印文件管理 API 模块
 * @module api/printFile
 */

/**
 * 获取文件列表（分页）
 * @param {Object} params - 查询参数
 * @param {number} [params.pageNum=1] - 页码
 * @param {number} [params.pageSize=10] - 每页条数
 * @param {string} [params.fileName] - 文件名搜索关键词
 * @param {boolean} [params.folder] - 是否只查询文件夹；文件列表应传 false
 * @returns {Promise<{code: number, message: string, data: {records: Array<PrintFile>, total: number}}>} 文件列表
 *
 * @typedef {Object} PrintFile
 * @property {number} id - 文件ID
 * @property {string} originalName - 原始文件名
 * @property {string} thumbnailUrl - 缩略图URL
 * @property {string} materialType - 耗材类型
 * @property {number} filamentWeight - 耗材重量(g)
 * @property {number} filamentLength - 耗材长度(m)
 * @property {number} printCount - 打印次数
 * @property {number} successRate - 成功率(%)
 * @property {number} estTime - 预计耗时(秒)
 * @property {'PRIVATE'|'PUBLIC'} visibility - 显式文件可见性
 * @property {string|number} userId - 创建者 ID
 * @property {boolean} canManage - 是否可管理目录结构
 * @property {boolean} canUpload - 是否可上传
 * @property {boolean} canDelete - 是否可删除
 * @property {boolean} canMove - 是否可移动
 * @property {boolean} canPrint - 是否可创建打印任务
 * @property {boolean} canDownload - 是否可下载
 * @property {number} nozzleSize - 喷嘴尺寸(mm)
 * @property {string} createdAt - 创建时间
 */
export function getFileList(params = {}) {
  return request({
    url: '/api/v1/print-files/page',
    method: 'post',
    data: normalizePrintFilePageParams(params)
  }).then(response => mapResponseData(
    response,
    data => normalizePageResponse(data, normalizePrintFile)
  ))
}

/** 获取文件的安全预览元数据，不返回文件内容或存储内部字段。 */
export function getFilePreview(id) {
  return request({
    url: `/api/v1/print-files/${id}/preview`,
    method: 'get'
  }).then(response => mapResponseData(response, normalizePrintFile))
}

/** 获取短期缩略图预签名 URL；没有缩略图时 data 为 null。 */
export function getThumbnailUrl(id, expires = 60) {
  return request({
    url: `/api/v1/print-files/${id}/thumbnail`,
    method: 'get',
    params: { expires }
  }).then(response => mapResponseData(response, data => typeof data === 'string' ? data : null))
}

const isProtectedLocalStorageUrl = value => (
  typeof value === 'string' && value.startsWith('/api/v1/print-files/storage?')
)

const readBlobAsDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.addEventListener('load', () => resolve(typeof reader.result === 'string' ? reader.result : null), { once: true })
  reader.addEventListener('error', () => reject(reader.error || new Error('缩略图读取失败')), { once: true })
  reader.readAsDataURL(blob)
})

/**
 * 获取可直接用于图片组件的缩略图地址。
 * Local Edition 的文件流需要鉴权，因此通过 Axios 携带令牌读取后转换为 data URL；
 * Server Edition 的对象存储预签名地址仍直接返回，避免跨域读取限制。
 */
export async function getThumbnailSource(id, expires = 60) {
  const response = await getThumbnailUrl(id, expires)
  const thumbnailUrl = response.data
  if (!thumbnailUrl || !isProtectedLocalStorageUrl(thumbnailUrl)) return response

  const blob = await request({
    url: thumbnailUrl,
    method: 'get',
    responseType: 'blob'
  })
  return {
    ...response,
    data: await readBlobAsDataUrl(blob)
  }
}

/** 获取文件关联的打印任务。 */
export function getFileJobs(id, params = {}) {
  return request({
    url: `/api/v1/print-files/${id}/jobs`,
    method: 'get',
    params: {
      pageNum: params.pageNum || 1,
      pageSize: params.pageSize || 10
    }
  }).then(response => mapResponseData(
    response,
    data => normalizePageResponse(data, normalizePrintJob)
  ))
}

/** 获取当前用户可见的文件树，不包含存储内部字段。 */
export function getFileTree() {
  return request({
    url: '/api/v1/print-files/tree',
    method: 'get'
  }).then(response => mapResponseData(response, data => {
    const normalizeNode = node => ({
      ...normalizePrintFile(node),
      children: Array.isArray(node?.children) ? node.children.map(normalizeNode) : []
    })
    return Array.isArray(data) ? data.map(normalizeNode) : []
  }))
}

/**
 * 创建文件夹
 * @param {Object} data - 文件夹参数
 * @param {number} [data.parentId] - 父文件夹ID
 * @param {string} data.folderName - 文件夹名称
 * @returns {Promise<{code: number, message: string, data: any}>} 创建结果
 */
export function createFolder(data) {
  return request({
    url: '/api/v1/print-files/folder/create',
    method: 'post',
    data
  }).then(response => mapResponseData(response, normalizePrintFile))
}

/** 重命名非默认文件夹。 */
export function renameFolder(id, data) {
  return request({
    url: `/api/v1/print-files/folder/${id}/rename`,
    method: 'put',
    data
  }).then(response => mapResponseData(response, normalizePrintFile))
}

/** 移动非默认文件夹；parentId 为 null 表示根目录。 */
export function moveFolder(id, data) {
  return request({
    url: `/api/v1/print-files/folder/${id}/move`,
    method: 'put',
    data
  }).then(response => mapResponseData(response, normalizePrintFile))
}

/**
 * 删除空文件夹；后端会拒绝默认目录和包含文件/子目录的目录。
 * @param {number|string} id - 文件夹 ID
 */
export function deleteFolder(id) {
  return request({
    url: `/api/v1/print-files/folder/${id}`,
    method: 'delete'
  })
}

/**
 * 上传切片文件
 * @param {FormData} formData - 包含文件的 FormData 对象
 * @returns {Promise<{code: number, message: string, data: PrintFile}>} 上传结果
 */
export function uploadFile(formData, onUploadProgress, options = {}) {
  return request({
    url: '/api/v1/print-files/upload',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress,
    timeout: REQUEST_TIMEOUT.UPLOAD,
    ...options
  }).then(response => mapResponseData(response, normalizePrintFile))
}

/**
 * 批量上传切片文件。后端会逐文件返回成功/失败结果，不会因为单个文件失败而丢失整批结果。
 * @param {File[]} files - 文件列表，后端字段名固定为 files
 * @param {number|string|null} [parentId] - 目标真实目录
 */
export function batchUploadFiles(files, parentId = null, onUploadProgress, options = {}) {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  if (parentId !== null && parentId !== undefined && parentId !== '') {
    formData.append('parentId', parentId)
  }

  return request({
    url: '/api/v1/print-files/batch-upload',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
    timeout: REQUEST_TIMEOUT.UPLOAD,
    ...options
  }).then(response => mapResponseData(response, normalizeBatchUploadResult))
}

/**
 * 删除单个文件
 * @param {number} id - 文件ID
 * @returns {Promise<{code: number, message: string}>} 删除结果
 */
export function deleteFile(id) {
  return request({
    url: `/api/v1/print-files/${id}`,
    method: 'delete'
  })
}

/**
 * 批量删除文件
 * @param {number[]} ids - 文件ID数组
 * @returns {Promise<{code: number, message: string}>} 删除结果
 */
export function deleteBatchFiles(ids) {
  return request({
    url: '/api/v1/print-files/batch',
    method: 'delete',
    data: { ids }
  })
}

/**
 * 批量移动文件；parentId 为 null 表示根目录，单次最多100个文件。
 * 后端逐项返回成功/失败结果，不移动文件夹，也不触碰对象存储。
 */
export function moveBatchFiles(ids, parentId = null) {
  return request({
    url: '/api/v1/print-files/batch/move',
    method: 'put',
    data: { ids, parentId }
  }).then(response => mapResponseData(response, normalizeBatchMoveResult))
}

export class DownloadFileError extends Error {
  constructor(message, code, status) {
    super(message)
    this.name = 'DownloadFileError'
    this.code = code
    this.status = status
  }
}

const getDownloadUrl = data => {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data && typeof data === 'object') {
    const url = data.url || data.downloadUrl
    if (typeof url === 'string' && url.trim()) return url.trim()
  }
  return ''
}

const requestDownloadUrl = async id => {
  const response = await request({
    url: `/api/v1/print-files/${id}/download`,
    method: 'get'
  })
  const downloadUrl = getDownloadUrl(response.data)
  if (!downloadUrl) {
    throw new DownloadFileError('下载链接为空，请稍后重试', 'DOWNLOAD_URL_EMPTY')
  }
  return downloadUrl
}

/**
 * 下载文件：先获取预签名 URL，再通过 Blob 下载；跨域不支持时回退到该预签名 URL。
 * @param {number|string} id - 文件ID
 * @param {string} [fileName] - 下载后的文件名
 */
export async function downloadFile(id, fileName) {
  let downloadUrl = await requestDownloadUrl(id)
  let hasRetried = false

  while (true) {
    let fileResponse
    try {
      fileResponse = await fetch(downloadUrl, {
        method: 'GET',
        mode: 'cors'
      })
    } catch {
      // 预签名 URL 仍然有效时，浏览器可直接跳转完成下载，避免受 Blob CORS 限制。
      const opened = window.open(downloadUrl, '_blank', 'noopener,noreferrer')
      if (!opened) {
        throw new DownloadFileError('下载失败，可能是跨域或网络异常，请重试', 'DOWNLOAD_CORS_OR_NETWORK')
      }
      return
    }

    if (!fileResponse.ok) {
      if (shouldRefreshPresignedUrl(fileResponse.status, hasRetried)) {
        hasRetried = true
        downloadUrl = await requestDownloadUrl(id)
        continue
      }

      const isExpiredOrForbidden = [401, 403, 410].includes(fileResponse.status)
      throw new DownloadFileError(
        isExpiredOrForbidden
          ? '下载链接已过期或无权访问，请重新下载'
          : `下载文件失败（${fileResponse.status}）`,
        isExpiredOrForbidden ? 'DOWNLOAD_URL_EXPIRED' : 'DOWNLOAD_FAILED',
        fileResponse.status
      )
    }

    const blob = await fileResponse.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = fileName || `print-file-${id}.gcode`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 0)
    return
  }
}
