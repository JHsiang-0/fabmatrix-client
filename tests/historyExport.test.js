import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import {
  createExportRequestGuard, exportFileName, HISTORY_EXPORT_TYPES,
  createHistoryExportForm, historyExportFiltersFromForm, readJsonDownloadBody, saveExportFile, toHistoryExportPayload
} from '../src/utils/fileExport.js'
import { readXlsx } from './helpers/xlsxReadback.js'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

test('history export sends terminal filters and excludes page/timeField', () => {
  assert.deepEqual(toHistoryExportPayload({ status: 'FAILED', pageNum: 4, pageSize: 10, timeField: 'CREATED_AT',
    fileName: ' sample ', printerId: '9007199254740993', startTime: '2026-10-08T00:00:00', userId: '2' }, 'PDF'), {
    format: 'PDF', statuses: ['FAILED'], fileName: 'sample', printerId: '9007199254740993', userId: '2', startTime: '2026-10-08T00:00:00'
  })
  assert.deepEqual(toHistoryExportPayload().statuses, ['COMPLETED', 'FAILED', 'CANCELLED'])
  assert.throws(() => toHistoryExportPayload({}, 'CSV'))
  assert.throws(() => toHistoryExportPayload({ status: 'PRINTING' }))
  assert.throws(() => toHistoryExportPayload({ statuses: [] }))
})

test('export form is independent, initializes from list filters and strips OPERATOR creator filters', () => {
  const original = { statuses: ['FAILED'], fileName: 'gearbox', printerId: '403', userId: '2',
    startTime: '2026-10-08T00:00:00', endTime: '2026-10-08T23:59:59' }
  const form = createHistoryExportForm(original, true)
  form.statuses.push('CANCELLED')
  form.fileName = 'other'
  assert.deepEqual(original.statuses, ['FAILED'])
  assert.equal(original.fileName, 'gearbox')
  assert.equal(historyExportFiltersFromForm(form, true).userId, '2')
  assert.equal('userId' in historyExportFiltersFromForm(form, false), false)
  assert.equal(createHistoryExportForm(original, false).userId, '')
  assert.deepEqual(historyExportFiltersFromForm(createHistoryExportForm()), { statuses: ['COMPLETED', 'FAILED', 'CANCELLED'] })
})

test('export form validates positive Long IDs, file limit and complete real calendar dates before download', () => {
  for (const id of ['0', '-1', '1.5', 'device-name', '9223372036854775808']) {
    assert.throws(() => toHistoryExportPayload({ printerId: id }), /ID/)
  }
  assert.throws(() => toHistoryExportPayload({ fileName: 'x'.repeat(256) }), /255/)
  assert.throws(() => historyExportFiltersFromForm({ statuses: ['COMPLETED'], dateRange: ['2026-10-08 00:00:00'] }), /完整/)
  assert.throws(() => toHistoryExportPayload({ startTime: '2026-02-30T00:00:00' }), /格式/)
  assert.throws(() => toHistoryExportPayload({ startTime: '2026-10-09T00:00:00', endTime: '2026-10-08T23:59:59' }), /晚于/)
  assert.equal(toHistoryExportPayload({ printerId: '9223372036854775807' }).printerId, '9223372036854775807')
})

test('safe names prefer UTF8, reject paths/control characters and enforce the format suffix', () => {
  assert.equal(exportFileName("attachment; filename=history.xlsx; filename*=UTF-8''%E6%89%93%E5%8D%B0%E5%8E%86%E5%8F%B2.xlsx", 'XLSX'), '打印历史.xlsx')
  assert.equal(exportFileName('attachment; filename="../../report.exe"', 'PDF'), 'report.pdf')
  assert.equal(exportFileName('attachment; filename="C:\\folder\\NUL.xlsx"', 'XLSX'), '打印历史.xlsx')
  assert.equal(exportFileName("attachment; filename=history.pdf; filename*=UTF-8''%zz", 'PDF'), 'history.pdf')
  assert.equal(exportFileName(null, 'PDF'), '打印历史.pdf')
})

