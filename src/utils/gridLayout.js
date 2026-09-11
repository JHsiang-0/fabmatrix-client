import { GRID_CONFIG as LEGACY_GRID_CONFIG } from './constants.js'

export const GRID_LAYOUT_LIMITS = Object.freeze({
  minRows: 1,
  maxRows: 30,
  minColumns: 1,
  maxColumns: 60,
  maxCells: 1800,
  maxAisles: 20,
  minAisleSize: 48,
  maxAisleSize: 240
})

const GRID_METRICS = Object.freeze({
  rowLabelWidth: 40,
  rootGap: 8,
  trackGap: 12,
  headerHeight: 28,
  headerMargin: 8,
  editControlWidth: 68,
  editControlGap: 8,
  editControlHeight: 32
})

export class GridLayoutValidationError extends Error {
  constructor(message, code = 'INVALID_LAYOUT', details = null) {
    super(message)
    this.name = 'GridLayoutValidationError'
    this.code = code
    this.details = details
  }
}

const fail = (message, code, details) => {
  throw new GridLayoutValidationError(message, code, details)
}

const isInteger = value => typeof value === 'number' && Number.isInteger(value)

const assertInteger = (value, name, min, max) => {
  if (!isInteger(value) || value < min || value > max) {
    fail(`${name} 必须是 ${min}-${max} 的整数`, 'INVALID_LAYOUT_FIELD', { field: name, value })
  }
  return value
}

const assertText = (value, name, maxLength) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    fail(`${name} 必须是 1-${maxLength} 个字符`, 'INVALID_LAYOUT_FIELD', { field: name, value })
  }
  return value.trim()
}

/** 修复服务端历史数据中 UTF-8 字节被误当作 Latin-1 解码的过道名称。 */
export function repairUtf8Mojibake(value) {
  if (typeof value !== 'string' || !/[\u0080-\u00ff]/.test(value)) return value
  try {
    const bytes = Uint8Array.from([...value], character => character.charCodeAt(0))
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return /[\u4e00-\u9fff]/.test(decoded) ? decoded : value
  } catch {
    return value
  }
}

const normalizeLimits = limits => {
  const source = limits && typeof limits === 'object' ? limits : GRID_LAYOUT_LIMITS
  const normalized = {}
  Object.keys(GRID_LAYOUT_LIMITS).forEach(key => {
    normalized[key] = assertInteger(source[key], `limits.${key}`, 1, 1800)
  })
  if (normalized.minRows > normalized.maxRows
    || normalized.minColumns > normalized.maxColumns
    || normalized.minAisleSize > normalized.maxAisleSize
    || normalized.maxCells < normalized.maxRows * normalized.maxColumns) {
    fail('布局限制之间存在矛盾', 'INVALID_LAYOUT_LIMITS')
  }
  return normalized
}

const normalizeAisles = (aisles, rowCount, columnCount, limits) => {
  if (!Array.isArray(aisles) || aisles.length > limits.maxAisles) {
    fail(`过道数量不能超过 ${limits.maxAisles} 条`, 'INVALID_LAYOUT_FIELD', { field: 'aisles' })
  }

  const ids = new Set()
  const positions = new Set()
  return aisles.map((aisle, index) => {
    if (!aisle || typeof aisle !== 'object') fail(`第 ${index + 1} 条过道格式错误`, 'INVALID_AISLE')
    const id = assertText(aisle.id, `aisles[${index}].id`, 64)
    if (ids.has(id)) fail(`过道 ID 重复：${id}`, 'DUPLICATE_AISLE_ID', { id })
    ids.add(id)

    const axis = aisle.axis
    if (axis !== 'ROW' && axis !== 'COLUMN') {
      fail(`过道方向无效：${axis}`, 'INVALID_AISLE_AXIS', { index, axis })
    }
    const maxIndex = axis === 'ROW' ? rowCount : columnCount
    const afterIndex = assertInteger(aisle.afterIndex, `aisles[${index}].afterIndex`, 0, maxIndex)
    const positionKey = `${axis}:${afterIndex}`
    if (positions.has(positionKey)) {
      fail(`同方向同位置过道重复：${positionKey}`, 'DUPLICATE_AISLE_POSITION', { positionKey })
    }
    positions.add(positionKey)
    const size = assertInteger(
      aisle.size,
      `aisles[${index}].size`,
      limits.minAisleSize,
      limits.maxAisleSize
    )
    return {
      id,
      axis,
      afterIndex,
      label: assertText(repairUtf8Mojibake(aisle.label), `aisles[${index}].label`, 12),
      size
    }
  }).sort((left, right) => left.axis.localeCompare(right.axis) || left.afterIndex - right.afterIndex)
}

