/**
 * 格式化工具函数
 * @module utils/formatters
 * @description 提供各种数据格式化函数，用于 UI 显示
 */

/**
 * 格式化温度
 * @param {number} temp - 温度值
 * @returns {string} 格式化后的温度字符串
 */
export function formatTemp(temp) {
  if (temp === undefined || temp === null) return '--°C'
  return `${Math.round(temp)}°C`
}

/**
 * 格式化时长
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长字符串 (HH:MM:SS)
 */
export function formatDuration(seconds) {
  const totalSeconds = Number(seconds)
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00:00'

  const normalizedSeconds = Math.floor(totalSeconds)
  const h = Math.floor(normalizedSeconds / 3600)
  const m = Math.floor((normalizedSeconds % 3600) / 60)
  const s = normalizedSeconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * 格式化耗材使用量
 * @param {number} mm - 毫米数
 * @returns {string} 格式化后的米数字符串
 */
export function formatFilament(mm) {
  if (!mm) return '0.00m'
  return `${(mm / 1000).toFixed(2)}m`
}

/**
 * 格式化行标签（数字转字母）
 * @param {number} row - 行号（1-based）
 * @returns {string} 行标签（如 A, B, C...）
 */
export function formatRowLabel(row) {
  let number = Math.max(1, Math.floor(Number(row) || 1))
  let label = ''
  while (number > 0) {
    number -= 1
    label = String.fromCharCode(65 + (number % 26)) + label
    number = Math.floor(number / 26)
  }
  return label
}

/**
 * 格式化槽位标签
 * @param {number} row - 行号
 * @param {number} col - 列号
 * @returns {string} 槽位标签（如 A-01）
 */
export function formatSlotLabel(row, col) {
  const rowLabel = formatRowLabel(row)
  return `${rowLabel}-${col.toString().padStart(2, '0')}`
}

/**
 * 格式化百分比
 * @param {number} value - 百分比值
 * @param {number} decimals - 小数位数，默认 0
 * @returns {string} 格式化后的百分比字符串
 */
export function formatPercent(value, decimals = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '--%'
  const normalized = Math.min(Math.max(number, 0), 100)
  return `${normalized.toFixed(decimals)}%`
}

/**
 * 将进度限制在后端契约规定的 0-100 范围内。
 * @param {number|string|null|undefined} value - 进度值
 * @returns {number} 规范化后的进度值
 */
export function normalizeProgress(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(Math.max(number, 0), 100)
}

/**
 * 格式化文件大小。
 * @param {number|string|null|undefined} bytes - 字节数
 * @returns {string} 可读文件大小
 */
export function formatFileSize(bytes) {
  const number = Number(bytes)
  if (!Number.isFinite(number) || number < 0) return '-'
  if (number === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(number) / Math.log(1024)), units.length - 1)
  const size = number / 1024 ** unitIndex
  const decimals = unitIndex === 0 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(decimals)} ${units[unitIndex]}`
}

const DISPLAY_TIME_ZONE = 'Asia/Shanghai'

const parseDate = date => {
  if (date instanceof Date) return date
  if (typeof date === 'string') {
    // 后端 LocalDateTime 不带时区，按契约解释为 Asia/Shanghai。
    if (/^\d{4}-\d{2}-\d{2}T/.test(date) && !/(Z|[+-]\d{2}:?\d{2})$/.test(date)) {
      return new Date(`${date}+08:00`)
    }
  }
  return new Date(date)
}

const getDateParts = date => {
  const value = parseDate(date)
  if (Number.isNaN(value.getTime())) return null

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(value)

  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

/**
 * 格式化日期时间
 * @param {Date|string|number} date - 日期对象或时间戳
 * @returns {string} 格式化后的时间字符串 (HH:MM:SS)
 */
export function formatTime(date) {
  const parts = getDateParts(date)
  if (!parts) return '-'
  return `${parts.hour}:${parts.minute}:${parts.second}`
}

/**
 * 格式化完整日期时间，统一按 Asia/Shanghai 展示。
 * @param {Date|string|number} date - 日期对象或时间戳
 * @returns {string} 格式化后的日期时间
 */
export function formatDateTime(date) {
  const parts = getDateParts(date)
  if (!parts) return '-'
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}
