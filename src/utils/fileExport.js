export const HISTORY_EXPORT_TYPES = Object.freeze({
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PDF: 'application/pdf'
})

export const HISTORY_EXPORT_STATUSES = Object.freeze(['COMPLETED', 'FAILED', 'CANCELLED'])

/** Only the applied history filters are sent; pagination is deliberately omitted. */
export function toHistoryExportPayload(filters = {}, format = 'XLSX') {
  if (!HISTORY_EXPORT_TYPES[format]) throw new TypeError('请选择 Excel 或 PDF 格式')
  const statuses = filters.status ? [filters.status] : (filters.statuses || HISTORY_EXPORT_STATUSES)
  if (!Array.isArray(statuses) || statuses.length === 0
    || statuses.some(status => !HISTORY_EXPORT_STATUSES.includes(status))) {
    throw new TypeError('只能导出已完成、失败或已取消的打印历史')
  }
  const body = { format, statuses: [...new Set(statuses)] }
  for (const key of ['fileName', 'printerId', 'userId', 'startTime', 'endTime']) {
    const value = filters[key]
    if (value !== null && value !== undefined && String(value).trim() !== '') body[key] = String(value).trim()
  }
  return body
}

/** Prefer RFC 5987 UTF-8 names and reduce every name to a safe local basename. */
export function exportFileName(disposition, format) {
  const fallback = `打印历史.${format === 'PDF' ? 'pdf' : 'xlsx'}`
  const header = String(disposition || '').slice(0, 2048)
  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;\r\n]+)/i)
  const plain = header.match(/filename\s*=\s*(?:"([^"\r\n]*)"|([^;\r\n]*))/i)
  let name = plain?.[1] || plain?.[2] || fallback
  if (encoded) {
    try { name = decodeURIComponent(encoded[1].trim()) } catch { /* Use the ASCII fallback. */ }
  }
  name = Array.from(name.split(/[\\/]/).pop(), char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char)
    .join('').replace(/[<>:"|?*]/g, '_').trim().replace(/[. ]+$/g, '')
  if (!name || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) return fallback
  const extension = format === 'PDF' ? '.pdf' : '.xlsx'
  // A backend name may not change the selected file type or introduce a second executable suffix.
  name = name.replace(/\.[^.]*$/, '').slice(0, 120)
  return `${name || '打印历史'}${extension}`
}

export async function readJsonDownloadBody(data, headers = {}, force = false) {
  const contentType = String(headers['content-type'] || headers['Content-Type'] || data?.type || '').toLowerCase()
  if (!(data instanceof Blob)) return data
  if (data.size > 1024 * 1024 || (!force && !contentType.includes('json'))) return null
  const text = await data.text()
  if (!contentType.includes('json') && !/^\s*\{/.test(text)) return null
  try { return JSON.parse(text) } catch { return null }
}

/** Schedule revocation after the browser has consumed the click, including failed clicks. */
export function saveExportFile(response, format, platform = globalThis) {
  if (!(response?.blob instanceof Blob) || response.blob.size === 0) throw new Error('导出文件为空，请重试')
  const filename = exportFileName(response.contentDisposition, format)
  const url = platform.URL.createObjectURL(response.blob)
  const anchor = platform.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  try {
    platform.document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    platform.setTimeout(() => platform.URL.revokeObjectURL(url), 1000)
  }
  return filename
}

/** A download becomes obsolete on unmount, logout/relogin, identity or role changes. */
export function createExportRequestGuard(getIdentity) {
  let active = null
  let disposed = false
  return {
    begin() {
      if (disposed || active) return null
      const controller = new AbortController()
      active = { controller, identity: getIdentity() }
      return active
    },
    isCurrent(ticket) { return !disposed && active === ticket && ticket.identity === getIdentity() && !ticket.controller.signal.aborted },
    finish(ticket) { if (active === ticket) active = null },
    cancel() { active?.controller.abort(); active = null },
    dispose() { disposed = true; this.cancel() }
  }
}
