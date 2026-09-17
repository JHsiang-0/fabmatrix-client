import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeId,
  normalizeFirmwareType,
  normalizeJobStatus,
  normalizePageParams,
  normalizePrintFilePageParams,
  normalizePageResponse,
  normalizePrinter,
  normalizePrinterDetail,
  normalizePrinterStatus,
  resolveEffectivePrinterStatus,
  resolveLastKnownPrinterStatus,
  normalizePrintJob,
  normalizePrintFile,
  normalizeBatchMoveResult
} from '../src/utils/dataAdapters.js'
import { formatFileSize, normalizeProgress } from '../src/utils/formatters.js'
import { shouldRefreshPresignedUrl } from '../src/utils/fileDownload.js'
import { isActiveJob, selectActiveJobs } from '../src/utils/jobSelectors.js'
import {
  getRealtimeAlertClearId,
  toRealtimeAlert,
  toRealtimeSnapshotEntries
} from '../src/utils/realtimeAlerts.js'
import {
  FIRMWARE_TYPES,
  JOB_STATUS,
  JOB_STATUS_MAP,
  JOB_STATUS_VALUES,
  PRINTER_STATUS,
  PRINTER_STATUS_MAP,
  PRINTER_STATUS_VALUES
} from '../src/utils/constants.js'

test('normalizes pagination params and legacy pagination responses', () => {
  assert.deepEqual(normalizePageParams({ pageNum: 3, pageSize: 200 }), {
    pageNum: 3,
    pageSize: 100
  })

  const page = normalizePageResponse({ current: 2, size: 20, total: 41, records: [{ id: 1 }] })
  assert.equal(page.pageNum, 2)
  assert.equal(page.pageSize, 20)
  assert.equal(page.pages, 3)

  const authoritativePage = normalizePageResponse({
    pageNum: 1,
    pageSize: 10,
    total: 21,
    pages: 7,
    records: []
  })
  assert.equal(authoritativePage.pages, 7)
})

test('normalizes file page query with contract fields', () => {
  assert.deepEqual(normalizePrintFilePageParams({
    pageNum: 2,
    pageSize: 20,
    fileName: '  gear  ',
    materialType: ' pla ',
    parentId: 1,
    keyword: 'must-not-be-sent'
  }), {
    pageNum: 2,
    pageSize: 20,
    fileName: 'gear',
    materialType: 'PLA',
    parentId: 1,
    folder: undefined
  })
})

test('refreshes an expired presigned URL at most once', () => {
  assert.equal(shouldRefreshPresignedUrl(401, false), true)
  assert.equal(shouldRefreshPresignedUrl(403, false), true)
  assert.equal(shouldRefreshPresignedUrl(410, false), true)
  assert.equal(shouldRefreshPresignedUrl(410, true), false)
  assert.equal(shouldRefreshPresignedUrl(500, false), false)
})

test('selects only active jobs and removes duplicate records by caller contract', () => {
  const jobs = [
    { id: 1, status: 'QUEUED' },
    { id: 2, status: 'PRINTING' },
    { id: 3, status: 'RECONCILING' },
    { id: 4, status: 'COMPLETED' }
  ]
  assert.equal(isActiveJob(jobs[1]), true)
  assert.equal(isActiveJob(jobs[0]), false)
  assert.deepEqual(selectActiveJobs(jobs).map(job => job.id), [2, 3])
})

test('uses one canonical printer status set and never persists ONLINE', () => {
  assert.deepEqual(PRINTER_STATUS_VALUES, [
    'OFFLINE',
    'IDLE',
    'PREPARING',
    'PRINTING',
    'PAUSED',
    'ERROR',
    'UNKNOWN'
  ])
  assert.deepEqual(Object.keys(PRINTER_STATUS_MAP), PRINTER_STATUS_VALUES)
  assert.equal(normalizePrinterStatus('preparing'), PRINTER_STATUS.PREPARING)
  assert.equal(normalizePrinterStatus('online'), PRINTER_STATUS.UNKNOWN)
  assert.equal(normalizePrinter({ id: 1, status: 'ONLINE' }).status, PRINTER_STATUS.UNKNOWN)
})

