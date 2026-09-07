import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const request = (method, url, data, headers, params) => mockRequest({ method, url, data, headers, params })
const adminHeaders = { Authorization: 'Bearer file-preview-admin' }
const operatorHeaders = { Authorization: 'Bearer file-preview-operator' }

function setupSession() {
  resetMockState()
  mockState.sessions['file-preview-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.sessions['file-preview-operator'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
}

test('returns safe preview metadata and keeps filament length in meters', async () => {
  setupSession()
  const response = await request('GET', '/api/v1/print-files/20/preview', undefined, adminHeaders)

  assert.equal(response.data.id, 20)
  assert.equal(response.data.filamentLength, 3)
  assert.equal(response.data.estTime, 3600)
  assert.equal(response.data.previewSupported, true)
  assert.equal('fileUrl' in response.data, false)
  assert.equal('safeName' in response.data, false)
  assert.equal('rustfsKey' in response.data, false)
})

test('rejects folder preview and returns null for a missing thumbnail', async () => {
  setupSession()
  await assert.rejects(
    request('GET', '/api/v1/print-files/1/preview', undefined, adminHeaders),
    error => error.response.status === 422
  )

  const thumbnail = await request(
    'GET',
    '/api/v1/print-files/20/thumbnail',
    undefined,
    adminHeaders,
    { expires: 60 }
  )
  assert.equal(thumbnail.data, null)
})

test('returns real associated jobs with pagination and public fields only', async () => {
  setupSession()
  const response = await request(
    'GET',
    '/api/v1/print-files/20/jobs',
    undefined,
    adminHeaders,
    { pageNum: 1, pageSize: 10 }
  )

  assert.equal(response.data.total, 2)
  assert.deepEqual(response.data.records.map(job => job.id), [1001, 1005])
  assert.equal(response.data.records.every(job => job.fileId === 20), true)
  assert.equal('fileName' in response.data.records[0], false)
  assert.equal('printerName' in response.data.records[0], false)
})

test('returns an access-filtered nested file tree without internal fields', async () => {
  setupSession()
  const response = await request('GET', '/api/v1/print-files/tree', undefined, operatorHeaders)
  const rootNames = response.data.map(node => node.name)
  const defaultFolder = response.data.find(node => node.id === 4)

  assert.deepEqual(rootNames, ['我的文件夹', '测试文件'])
  assert.equal(defaultFolder.isDefault, true)
  assert.deepEqual(defaultFolder.children, [])
  const defaultFolderFiles = await request('POST', '/api/v1/print-files/page', {
    pageNum: 1,
    pageSize: 10,
    parentId: 4,
    folder: false
  }, operatorHeaders)
  assert.deepEqual(defaultFolderFiles.data.records.map(file => file.id), [23])
  assert.equal(defaultFolderFiles.data.records[0].originalName, 'calibration.bgcode')
  assert.equal(response.data.some(node => node.id === 1), false)
  assert.equal(response.data.every(node => node.userId === 2), true)
  assert.equal('safeName' in defaultFolder, false)
  assert.equal('fileUrl' in defaultFolderFiles.data.records[0], false)
})

test('allows the real default folder as a second-level parent but still caps depth at two', async () => {
  setupSession()

  const created = await request('POST', '/api/v1/print-files/folder/create', {
    parentId: 4,
    folderName: '校准归档'
  }, operatorHeaders)
  assert.equal(created.data.parentId, 4)
  assert.equal(created.data.level, 2)

  await assert.rejects(
    request('POST', '/api/v1/print-files/folder/create', {
      parentId: created.data.id,
      folderName: '不应创建'
    }, operatorHeaders),
    error => error.response.status === 422
  )
})

test('resolves omitted upload parents to the real default folder and validates page parents', async () => {
  setupSession()

  const single = await request('POST', '/api/v1/print-files/upload', {
    file: { name: 'default-single.gcode', size: 12 }
  }, operatorHeaders)
  assert.equal(single.data.parentId, 4)

  const batch = await request('POST', '/api/v1/print-files/batch-upload', {
    files: [{ name: 'default-batch.gcode', size: 12 }]
  }, operatorHeaders)
  assert.equal(batch.data.items[0].status, 'SUCCESS')
  const batchFile = mockState.files.find(file => file.id === batch.data.items[0].fileId)
  assert.equal(batchFile.parentId, 4)

  await assert.rejects(
    request('POST', '/api/v1/print-files/page', { pageNum: 1, pageSize: 10, parentId: 20 }, operatorHeaders),
    error => error.response.status === 422 && error.message === '父级资源不是文件夹'
  )
  await assert.rejects(
    request('POST', '/api/v1/print-files/page', { pageNum: 1, pageSize: 10, parentId: 1 }, operatorHeaders),
    error => error.response.status === 403 && error.message === '无权访问该文件夹'
  )
  await assert.rejects(
    request('POST', '/api/v1/print-files/page', { pageNum: 1, pageSize: 10, parentId: 999 }, operatorHeaders),
    error => error.response.status === 404 && error.message === '父文件夹不存在'
  )
})
