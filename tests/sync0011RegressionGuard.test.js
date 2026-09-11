import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'
import {
  MAX_BATCH_UPLOAD_FILES,
  MAX_UPLOAD_FILE_BYTES,
  validateBatchUploadSelection
} from '../src/utils/batchUpload.js'
import {
  getRealtimeAlertClearId,
  toRealtimeSnapshotEntries
} from '../src/utils/realtimeAlerts.js'

const read = relativePath => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
const request = (method, url, data, headers, params) => mockRequest({ method, url, data, headers, params })

const adminHeaders = { Authorization: 'Bearer sync-0011-admin' }
const operatorHeaders = { Authorization: 'Bearer sync-0011-operator' }

function setupSessions() {
  resetMockState()
  mockState.sessions['sync-0011-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.sessions['sync-0011-operator'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
}

function flattenTree(nodes, result = []) {
  nodes.forEach(node => {
    result.push(node)
    if (Array.isArray(node.children)) flattenTree(node.children, result)
  })
  return result
}

test.beforeEach(setupSessions)
test.afterEach(() => resetMockState())

test('SYNC-001.1 保留核心业务源码与既有回归测试入口', () => {
  const protectedPaths = [
    'src/views/FileLibrary.vue',
    'src/components/file/FileFolderTree.vue',
    'src/views/PrinterManage.vue',
    'src/stores/printer/realtimeStore.js',
    'src/views/JobQueue.vue',
    'src/views/BatchDispatch.vue',
    'tests/fileLibrary.test.js',
    'tests/filePreview.test.js',
    'tests/printerMonitoring.test.js',
    'tests/websocket.test.js',
    'tests/realtimeSequence.test.js',
    'tests/mockStateMachine.test.js',
    'tests/batchFlow.test.js'
  ]

  protectedPaths.forEach(relativePath => {
    assert.equal(fs.existsSync(new URL(`../${relativePath}`, import.meta.url)), true, relativePath)
  })

  assert.match(read('package.json'), /"test":\s*"node --test tests\/\*\.test\.js"/)
})

test('文件树按归属暴露 capability，目录操作保持完整且不越权', async () => {
  const treeResponse = await request('GET', '/api/v1/print-files/tree', undefined, operatorHeaders)
  assert.equal(treeResponse.code, 200)
  const nodes = flattenTree(treeResponse.data)
  const publicRoot = nodes.find(node => node.id === '2')
  const operatorDefaultRoot = nodes.find(node => node.id === '4')

  assert.ok(publicRoot)
  assert.equal(publicRoot.visibility, 'PUBLIC')
  assert.equal(publicRoot.canUpload, true)
  assert.equal(publicRoot.canManage, false)
  assert.ok(operatorDefaultRoot)
  assert.equal(operatorDefaultRoot.canCreate, true)
  assert.equal(operatorDefaultRoot.canManage, false)
  assert.equal(nodes.some(node => node.id === '1'), false)
  nodes.forEach(node => {
    for (const capability of ['canManage', 'canCreate', 'canUpload']) {
      assert.equal(typeof node[capability], 'boolean')
    }
    assert.equal('safeName' in node, false)
    assert.equal('fileUrl' in node, false)
  })

  const createdRoot = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: 'SYNC-001.1 根目录'
  }, operatorHeaders)
  const createdChild = await request('POST', '/api/v1/print-files/folder/create', {
    parentId: createdRoot.data.id,
    folderName: 'SYNC-001.1 子目录'
  }, operatorHeaders)
  const renamed = await request('PUT', `/api/v1/print-files/folder/${createdChild.data.id}/rename`, {
    folderName: 'SYNC-001.1 已重命名'
  }, operatorHeaders)
  assert.equal(renamed.data.originalName, 'SYNC-001.1 已重命名')

  const moved = await request('PUT', `/api/v1/print-files/folder/${createdChild.data.id}/move`, {
    parentId: null
  }, operatorHeaders)
  assert.equal(moved.data.parentId, null)
  await request('DELETE', `/api/v1/print-files/folder/${createdChild.data.id}`, undefined, operatorHeaders)
  await request('DELETE', `/api/v1/print-files/folder/${createdRoot.data.id}`, undefined, operatorHeaders)
  assert.equal(mockState.files.some(file => file.originalName === 'SYNC-001.1 根目录'), false)

  await assert.rejects(
    request('POST', '/api/v1/print-files/folder/create', {
      folderName: 'SYNC-001.1 公共目录',
      visibility: 'PUBLIC'
    }, operatorHeaders),
    error => error.response.status === 403
  )
})

