import test from 'node:test'
import assert from 'node:assert/strict'
import { mockRequest } from '../src/mock/index.js'
import { mockState, resetMockState } from '../src/mock/data.js'

const request = (method, url, data, headers, params) => mockRequest({ method, url, data, headers, params })
const adminHeaders = { Authorization: 'Bearer file-preview-admin' }
const secondAdminHeaders = { Authorization: 'Bearer file-preview-second-admin' }
const operatorHeaders = { Authorization: 'Bearer file-preview-operator' }
const thirdUserHeaders = { Authorization: 'Bearer file-preview-third-user' }

function setupSession() {
  resetMockState()
  mockState.users.push({
    id: 3,
    username: 'third-user',
    password: 'Third123',
    role: 'OPERATOR',
    email: null,
    phone: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  })
  mockState.sessions['file-preview-admin'] = { userId: 1, username: 'admin', role: 'ADMIN' }
  mockState.sessions['file-preview-second-admin'] = { userId: 3, username: 'second-admin', role: 'ADMIN' }
  mockState.sessions['file-preview-operator'] = { userId: 2, username: 'operator', role: 'OPERATOR' }
  mockState.sessions['file-preview-third-user'] = { userId: 3, username: 'third-user', role: 'OPERATOR' }
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

  assert.deepEqual(rootNames, ['公共文件', '我的文件夹', '测试文件'])
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
  assert.equal(response.data.find(node => node.visibility === 'PUBLIC').canUpload, true)
  assert.equal(response.data.find(node => node.visibility === 'PUBLIC').canManage, false)
  assert.equal('safeName' in defaultFolder, false)
  assert.equal('fileUrl' in defaultFolderFiles.data.records[0], false)
})

test('allows authenticated public browse upload and job creation but denies public structure management', async () => {
  setupSession()

  const publicPage = await request('POST', '/api/v1/print-files/page', {
    pageNum: 1,
    pageSize: 10,
    parentId: 5,
    folder: false
  }, operatorHeaders)
  assert.equal(publicPage.data.records[0].visibility, 'PUBLIC')
  assert.equal(publicPage.data.records[0].canPrint, true)
  assert.equal(publicPage.data.records[0].canDelete, true)

  const uploaded = await request('POST', '/api/v1/print-files/upload', {
    file: { name: 'public-upload.gcode', size: 12 },
    parentId: 5
  }, operatorHeaders)
  assert.equal(uploaded.data.visibility, 'PUBLIC')

  const jobId = await request('POST', '/api/v1/print-jobs', {
    fileId: publicPage.data.records[0].id,
    priority: 0
  }, operatorHeaders)
  assert.ok(jobId.data)

  await assert.rejects(
    request('POST', '/api/v1/print-files/folder/create', {
      parentId: 5,
      folderName: '不应创建'
    }, operatorHeaders),
    error => error.response.status === 403
  )
  const move = await request('PUT', '/api/v1/print-files/batch/move', {
    ids: [23],
    parentId: 5
  }, operatorHeaders)
  assert.equal(move.data.items[0].success, false)
})

test('blocks admin writes into another user private folders and shares public name namespaces', async () => {
  setupSession()

  await assert.rejects(
    request('POST', '/api/v1/print-files/folder/create', {
      parentId: 4,
      folderName: '不应创建'
    }, adminHeaders),
    error => error.response.status === 403
  )
  await assert.rejects(
    request('POST', '/api/v1/print-files/upload', {
      parentId: 4,
      file: { name: '不应上传.gcode', size: 12 }
    }, adminHeaders),
    error => error.response.status === 403
  )

  const publicRoot = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '共享命名空间',
    visibility: 'PUBLIC'
  }, adminHeaders)
  await assert.rejects(
    request('POST', '/api/v1/print-files/folder/create', {
      folderName: '共享命名空间',
      visibility: 'PUBLIC'
    }, secondAdminHeaders),
    error => error.response.status === 409
  )
  const publicChild = await request('POST', '/api/v1/print-files/folder/create', {
    parentId: publicRoot.data.id,
    folderName: '共享子目录'
  }, adminHeaders)
  await assert.rejects(
    request('POST', '/api/v1/print-files/folder/create', {
      parentId: publicRoot.data.id,
      folderName: '共享子目录'
    }, secondAdminHeaders),
    error => error.response.status === 409
  )
  assert.equal(publicChild.data.visibility, 'PUBLIC')

  await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '各自私有命名空间',
    visibility: 'PRIVATE'
  }, adminHeaders)
  const privateRootForSecondAdmin = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '各自私有命名空间',
    visibility: 'PRIVATE'
  }, secondAdminHeaders)
  assert.equal(privateRootForSecondAdmin.data.visibility, 'PRIVATE')
})

test('allows admin to move public folders across creators and keeps operator management denied', async () => {
  setupSession()

  await assert.rejects(
    request('PUT', '/api/v1/print-files/folder/5/rename', {
      folderName: '不应重命名'
    }, operatorHeaders),
    error => error.response.status === 403
  )

  const source = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '公共源目录',
    visibility: 'PUBLIC'
  }, adminHeaders)
  const target = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '公共目标目录',
    visibility: 'PUBLIC'
  }, adminHeaders)
  mockState.files.find(file => file.id === source.data.id).userId = 2
  mockState.files.find(file => file.id === target.data.id).userId = 3

  const moved = await request('PUT', `/api/v1/print-files/folder/${source.data.id}/move`, {
    parentId: target.data.id
  }, adminHeaders)
  assert.equal(moved.data.parentId, target.data.id)
  assert.equal(mockState.files.find(file => file.id === source.data.id).parentId, target.data.id)
})