/** 严格校验并复制服务端布局，禁止把错误数据静默修正为默认值。 */
export function normalizeLayout(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('布局响应格式错误', 'INVALID_LAYOUT')
  const limits = normalizeLimits(input.limits)
  const rowCount = assertInteger(input.rowCount, 'rowCount', limits.minRows, limits.maxRows)
  const columnCount = assertInteger(input.columnCount, 'columnCount', limits.minColumns, limits.maxColumns)
  if (rowCount * columnCount > limits.maxCells) fail('物理槽位总数超过限制', 'INVALID_LAYOUT_FIELD')
  const version = Number(input.version)
  if (!Number.isSafeInteger(version) || version <= 0) fail('version 必须为正整数', 'INVALID_LAYOUT_FIELD')

  return {
    rowCount,
    columnCount,
    aisles: normalizeAisles(input.aisles, rowCount, columnCount, limits),
    version,
    limits,
    updatedAt: input.updatedAt ?? null
  }
}

export const DEFAULT_LAYOUT = Object.freeze({
  rowCount: 4,
  columnCount: 12,
  aisles: Object.freeze([Object.freeze({
    id: 'default-column-aisle',
    axis: 'COLUMN',
    afterIndex: 7,
    label: '过道',
    size: 100
  })]),
  version: 1,
  limits: GRID_LAYOUT_LIMITS,
  updatedAt: null
})

export function getDefaultGridConfig() {
  return createGridConfig(DEFAULT_LAYOUT)
}

/** 将服务端布局或旧常量转换成渲染层配置。旧常量仅作为未加载快照时的兼容回退。 */
export function createGridConfig(input = {}) {
  const isLayout = Number.isInteger(input.rowCount) && Number.isInteger(input.columnCount)
  const rowCount = isLayout ? input.rowCount : (input.ROWS ?? LEGACY_GRID_CONFIG.ROWS)
  const columnCount = isLayout ? input.columnCount : (input.COLS ?? LEGACY_GRID_CONFIG.COLS)
  const sourceAisles = Array.isArray(input.aisles)
    ? input.aisles
    : input.AISLE_COL
      ? [{ id: 'legacy-column-aisle', axis: 'COLUMN', afterIndex: input.AISLE_COL - 1, label: '过道', size: input.CELL_MIN_WIDTH || 100 }]
      : []
  const limits = input.limits || GRID_LAYOUT_LIMITS
  const aisles = normalizeLayout({
    rowCount,
    columnCount,
    aisles: sourceAisles.map((aisle, index) => ({
      id: aisle.id || `aisle-${index + 1}`,
      axis: String(aisle.axis || '').toUpperCase(),
      afterIndex: aisle.afterIndex ?? aisle.afterRow ?? aisle.afterColumn,
      label: aisle.label || '过道',
      size: aisle.size ?? aisle.height ?? aisle.width ?? 100
    })),
    version: Number.isInteger(input.version) && input.version > 0 ? input.version : 1,
    limits,
    updatedAt: input.updatedAt ?? null
  }).aisles
  const firstColumnAisle = aisles.find(aisle => aisle.axis === 'COLUMN')
  return {
    rowCount,
    columnCount,
    aisles: aisles.map(aisle => ({
      ...aisle,
      ...(aisle.axis === 'ROW' ? { afterRow: aisle.afterIndex, height: aisle.size } : { afterColumn: aisle.afterIndex, width: aisle.size })
    })),
    ROWS: rowCount,
    COLS: columnCount,
    TOTAL_ROWS: rowCount + aisles.filter(aisle => aisle.axis === 'ROW').length,
    TOTAL_COLS: columnCount + aisles.filter(aisle => aisle.axis === 'COLUMN').length,
    AISLE_COL: firstColumnAisle ? firstColumnAisle.afterIndex + 1 : null,
    AISLE_COL_INDEX: firstColumnAisle ? firstColumnAisle.afterIndex : -1,
    CELL_HEIGHT: Number(input.CELL_HEIGHT) > 0 ? Number(input.CELL_HEIGHT) : LEGACY_GRID_CONFIG.CELL_HEIGHT,
    CELL_MIN_WIDTH: Number(input.CELL_MIN_WIDTH) > 0 ? Number(input.CELL_MIN_WIDTH) : LEGACY_GRID_CONFIG.CELL_MIN_WIDTH
  }
}

const aisleVisualEntry = aisle => ({
  type: 'aisle',
  ...aisle,
  ...(aisle.axis === 'ROW' ? { height: aisle.size } : { width: aisle.size })
})

export function getVisualColumns(config = {}) {
  const normalized = createGridConfig(config)
  const columns = []
  const byPosition = new Map(normalized.aisles
    .filter(aisle => aisle.axis === 'COLUMN')
    .map(aisle => [aisle.afterIndex, aisle]))
  if (byPosition.has(0)) columns.push(aisleVisualEntry(byPosition.get(0)))
  for (let number = 1; number <= normalized.columnCount; number += 1) {
    columns.push({ type: 'device', number })
    if (byPosition.has(number)) columns.push(aisleVisualEntry(byPosition.get(number)))
  }
  return columns
}

export function getVisualRows(config = {}) {
  const normalized = createGridConfig(config)
  const rows = []
  const byPosition = new Map(normalized.aisles
    .filter(aisle => aisle.axis === 'ROW')
    .map(aisle => [aisle.afterIndex, aisle]))
  if (byPosition.has(0)) rows.push(aisleVisualEntry(byPosition.get(0)))
  for (let number = 1; number <= normalized.rowCount; number += 1) {
    rows.push({ type: 'device', number })
    if (byPosition.has(number)) rows.push(aisleVisualEntry(byPosition.get(number)))
  }
  return rows
}

