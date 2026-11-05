const FRESHNESS_MS = 30000
const FUTURE_TOLERANCE_MS = 5000
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)

export const hasPrinterStateSummary = record => hasOwn(record, 'stateSummary')

/** Capture receipt once; rendering or merging a legacy message must not renew the sample. */
export function capturePrinterStateSummary(record, now = Date.now()) {
  return hasPrinterStateSummary(record)
    ? { ...record, _stateSummaryReceivedAt: record._stateSummaryReceivedAt ?? now }
    : record
}

/** Read-side projection only. Local job bindings and safety fields remain separate. */
export function applyPrinterStateSummary(record, printerId = record?.id, now = Date.now()) {
  if (!hasPrinterStateSummary(record)) return record
  const summary = record.stateSummary
  const valid = summary?.modelVersion === 2 && printerId != null
    && String(summary.localPrinterId) === String(printerId)
  const receivedAt = record._stateSummaryReceivedAt
  const elapsed = now - receivedAt
  const serverNow = Date.parse(summary?.serverTime) + elapsed
  const age = serverNow - Date.parse(summary?.observedAt)
  const current = valid && summary.stale === false && summary.monitorEnabled === true
    && summary.connectionStatus === 'ONLINE' && Number.isFinite(receivedAt)
    && elapsed >= 0 && Number.isFinite(age) && age >= -FUTURE_TOLERANCE_MS && age <= FRESHNESS_MS
  const health = valid && summary.monitorEnabled === true && summary.connectionStatus === 'OFFLINE'
    ? 'OFFLINE' : current ? 'ONLINE' : 'UNKNOWN'
  const status = current && ['IDLE', 'PREPARING', 'PRINTING', 'PAUSED', 'ERROR', 'UNKNOWN'].includes(summary.status)
    ? summary.status : health === 'OFFLINE' ? 'OFFLINE' : 'UNKNOWN'
  const number = (key, min, max = Number.MAX_VALUE) => current && typeof summary[key] === 'number'
    && Number.isFinite(summary[key]) && summary[key] >= min && summary[key] <= max ? summary[key] : null
  const toolTemperature = number('toolTemperature', -100, 1000)
  const toolTarget = number('toolTarget', -100, 1000)
  const bedTemperature = number('bedTemperature', -100, 1000)
  const bedTarget = number('bedTarget', -100, 1000)
  return {
    ...record,
    id: record.id ?? String(printerId),
    effectiveStatus: status,
    businessStatus: status,
    unifiedState: status,
    state: status,
    connectionStatus: health,
    ...(valid ? { monitorEnabled: summary.monitorEnabled, lastSeenAt: summary.lastSeenAt,
      consecutiveFailureCount: summary.consecutiveFailureCount } : {}),
    progress: number('progress', 0, 100),
    toolTemperature, toolTarget, bedTemperature, bedTarget,
    extruder: { ...record.extruder, temperature: toolTemperature, target: toolTarget },
    heaterBed: { ...record.heaterBed, temperature: bedTemperature, target: bedTarget },
    printDuration: number('printDuration', 0),
    totalDuration: number('totalDuration', 0),
    filamentUsed: number('filamentUsed', 0),
    filename: current ? summary.filename ?? null : null,
    observedFilename: current ? summary.filename ?? null : null,
    taskSource: current ? summary.taskSource || 'UNKNOWN' : 'UNKNOWN',
    executionId: current ? summary.executionId ?? null : null
  }
}