test('allows a third user to read public files but only the uploader can delete', async () => {
  setupSession()

  const publicPage = await request('POST', '/api/v1/print-files/page', {
    pageNum: 1,
    pageSize: 10,
    parentId: 5,
    folder: false
  }, thirdUserHeaders)
  assert.deepEqual(publicPage.data.records.map(file => file.id), [24])
  assert.equal(publicPage.data.records[0].canPrint, true)
  const preview = await request('GET', '/api/v1/print-files/24/preview', undefined, thirdUserHeaders)
  assert.equal(preview.data.id, 24)
  const thumbnail = await request('GET', '/api/v1/print-files/24/thumbnail', undefined, thirdUserHeaders)
  assert.equal(thumbnail.data, null)

  await assert.rejects(
    request('DELETE', '/api/v1/print-files/24', undefined, thirdUserHeaders),
    error => error.response.status === 403
  )
  assert.equal(mockState.files.some(file => file.id === 24), true)

  await request('DELETE', '/api/v1/print-files/24', undefined, operatorHeaders)
  assert.equal(mockState.files.some(file => file.id === 24), false)
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

test('deletes only empty non-default folders through the dedicated endpoint', async () => {
  setupSession()

  await request('DELETE', '/api/v1/print-files/folder/2', undefined, adminHeaders)
  assert.equal(mockState.files.some(file => file.id === 2), false)
  assert.equal(mockState.files.some(file => file.id === 20), true)

  await assert.rejects(
    request('DELETE', '/api/v1/print-files/folder/3', undefined, adminHeaders),
    error => error.response.status === 422 && error.message === '默认目录不可删除'
  )
  await assert.rejects(
    request('DELETE', '/api/v1/print-files/folder/4', undefined, operatorHeaders),
    error => error.response.status === 422 && error.message === '默认目录不可删除'
  )

  await assert.rejects(
    request('DELETE', '/api/v1/print-files/folder/4', undefined, adminHeaders),
    error => error.response.status === 422 && error.message === '默认目录不可删除'
  )
})

test('renames and moves folders through the real endpoints and records mock audit entries', async () => {
  setupSession()

  const source = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '待整理'
  }, operatorHeaders)
  const target = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '归档'
  }, operatorHeaders)
  const renamed = await request('PUT', `/api/v1/print-files/folder/${source.data.id}/rename`, {
    folderName: '已整理'
  }, operatorHeaders)
  assert.equal(renamed.data.originalName, '已整理')

  const moved = await request('PUT', `/api/v1/print-files/folder/${source.data.id}/move`, {
    parentId: target.data.id
  }, operatorHeaders)
  assert.equal(moved.data.parentId, target.data.id)
  assert.equal(mockState.files.find(file => file.id === source.data.id).parentId, target.data.id)
  assert.deepEqual(mockState.auditLogs.slice(0, 2).map(log => log.action), ['FOLDER_MOVE', 'FOLDER_RENAME'])
})

test('批量移动文件返回逐项结果，不会移动文件夹或触碰对象存储', async () => {
  setupSession()

  const target = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '批量目标'
  }, operatorHeaders)
  const response = await request('PUT', '/api/v1/print-files/batch/move', {
    ids: [23, target.data.id],
    parentId: target.data.id
  }, operatorHeaders)

  assert.equal(response.data.totalCount, 2)
  assert.equal(response.data.movedCount, 1)
  assert.equal(response.data.failedCount, 1)
  assert.deepEqual(response.data.items.map(item => item.success), [true, false])
  assert.equal(mockState.files.find(file => file.id === 23).parentId, target.data.id)
  assert.equal(mockState.files.find(file => file.id === target.data.id).parentId, null)
})

test('protects default folders and rejects illegal names, duplicate names, cross-user and third-level moves', async () => {
  setupSession()

  await assert.rejects(
    request('PUT', '/api/v1/print-files/folder/4/rename', { folderName: '不应修改' }, operatorHeaders),
    error => error.response.status === 422 && error.message === '默认目录不可重命名'
  )
  await assert.rejects(
    request('PUT', '/api/v1/print-files/folder/4/move', { parentId: null }, operatorHeaders),
    error => error.response.status === 422 && error.message === '默认目录不可移动'
  )

  const source = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '源目录'
  }, operatorHeaders)
  const target = await request('POST', '/api/v1/print-files/folder/create', {
    folderName: '目标目录'
  }, operatorHeaders)
  await assert.rejects(
    request('PUT', `/api/v1/print-files/folder/${source.data.id}/rename`, { folderName: 'bad/name' }, operatorHeaders),
    error => error.response.status === 400
  )
  await assert.rejects(
    request('PUT', `/api/v1/print-files/folder/${source.data.id}/rename`, { folderName: '目标目录' }, operatorHeaders),
    error => error.response.status === 409
  )
  await assert.rejects(
    request('PUT', '/api/v1/print-files/folder/1/move', { parentId: 2 }, adminHeaders),
    error => error.response.status === 403
  )

  await request('POST', '/api/v1/print-files/folder/create', {
    parentId: source.data.id,
    folderName: '子目录'
  }, operatorHeaders)
  await assert.rejects(
    request('PUT', `/api/v1/print-files/folder/${source.data.id}/move`, { parentId: target.data.id }, operatorHeaders),
    error => error.response.status === 422 && error.message === '移动后文件夹最多支持两级目录'
  )
})

test('rejects non-empty folder deletion without removing its children', async () => {
  setupSession()

  await assert.rejects(
    request('DELETE', '/api/v1/print-files/folder/1', undefined, adminHeaders),
    error => error.response.status === 409
  )
  assert.equal(mockState.files.some(file => file.id === 1), true)
  assert.equal(mockState.files.some(file => file.id === 20), true)
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