test('通信状态优先决定打印机当前可用状态，同时保留最后已知业务状态', () => {
  const offlineIdle = {
    monitorEnabled: true,
    connectionStatus: 'OFFLINE',
    status: 'IDLE',
    lastKnownStatus: 'IDLE'
  }
  assert.equal(resolveEffectivePrinterStatus(offlineIdle), PRINTER_STATUS.OFFLINE)
  assert.equal(resolveLastKnownPrinterStatus(offlineIdle), PRINTER_STATUS.IDLE)
  assert.equal(resolveEffectivePrinterStatus({ ...offlineIdle, connectionStatus: 'ONLINE' }), PRINTER_STATUS.IDLE)
  assert.equal(resolveEffectivePrinterStatus({ ...offlineIdle, connectionStatus: 'UNKNOWN' }), PRINTER_STATUS.UNKNOWN)
  assert.equal(resolveEffectivePrinterStatus({ ...offlineIdle, monitorEnabled: false }), PRINTER_STATUS.UNKNOWN)

  const normalized = normalizePrinter({ id: 1, ...offlineIdle })
  assert.equal(normalized.status, PRINTER_STATUS.IDLE)
  assert.equal(normalized.effectiveStatus, PRINTER_STATUS.OFFLINE)
})

test('flattens the formal printer detail aggregate without losing realtime and job data', () => {
  const detail = normalizePrinterDetail({
    printer: { id: 565, name: 'RRF-192.168.0.88', status: 'IDLE' },
    realtimeStatus: null,
    currentJob: null
  })
  assert.equal(detail.id, '565')
  assert.equal(detail.name, 'RRF-192.168.0.88')
  assert.equal(detail.status, PRINTER_STATUS.IDLE)
  assert.equal(detail.realtimeStatus, null)
  assert.equal(detail.currentJob, null)
})

test('normalizes firmware and job status aliases without changing RRF', () => {
  assert.deepEqual(FIRMWARE_TYPES, ['KLIPPER', 'RRF'])
  assert.equal(normalizeFirmwareType('Klipper'), 'KLIPPER')
  assert.equal(normalizeFirmwareType('RRF'), 'RRF')
  assert.equal(normalizeFirmwareType('Marlin'), null)

  assert.deepEqual(Object.keys(JOB_STATUS_MAP), JOB_STATUS_VALUES)
  assert.equal(normalizeJobStatus('PENDING'), JOB_STATUS.QUEUED)
  assert.equal(normalizeJobStatus('CANCELED'), JOB_STATUS.CANCELLED)
  assert.equal(normalizeJobStatus('PREPARING'), JOB_STATUS.UPLOADING)
})

test('keeps long identifiers as strings and clamps job progress', () => {
  assert.equal(normalizeId(9007199254740993n), '9007199254740993')
  assert.deepEqual(normalizePrintJob({ id: 123, fileId: 456, progress: 120 }), {
    id: '123',
    fileId: '456',
    progress: 100
  })
})

test('normalizes progress and formats file sizes safely', () => {
  assert.equal(normalizeProgress(-10), 0)
  assert.equal(normalizeProgress(120), 100)
  assert.equal(formatFileSize(1024), '1.00 KB')
  assert.equal(formatFileSize(-1), '-')
})

test('normalizes the unified folder flag and removes the legacy field', () => {
  assert.deepEqual(normalizePrintFile({ id: 9, isFolder: 1 }), {
    id: '9',
    folder: true,
    visibility: 'PRIVATE',
    userId: null
  })
  assert.equal(normalizePrintFile({ id: 10, folder: false }).folder, false)
  assert.deepEqual(normalizePrintFile({
    id: 11,
    folder: false,
    estimatedSeconds: '90',
    filamentLength: '1.25'
  }), {
    id: '11',
    folder: false,
    estTime: 90,
    filamentLength: 1.25,
    visibility: 'PRIVATE',
    userId: null
  })
})

