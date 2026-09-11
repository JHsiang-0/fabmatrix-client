import { PRINTER_STATE } from './constants.js'

export const DASHBOARD_STATUS_ITEMS = Object.freeze([
  { key: PRINTER_STATE.PRINTING, label: '打印中', theme: 'primary' },
  { key: PRINTER_STATE.STANDBY, label: '待机', theme: 'success' },
  { key: PRINTER_STATE.PAUSED, label: '已暂停', theme: 'warning' },
  { key: PRINTER_STATE.FAULT, label: '硬件故障', theme: 'danger' },
  { key: PRINTER_STATE.SYS_ERROR, label: '系统错误', theme: 'danger' },
  { key: PRINTER_STATE.PRINT_ERROR, label: '打印错误', theme: 'warning' },
  { key: PRINTER_STATE.STARTING, label: '启动中', theme: 'warning' },
  { key: PRINTER_STATE.COMPLETED, label: '已完成', theme: 'success' },
  { key: PRINTER_STATE.CANCELLED, label: '已取消', theme: 'default' },
  { key: PRINTER_STATE.UNKNOWN, label: '离线/未知', theme: 'default' }
])

export function buildStatusSummary(statusCounts = {}) {
  const items = DASHBOARD_STATUS_ITEMS.map(item => ({
    ...item,
    count: Number.isFinite(Number(statusCounts[item.key])) ? Math.max(0, Number(statusCounts[item.key])) : 0
  }))
  const total = items.reduce((sum, item) => sum + item.count, 0)
  return {
    total,
    items: items.map(item => ({
      ...item,
      percent: total ? Math.round((item.count / total) * 100) : 0
    }))
  }
}

export const FARM_TIME_ZONE = 'Asia/Shanghai'
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?$/
const LOCAL_DATE_TIME_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDateKey(year, month, day) {
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
}

function partsFromFormatter(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FARM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour === '24' ? '00' : values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  }
}

function farmCalendarParts(value) {
  if (typeof value === 'string') {
    const localMatch = value.match(LOCAL_DATE_TIME_PATTERN)
    if (localMatch) {
      return { year: Number(localMatch[1]), month: Number(localMatch[2]), day: Number(localMatch[3]) }
    }
    if (LOCAL_DATE_TIME_LIKE_PATTERN.test(value)) return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : partsFromFormatter(date)
}

function farmDateTimeParts(value) {
  if (typeof value === 'string') {
    const localMatch = value.match(LOCAL_DATE_TIME_PATTERN)
    if (localMatch) {
      return {
        year: Number(localMatch[1]),
        month: Number(localMatch[2]),
        day: Number(localMatch[3]),
        hour: Number(localMatch[4]),
        minute: Number(localMatch[5]),
        second: Number(localMatch[6])
      }
    }
    if (LOCAL_DATE_TIME_LIKE_PATTERN.test(value)) return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : partsFromFormatter(date)
}

function formatDateTimeParts(parts) {
  return `${formatDateKey(parts.year, parts.month, parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
}

export function formatFarmLocalDateTime(value) {
  const parts = farmDateTimeParts(value)
  return parts ? formatDateTimeParts(parts) : ''
}

export function buildFarmDateRange(referenceTime = new Date(), dayCount = 7) {
  const endParts = farmDateTimeParts(referenceTime)
  if (!endParts || !Number.isInteger(dayCount) || dayCount < 1) return { startTime: '', endTime: '' }

  const start = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day))
  start.setUTCDate(start.getUTCDate() - dayCount + 1)
  const startParts = {
    year: start.getUTCFullYear(),
    month: start.getUTCMonth() + 1,
    day: start.getUTCDate(),
    hour: endParts.hour,
    minute: endParts.minute,
    second: endParts.second
  }
  return { startTime: formatDateTimeParts(startParts), endTime: formatDateTimeParts(endParts) }
}

function dateKey(value) {
  const parts = farmCalendarParts(value)
  return parts ? formatDateKey(parts.year, parts.month, parts.day) : null
}

export function buildSevenDayJobTrend(jobs = [], referenceTime = new Date()) {
  const referenceParts = farmCalendarParts(referenceTime)
  if (!referenceParts) return []
  // Use UTC only as a timezone-free calendar arithmetic container. The values
  // below are already Asia/Shanghai calendar parts, never browser-local time.
  const end = new Date(Date.UTC(referenceParts.year, referenceParts.month - 1, referenceParts.day))
  const counts = new Map()
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(end)
    day.setUTCDate(end.getUTCDate() - 6 + index)
    const key = formatDateKey(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate())
    counts.set(key, 0)
    return { key, label: key.slice(5) }
  })
  for (const job of Array.isArray(jobs) ? jobs : []) {
    const key = dateKey(job?.completedAt || job?.createdAt)
    if (counts.has(key)) counts.set(key, counts.get(key) + 1)
  }
  return days.map(day => ({ ...day, count: counts.get(day.key) }))
}