test('download JSON parser handles Blob errors, malformed JSON and binary documents', async () => {
  assert.deepEqual(await readJsonDownloadBody(new Blob(['{"code":422,"message":"缩小范围"}'], { type: 'application/json' })), { code: 422, message: '缩小范围' })
  assert.deepEqual(await readJsonDownloadBody(new Blob(['{"code":403}']), {}, true), { code: 403 })
  assert.equal(await readJsonDownloadBody(new Blob(['bad json'], { type: 'application/json' })), null)
  assert.equal(await readJsonDownloadBody(new Blob(['%PDF-1.4'], { type: 'application/pdf' })), null)
})

test('download link is removed immediately and URL is revoked after consumption, also on click failure', () => {
  for (const fails of [false, true]) {
    const events = []
    let cleanup
    const anchor = { click() { events.push('click'); if (fails) throw new Error('click failed') }, remove() { events.push('remove') } }
    const platform = { URL: { createObjectURL: () => 'blob:history', revokeObjectURL: url => events.push(url) },
      document: { createElement: () => anchor, body: { appendChild: () => events.push('append') } },
      setTimeout: callback => { cleanup = callback } }
    const save = () => saveExportFile({ blob: new Blob(['file']), contentDisposition: 'attachment; filename=history.pdf' }, 'PDF', platform)
    if (fails) assert.throws(save, /click failed/)
    else assert.equal(save(), 'history.pdf')
    assert.deepEqual(events, ['append', 'click', 'remove'])
    cleanup()
    assert.deepEqual(events, ['append', 'click', 'remove', 'blob:history'])
    assert.equal(anchor.download, 'history.pdf')
  }
})

test('request guard deduplicates, cancels and ignores identity/role changes and disposal', () => {
  let identity = 'admin:1:ADMIN'
  const guard = createExportRequestGuard(() => identity)
  const first = guard.begin()
  assert.equal(guard.begin(), null)
  identity = 'operator:2:OPERATOR'
  assert.equal(guard.isCurrent(first), false)
  guard.cancel()
  assert.equal(first.controller.signal.aborted, true)
  const second = guard.begin()
  guard.finish(first)
  assert.equal(guard.isCurrent(second), true)
  guard.dispose()
  assert.equal(second.controller.signal.aborted, true)
  assert.equal(guard.isCurrent(second), false)
  assert.equal(guard.begin(), null)
})

const mockExport = (format, body = {}, token = 'export-admin') => mockRequest({ method: 'post', url: '/api/v1/print-jobs/history/export',
  headers: { Authorization: `Bearer ${token}` }, data: { format, ...body } })
