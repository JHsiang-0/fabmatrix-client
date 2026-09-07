import { GRID_CONFIG as LEGACY_GRID_CONFIG } from './constants.js'

export const GRID_LAYOUT_STORAGE_KEY = 'fabmatrix:grid-layout'

const LIMITS = {
  rows: { min: 1, max: 30 },
  columns: { min: 1, max: 60 },
  aislePosition: { min: 0, max: 60 },
  aisleWidth: { min: 48, max: 240 }
}

const DEFAULT_AISLE = {
  label: '过道',
  width: LEGACY_GRID_CONFIG.CELL_MIN_WIDTH
}

function toInteger(value, fallback, { min, max }) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(Math.round(number), min), max)
}

function normalizeAisles(aisles, rowCount, columnCount, legacyAisleCol) {
  const source = Array.isArray(aisles) && aisles.length
    ? aisles
    : legacyAisleCol
      ? [{ axis: 'column', afterIndex: Number(legacyAisleCol) - 1 }]
      : []
  const seen = new Set()

  return source
    .map((aisle, index) => {
      const axis = aisle?.axis === 'row' ? 'row' : 'column'
      const limit = axis === 'row' ? rowCount : columnCount
      const legacyPosition = axis === 'row' ? aisle?.afterRow : aisle?.afterColumn
      const afterIndex = toInteger(
        aisle?.afterIndex ?? legacyPosition,
        Math.min(index + 1, limit),
        { ...LIMITS.aislePosition, max: limit }
      )
      const key = `${axis}:${afterIndex}`
      if (seen.has(key)) return null
      seen.add(key)
      const size = toInteger(
        aisle?.size ?? (axis === 'row' ? aisle?.height : aisle?.width),
        axis === 'row' ? LEGACY_GRID_CONFIG.CELL_HEIGHT : DEFAULT_AISLE.width,
        { min: LIMITS.aisleWidth.min, max: LIMITS.aisleWidth.max }
      )
      return {
        id: String(aisle?.id || `aisle-${axis}-${afterIndex}`),
        axis,
        afterIndex,
        ...(axis === 'row' ? { afterRow: afterIndex, height: size } : { afterColumn: afterIndex, width: size }),
        label: String(aisle?.label || DEFAULT_AISLE.label).trim() || DEFAULT_AISLE.label,
        size
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.afterColumn - right.afterColumn)
}

export function createGridConfig(input = {}) {
  const rowCount = toInteger(input.rowCount ?? input.ROWS, LEGACY_GRID_CONFIG.ROWS, LIMITS.rows)
  const columnCount = toInteger(input.columnCount ?? input.COLS, LEGACY_GRID_CONFIG.COLS, LIMITS.columns)
  const aisles = normalizeAisles(input.aisles, rowCount, columnCount, input.AISLE_COL)
  const firstColumnAisle = aisles.find(aisle => aisle.axis === 'column')
  const rowAisleCount = aisles.filter(aisle => aisle.axis === 'row').length
  const columnAisleCount = aisles.filter(aisle => aisle.axis === 'column').length

  return {
    rowCount,
    columnCount,
    aisles,
    ROWS: rowCount,
    COLS: columnCount,
    TOTAL_ROWS: rowCount + rowAisleCount,
    TOTAL_COLS: columnCount + columnAisleCount,
    AISLE_COL: firstColumnAisle ? firstColumnAisle.afterColumn + 1 : null,
    AISLE_COL_INDEX: firstColumnAisle ? firstColumnAisle.afterColumn : -1,
    CELL_HEIGHT: Number(input.CELL_HEIGHT) || LEGACY_GRID_CONFIG.CELL_HEIGHT,
    CELL_MIN_WIDTH: Number(input.CELL_MIN_WIDTH) || LEGACY_GRID_CONFIG.CELL_MIN_WIDTH
  }
}

export function getDefaultGridConfig() {
  return createGridConfig(LEGACY_GRID_CONFIG)
}

export function loadGridConfig() {
  if (typeof window === 'undefined') return getDefaultGridConfig()

  try {
    const saved = window.localStorage.getItem(GRID_LAYOUT_STORAGE_KEY)
    return saved ? createGridConfig(JSON.parse(saved)) : getDefaultGridConfig()
  } catch (error) {
    console.warn('[GridLayout] 布局配置读取失败，将使用默认配置:', error)
    return getDefaultGridConfig()
  }
}

export function saveGridConfig(config) {
  const normalized = createGridConfig(config)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(GRID_LAYOUT_STORAGE_KEY, JSON.stringify({
      rowCount: normalized.rowCount,
      columnCount: normalized.columnCount,
      aisles: normalized.aisles
    }))
  }
  return normalized
}

export function getVisualColumns(config) {
  const normalized = createGridConfig(config)
  const aislesByPosition = new Map(normalized.aisles
    .filter(aisle => aisle.axis === 'column')
    .map(aisle => [aisle.afterColumn, aisle]))
  const columns = []

  for (let physicalColumn = 1; physicalColumn <= normalized.columnCount; physicalColumn += 1) {
    columns.push({ type: 'device', number: physicalColumn })
    const aisle = aislesByPosition.get(physicalColumn)
    if (aisle) columns.push({ type: 'aisle', ...aisle })
  }

  const leadingAisles = normalized.aisles.filter(aisle => aisle.afterColumn === 0)
  return [...leadingAisles.map(aisle => ({ type: 'aisle', ...aisle })), ...columns]
}

export function getPhysicalColumn(visualColumn, config) {
  return getVisualColumns(config)[Number(visualColumn) - 1]?.number ?? null
}

export function isAisleVisualColumn(visualColumn, config) {
  return getVisualColumns(config)[Number(visualColumn) - 1]?.type === 'aisle'
}

export function getVisualRows(config) {
  const normalized = createGridConfig(config)
  const aislesByPosition = new Map(normalized.aisles
    .filter(aisle => aisle.axis === 'row')
    .map(aisle => [aisle.afterRow, aisle]))
  const rows = []

  for (let physicalRow = 1; physicalRow <= normalized.rowCount; physicalRow += 1) {
    rows.push({ type: 'device', number: physicalRow })
    const aisle = aislesByPosition.get(physicalRow)
    if (aisle) rows.push({ type: 'aisle', ...aisle })
  }

  const leadingAisles = normalized.aisles.filter(aisle => aisle.axis === 'row' && aisle.afterRow === 0)
  return [...leadingAisles.map(aisle => ({ type: 'aisle', ...aisle })), ...rows]
}

export function getPhysicalRow(visualRow, config) {
  return getVisualRows(config)[Number(visualRow) - 1]?.number ?? null
}

export function isAisleVisualRow(visualRow, config) {
  return getVisualRows(config)[Number(visualRow) - 1]?.type === 'aisle'
}

export function getOutOfBoundsDevices(devices, config) {
  const normalized = createGridConfig(config)
  return (Array.isArray(devices) ? devices : []).filter(device => (
    Number.isInteger(device?.gridRow)
    && Number.isInteger(device?.gridCol)
    && (device.gridRow < 1
      || device.gridRow > normalized.rowCount
      || device.gridCol < 1
      || device.gridCol > normalized.columnCount)
  ))
}