test('normalizes batch move counts to the canonical contract and accepts legacy count names', () => {
  assert.deepEqual(normalizeBatchMoveResult({
    totalCount: 2,
    movedCount: 1,
    failedCount: 1,
    items: [{ id: '20', success: true }, { id: '21', success: false, reason: '已在目标目录' }]
  }), {
    totalCount: 2,
    movedCount: 1,
    failedCount: 1,
    items: [{ id: '20', success: true, reason: null }, { id: '21', success: false, reason: '已在目标目录' }],
    message: null
  })

  const legacy = normalizeBatchMoveResult({
    successCount: 2,
    failureCount: 0,
    items: [{ id: 20, success: true }, { id: 21, success: true }]
  })
  assert.equal(legacy.movedCount, 2)
  assert.equal(legacy.failedCount, 0)
})

test('maps legacy endedAt to completedAt and keeps job units canonical', () => {
  assert.deepEqual(normalizePrintJob({
    id: 12,
    status: 'COMPLETED',
    endedAt: '2026-09-04T10:00:00'
  }), {
    id: '12',
    status: 'COMPLETED',
    completedAt: '2026-09-04T10:00:00'
  })
})

test('creates deduplicable alerts for offline printers and failed jobs', () => {
  assert.deepEqual(toRealtimeAlert({
    type: 'PRINTER_OFFLINE',
    printerId: 62,
    data: { reason: '设备无响应' }
  }), {
    id: 'printer-offline:62',
    theme: 'warning',
    title: '打印机 #62 已离线',
    message: '设备无响应'
  })

  assert.deepEqual(toRealtimeAlert({
    type: 'JOB_STATUS',
    printerId: 62,
    data: { jobId: 9, status: 'FAILED', errorReason: '喷嘴温度异常' }
  }), {
    id: 'job-failed:9',
    theme: 'danger',
    title: '打印任务 #9 执行失败',
    message: '喷嘴温度异常'
  })
})

test('clears alerts when the printer recovers or a job leaves FAILED', () => {
  assert.equal(getRealtimeAlertClearId({
    type: 'PRINTER_STATUS',
    printerId: 62,
    data: { unifiedState: 'IDLE' }
  }), 'printer-offline:62')
  assert.equal(getRealtimeAlertClearId({
    type: 'JOB_STATUS',
    data: { jobId: 9, status: 'PRINTING' }
  }), 'job-failed:9')
  assert.equal(getRealtimeAlertClearId({
    type: 'PRINTER_STATUS',
    printerId: 62,
    data: { unifiedState: 'UNKNOWN' }
  }), null)
})

test('maps the backend SNAPSHOT data.printers payload into printer entries', () => {
  assert.deepEqual(toRealtimeSnapshotEntries({
    printers: [{ id: 62, name: 'RRF-01', status: 'IDLE' }]
  }), [{
    printerId: 62,
    data: { id: 62, name: 'RRF-01', status: 'IDLE' }
  }])
})

test('merges cached task observations into the initial printer snapshot', () => {
  assert.deepEqual(toRealtimeSnapshotEntries({
    printers: [{ id: '403', name: 'RRF-01', status: 'IDLE', currentJobId: '1001' }],
    printerStatuses: [{
      printerId: '403',
      data: {
        unifiedState: 'PRINTING',
        filename: 'external.gcode',
        taskSource: 'EXTERNAL',
        farmJobId: '1001',
        farmJobStatus: 'READY',
        taskMatchReason: 'FILENAME_MISMATCH'
      }
    }]
  }), [{
    printerId: '403',
    data: {
      id: '403',
      name: 'RRF-01',
      status: 'IDLE',
      currentJobId: '1001',
      unifiedState: 'PRINTING',
      filename: 'external.gcode',
      taskSource: 'EXTERNAL',
      farmJobId: '1001',
      farmJobStatus: 'READY',
      taskMatchReason: 'FILENAME_MISMATCH'
    }
  }])
})