const setupMock = () => {
  resetMockState()
  mockState.sessions['export-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.sessions['export-operator'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
}

test('Mock emits valid XLSX/PDF binary signatures, headers and only selected terminal records', async () => {
  setupMock()
  const xlsx = await mockExport('XLSX', { statuses: ['FAILED'] })
  assert.equal(xlsx.headers['content-type'], HISTORY_EXPORT_TYPES.XLSX)
  const excel = new Uint8Array(await xlsx.data.arrayBuffer())
  assert.deepEqual(Array.from(excel.slice(0, 4)), [0x50, 0x4b, 3, 4])
  const text = new TextDecoder().decode(excel)
  assert.match(text, /xl\/worksheets\/sheet1.xml/)
  assert.match(text, /1005/)
  assert.doesNotMatch(text, /1001/)
  const pdf = await mockExport('PDF', { statuses: ['COMPLETED'] })
  assert.equal(pdf.headers['content-type'], HISTORY_EXPORT_TYPES.PDF)
  assert.match(await pdf.data.text(), /^%PDF-1\.4/)
  assert.match(await pdf.data.text(), /xref/)
  assert.match(pdf.headers['content-disposition'], /filename\*=UTF-8''/)
})

test('downloaded workbook opens with full 13-column detail first and matching statistics second', async () => {
  setupMock()
  const source = mockState.jobs.find(job => job.id === 1005)
  Object.assign(source, { machineNumberSnapshot: '历史机台', operatorUsernameSnapshot: '现场操作员',
    startedAt: '2026-10-08T10:00:00', completedAt: '2026-10-08T10:17:15', attemptNumber: 3, errorReason: '=原样文本原因' })
  const download = await mockExport('XLSX', { statuses: ['FAILED'] })
  const book = readXlsx(await download.data.arrayBuffer())
  assert.equal(book.activeTab, 0)
  assert.deepEqual(book.sheets.map(sheet => sheet.name), ['明细', '汇总'])
  assert.deepEqual(book.sheets[0].rows[0], ['任务编号', '文件名', '打印机', '机台号', '创建人', '操作员', '结果', '创建时间', '开始时间', '结束时间', '经过时长（分钟）', '尝试序号', '原因'])
  assert.equal(book.sheets[0].rows.length, 2)
  assert.equal(book.sheets[0].rows[1].length, 13)
  assert.equal(book.sheets[0].rows[1][0], '1005')
  assert.equal(book.sheets[0].rows[1][3], '历史机台')
  assert.equal(book.sheets[0].rows[1][5], '现场操作员')
  assert.equal(book.sheets[0].rows[1][10], 17.25)
  assert.equal(book.sheets[0].rows[1][11], 3)
  assert.equal(book.sheets[0].rows[1][12], '=原样文本原因')
  assert.deepEqual(book.sheets[1].rows.find(row => row[0] === '历史记录条数'), ['历史记录条数', 1])
})

test('Mock export enforces role ownership, missing session, terminal status and row limit', async () => {
  setupMock()
  await assert.rejects(mockExport('PDF', {}, 'unknown'), error => error.response.status === 401)
  const forcedOwn = await mockExport('PDF', { userId: '1' }, 'export-operator')
  assert.match(await forcedOwn.data.text(), /#1004/)
  assert.doesNotMatch(await forcedOwn.data.text(), /#1005/)
  await assert.rejects(mockExport('PDF', { statuses: ['PRINTING'] }), error => error.response.status === 400)
  mockState.jobs = Array.from({ length: 1001 }, (_, index) => ({ id: 10000 + index, userId: 1, status: 'COMPLETED', completedAt: '2026-10-08T12:00:00' }))
  await assert.rejects(mockExport('PDF'), error => error.response.status === 422 && /缩小时间范围/.test(error.message))
  const own = await mockExport('PDF', {}, 'export-operator')
  assert.match(await own.data.text(), /0 records/)
})

let viteServer, service, exportJobHistory, useUserStore, request
test.before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  viteServer = await createServer({ root, configFile: false, appType: 'custom', plugins: [vue()],
    resolve: { alias: { '@': path.resolve(root, 'src') } }, server: { middlewareMode: true, hmr: false } })
  ;({ service, default: request } = await viteServer.ssrLoadModule('/src/utils/request.js'))
  ;({ exportJobHistory } = await viteServer.ssrLoadModule('/src/api/job.js'))
  ;({ useUserStore } = await viteServer.ssrLoadModule('/src/stores/user.js'))
  const { default: router } = await viteServer.ssrLoadModule('/src/router/index.js')
  router.push = async () => {}
  await viteServer.ssrLoadModule('/src/stores/printer/realtimeStore.js')
})
test.after(async () => { await viteServer.close() })
const login = (token = 'export-admin-session', role = 'ADMIN') => {
  setActivePinia(createPinia())
  const store = useUserStore()
  store.userLoginWithResult({ token, userId: role === 'ADMIN' ? '1' : '2', username: role === 'ADMIN' ? 'admin' : 'operator', role, expiresIn: 3600 })
  return store
}
const response = (config, data, status = 200, headers = {}) => ({ config, data, status, statusText: 'OK', headers })

test('real Axios export carries JWT, whitelist filters and binary response headers', async () => {
  login()
  let seen
  service.defaults.adapter = async config => {
    seen = config
    return response(config, new Blob(['%PDF-1.4\n%%EOF'], { type: HISTORY_EXPORT_TYPES.PDF }), 200,
      { 'content-type': HISTORY_EXPORT_TYPES.PDF, 'content-disposition': 'attachment; filename=history.pdf' })
  }
  const result = await exportJobHistory({ status: 'FAILED', userId: '2', pageNum: 9, pageSize: 20 }, 'PDF')
  assert.equal(seen.headers.Authorization, 'Bearer export-admin-session')
  assert.equal(seen.url, '/api/v1/print-jobs/history/export')
  assert.deepEqual(JSON.parse(seen.data), { format: 'PDF', statuses: ['FAILED'], userId: '2' })
  assert.equal(result.contentDisposition, 'attachment; filename=history.pdf')
  assert.equal(result.blob.type, HISTORY_EXPORT_TYPES.PDF)
})

for (const status of [400, 403, 422, 503]) {
  test(`real Axios decodes HTTP ${status} JSON Blob into the shared safe error`, async () => {
    login()
    service.defaults.adapter = async config => {
      const error = new Error('HTTP failure')
      error.config = config
      error.response = response(config, new Blob([JSON.stringify({ code: status, message: '请缩小时间范围', data: null })], { type: 'application/json' }), status,
        { 'content-type': 'application/json', 'X-Trace-Id': 'export-trace' })
      throw error
    }
    await assert.rejects(exportJobHistory({}, 'XLSX'), error => error.status === status && error.message === '请缩小时间范围'
      && error.traceId === 'export-trace' && error.response.data.code === status && !error.config.headers)
  })
}

test('real Axios rejects JSON business errors returned as HTTP 200 without downloading', async () => {
  login()
  service.defaults.adapter = async config => response(config, new Blob(['{"code":422,"message":"记录过多"}'], { type: 'application/json' }), 200, { 'content-type': 'application/json' })
  await assert.rejects(exportJobHistory({}, 'PDF'), error => error.code === 422 && error.message === '记录过多')
})

test('real Axios rejects wrong or empty binary output while legacy Blob API retains its shape', async () => {
  login()
  service.defaults.adapter = async config => response(config, new Blob(['<html>failure</html>'], { type: 'text/html' }), 200, { 'content-type': 'text/html' })
  await assert.rejects(exportJobHistory({}, 'PDF'), error => error.status === 503)
  service.defaults.adapter = async config => response(config, new Blob([], { type: HISTORY_EXPORT_TYPES.PDF }), 200, { 'content-type': HISTORY_EXPORT_TYPES.PDF })
  await assert.rejects(exportJobHistory({}, 'PDF'), error => error.status === 503)
  service.defaults.adapter = async config => response(config, new Blob(['thumbnail'], { type: 'image/png' }))
  assert.equal((await request({ url: '/thumbnail', method: 'get', responseType: 'blob' })).type, 'image/png')
})

test('a canceled export is never reused by a fresh retry with identical filters', async () => {
  login()
  const pending = []
  service.defaults.adapter = config => new Promise(resolve => pending.push({ config, resolve }))
  const controller = new AbortController()
  const first = exportJobHistory({}, 'PDF', { signal: controller.signal })
  const firstResult = assert.rejects(first, error => error.context === 'canceled')
  while (pending.length < 1) await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  const second = exportJobHistory({}, 'PDF')
  while (pending.length < 2) await new Promise(resolve => setImmediate(resolve))
  for (const item of pending) item.resolve(response(item.config, new Blob(['%PDF-1.4'], { type: HISTORY_EXPORT_TYPES.PDF }), 200, { 'content-type': HISTORY_EXPORT_TYPES.PDF }))
  await firstResult
  assert.equal((await second).contentType, HISTORY_EXPORT_TYPES.PDF)
})

test('real Axios binary current-session 401 logs out but an obsolete-session 401 preserves the new identity', async () => {
  for (const obsolete of [false, true]) {
    const store = login()
    let release
    let seen
    service.defaults.adapter = config => {
      seen = config
      return new Promise((resolve, reject) => { release = () => {
        const error = new Error('Unauthorized')
        error.config = config
        error.response = response(config, new Blob(['{"code":401,"message":"登录已过期"}'], { type: 'application/json' }), 401)
        reject(error)
      } })
    }
    const pending = exportJobHistory({}, 'PDF')
    while (!seen) await new Promise(resolve => setImmediate(resolve))
    if (obsolete) store.userLoginWithResult({ token: 'export-operator-session', userId: '2', username: 'operator', role: 'OPERATOR', expiresIn: 3600 })
    release()
    await assert.rejects(pending, error => error.status === 401)
    assert.equal(store.token, obsolete ? 'export-operator-session' : '')
  }
})