test('单文件和批量上传遵守类型、1GB、100个上限并保留逐项结果', async () => {
  assert.equal(MAX_BATCH_UPLOAD_FILES, 100)
  assert.equal(MAX_UPLOAD_FILE_BYTES, 1024 * 1024 * 1024)

  const selection = validateBatchUploadSelection(
    Array.from({ length: 101 }, (_, index) => ({ name: `piece-${index}.GCODE`, size: 1 }))
  )
  assert.equal(selection.files.length, 100)
  assert.equal(selection.rejected.at(-1).reason, '单次最多选择 100 个文件')

  const duplicateSelection = validateBatchUploadSelection([
    { name: 'same.gcode', size: 1 },
    { name: 'SAME.GCODE', size: 1 }
  ])
  assert.equal(duplicateSelection.files.length, 1)
  assert.equal(duplicateSelection.rejected[0].reason, '当前目录已存在同名文件')

  const beforeCount = mockState.files.length
  const batch = await request('POST', '/api/v1/print-files/batch-upload', {
    files: [
      { name: 'sync-0011-valid.gcode', size: 10 },
      { name: 'sync-0011-invalid.txt', size: 10 },
      { name: 'sync-0011-large.3mf', size: MAX_UPLOAD_FILE_BYTES + 1 }
    ]
  }, operatorHeaders)
  assert.deepEqual(batch.data.items.map(item => item.status), ['SUCCESS', 'FAILED', 'FAILED'])
  assert.equal(batch.data.items[1].errorCode, 400)
  assert.equal(batch.data.items[2].message, '单个文件大小不能超过 1GB')
  assert.equal(mockState.files.length, beforeCount + 1)

  const single = await request('POST', '/api/v1/print-files/upload', {
    file: { name: 'sync-0011-single.G', size: 10 }
  }, operatorHeaders)
  assert.equal(single.data.parentId, '4')
  await assert.rejects(
    request('POST', '/api/v1/print-files/upload', {
      file: { name: 'sync-0011-invalid.zip', size: 10 }
    }, operatorHeaders),
    error => error.response.status === 400
  )
})

test('打印机业务状态、通信状态和监控权限保持分离', async () => {
  const printer = mockState.printers.find(item => item.id === 403)
  printer.status = 'PRINTING'
  printer.connectionStatus = 'OFFLINE'
  printer.lastKnownStatus = 'PRINTING'

  const page = await request('GET', '/api/v1/printers/page', undefined, operatorHeaders, {
    pageNum: 1,
    pageSize: 10
  })
  const row = page.data.records.find(item => item.id === '403')
  assert.equal(row.status, 'PRINTING')
  assert.equal(row.connectionStatus, 'OFFLINE')
  assert.equal(row.lastKnownStatus, 'PRINTING')
  assert.equal(typeof row.lastSeenAt, 'string')
  assert.equal(typeof row.consecutiveFailureCount, 'number')

  const monitor = await request('GET', '/api/v1/printers/403/monitor', undefined, operatorHeaders)
  assert.equal(monitor.data.connectionStatus, 'OFFLINE')
  await assert.rejects(
    request('PUT', '/api/v1/printers/403/monitor', { monitorEnabled: false }, operatorHeaders),
    error => error.response.status === 403
  )

  const updated = await request('PUT', '/api/v1/printers/403/monitor', {
    monitorEnabled: false
  }, adminHeaders)
  assert.equal(updated.data.monitorEnabled, false)
  assert.equal(updated.data.connectionStatus, 'OFFLINE')
})