export function getPhysicalColumn(visualColumn, config = {}) {
  const entry = getVisualColumns(config)[Number(visualColumn) - 1]
  return entry?.type === 'device' ? entry.number : null
}

export function getPhysicalRow(visualRow, config = {}) {
  const entry = getVisualRows(config)[Number(visualRow) - 1]
  return entry?.type === 'device' ? entry.number : null
}

export function isAisleVisualColumn(visualColumn, config = {}) {
  return getVisualColumns(config)[Number(visualColumn) - 1]?.type === 'aisle'
}

export function isAisleVisualRow(visualRow, config = {}) {
  return getVisualRows(config)[Number(visualRow) - 1]?.type === 'aisle'
}

export function formatGridRowLabel(row) {
  if (!isInteger(row) || row < 1) return ''
  let value = row
  let label = ''
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

const positionRecord = (device, index) => ({
  device,
  index,
  id: device?.id == null ? null : String(device.id),
  name: device?.name ?? null,
  gridRow: device?.gridRow ?? null,
  gridCol: device?.gridCol ?? null
})

export function getDuplicateDevicePositions(devices) {
  const groups = new Map()
  ;(Array.isArray(devices) ? devices : []).forEach((device, index) => {
    if (!isInteger(device?.gridRow) || !isInteger(device?.gridCol) || device.gridRow < 1 || device.gridCol < 1) return
    const key = `${device.gridRow},${device.gridCol}`
    const entries = groups.get(key) || []
    entries.push(positionRecord(device, index))
    groups.set(key, entries)
  })
  return [...groups.entries()]
    .filter(([, entries]) => entries.length > 1)
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([position, entries]) => ({ position, gridRow: entries[0].gridRow, gridCol: entries[0].gridCol, devices: entries }))
}

export function analyzeDevicePositions(devices, config = {}) {
  const normalized = createGridConfig(config)
  const all = (Array.isArray(devices) ? devices : []).map(positionRecord)
  const unallocated = all.filter(item => item.gridRow == null && item.gridCol == null)
  const invalid = all.filter(item => {
    const hasRow = item.gridRow != null
    const hasCol = item.gridCol != null
    return hasRow !== hasCol
      || (hasRow && (!isInteger(item.gridRow) || !isInteger(item.gridCol) || item.gridRow < 1 || item.gridCol < 1))
  })
  const outOfBounds = all.filter(item => (
    isInteger(item.gridRow)
    && isInteger(item.gridCol)
    && item.gridRow >= 1
    && item.gridCol >= 1
    && (item.gridRow > normalized.rowCount || item.gridCol > normalized.columnCount)
  ))
  const duplicates = getDuplicateDevicePositions(devices)
  const duplicateIds = new Set(duplicates.flatMap(group => group.devices.map(item => item.id)))
  const valid = all.filter(item => (
    isInteger(item.gridRow)
    && isInteger(item.gridCol)
    && item.gridRow >= 1
    && item.gridCol >= 1
    && item.gridRow <= normalized.rowCount
    && item.gridCol <= normalized.columnCount
  ))
  return { all, valid, unallocated, invalid, outOfBounds, duplicates, duplicateIds }
}

export function getOutOfBoundsDevices(devices, config = {}) {
  return analyzeDevicePositions(devices, config).outOfBounds.map(item => item.device)
}

export function calculateGridFit(config, { width = 0, height = 0, isEditMode = false } = {}) {
  const normalized = createGridConfig(config)
  const columns = getVisualColumns(normalized)
  const rows = getVisualRows(normalized)
  const columnWidth = columns.reduce((sum, column) => sum + (column.type === 'aisle' ? column.width : normalized.CELL_MIN_WIDTH), 0)
    + Math.max(columns.length - 1, 0) * GRID_METRICS.trackGap
  const rowHeight = rows.reduce((sum, row) => sum + (row.type === 'aisle' ? row.height : normalized.CELL_HEIGHT), 0)
    + Math.max(rows.length - 1, 0) * GRID_METRICS.trackGap
  const naturalWidth = GRID_METRICS.rowLabelWidth + GRID_METRICS.rootGap + columnWidth
    + (isEditMode ? GRID_METRICS.editControlGap + GRID_METRICS.editControlWidth : 0)
  const naturalHeight = Math.max(
    GRID_METRICS.headerHeight + GRID_METRICS.headerMargin + rowHeight,
    GRID_METRICS.headerHeight + GRID_METRICS.headerMargin + rowHeight
      + (isEditMode ? GRID_METRICS.headerMargin + GRID_METRICS.editControlHeight : 0)
  )
  const safeWidth = Number(width) > 0 ? Number(width) : naturalWidth
  const safeHeight = Number(height) > 0 ? Number(height) : naturalHeight
  const scale = Math.min(1, safeWidth / naturalWidth, safeHeight / naturalHeight)
  return { scale, naturalWidth, naturalHeight, displayWidth: naturalWidth * scale, displayHeight: naturalHeight * scale }
}