test('REST 快照与 WebSocket 增量使用独立业务/通信字段并支持恢复', () => {
  const entries = toRealtimeSnapshotEntries({
    printers: [{ id: 403, status: 'PRINTING', connectionStatus: 'ONLINE' }]
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].printerId, 403)
  assert.equal(entries[0].data.status, 'PRINTING')
  assert.equal(entries[0].data.connectionStatus, 'ONLINE')
  assert.equal(getRealtimeAlertClearId({
    type: 'COMMUNICATION_HEALTH',
    printerId: 403,
    data: { connectionStatus: 'ONLINE' }
  }), 'printer-offline:403')

  const realtimeSource = read('src/stores/printer/realtimeStore.js')
  assert.match(realtimeSource, /const isCommunicationHealth = stateSource === 'COMMUNICATION_HEALTH'/)
  assert.match(realtimeSource, /if \(!isCommunicationHealth && hasBusinessState\) \{[\s\S]*next\.businessStatus = businessState/)
  assert.match(realtimeSource, /assignIfPresent\('connectionStatus'/)
  assert.match(realtimeSource, /if \(type === 'SNAPSHOT'\)[\s\S]*toRealtimeSnapshotEntries\(data\)/)
  assert.match(realtimeSource, /if \(type === 'JOB_STATUS'\)[\s\S]*jobStore\.queueRealtimeJobStatus\(message\)/)
  assert.match(realtimeSource, /refreshPrinterSnapshot\(\)/)
})

test('急停进入 RECONCILING，人工核对重新排队时释放打印机绑定', async () => {
  const printer = mockState.printers.find(item => item.id === 403)
  const job = mockState.jobs.find(item => item.id === 1001)
  assert.equal(job.status, 'PRINTING')
  assert.equal(printer.currentJobId, job.id)

  await request('POST', '/api/v1/control/403/emergency-stop', undefined, adminHeaders)
  const reconciling = await request('GET', '/api/v1/print-jobs/1001', undefined, adminHeaders)
  assert.equal(reconciling.data.status, 'RECONCILING')
  assert.equal(mockState.printers.find(item => item.id === 403).status, 'ERROR')
  assert.equal(mockState.printers.find(item => item.id === 403).currentJobId, 1001)

  const reconciled = await request('POST', '/api/v1/print-jobs/1001/reconcile', {
    result: 'QUEUED',
    reason: 'SYNC-001.1 回归护栏核对'
  }, adminHeaders)
  assert.equal(reconciled.data, null)
  const reconciledJob = await request('GET', '/api/v1/print-jobs/1001', undefined, adminHeaders)
  assert.equal(reconciledJob.data.status, 'QUEUED')
  assert.equal(reconciledJob.data.printerId, null)
  assert.equal(mockState.printers.find(item => item.id === 403).status, 'IDLE')
  assert.equal(mockState.printers.find(item => item.id === 403).currentJobId, null)
})

test('批量派发 Preview 无副作用且 Confirm 重复提交幂等', async () => {
  const initialJobCount = mockState.jobs.length
  const printer = mockState.printers.find(item => item.id === 408)
  const initialPrinterJobId = printer.currentJobId
  const preview = await request('POST', '/api/v1/print-jobs/batch/preview', {
    fileIds: [22],
    printerIds: [408],
    strategy: 'ONE_TO_ONE',
    action: 'QUEUE'
  }, adminHeaders)

  assert.equal(mockState.jobs.length, initialJobCount)
  assert.equal(printer.currentJobId, initialPrinterJobId)
  assert.equal(preview.data.items[0].canExecute, true)

  const confirmRequest = {
    planId: preview.data.planId,
    version: preview.data.version,
    itemIds: [preview.data.items[0].itemId],
    confirmationToken: preview.data.confirmationToken
  }
  const confirmed = await request('POST', '/api/v1/print-jobs/batch/confirm', confirmRequest, adminHeaders)
  const repeated = await request('POST', '/api/v1/print-jobs/batch/confirm', confirmRequest, adminHeaders)
  assert.equal(confirmed.data.items[0].status, 'ASSIGNED')
  assert.equal(repeated.data.repeated, true)
  assert.equal(repeated.data.items[0].jobId, confirmed.data.items[0].jobId)
  assert.equal(mockState.jobs.length, initialJobCount + 1)
})
