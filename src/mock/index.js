import {
  cloneMockData,
  compareMockIds,
  isValidMockId,
  mockState,
  nextMockId,
  normalizeMockId,
  resetMockState,
  sameMockId,
  sameOptionalMockId
} from './data.js'
import { createMockPage, createMockSuccess, MockRequestError } from './factory.js'
import { resolveMockErrorScenario } from './scenarios.js'
import { toPublicFile, toPublicJob, toPublicPrinter, toPublicSemanticIds } from './server.js'
import { transitionMockJob } from './stateMachine.js'
import { publishMockWebSocketEvent } from './websocket.js'

const runtimeEnv = import.meta.env || {}
const MOCK_DELAY = 120
const BATCH_PLAN_TTL_MS = 5 * 60 * 1000
const MAX_UPLOAD_FILE_BYTES = 1024 * 1024 * 1024
const BATCH_STRATEGIES = ['ONE_TO_ONE', 'ROUND_ROBIN', 'AUTO_MATCH']
const BATCH_ACTIONS = ['UPLOAD_ONLY', 'QUEUE', 'START_AFTER_CONFIRM']
const ATTENTION_PRINTER_STATUSES = ['ERROR', 'OFFLINE', 'PAUSED', 'UNKNOWN', 'FAULT', 'SYS_ERROR', 'PRINT_ERROR']

const wait = duration => new Promise(resolve => setTimeout(resolve, duration))

const now = () => new Date().toISOString().slice(0, 19)

const fail = (status, code, message, data) => {
  throw new MockRequestError(status, code, message, data)
}

const getBody = config => {
  if (config.data instanceof FormData) {
    return {
      file: config.data.get('file'),
      files: config.data.getAll('files'),
      parentId: config.data.get('parentId')
    }
  }
  return config.data || {}
}

const getHeader = (headers, name) => {
  if (!headers) return ''
  return headers[name] || headers[name.toLowerCase()] || ''
}

const throwMockErrorScenario = config => {
  const scenario = resolveMockErrorScenario(config)
  if (scenario) fail(scenario.status, scenario.code, scenario.message)
}

const getSession = config => {
  const authorization = getHeader(config.headers, 'Authorization')
  const token = authorization.replace(/^Bearer\s+/i, '')
  return token ? mockState.sessions[token] : null
}

const requireSession = (config, roles = []) => {
  const session = getSession(config)
  if (!session) {
    fail(401, 401, '未登录或登录已过期')
  }
  if (roles.length > 0 && !roles.includes(session.role)) {
    fail(403, 403, '没有权限执行此操作')
  }
  const user = mockState.users.find(item => String(item.id) === String(session.userId))
  if (!user || user.enabled === false) {
    fail(403, 403, '用户已被禁用')
  }
  return session
}

const getPath = url => {
  try {
    return new URL(url, 'http://mock.local').pathname
  } catch {
    return url.split('?')[0]
  }
}

const getParams = config => config.params || {}

const findPrinter = id => mockState.printers.find(item => sameMockId(item.id, id))
const findFile = id => mockState.files.find(item => sameMockId(item.id, id))
const findJob = id => mockState.jobs.find(item => sameMockId(item.id, id))

const setJobStatus = (job, nextStatus) => {
  job.status = transitionMockJob(job.status, nextStatus)
  job.updatedAt = now()
}

const visibilityOf = file => {
  const visibility = String(file?.visibility || '').trim().toUpperCase()
  return visibility === 'PUBLIC' || visibility === 'PRIVATE' ? visibility : null
}

const resolveFilePath = file => {
  if (!file || file.id === undefined || file.id === null || !visibilityOf(file)
    || file.userId === null || file.userId === undefined) return null
  const nodes = []
  const visited = new Set()
  let current = file
  let folderLevel = file.folder ? 1 : 0
  const visibility = visibilityOf(file)
  while (current) {
    const currentId = String(current.id)
    if (visited.has(currentId) || visibilityOf(current) !== visibility
      || current.userId === null || current.userId === undefined) return null
    visited.add(currentId)
    nodes.push(current)
    if (current.parentId === null || current.parentId === undefined) break
    const parent = findFile(current.parentId)
    if (!parent?.folder) return null
    folderLevel += 1
    if (folderLevel > 2) return null
    current = parent
  }
  if (!current || (file.parentId !== null && file.parentId !== undefined && !current.folder)) return null
  return { leaf: file, root: current, nodes, visibility, folderLevel }
}

const canReadFile = (session, file) => {
  const path = resolveFilePath(file)
  if (!path) return false
  if (session.role === 'ADMIN' || path.visibility === 'PUBLIC') return true
  return String(session.userId) === String(path.root.userId)
    && String(session.userId) === String(path.leaf.userId)
    && path.nodes.every(node => String(node.userId) === String(path.root.userId))
}
const canReadResource = (session, userId) => session.role === 'ADMIN' || String(session.userId) === String(userId)

const fileCapabilities = (session, file) => {
  const publicFile = visibilityOf(file) === 'PUBLIC'
  const owner = String(session.userId) === String(file?.userId)
  const admin = session.role === 'ADMIN'
  const folder = Boolean(file?.folder)
  return {
    visibility: publicFile ? 'PUBLIC' : 'PRIVATE',
    canManage: folder && !file.isDefault && ((!publicFile && owner) || (admin && publicFile)),
    canCreate: folder && ((publicFile && admin) || (!publicFile && owner)),
    canUpload: folder && (publicFile || owner),
    canDelete: !folder && (admin || owner),
    canMove: !folder && ((!publicFile && owner) || (admin && publicFile)),
    canPrint: !folder && canReadFile(session, file),
    canDownload: !folder && canReadFile(session, file),
    level: file.level || getFolderLevel(file)
  }
}

const toSessionFile = (session, file) => ({
  ...toPublicFile(file),
  ...fileCapabilities(session, file)
})

const getFolderLevel = folder => resolveFilePath(folder)?.folderLevel || -1

const getFolderLevelForMove = (folder, foldersById, movedFolderId, movedParentId) => {
  let level = 1
  let current = folder
  const visited = new Set()
  while (current) {
    if (visited.has(String(current.id))) return -1
    visited.add(String(current.id))
    const parentId = String(current.id) === String(movedFolderId)
      ? movedParentId
      : current.parentId
    if (parentId === null || parentId === undefined) return level
    const parent = foldersById.get(String(parentId))
    if (!parent?.folder || visibilityOf(parent) !== visibilityOf(folder)) return -1
    level += 1
    current = parent
    if (level > 2) return level
  }
  return level
}

const isFolderSameOrDescendant = (candidate, ancestor, foldersById) => {
  let current = candidate
  const visited = new Set()
  while (current && !visited.has(String(current.id))) {
    if (String(current.id) === String(ancestor.id)) return true
    visited.add(String(current.id))
    current = foldersById.get(String(current.parentId))
  }
  return false
}

const requireFolderParent = (session, parentId, options = {}) => {
  if (parentId === null || parentId === undefined || parentId === '') return null
  const normalizedId = normalizeMockId(parentId)
  const parent = findFile(normalizedId)
  if (!parent) fail(404, 404, '父文件夹不存在')
  if (!parent.folder) fail(422, 422, '父级资源不是文件夹')
  if (!canReadFile(session, parent)) fail(403, 403, '无权访问该文件夹')
  const canCreate = visibilityOf(parent) === 'PUBLIC'
    ? session.role === 'ADMIN'
    : String(parent.userId) === String(session.userId)
  if (!canCreate) {
    fail(403, 403, '无权管理该文件夹')
  }
  const level = getFolderLevel(parent)
  const maxLevel = options.allowSecondLevel ? 2 : 1
  if (level < 1 || level > maxLevel) fail(422, 422, '文件夹最多支持两级目录')
  return parent
}

const requireUploadParent = (session, parentId) => {
  const parent = findFile(normalizeMockId(parentId))
  if (!parent) fail(404, 404, '父文件夹不存在')
  if (!parent.folder) fail(422, 422, '父级资源不是文件夹')
  if (!canReadFile(session, parent)) fail(403, 403, '无权访问该文件夹')
  if (visibilityOf(parent) === 'PRIVATE'
    && String(parent.userId) !== String(session.userId)) {
    fail(403, 403, '无权向该文件夹上传文件')
  }
  const level = getFolderLevel(parent)
  if (level < 1 || level > 2) fail(422, 422, '文件夹层级数据异常')
  return parent
}

const requirePageFolderParent = (session, parentId) => {
  const parent = findFile(parentId)
  if (!parent) fail(404, 404, '父文件夹不存在')
  if (!parent.folder) fail(422, 422, '父级资源不是文件夹')
  if (!canReadFile(session, parent)) fail(403, 403, '无权访问该文件夹')
  const level = getFolderLevel(parent)
  if (level < 1 || level > 2) fail(422, 422, '文件夹最多支持两级目录')
  return parent
}

const resolveUploadParent = (session, parentId) => {
  if (parentId !== null && parentId !== undefined && parentId !== '') {
    return requireUploadParent(session, parentId).id
  }
  const defaults = mockState.files.filter(item => (
    item.folder && item.isDefault && item.parentId == null
      && String(item.userId) === String(session.userId)
  ))
  if (defaults.length !== 1) fail(422, 422, '默认文件夹不可用，请先完成目录迁移')
  return defaults[0].id
}

const publicUser = user => {
  const data = cloneMockData(user)
  delete data.password
  if (data.id !== undefined && data.id !== null) data.id = String(data.id)
  return data
}

const makeMockFileUrl = name => {
  const content = `; Mock G-code: ${name}\nG28\nG1 X10 Y10 F3000\nM104 S0\n`
  return `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`
}

const handleLogin = config => {
  const { username, password } = getBody(config)
  if (username === 'disabled') {
    fail(403, 403, '用户已被禁用')
  }

  const user = mockState.users.find(item => item.username === username)
  if (!user || user.password !== password) {
    fail(401, 401, '用户名或密码错误')
  }
  if (!user.enabled) {
    fail(403, 403, '用户已被禁用')
  }

  const token = `mock-token-${user.id}`
  mockState.sessions[token] = {
    userId: user.id,
    username: user.username,
    role: user.role
  }

  return {
    token,
    expiresIn: 604800,
    userId: String(user.id),
    username: user.username,
    role: user.role,
    email: user.email,
    phone: user.phone
  }
}

const handleFirstAdminSetupStatus = () => ({
  initialized: mockState.users.length > 0,
  setupAvailable: mockState.users.length === 0
})

const handleFirstAdminSetup = config => {
  if (mockState.users.length > 0) {
    fail(409, 409, '系统已完成初始化，请登录后由管理员创建账号')
  }

  const body = getBody(config)
  if (!body.username || !body.password || body.password !== body.confirmPassword) {
    fail(400, 400, '用户名、密码和确认密码不能为空且必须一致')
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,20}$/.test(body.password)) {
    fail(400, 400, '密码必须为 6-20 位且包含大小写字母和数字')
  }

  const user = {
    id: nextMockId('users'),
    username: body.username,
    password: body.password,
    role: 'ADMIN',
    email: body.email || null,
    phone: body.phone || null,
    enabled: true,
    createdAt: now(),
    updatedAt: now()
  }
  mockState.users.push(user)
  mockState.files.push(createMockDefaultFolder(user.id))
  const token = `mock-token-${user.id}`
  mockState.sessions[token] = { userId: user.id, username: user.username, role: user.role }
  return {
    token,
    expiresIn: 604800,
    userId: String(user.id),
    username: user.username,
    role: user.role,
    email: user.email,
    phone: user.phone
  }
}

const handleRegister = config => {
  requireSession(config, ['ADMIN'])
  const body = getBody(config)
  if (!body.username || !body.password || body.password !== body.confirmPassword) {
    fail(400, 400, '用户名、密码和确认密码不能为空且必须一致')
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,20}$/.test(body.password)) {
    fail(400, 400, '密码必须为 6-20 位且包含大小写字母和数字')
  }
  if (mockState.users.some(item => item.username === body.username)) {
    fail(409, 409, '用户名已存在')
  }

  const user = {
    id: nextMockId('users'),
    username: body.username,
    password: body.password,
    role: 'OPERATOR',
    email: body.email || null,
    phone: body.phone || null,
    enabled: true,
    createdAt: now(),
    updatedAt: now()
  }
  mockState.users.push(user)
  mockState.files.push(createMockDefaultFolder(user.id))
  return user.id
}

const createMockDefaultFolder = userId => ({
  id: nextMockId('folder'),
  parentId: null,
  folder: true,
  isFolder: 1,
  isDefault: true,
  level: 1,
  originalName: '我的文件夹',
  safeName: `folder_default_${userId}`,
  fileSize: 0,
  fileUrl: null,
  userId,
  createdAt: now(),
  estTime: 0,
  estimatedSeconds: 0,
  materialType: null,
  nozzleSize: null,
  filamentWeight: null,
  filamentLength: null,
  printCount: 0,
  successRate: 0
})

const handleAdminUserPage = config => {
  requireSession(config, ['ADMIN'])
  const params = getParams(config)
  let records = mockState.users
  if (params.username) records = records.filter(user => user.username.includes(String(params.username)))
  if (params.role) records = records.filter(user => user.role === params.role)
  if (params.email) records = records.filter(user => (user.email || '').includes(String(params.email)))
  return createMockPage(records.map(publicUser), params)
}

const handleAuditLogPage = config => {
  requireSession(config, ['ADMIN'])
  const params = getParams(config)
  let records = [...mockState.auditLogs]
  if (params.actorId) records = records.filter(item => String(item.actorId) === String(params.actorId))
  if (params.action) records = records.filter(item => item.action === String(params.action))
  if (params.targetType) records = records.filter(item => item.targetType === String(params.targetType))
  if (params.targetId) records = records.filter(item => String(item.targetId) === String(params.targetId))
  if (params.result) records = records.filter(item => item.result === String(params.result))
  if (params.from) records = records.filter(item => item.occurredAt >= String(params.from))
  if (params.to) records = records.filter(item => item.occurredAt <= String(params.to))
  records.sort((left, right) => {
    const timeDiff = String(right.occurredAt).localeCompare(String(left.occurredAt))
    return timeDiff || compareMockIds(right.id, left.id)
  })
  return createMockPage(records, params)
}

const handleAdminUserCreate = config => {
  const id = handleRegister(config)
  return id
}

const handleAdminUserUpdate = config => {
  const session = requireSession(config, ['ADMIN'])
  const id = getPath(config.url).split('/').at(-1)
  const user = mockState.users.find(item => String(item.id) === String(id))
  if (!user) fail(404, 404, '鐢ㄦ埛涓嶅瓨鍦?')
  const body = getBody(config)
  if (body.email !== undefined) user.email = body.email || null
  if (body.phone !== undefined) user.phone = body.phone || null
  if (body.role && ['ADMIN', 'OPERATOR'].includes(body.role)) user.role = body.role
  if (body.password) user.password = body.password
  user.updatedAt = now()
  if (session.userId === user.id && body.role) session.role = body.role
  return null
}

const handleAdminUserToggle = config => {
  const session = requireSession(config, ['ADMIN'])
  const parts = getPath(config.url).split('/')
  const id = parts.at(-2)
  const user = mockState.users.find(item => String(item.id) === String(id))
  if (!user) fail(404, 404, '鐢ㄦ埛涓嶅瓨鍦?')
  if (String(session.userId) === String(user.id) && parts.at(-1) === 'disable') {
    fail(409, 409, '不能禁用当前登录账号')
  }
  user.enabled = parts.at(-1) === 'enable'
  user.updatedAt = now()
  return publicUser(user)
}

const handleCurrentUser = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const user = mockState.users.find(item => String(item.id) === String(session.userId))
  if (!user) fail(404, 404, '用户不存在')
  return publicUser(user)
}

const handleProfile = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  if (String(session.userId) !== String(id)) fail(403, 403, '鍙兘鏌ョ湅鑷繁鐨勮祫鏂?')
  const user = mockState.users.find(item => sameMockId(item.id, session.userId))
  if (!user) fail(404, 404, '鐢ㄦ埛涓嶅瓨鍦?')
  if (config.method?.toLowerCase() === 'put') {
    const body = getBody(config)
    user.email = body.email ?? user.email
    user.phone = body.phone ?? user.phone
    user.updatedAt = now()
  }
  return publicUser(user)
}

const handleChangePassword = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  if (String(session.userId) !== String(id)) fail(403, 403, '鍙兘淇敼鑷繁鐨勫瘑鐮?')
  const body = getBody(config)
  const user = mockState.users.find(item => sameMockId(item.id, session.userId))
  if (!user || user.password !== body.oldPassword) fail(422, 422, '鏃у瘑鐮侀敊璇?')
  if (!body.newPassword || body.newPassword !== body.confirmPassword || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,20}$/.test(body.newPassword)) {
    fail(422, 422, '鏂板瘑鐮佹牸寮忔垨纭涓嶆纭?')
  }
  user.password = body.newPassword
  user.updatedAt = now()
  return null
}

const handlePrinterPage = config => {
  requireSession(config, ['ADMIN', 'OPERATOR'])
  const params = getParams(config)
  let records = mockState.printers
  if (params.name) {
    records = records.filter(item => item.name.toLowerCase().includes(String(params.name).toLowerCase()))
  }
  if (params.status) {
    records = params.status === 'ATTENTION'
      ? records.filter(item => ATTENTION_PRINTER_STATUSES.includes(String(item.status || '').toUpperCase()))
      : records.filter(item => item.status === params.status)
  }
  return createMockPage(records.map(printer => ({
    ...toPublicPrinter(printer),
    ...getMockMonitorData(printer)
  })), params)
}

const handlePrinterDetail = config => {
  requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').pop()
  const printer = findPrinter(id)
  if (!printer) fail(404, 404, '打印机不存在')
  return {
    ...toPublicPrinter(printer),
    ...getMockMonitorData(printer)
  }
}

const getMockMonitorData = printer => {
  const connectionStatus = String(
    printer.connectionStatus || (printer.status === 'OFFLINE'
      ? 'OFFLINE'
      : printer.status === 'UNKNOWN' ? 'UNKNOWN' : 'ONLINE')
  ).toUpperCase()
  return {
    printerId: printer.id,
    monitorEnabled: printer.monitorEnabled !== false,
    connectionStatus,
    lastSeenAt: printer.lastSeenAt ?? printer.updatedAt ?? null,
    lastCommunicationError: printer.lastCommunicationError ?? (connectionStatus === 'OFFLINE' ? '设备暂时离线' : null),
    consecutiveFailureCount: Number(printer.consecutiveFailureCount || 0),
    lastKnownStatus: printer.lastKnownStatus ?? printer.status ?? null,
    lastProtocolState: printer.lastProtocolState ?? null,
    lastDeviceUptime: printer.lastDeviceUptime ?? null
  }
}

const handleGetPrinterMonitor = config => {
  requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  const printer = findPrinter(id)
  if (!printer) fail(404, 404, '打印机不存在')
  return getMockMonitorData(printer)
}

const handleUpdatePrinterMonitor = config => {
  requireSession(config, ['ADMIN'])
  const id = getPath(config.url).split('/').at(-2)
  const printer = findPrinter(id)
  if (!printer) fail(404, 404, '打印机不存在')
  const body = getBody(config)
  if (typeof body.monitorEnabled !== 'boolean') fail(400, 400, 'monitorEnabled 必须为布尔值')
  printer.monitorEnabled = body.monitorEnabled
  printer.updatedAt = now()
  return getMockMonitorData(printer)
}

const handleBatchUpdatePrinterMonitor = config => {
  requireSession(config, ['ADMIN'])
  const body = getBody(config)
  if (!Array.isArray(body.printerIds) || body.printerIds.length === 0) fail(400, 400, '请选择至少一台打印机')
  if (body.printerIds.length > 100) fail(400, 400, '单次最多更新 100 台打印机')
  if (typeof body.monitorEnabled !== 'boolean') fail(400, 400, 'monitorEnabled 必须为布尔值')
  const printers = body.printerIds.map(findPrinter)
  if (printers.some(printer => !printer)) fail(404, 404, '打印机不存在')
  printers.forEach(printer => {
    printer.monitorEnabled = body.monitorEnabled
    printer.updatedAt = now()
  })
  return {
    updatedCount: printers.length,
    monitorEnabled: body.monitorEnabled
  }
}

const getPrinterForAnalytics = config => {
  requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  if (!isValidMockId(id)) fail(400, 400, '打印机 ID 不合法')
  const printer = findPrinter(id)
  if (!printer) fail(404, 404, '打印机不存在')
  return printer
}

const getAnalyticsTimeRange = config => {
  const params = getParams(config)
  const from = params.from || null
  const to = params.to || null
  if (from && to && new Date(from) > new Date(to)) fail(400, 400, '开始时间不能晚于结束时间')
  return { from, to }
}

const isInTimeRange = (value, range) => {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return false
  if (range.from && time < new Date(range.from).getTime()) return false
  if (range.to && time > new Date(range.to).getTime()) return false
  return true
}

const handlePrinterHistory = config => {
  const printer = getPrinterForAnalytics(config)
  const range = getAnalyticsTimeRange(config)
  const fileById = new Map(mockState.files.map(file => [String(file.id), file]))
  const jobs = mockState.jobs
    .filter(job => String(job.printerId) === String(printer.id))
    .map(job => {
      const file = fileById.get(String(job.fileId))
      return {
        id: `${printer.id}-${job.id}`,
        printerId: printer.id,
        status: job.status,
        rawState: String(job.status || '').toLowerCase(),
        systemMessage: job.errorReason || null,
        filename: file?.originalName || null,
        progress: job.progress || 0,
        nozzleTargetTemperature: null,
        nozzleTemperature: null,
        bedTargetTemperature: null,
        bedTemperature: null,
        filamentUsed: null,
        printDuration: job.startedAt && job.completedAt
          ? Math.max(new Date(job.completedAt) - new Date(job.startedAt), 0) / 1000
          : null,
        recordedAt: job.updatedAt || job.createdAt
      }
    })
  const currentRecord = {
    id: `${printer.id}-current`,
    printerId: printer.id,
    status: printer.status,
    rawState: String(printer.status || '').toLowerCase(),
    systemMessage: null,
    filename: printer.currentJobFileName || null,
    progress: 0,
    nozzleTargetTemperature: null,
    nozzleTemperature: null,
    bedTargetTemperature: null,
    bedTemperature: null,
    filamentUsed: null,
    printDuration: null,
    recordedAt: printer.updatedAt || printer.createdAt
  }
  const records = [currentRecord, ...jobs]
    .filter(record => isInTimeRange(record.recordedAt, range))
    .sort((left, right) => new Date(right.recordedAt) - new Date(left.recordedAt))
  return createMockPage(records.map(record => ({
    ...record,
    printerId: String(record.printerId)
  })), getParams(config))
}

const handlePrinterStatistics = config => {
  const printer = getPrinterForAnalytics(config)
  const range = getAnalyticsTimeRange(config)
  const jobs = mockState.jobs.filter(job => (
    String(job.printerId) === String(printer.id) && isInTimeRange(job.createdAt, range)
  ))
  const completedJobs = jobs.filter(job => job.status === 'COMPLETED')
  const failedJobs = jobs.filter(job => job.status === 'FAILED')
  const cancelledJobs = jobs.filter(job => job.status === 'CANCELLED')
  const activeJobs = jobs.filter(job => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status))
  const durations = completedJobs
    .filter(job => job.startedAt && job.completedAt)
    .map(job => Math.max(new Date(job.completedAt) - new Date(job.startedAt), 0) / 1000)
  const totalPrintSeconds = durations.reduce((total, seconds) => total + seconds, 0)
  const denominator = completedJobs.length + failedJobs.length

  return {
    printerId: String(printer.id),
    from: range.from,
    to: range.to,
    totalJobs: jobs.length,
    completedJobs: completedJobs.length,
    failedJobs: failedJobs.length,
    cancelledJobs: cancelledJobs.length,
    activeJobs: activeJobs.length,
    successRate: denominator > 0 ? (completedJobs.length / denominator) * 100 : 0,
    totalPrintSeconds,
    averagePrintSeconds: durations.length > 0 ? totalPrintSeconds / durations.length : 0
  }
}

const handleBatchRetryPreview = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const sourcePlan = mockState.batchPlans.find(item => item.planId === body.sourcePlanId)
  if (!sourcePlan || !canReadResource(session, sourcePlan.userId)) {
    fail(404, 404, '批量派发计划不存在')
  }
  const sourceItemIds = normalizeBatchIds(body.sourceItemIds)
  if (!sourceItemIds.length || sourceItemIds.length > 100 || !body.retryKey) {
    fail(400, 400, '来源计划、失败项和恢复幂等键不能为空')
  }
  const existing = mockState.batchPlans.find(item => (
    sameMockId(item.userId, session.userId) && item.retryKey === String(body.retryKey)
  ))
  if (existing) return batchPreviewResponse(existing)

  const sourceById = new Map(sourcePlan.items.map(item => [String(item.itemId), item]))
  if (sourceItemIds.some(itemId => !sourceById.has(itemId))) fail(404, 404, '批量计划明细不存在')
  const items = sourceItemIds.map((sourceItemId, index) => {
    const source = sourceById.get(sourceItemId)
    if (source.status !== 'RETRYABLE' && !source.retryable) {
      fail(422, 422, '只有可恢复失败项可以恢复')
    }
    const item = {
      itemId: `batch-retry-${nextMockId('batchPlan')}-item-${index + 1}`,
      fileId: source.fileId,
      printerId: source.printerId,
      canExecute: false,
      reasonCode: null,
      errorCode: null,
      message: null,
      retryable: false,
      sourcePlanId: sourcePlan.planId,
      sourceItemId,
      recoveryAction: null,
      status: 'PENDING',
      jobId: source.jobId || null
    }
    if (source.jobId) {
      source.status = 'RECOVERY_REQUIRED'
      source.retryable = false
      source.recoveryAction = 'OPEN_EXISTING_JOB'
      item.status = 'RECOVERY_REQUIRED'
      item.recoveryAction = 'OPEN_EXISTING_JOB'
      item.message = '已有任务已创建，请打开既有任务进行恢复'
      return item
    }
    const file = findFile(source.fileId)
    const printer = findPrinter(source.printerId)
    if (!file || file.folder || !canReadFile(session, file)) {
      item.reasonCode = 'FILE_NOT_AVAILABLE'
      item.message = '文件不存在或无权使用'
      return item
    }
    if (!isPrinterAvailable(printer)) {
      item.reasonCode = 'PRINTER_UNAVAILABLE'
      item.message = '打印机当前不可用'
      return item
    }
    item.canExecute = true
    item.message = '恢复预览可执行'
    return item
  })
  const plan = {
    planId: `batch-plan-${nextMockId('batchPlan')}`,
    version: 1,
    userId: session.userId,
    strategy: sourcePlan.strategy,
    action: sourcePlan.action,
    items,
    suggestions: [],
    conflicts: items.filter(item => !item.canExecute),
    confirmationToken: `mock-retry-confirm-${String(body.retryKey)}`,
    expiresAt: new Date(Date.now() + BATCH_PLAN_TTL_MS).toISOString(),
    status: 'PREVIEWED',
    confirmResult: null,
    retryKey: String(body.retryKey)
  }
  mockState.batchPlans.push(plan)
  return batchPreviewResponse(plan)
}

const batchPreviewResponse = plan => ({
  planId: plan.planId,
  version: plan.version,
  action: plan.action,
  strategy: plan.strategy,
  items: cloneMockData(plan.items),
  suggestions: cloneMockData(plan.suggestions),
  conflicts: cloneMockData(plan.conflicts),
  confirmationToken: plan.confirmationToken,
  expiresAt: plan.expiresAt
})

const handleAddPrinter = config => {
  requireSession(config, ['ADMIN'])
  const body = getBody(config)
  const printer = {
    id: nextMockId('printer'),
    name: body.name || `Mock_Printer_${Date.now()}`,
    ipAddress: body.ipAddress || '192.168.1.100',
    macAddress: body.macAddress || 'AA:BB:CC:DD:EE:99',
    firmwareType: body.firmwareType || 'KLIPPER',
    status: 'UNKNOWN',
    isSafeToPrint: false,
    currentJobId: null,
    currentMaterial: body.currentMaterial || 'PLA',
    nozzleSize: Number(body.nozzleSize) || 0.4,
    gridRow: body.gridRow ?? null,
    gridCol: body.gridCol ?? null,
    createdAt: now(),
    updatedAt: now()
  }
  mockState.printers.push(printer)
  return null
}

const handleUpdatePrinter = config => {
  requireSession(config, ['ADMIN'])
  const body = getBody(config)
  const printer = findPrinter(body.id)
  if (!printer) fail(404, 404, '打印机不存在')
  Object.assign(printer, body, { updatedAt: now() })
  return null
}

const handleDeletePrinter = config => {
  requireSession(config, ['ADMIN'])
  const id = getPath(config.url).split('/').pop()
  const printer = findPrinter(id)
  if (!printer) fail(404, 404, '打印机不存在')
  if (printer.currentJobId || ['PREPARING', 'PRINTING', 'PAUSED'].includes(printer.status)) {
    fail(409, 10002, '打印机正在执行任务，暂不可删除')
  }
  const index = mockState.printers.indexOf(printer)
  mockState.printers.splice(index, 1)
  return null
}

const handleScanPrinters = config => {
  requireSession(config, ['ADMIN'])
  const subnet = getParams(config).subnet || '192.168.1'
  mockState.lastScanSubnet = subnet
  return Array.from({ length: 12 }, (_, index) => {
    const host = 90 + index
    const discoveryStatus = index === 1 ? 'EXISTING' : index === 2 ? 'UNKNOWN_MAC' : 'NEW'
    return {
      ipAddress: `${subnet}.${host}`,
      macAddress: `AA:BB:CC:DD:EE:${String(host).padStart(2, '0')}`,
      isNewDevice: discoveryStatus === 'NEW',
      firmwareType: index % 2 === 0 ? 'KLIPPER' : 'RRF',
      status: discoveryStatus,
      suggestedName: `Mock_Scanned_Printer_${index + 1}`
    }
  })
}

const findBatchAddFailure = (device, index) => {
  const failures = Array.isArray(mockState.batchAddFailures) ? mockState.batchAddFailures : []
  return failures.find(item => item?.index !== null && item?.index !== ''
      && Number.isInteger(Number(item.index)) && Number(item.index) === index)
    || failures.find(item => item?.ipAddress && item.ipAddress === device?.ipAddress)
    || failures.find(item => item?.macAddress
      && String(item.macAddress).toUpperCase() === String(device?.macAddress || '').toUpperCase())
}

const handleBatchAddPrinters = config => {
  requireSession(config, ['ADMIN'])
  const devices = Array.isArray(config.data) ? config.data : []
  mockState.lastBatchAddPayload = cloneMockData(devices)
  let insertedCount = 0
  let updatedCount = 0
  let failedCount = 0
  const items = devices.map((device, index) => {
    const configuredFailure = findBatchAddFailure(device, index)
    if (configuredFailure) {
      failedCount += 1
      return {
        index,
        ipAddress: device?.ipAddress || null,
        macAddress: device?.macAddress || null,
        success: false,
        reason: configuredFailure.reason || '模拟设备导入失败'
      }
    }
    const existing = mockState.printers.find(item => item.ipAddress === device.ipAddress)
    if (existing) {
      Object.assign(existing, device, { updatedAt: now() })
      updatedCount += 1
      return {
        index,
        ipAddress: device.ipAddress,
        macAddress: device.macAddress || null,
        success: true,
        reason: '处理成功'
      }
    }

    const printer = {
      id: nextMockId('printer'),
      name: device.suggestedName || `Mock_Printer_${Date.now()}`,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      firmwareType: device.firmwareType || 'KLIPPER',
      status: 'UNKNOWN',
      isSafeToPrint: false,
      currentJobId: null,
      currentMaterial: 'PLA',
      nozzleSize: 0.4,
      gridRow: null,
      gridCol: null,
      createdAt: now(),
      updatedAt: now()
    }
    mockState.printers.push(printer)
    insertedCount += 1
    return {
      index,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress || null,
      success: true,
      reason: '处理成功'
    }
  })
  return {
    totalCount: items.length,
    insertedCount,
    updatedCount,
    failedCount,
    message: `批量处理完成：新增 ${insertedCount} 台，更新 ${updatedCount} 台，失败 ${failedCount} 台`,
    items
  }
}

const handleUnallocatedPrinters = config => {
  requireSession(config, ['ADMIN', 'OPERATOR'])
  const keyword = getParams(config).keyword
  return mockState.printers
    .filter(item => item.gridRow == null)
    .filter(item => !keyword || item.name.toLowerCase().includes(String(keyword).toLowerCase()))
    .map(toPublicPrinter)
}

const handlePositions = config => {
  requireSession(config, ['ADMIN'])
  const positions = config.data
  if (!Array.isArray(positions) || positions.length < 1 || positions.length > 100) {
    fail(400, 400, '位置更新请求体必须是包含 1-100 项的数组')
  }
  handleDashboardLayout({
    ...config,
    method: 'put',
    data: {
      expectedVersion: mockState.dashboardLayout.version,
      rowCount: mockState.dashboardLayout.rowCount,
      columnCount: mockState.dashboardLayout.columnCount,
      aisles: cloneMockData(mockState.dashboardLayout.aisles),
      overflowPolicy: 'REJECT',
      positionChanges: positions.map(position => ({
        printerId: position?.id,
        gridRow: position?.gridRow ?? null,
        gridCol: position?.gridCol ?? null
      }))
    }
  })
  return null
}

const layoutLimits = {
  minRows: 1,
  maxRows: 30,
  minColumns: 1,
  maxColumns: 60,
  maxCells: 1800,
  maxAisles: 20,
  minAisleSize: 48,
  maxAisleSize: 240
}

const layoutPosition = (row, col) => `${row},${col}`

const validateMockLayout = body => {
  if (!Number.isInteger(body.rowCount) || body.rowCount < 1 || body.rowCount > layoutLimits.maxRows
    || !Number.isInteger(body.columnCount) || body.columnCount < 1 || body.columnCount > layoutLimits.maxColumns
    || body.rowCount * body.columnCount > layoutLimits.maxCells) {
    fail(400, 400, '布局行列不合法')
  }
  if (!Array.isArray(body.aisles) || body.aisles.length > layoutLimits.maxAisles) fail(400, 400, '过道配置不合法')
  const aisleIds = new Set()
  const aislePositions = new Set()
  body.aisles.forEach(aisle => {
    if (!aisle || typeof aisle.id !== 'string' || !aisle.id.trim() || aisle.id.length > 64
      || !['ROW', 'COLUMN'].includes(aisle.axis) || !Number.isInteger(aisle.afterIndex)
      || aisle.afterIndex < 0 || aisle.afterIndex > (aisle.axis === 'ROW' ? body.rowCount : body.columnCount)
      || typeof aisle.label !== 'string' || !aisle.label.trim() || aisle.label.length > 12
      || !Number.isInteger(aisle.size) || aisle.size < layoutLimits.minAisleSize || aisle.size > layoutLimits.maxAisleSize) {
      fail(400, 400, '过道配置不合法')
    }
    const position = `${aisle.axis}:${aisle.afterIndex}`
    if (aisleIds.has(aisle.id) || aislePositions.has(position)) fail(400, 400, '过道 ID 或位置重复')
    aisleIds.add(aisle.id)
    aislePositions.add(position)
  })
}

const handleDashboardLayout = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  if (config.method?.toLowerCase() === 'get') {
    if (mockState.dashboardLayoutError) {
      const failure = mockState.dashboardLayoutError
      fail(failure.status || 503, failure.code || 503, failure.message || '模拟布局加载失败')
    }
    return cloneMockData(mockState.dashboardLayout)
  }
  if (session.role !== 'ADMIN') fail(403, 403, '没有权限执行此操作')

  const body = getBody(config)
  if (Number(body.expectedVersion) !== Number(mockState.dashboardLayout.version)) {
    fail(409, 409, '布局版本已过期', {
      reason: 'VERSION_CONFLICT',
      serverVersion: mockState.dashboardLayout.version,
      conflicts: [],
      outOfBoundsPrinters: []
    })
  }
  if (!['REJECT', 'UNALLOCATE'].includes(body.overflowPolicy) || !Array.isArray(body.positionChanges)
    || body.positionChanges.length > 100) fail(400, 400, '布局保存请求不合法')
  validateMockLayout(body)

  const changes = new Map()
  const targetSlots = new Map()
  body.positionChanges.forEach(change => {
    const id = String(change?.printerId ?? '')
    if (!id || changes.has(id)) fail(400, 400, '设备变更列表存在重复 ID')
    const printer = findPrinter(id)
    if (!printer) fail(404, 404, '打印机不存在')
    const hasRow = change.gridRow !== null && change.gridRow !== undefined
    const hasCol = change.gridCol !== null && change.gridCol !== undefined
    if (hasRow !== hasCol || (hasRow && (!Number.isInteger(change.gridRow) || !Number.isInteger(change.gridCol)
      || change.gridRow < 1 || change.gridRow > body.rowCount || change.gridCol < 1 || change.gridCol > body.columnCount))) {
      fail(400, 400, '设备坐标不合法')
    }
    if (hasRow) {
      const targetSlot = layoutPosition(change.gridRow, change.gridCol)
      const previousPrinterId = targetSlots.get(targetSlot)
      if (previousPrinterId !== undefined) {
        fail(400, 400, '请求中的目标槽位重复', {
          reason: 'DUPLICATE_SLOT',
          serverVersion: mockState.dashboardLayout.version,
          conflicts: [previousPrinterId, printer.id],
          outOfBoundsPrinters: []
        })
      }
      targetSlots.set(targetSlot, printer.id)
    }
    changes.set(id, { printer, gridRow: hasRow ? change.gridRow : null, gridCol: hasCol ? change.gridCol : null })
  })

  const nextPrinters = mockState.printers.map(printer => {
    const change = changes.get(String(printer.id))
    return change ? { ...printer, gridRow: change.gridRow, gridCol: change.gridCol } : { ...printer }
  })
  const outOfBoundsPrinters = nextPrinters.filter(printer => (
    Number.isInteger(printer.gridRow) && Number.isInteger(printer.gridCol)
      && (printer.gridRow > body.rowCount || printer.gridCol > body.columnCount)
  )).map(printer => ({
    printerId: printer.id,
    name: printer.name,
    gridRow: printer.gridRow,
    gridCol: printer.gridCol
  }))
  if (outOfBoundsPrinters.length && body.overflowPolicy === 'REJECT') {
    fail(422, 422, '缩容后存在越界设备', {
      reason: 'OUT_OF_BOUNDS',
      serverVersion: mockState.dashboardLayout.version,
      conflicts: [],
      outOfBoundsPrinters
    })
  }
  if (body.overflowPolicy === 'UNALLOCATE') {
    outOfBoundsPrinters.forEach(item => {
      const printer = nextPrinters.find(candidate => String(candidate.id) === String(item.printerId))
      printer.gridRow = null
      printer.gridCol = null
    })
  }
  const occupied = new Map()
  nextPrinters.forEach(printer => {
    if (printer.gridRow == null && printer.gridCol == null) return
    const position = layoutPosition(printer.gridRow, printer.gridCol)
    if (occupied.has(position)) fail(409, 409, '目标槽位已被占用', {
      reason: 'SLOT_CONFLICT',
      serverVersion: mockState.dashboardLayout.version,
      conflicts: [occupied.get(position), printer.id],
      outOfBoundsPrinters: []
    })
    occupied.set(position, printer.id)
  })

  const nextLayout = {
    rowCount: body.rowCount,
    columnCount: body.columnCount,
    aisles: cloneMockData(body.aisles),
    version: mockState.dashboardLayout.version + 1,
    limits: cloneMockData(layoutLimits),
    updatedAt: now()
  }
  const changedPositions = nextPrinters
    .filter(printer => changes.has(String(printer.id)) || outOfBoundsPrinters.some(item => String(item.printerId) === String(printer.id)))
    .map(printer => ({ printerId: printer.id, gridRow: printer.gridRow, gridCol: printer.gridCol }))
  // 返回下架前的原坐标；changedPositions 才表示提交后的 null 坐标。
  const unallocatedPrinters = outOfBoundsPrinters.map(item => ({ ...item }))
  mockState.printers = nextPrinters
  mockState.dashboardLayout = nextLayout
  publishMockWebSocketEvent({
    type: 'LAYOUT_UPDATED',
    printerId: null,
    data: { stateSource: 'LAYOUT', layoutVersion: nextLayout.version }
  })
  return { layout: cloneMockData(nextLayout), changedPositions, unallocatedPrinters }
}

const handleFilePage = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const params = getBody(config)
  const parentId = params.parentId == null || params.parentId === '' ? null : normalizeMockId(params.parentId)
  if (parentId !== null) requirePageFolderParent(session, parentId)
  let records = mockState.files.filter(item => parentId === null
    ? item.parentId === null || item.parentId === undefined
    : sameMockId(item.parentId, parentId))
  if (params.fileName) {
    const fileName = String(params.fileName).trim().toLowerCase()
    records = records.filter(item => item.originalName.toLowerCase().includes(fileName))
  }
  if (params.materialType) {
    const materialType = String(params.materialType).trim().toUpperCase()
    records = records.filter(item => item.materialType === materialType)
  }
  if (typeof params.folder === 'boolean') {
    records = records.filter(item => Boolean(item.folder) === params.folder)
  }
  return createMockPage(records.filter(file => canReadFile(session, file)).map(file => toSessionFile(session, file)), params)
}

const createUploadedFile = (session, file, parentId) => {
  const createdAt = now()
  const printFile = {
    id: nextMockId('file'),
    parentId: parentId == null || parentId === '' ? null : normalizeMockId(parentId),
    folder: false,
    isFolder: 0,
    isDefault: false,
    visibility: visibilityOf(findFile(parentId)),
    originalName: file.name,
    safeName: file.name,
    fileSize: file.size || 1024,
    fileUrl: makeMockFileUrl(file.name),
    userId: session.userId,
    createdAt,
    estTime: 1800,
    estimatedSeconds: 1800,
    materialType: 'PLA',
    nozzleSize: 0.4,
    filamentWeight: 8,
    filamentLength: 1.8,
    nozzleTemp: 210,
    bedTemp: 60,
    layerHeight: 0.2,
    firstLayerHeight: 0.24,
    firstLayerNozzleTemp: 215,
    firstLayerBedTemp: 60,
    printCount: 0,
    successRate: 0
  }
  mockState.files.push(printFile)
  return toSessionFile(session, printFile)
}

const handleUpload = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const file = body.file
  if (!file?.name) fail(400, 400, '请选择要上传的文件')
  if (!/\.(gcode|g|3mf|stl)$/i.test(file.name)) fail(400, 400, '仅支持 .gcode、.g、.3mf 或 .stl 文件')
  if ((Number(file.size) || 0) > MAX_UPLOAD_FILE_BYTES) fail(400, 400, '单个文件大小不能超过 1GB')
  const parentId = resolveUploadParent(session, body.parentId)
  return createUploadedFile(session, file, parentId)
}

const handleBatchUpload = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const files = Array.isArray(body.files) && body.files.length > 0
    ? body.files
    : []
  if (files.length === 0 || files.length > 100) fail(400, 400, '批量上传文件数量必须为 1-100 个')
  const parentId = resolveUploadParent(session, body.parentId)

  return {
    items: files.map((file, index) => {
      if (!file?.name) {
        return { index, fileId: null, fileName: '', status: 'FAILED', errorCode: 400, message: '文件不能为空', retryable: false }
      }
      if (!/\.(gcode|g|3mf|stl)$/i.test(file.name)) {
        return { index, fileId: null, fileName: file.name, status: 'FAILED', errorCode: 400, message: '文件类型不支持', retryable: false }
      }
      if ((Number(file.size) || 0) > MAX_UPLOAD_FILE_BYTES) {
        return { index, fileId: null, fileName: file.name, status: 'FAILED', errorCode: 400, message: '单个文件大小不能超过 1GB', retryable: false }
      }
      const created = createUploadedFile(session, file, parentId)
      return {
        index,
        fileId: created.id,
        fileName: created.originalName,
        status: 'SUCCESS',
        errorCode: null,
        message: '上传成功',
        retryable: false
      }
    })
  }
}

const isSameFolderNameNamespace = (file, parentId, visibility, ownerUserId) => {
  if (parentId === null
    ? file.parentId !== null && file.parentId !== undefined
    : !sameMockId(file.parentId, parentId)) return false
  if (parentId !== null) return true
  if (visibilityOf(file) !== visibility) return false
  return visibility === 'PUBLIC' || String(file.userId) === String(ownerUserId)
}

const handleCreateFolder = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const folderName = body.folderName?.trim()
  if (!folderName) fail(400, 400, '文件夹名称不能为空')
  const hasControlCharacter = [...folderName].some(character => character.charCodeAt(0) < 32)
  if (folderName.length > 100 || hasControlCharacter || /[\\/:*?"<>|]/.test(folderName)) {
    fail(400, 400, '文件夹名称不合法')
  }
  const parentId = body.parentId == null || body.parentId === '' ? null : normalizeMockId(body.parentId)
  const parent = requireFolderParent(session, parentId)
  const visibility = parent ? visibilityOf(parent) : body.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE'
  if (visibility === 'PUBLIC' && session.role !== 'ADMIN') fail(403, 403, '无权创建公共目录')
  if (mockState.files.some(file => (
    file.folder && file.originalName === folderName
      && isSameFolderNameNamespace(file, parentId, visibility, session.userId)
  ))) {
    fail(409, 'PRINT_FOLDER_NAME_CONFLICT', '该目录下已存在同名文件夹')
  }
  const folder = {
    id: nextMockId('folder'),
    parentId,
    folder: true,
    isFolder: 1,
    isDefault: false,
    visibility,
    level: parentId === null ? 1 : 2,
    originalName: folderName,
    safeName: folderName,
    fileSize: 0,
    fileUrl: null,
    userId: session.userId,
    createdAt: now(),
    estTime: 0,
    estimatedSeconds: 0,
    materialType: null,
    nozzleSize: null,
    filamentWeight: null,
    filamentLength: null,
    nozzleTemp: null,
    bedTemp: null,
    layerHeight: null,
    printCount: 0,
    successRate: 0
  }
  mockState.files.push(folder)
  return toSessionFile(session, folder)
}

const recordFolderAudit = (session, action, folder) => {
  mockState.auditLogs.unshift({
    id: nextMockId('auditLog'),
    actorId: session.userId,
    actorUsername: session.username,
    actorRole: session.role,
    action,
    targetType: 'FOLDER',
    targetId: String(folder.id),
    targetLabel: folder.originalName,
    result: 'SUCCESS',
    errorCode: null,
    occurredAt: now(),
    traceId: `mock-trace-folder-${folder.id}`
  })
}

const normalizeMockFolderName = value => {
  const folderName = String(value || '').trim()
  const hasControlCharacter = [...folderName].some(character => character.charCodeAt(0) < 32)
  if (!folderName) fail(400, 400, '文件夹名称不能为空')
  if (folderName.length > 100 || hasControlCharacter || /[\\/:*?"<>|]/.test(folderName)) {
    fail(400, 400, '文件夹名称不合法')
  }
  return folderName
}

const handleRenameFolder = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  const folder = getFileForSession(config, id)
  if (!folder.folder) fail(422, 422, '目标资源不是文件夹')
  if (folder.isDefault) fail(422, 422, '默认目录不可重命名')
  if (fileCapabilities(session, folder).canManage !== true) fail(403, 403, '无权管理该文件夹')
  const folderName = normalizeMockFolderName(getBody(config).folderName)
  if (mockState.files.some(file => (
    file.folder && String(file.id) !== String(folder.id)
      && isSameFolderNameNamespace(file, folder.parentId ?? null,
        visibilityOf(folder), folder.userId)
      && file.originalName === folderName
  ))) {
    fail(409, 'PRINT_FOLDER_NAME_CONFLICT', '该目录下已存在同名文件夹')
  }
  folder.originalName = folderName
  recordFolderAudit(session, 'FOLDER_RENAME', folder)
  return toSessionFile(session, folder)
}

const handleMoveFolder = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  const folder = getFileForSession(config, id)
  if (!folder.folder) fail(422, 422, '目标资源不是文件夹')
  if (folder.isDefault) fail(422, 422, '默认目录不可移动')
  if (fileCapabilities(session, folder).canManage !== true) fail(403, 403, '无权管理该文件夹')

  const rawParentId = getBody(config).parentId
  const parentId = rawParentId == null || rawParentId === '' ? null : normalizeMockId(rawParentId)
  if (parentId !== null && !isValidMockId(parentId)) {
    fail(400, 400, '目标目录 ID 必须为正数')
  }

  const userFolders = mockState.files.filter(file => (
    file.folder && visibilityOf(file) === visibilityOf(folder)
      && (session.role === 'ADMIN' || String(file.userId) === String(folder.userId))
  ))
  const foldersById = new Map(userFolders.map(item => [String(item.id), item]))
  const target = parentId === null ? null : getFileForSession(config, parentId)
  if (target && !target.folder) fail(422, 422, '移动目标不是文件夹')
  if (target && visibilityOf(target) !== visibilityOf(folder)) {
    fail(403, 403, '禁止跨可见性移动文件夹')
  }
  if (target && visibilityOf(folder) !== 'PUBLIC'
    && String(target.userId) !== String(folder.userId)) {
    fail(403, 403, '目标文件夹必须属于源文件夹用户')
  }
  if (target && (target.parentId !== null && target.parentId !== undefined
    || getFolderLevel(target) !== 1)) {
    fail(422, 422, '移动目标必须是一级文件夹')
  }
  if (target && isFolderSameOrDescendant(target, folder, foldersById)) {
    fail(422, 422, '不能移动到自身或子孙目录')
  }

  userFolders.forEach(candidate => {
    if (isFolderSameOrDescendant(candidate, folder, foldersById)
      && getFolderLevelForMove(candidate, foldersById, folder.id, parentId) > 2) {
      fail(422, 422, '移动后文件夹最多支持两级目录')
    }
  })
  if (mockState.files.some(file => (
    file.folder && String(file.id) !== String(folder.id)
      && isSameFolderNameNamespace(file, parentId, visibilityOf(folder), folder.userId)
      && file.originalName === folder.originalName
  ))) {
    fail(409, 'PRINT_FOLDER_NAME_CONFLICT', '目标目录下已存在同名文件夹')
  }
  folder.parentId = parentId
  folder.level = getFolderLevel(folder)
  recordFolderAudit(session, 'FOLDER_MOVE', folder)
  return toSessionFile(session, folder)
}

const handleDeleteFolder = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').pop()
  const folder = getFileForSession(config, id)
  if (!folder.folder) fail(422, 422, '目标资源不是文件夹')
  if (folder.isDefault) fail(422, 422, '默认目录不可删除')
  if (fileCapabilities(session, folder).canManage !== true) fail(403, 403, '无权管理该文件夹')
  if (mockState.files.some(file => String(file.parentId) === String(folder.id))) {
    fail(409, 409, '文件夹非空，包含文件或子目录，无法删除')
  }
  mockState.files.splice(mockState.files.indexOf(folder), 1)
  return null
}

const getFileForSession = (config, id) => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const file = findFile(id)
  if (!file) fail(404, 404, '文件不存在')
  if (!canReadFile(session, file)) fail(404, 404, '文件不存在')
  return file
}

const handleFilePreview = config => {
  const id = getPath(config.url).split('/').at(-2)
  const file = getFileForSession(config, id)
  if (file.folder) fail(422, 422, '文件夹不支持预览')

  return {
    ...toSessionFile(requireSession(config, ['ADMIN', 'OPERATOR']), file),
    previewSupported: /\.(gcode|g|3mf|stl)$/i.test(file.originalName || '')
  }
}

const handleThumbnail = config => {
  const id = getPath(config.url).split('/').at(-2)
  const file = getFileForSession(config, id)
  if (file.folder) fail(422, 422, '文件夹没有缩略图')

  // Mock 不伪造切片服务生成的图片，null 用于覆盖前端缺失缩略图占位态。
  return null
}

const handleFileJobs = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  getFileForSession(config, id)
  const records = mockState.jobs
    .filter(job => String(job.fileId) === String(id))
    .filter(job => canReadResource(session, job.userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return createMockPage(records.map(toPublicJob), getParams(config))
}

const handleFileTree = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const files = mockState.files
    .filter(file => file.folder && canReadFile(session, file))
    .map(file => ({
      id: String(file.id),
      parentId: file.parentId == null ? null : String(file.parentId),
      folder: true,
      level: file.level || getFolderLevel(file),
      isDefault: Boolean(file.isDefault),
      userId: file.userId == null ? null : String(file.userId),
      visibility: visibilityOf(file),
      ...fileCapabilities(session, file),
      name: file.originalName,
      createdAt: file.createdAt
    }))
  const byId = new Map(files.map(file => [String(file.id), file]))
  const valid = node => {
    const level = getFolderLevel(node)
    if (level < 1 || level > 2) return false
    let parentId = node.parentId
    while (parentId !== null && parentId !== undefined) {
      const parent = byId.get(String(parentId))
      if (!parent) return false
      parentId = parent.parentId
    }
    return true
  }
  const validFiles = files.filter(valid)
  const childrenByParent = new Map()
  validFiles.forEach(file => {
    const parentKey = file.parentId == null ? 'root' : String(file.parentId)
    const children = childrenByParent.get(parentKey) || []
    children.push(file)
    childrenByParent.set(parentKey, children)
  })
  const sortNodes = nodes => nodes.sort((left, right) => (
    Number(right.folder) - Number(left.folder) ||
    new Date(right.createdAt) - new Date(left.createdAt) ||
    String(left.name).localeCompare(String(right.name), 'zh-CN')
  ))
  const build = (parentKey, path = new Set()) => sortNodes(childrenByParent.get(parentKey) || []).map(node => {
    if (path.has(String(node.id))) return null
    const nextPath = new Set(path)
    nextPath.add(String(node.id))
    return {
    ...node,
    children: build(String(node.id), nextPath)
    }
  }).filter(Boolean)

  return build('root')
}

const handleDownload = config => {
  const id = getPath(config.url).split('/').at(-2)
  const file = getFileForSession(config, id)
  if (file.folder) fail(422, 422, '文件夹不能下载')
  return file.fileUrl
}

const handleDeleteFile = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').pop()
  const file = getFileForSession(config, id)
  if (file.folder) fail(422, 422, '文件夹不能删除')
  if (session.role !== 'ADMIN' && String(file.userId) !== String(session.userId)) {
    fail(403, 403, '只有上传者可以删除公共文件')
  }
  if (mockState.jobs.some(job => String(job.fileId) === String(file.id))) {
    fail(409, 409, '文件已关联打印任务，无法删除')
  }
  mockState.files.splice(mockState.files.indexOf(file), 1)
  return null
}

const handleBatchDeleteFiles = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const ids = getBody(config).ids || []
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    fail(400, 400, '批量删除文件数量必须为 1-100 个')
  }

  const items = ids.map(id => {
    const file = findFile(id)
    if (!file || !canReadFile(session, file)) {
      return { id, success: false, reason: '文件不存在' }
    }
    if (file.folder) return { id, success: false, reason: '文件夹不能删除' }
    if (session.role !== 'ADMIN' && String(file.userId) !== String(session.userId)) {
      return { id, success: false, reason: '只有上传者可以删除公共文件' }
    }
    if (mockState.jobs.some(job => String(job.fileId) === String(file.id))) {
      return { id, success: false, reason: '文件已关联打印任务，无法删除' }
    }
    mockState.files.splice(mockState.files.indexOf(file), 1)
    return { id, success: true, reason: null }
  })
  return { items }
}

const handleBatchMoveFiles = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const rawIds = body.ids || []
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > 100) {
    fail(400, 400, '批量移动文件数量必须为 1-100 个')
  }
  const ids = [...new Set(rawIds.map(normalizeMockId))]
  const rawParentId = body.parentId
  const parentId = rawParentId == null || rawParentId === '' ? null : normalizeMockId(rawParentId)
  if (parentId !== null && !isValidMockId(parentId)) {
    fail(400, 400, '目标目录 ID 必须为正数')
  }
  const target = parentId === null ? null : findFile(parentId)
  if (parentId !== null && !target) fail(404, 404, '目标文件夹不存在')
  if (target && !target.folder) fail(422, 422, '目标资源不是文件夹')
  if (target && !canReadFile(session, target)) fail(403, 403, '无权访问目标文件夹')

  const items = ids.map(id => {
    const file = findFile(id)
    if (!file || !canReadFile(session, file)) {
      return { id, success: false, reason: '文件不存在' }
    }
    if (file.folder) return { id, success: false, reason: '文件夹不能通过文件移动接口移动' }
    if (fileCapabilities(session, file).canMove !== true) {
      return { id, success: false, reason: '无权移动此文件' }
    }
    if (target && visibilityOf(target) !== visibilityOf(file)) {
      return { id, success: false, reason: '禁止跨可见性移动文件' }
    }
    if (target && visibilityOf(file) !== 'PUBLIC'
      && String(target.userId) !== String(file.userId)) {
      return { id, success: false, reason: '目标文件夹必须属于文件所属用户' }
    }
    if (parentId === null
      ? file.parentId === null || file.parentId === undefined
      : sameMockId(file.parentId, parentId)) {
      return { id, success: false, reason: '文件已经位于目标目录' }
    }
    file.parentId = parentId
    return { id, success: true, reason: '移动成功' }
  })
  const movedCount = items.filter(item => item.success).length
  const failedCount = items.length - movedCount
  return {
    totalCount: items.length,
    movedCount,
    failedCount,
    items,
    message: `批量移动完成：成功 ${movedCount} 个，失败 ${failedCount} 个`
  }
}

const handleJobPage = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const params = getBody(config)
  let records = mockState.jobs
  const filesById = new Map(mockState.files.map(file => [String(file.id), file]))
  if (session.role !== 'ADMIN') {
    records = records.filter(item => String(item.userId) === String(session.userId))
  }
  if (params.status) records = records.filter(item => item.status === params.status)
  if (params.printerId !== undefined && params.printerId !== null && params.printerId !== '') {
    records = records.filter(item => String(item.printerId) === String(params.printerId))
  }
  if (params.keyword) {
    const keyword = String(params.keyword).trim().toLowerCase()
    records = records.filter(item => (
      String(item.id).toLowerCase().includes(keyword) ||
      String(filesById.get(String(item.fileId))?.originalName || '').toLowerCase().includes(keyword)
    ))
  }
  if (params.startTime && params.endTime && new Date(params.startTime) > new Date(params.endTime)) {
    fail(400, 400, '开始时间不能晚于结束时间')
  }
  if (params.startTime) records = records.filter(item => new Date(item.createdAt) >= new Date(params.startTime))
  if (params.endTime) records = records.filter(item => new Date(item.createdAt) <= new Date(params.endTime))
  return createMockPage(records.map(toPublicJob), params)
}

const handleJobQueue = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  let records = mockState.jobs.filter(item => item.status === 'QUEUED')
  if (session.role !== 'ADMIN') {
    records = records.filter(item => String(item.userId) === String(session.userId))
  }
  return records
    .sort((a, b) => b.priority - a.priority || new Date(b.createdAt) - new Date(a.createdAt))
    .map(toPublicJob)
}

const handleJobDetail = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').pop()
  const job = findJob(id)
  if (!job || !canReadResource(session, job.userId)) fail(404, 404, '任务不存在')
  return toPublicJob(job)
}

const handleReconcileJob = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  const job = findJob(id)
  if (!job) fail(404, 404, '任务不存在')
  if (!canReadResource(session, job.userId)) fail(403, 403, '无权操作此任务')
  if (job.status !== 'RECONCILING') fail(422, 422, '当前任务状态不允许人工核对')

  const body = getBody(config)
  const result = String(body.result || '').toUpperCase()
  const reason = String(body.reason || '').trim()
  if (!['COMPLETED', 'FAILED', 'CANCELLED', 'QUEUED'].includes(result)) fail(400, 400, '核对结果不合法')
  if (!reason) fail(400, 400, '核对原因不能为空')
  if (reason.length > 255) fail(400, 400, '核对原因最多 255 个字符')

  if (job.printerId) {
    const printer = findPrinter(job.printerId)
    if (sameMockId(printer?.currentJobId, job.id)) {
      printer.currentJobId = null
      printer.isSafeToPrint = false
      printer.status = 'IDLE'
      printer.updatedAt = now()
    }
  }

  if (result === 'QUEUED') {
    Object.assign(job, { printerId: null, operatorId: null, progress: 0, errorReason: reason })
  } else {
    job.errorReason = reason
    job.completedAt = now()
  }
  setJobStatus(job, result)
  return toPublicJob(job)
}

const handleCreateJob = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const fileId = normalizeMockId(body.fileId)
  const priority = Number(body.priority)
  const printerId = body.printerId === undefined || body.printerId === null || body.printerId === ''
    ? null
    : normalizeMockId(body.printerId)
  if (!isValidMockId(fileId) || (printerId !== null && !isValidMockId(printerId))
    || !Number.isInteger(priority) || priority < 0 || priority > 100) {
    fail(400, 400, '任务参数不合法')
  }
  if (body.idempotencyKey) {
    const previous = mockState.jobs.find(job => (
      sameMockId(job.userId, session.userId) && job.idempotencyKey === body.idempotencyKey
    ))
    if (previous) {
      if (!sameMockId(previous.fileId, fileId) || !sameOptionalMockId(previous.printerId, printerId)
        || previous.priority !== priority) {
        fail(409, 409, '幂等键对应的任务参数不一致')
      }
      return previous.id
    }
  }
  const file = findFile(fileId)
  if (!file || file.folder) fail(404, 404, '打印文件不存在')
  if (!canReadFile(session, file)) fail(403, 403, '无权使用此文件创建任务')
  const printer = printerId === null ? null : findPrinter(printerId)
  if (printerId !== null && !printer) fail(404, 404, '打印机不存在')
  if (printer && (printer.status !== 'IDLE' || printer.currentJobId)) {
    fail(409, 10002, '打印机当前忙碌')
  }
  const createdAt = now()
  const job = {
    id: nextMockId('job'),
    fileId,
    printerId,
    userId: session.userId,
    operatorId: null,
    priority,
    idempotencyKey: body.idempotencyKey || null,
    status: 'QUEUED',
    progress: 0,
    startedAt: null,
    completedAt: null,
    errorReason: null,
    createdAt,
    updatedAt: createdAt
  }
  mockState.jobs.push(job)
  if (printer) {
    setJobStatus(job, 'ASSIGNED')
    printer.currentJobId = job.id
    printer.isSafeToPrint = false
    printer.updatedAt = createdAt
  }
  return job.id
}

const handleCancelJob = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').pop()
  const job = findJob(id)
  if (!job) fail(404, 404, '任务不存在')
  if (!canReadResource(session, job.userId)) fail(403, 403, '无权操作此任务')
  if (!['QUEUED', 'ASSIGNED', 'UPLOADING', 'READY', 'PRINTING', 'PAUSED'].includes(job.status)) {
    fail(422, 422, '当前任务状态不允许取消')
  }
  setJobStatus(job, 'CANCELLED')
  if (job.printerId) {
    const printer = findPrinter(job.printerId)
    if (sameMockId(printer?.currentJobId, job.id)) {
      printer.currentJobId = null
      printer.status = 'IDLE'
      printer.updatedAt = now()
    }
  }
  return null
}

const handleAssignJob = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const job = findJob(body.jobId)
  const printer = findPrinter(body.printerId)
  if (!job) fail(404, 404, '任务不存在')
  if (!printer) fail(404, 404, '打印机不存在')
  if (!canReadResource(session, job.userId)) fail(403, 403, '无权操作此任务')
  if (job.status !== 'QUEUED') fail(422, 422, '当前任务状态不允许派发')
  if (printer.status !== 'IDLE' || printer.currentJobId) fail(409, 10002, '打印机当前忙碌')
  job.printerId = printer.id
  setJobStatus(job, 'ASSIGNED')
  printer.currentJobId = job.id
  printer.status = 'IDLE'
  printer.updatedAt = now()
  return toPublicJob(job)
}

const handleRetryJob = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  const job = findJob(id)
  if (!job || !canReadResource(session, job.userId)) fail(404, 404, '任务不存在')
  if (job.status !== 'FAILED') fail(422, 422, '当前任务状态不允许重试')
  Object.assign(job, {
    printerId: null,
    operatorId: null,
    startedAt: null,
    completedAt: null,
    errorReason: null,
    progress: 0,
    updatedAt: now()
  })
  setJobStatus(job, 'QUEUED')
  return null
}

const handleRequeueJob = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  const job = findJob(id)
  if (!job || !canReadResource(session, job.userId)) fail(404, 404, '任务不存在')
  if (!['ASSIGNED', 'READY'].includes(job.status)) fail(422, 422, '当前任务状态不允许重新排队')
  if (job.printerId) {
    const printer = findPrinter(job.printerId)
    if (sameMockId(printer?.currentJobId, job.id)) {
      printer.currentJobId = null
      printer.isSafeToPrint = false
      printer.status = 'IDLE'
      printer.updatedAt = now()
    }
  }
  Object.assign(job, { printerId: null, progress: 0 })
  setJobStatus(job, 'QUEUED')
  return null
}

const handleUpdateJobPriority = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const id = getPath(config.url).split('/').at(-2)
  const job = findJob(id)
  const priority = Number(getBody(config).priority)
  if (!job || !canReadResource(session, job.userId)) fail(404, 404, '任务不存在')
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) fail(400, 400, '优先级必须为 0-100')
  if (job.status !== 'QUEUED') fail(422, 422, '只有排队任务可以调整优先级')
  job.priority = priority
  job.updatedAt = now()
  return null
}

const normalizeBatchIds = value => (Array.isArray(value) ? value : [])
  .map(item => String(item).trim())
  .filter(Boolean)

const batchItemFailure = (itemId, fileId, printerId, errorCode, message, retryable = false) => ({
  itemId,
  fileId,
  printerId,
  canExecute: false,
  reasonCode: errorCode,
  errorCode,
  message,
  retryable
})

const getBatchPrinterId = (strategy, printerIds, index) => {
  if (!printerIds.length) return null
  if (strategy === 'ROUND_ROBIN') return printerIds[index % printerIds.length]
  return printerIds[index] || null
}

const isPrinterAvailable = printer => Boolean(
  printer && printer.status === 'IDLE' && !printer.currentJobId
)

const handleBatchPreview = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const fileIds = normalizeBatchIds(body.fileIds)
  const printerIds = normalizeBatchIds(body.printerIds)
  const strategy = String(body.strategy || '').toUpperCase()
  const action = String(body.action || '').toUpperCase()

  if (!fileIds.length || fileIds.length > 100 || new Set(fileIds).size !== fileIds.length) {
    fail(400, 400, '批量预览文件数量必须为 1-100 个且不能重复')
  }
  if (!BATCH_STRATEGIES.includes(strategy) || !BATCH_ACTIONS.includes(action)) {
    fail(400, 400, '批量预览策略或动作不合法')
  }

  const planId = `batch-plan-${nextMockId('batchPlan')}`
  const suggestions = []
  const items = fileIds.map((fileId, index) => {
    const itemId = `${planId}-item-${index + 1}`
    const file = findFile(fileId)
    if (!file || file.folder) return batchItemFailure(itemId, fileId, null, 'FILE_NOT_AVAILABLE', '文件不存在或不是可打印文件')
    if (!canReadFile(session, file)) return batchItemFailure(itemId, fileId, null, 'FILE_FORBIDDEN', '无权使用此文件')

    let printerId = getBatchPrinterId(strategy, printerIds, index)
    if (strategy === 'AUTO_MATCH') {
      const candidates = printerIds.map(id => findPrinter(id)).filter(isPrinterAvailable)
      printerId = candidates[index % candidates.length]?.id || null
      if (printerId) suggestions.push({ itemId, message: `建议匹配空闲打印机 ${printerId}` })
    }
    if (!printerId) return batchItemFailure(itemId, file.id, null, 'PRINTER_REQUIRED', '没有可用的打印机匹配此文件')

    const printer = findPrinter(printerId)
    if (!printer) return batchItemFailure(itemId, file.id, printerId, 'PRINTER_NOT_FOUND', '打印机不存在')
    if (!isPrinterAvailable(printer)) {
      return batchItemFailure(itemId, file.id, printer.id, 'PRINTER_BUSY', '打印机当前忙碌或不可用')
    }
    return {
      itemId,
      fileId: file.id,
      printerId: printer.id,
      canExecute: true,
      reasonCode: null,
      errorCode: null,
      message: '预览可执行',
      retryable: false
    }
  })

  const plan = {
    planId,
    version: 1,
    userId: session.userId,
    strategy,
    action,
    items,
    suggestions,
    conflicts: items.filter(item => !item.canExecute),
    confirmationToken: `mock-confirm-${planId}`,
    expiresAt: new Date(Date.now() + BATCH_PLAN_TTL_MS).toISOString(),
    status: 'PREVIEWED',
    confirmResult: null
  }
  mockState.batchPlans.push(plan)
  return {
    planId: plan.planId,
    version: plan.version,
    action: plan.action,
    strategy: plan.strategy,
    items: cloneMockData(plan.items),
    suggestions: cloneMockData(plan.suggestions),
    conflicts: cloneMockData(plan.conflicts),
    confirmationToken: plan.confirmationToken,
    expiresAt: plan.expiresAt
  }
}

const createBatchJob = (session, item, action) => {
  const file = findFile(item.fileId)
  const printer = findPrinter(item.printerId)
  if (!file || file.folder || !canReadFile(session, file)) {
    return { success: false, errorCode: 'FILE_NOT_AVAILABLE', message: '文件已不可用', retryable: false }
  }
  if (!isPrinterAvailable(printer)) {
    return { success: false, errorCode: 'PRINTER_BUSY', message: '打印机在确认时已被占用', retryable: true }
  }

  const idempotencyKey = `batch:${item.planId || 'legacy'}:${item.itemId}`
  const existing = mockState.jobs.find(job => (
    String(job.userId) === String(session.userId) && job.idempotencyKey === idempotencyKey
  ))
  if (existing) return { success: true, job: existing }

  const createdAt = now()
  const job = {
    id: nextMockId('job'),
    fileId: file.id,
    printerId: printer.id,
    userId: session.userId,
    operatorId: null,
    priority: 0,
    idempotencyKey,
    status: 'QUEUED',
    progress: 0,
    startedAt: null,
    completedAt: null,
    errorReason: null,
    createdAt,
    updatedAt: createdAt
  }
  mockState.jobs.push(job)
  setJobStatus(job, 'ASSIGNED')
  printer.currentJobId = job.id
  printer.isSafeToPrint = false
  printer.updatedAt = now()

  if (action === 'UPLOAD_ONLY') {
    printer.isSafeToPrint = true
    setJobStatus(job, 'UPLOADING')
    setJobStatus(job, 'READY')
    job.operatorId = session.userId
    job.startedAt = now()
    printer.status = 'IDLE'
    printer.isSafeToPrint = false
    printer.updatedAt = now()
  }
  return { success: true, job }
}

const handleBatchConfirm = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const plan = mockState.batchPlans.find(item => item.planId === body.planId)
  if (!plan) fail(404, 404, '批量派发计划不存在')
  if (session.role !== 'ADMIN' && String(plan.userId) !== String(session.userId)) {
    fail(403, 403, '无权确认此批量派发计划')
  }
  if (Number(body.version) !== plan.version || body.confirmationToken !== plan.confirmationToken) {
    fail(409, 409, '批量派发计划版本或确认令牌不匹配')
  }
  if (Date.parse(plan.expiresAt) <= Date.now()) fail(409, 409, '批量派发计划已过期')

  const itemIds = normalizeBatchIds(body.itemIds)
  if (!itemIds.length) fail(400, 400, '至少确认一个可执行项')
  const planItems = new Map(plan.items.map(item => [String(item.itemId), item]))
  const requestedItems = itemIds.map(itemId => planItems.get(itemId)).filter(Boolean)
  if (requestedItems.length !== itemIds.length
    || requestedItems.some(item => !canReadFile(session, findFile(item.fileId)))) {
    fail(404, 404, '批量派发计划不存在')
  }
  if (plan.status === 'CONFIRMED' && plan.confirmResult) {
    return { ...cloneMockData(plan.confirmResult), idempotent: true, repeated: true }
  }
  const items = []
  const seen = new Set()
  itemIds.forEach(itemId => {
    if (seen.has(itemId)) return
    seen.add(itemId)
    const previewItem = planItems.get(itemId)
    if (!previewItem) {
      items.push({ itemId, fileId: null, printerId: null, jobId: null, status: 'FAILED', errorCode: 'ITEM_NOT_FOUND', message: '预览项不存在', attemptCount: 1, retryable: false, success: false })
      return
    }
    if (!previewItem.canExecute) {
      items.push({ ...previewItem, jobId: null, status: 'FAILED', attemptCount: 1, success: false })
      return
    }
    const result = createBatchJob(session, { ...previewItem, planId: plan.planId }, plan.action)
    if (!result.success) {
      items.push({
        itemId: previewItem.itemId,
        fileId: previewItem.fileId,
        printerId: previewItem.printerId,
        jobId: null,
        status: 'FAILED',
        errorCode: result.errorCode,
        message: result.message,
        attemptCount: 1,
        retryable: result.retryable,
        success: false
      })
      previewItem.status = result.retryable ? 'RETRYABLE' : 'FAILED'
      previewItem.retryable = result.retryable
      return
    }
    items.push({
      itemId: previewItem.itemId,
      fileId: result.job.fileId,
      printerId: result.job.printerId,
      jobId: result.job.id,
      status: result.job.status,
      errorCode: null,
      message: plan.action === 'START_AFTER_CONFIRM' ? '已创建分配任务，等待逐项安全确认' : plan.action === 'UPLOAD_ONLY' ? '已安全确认并上传' : '已创建分配任务',
      attemptCount: 1,
      retryable: false,
      success: true,
      job: toPublicJob(result.job)
    })
    previewItem.status = result.job.status
    previewItem.jobId = result.job.id
    previewItem.retryable = false
  })

  const result = {
    planId: plan.planId,
    version: plan.version,
    planStatus: items.every(item => item.success) ? 'CONFIRMED' : 'PARTIAL_SUCCESS',
    idempotent: false,
    repeated: false,
    items
  }
  plan.status = 'CONFIRMED'
  plan.confirmResult = cloneMockData(result)
  return result
}

const handleConfirmSafe = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const printer = findPrinter(getBody(config).printerId)
  if (!printer) fail(404, 404, '打印机不存在')
  if (!printer.currentJobId) fail(422, 422, '打印机没有待确认任务')
  const job = findJob(printer.currentJobId)
  if (!job || !canReadResource(session, job.userId)) fail(404, 404, '任务不存在')
  if (!['ASSIGNED', 'READY'].includes(job.status)) fail(422, 422, '当前任务状态不允许安全确认')
  printer.isSafeToPrint = true
  printer.updatedAt = now()
  return toPublicPrinter(printer)
}

const handleStartJob = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const body = getBody(config)
  const job = findJob(body.jobId)
  if (!job) fail(404, 404, '任务不存在')
  if (!canReadResource(session, job.userId)) fail(403, 403, '无权操作此任务')
  const printer = findPrinter(job.printerId)
  if (!printer) fail(422, 422, '任务尚未分配打印机')
  if (!printer.isSafeToPrint) fail(422, 422, '请先完成设备安全确认')
  if (!['ASSIGNED', 'READY'].includes(job.status)) fail(422, 422, '当前任务状态不允许启动')
  if (!['START_PRINT', 'UPLOAD_ONLY'].includes(body.action || 'START_PRINT')) {
    fail(400, 400, '启动 action 不合法')
  }
  if (job.status === 'ASSIGNED') setJobStatus(job, 'UPLOADING')
  if (job.status === 'UPLOADING') setJobStatus(job, 'READY')
  if (body.action !== 'UPLOAD_ONLY') setJobStatus(job, 'PRINTING')
  job.operatorId = session.userId
  job.startedAt = job.startedAt || now()
  job.updatedAt = now()
  printer.status = job.status === 'PRINTING' ? 'PRINTING' : 'IDLE'
  printer.isSafeToPrint = false
  printer.updatedAt = now()
  return toPublicJob(job)
}

const handlePrinterControl = config => {
  const session = requireSession(config, ['ADMIN', 'OPERATOR'])
  const pathParts = getPath(config.url).split('/')
  const action = pathParts.at(-1)
  const printer = findPrinter(pathParts.at(-2))
  if (!printer) fail(404, 404, '打印机不存在')
  if (!printer.currentJobId) fail(422, 422, '打印机当前没有任务')
  const job = findJob(printer.currentJobId)
  if (!job) fail(422, 422, '打印机当前任务不存在')
  if (!canReadResource(session, job.userId)) fail(403, 403, '无权操作此任务')

  if (action === 'pause') {
    if (job.status !== 'PRINTING') fail(422, 422, '当前任务状态不允许暂停')
    setJobStatus(job, 'PAUSED')
    printer.status = 'PAUSED'
  } else if (action === 'resume') {
    if (job.status !== 'PAUSED') fail(422, 422, '当前任务状态不允许恢复')
    setJobStatus(job, 'PRINTING')
    printer.status = 'PRINTING'
  } else if (action === 'cancel') {
    if (!['PRINTING', 'PAUSED', 'ASSIGNED', 'UPLOADING', 'READY'].includes(job.status)) {
      fail(422, 422, '当前任务状态不允许取消')
    }
    setJobStatus(job, 'CANCELLED')
    printer.status = 'IDLE'
    printer.currentJobId = null
    printer.isSafeToPrint = false
  } else if (action === 'emergency-stop') {
    if (!['PRINTING', 'PAUSED'].includes(job.status)) {
      fail(422, 422, '当前任务状态不允许急停')
    }
    setJobStatus(job, 'RECONCILING')
    job.errorReason = '紧急停机，等待现场核对'
    job.updatedAt = now()
    printer.status = 'ERROR'
  } else {
    fail(404, 404, `Mock 未实现设备操作：${action}`)
  }
  printer.updatedAt = now()
  return null
}

const route = async config => {
  throwMockErrorScenario(config)
  const method = String(config.method || 'get').toUpperCase()
  const path = getPath(config.url)
  const key = `${method} ${path}`

  if (key === 'POST /api/v1/auth/login') return handleLogin(config)
  if (key === 'GET /api/v1/auth/setup/status') return handleFirstAdminSetupStatus()
  if (key === 'POST /api/v1/auth/setup/admin') return handleFirstAdminSetup(config)
  if (key === 'POST /api/v1/auth/register') return handleRegister(config)
  if (key === 'GET /api/v1/auth/me') return handleCurrentUser(config)
  if (key === 'GET /api/v1/auth/admin/users') return handleAdminUserPage(config)
  if (key === 'GET /api/v1/auth/admin/audit-logs') return handleAuditLogPage(config)
  if (key === 'POST /api/v1/auth/admin/users') return handleAdminUserCreate(config)
  if (/^PUT \/api\/v1\/auth\/admin\/users\/[^/]+$/.test(key)) return handleAdminUserUpdate(config)
  if (/^POST \/api\/v1\/auth\/admin\/users\/[^/]+\/(enable|disable)$/.test(key)) return handleAdminUserToggle(config)
  if (/^(GET|PUT) \/api\/v1\/auth\/[^/]+\/profile$/.test(key)) return handleProfile(config)
  if (/^POST \/api\/v1\/auth\/[^/]+\/change-password$/.test(key)) return handleChangePassword(config)
  if (key === 'GET /api/v1/dashboard-layout' || key === 'PUT /api/v1/dashboard-layout') return handleDashboardLayout(config)
  if (key === 'GET /api/v1/printers/page') return handlePrinterPage(config)
  if (key === 'GET /api/v1/printers/scan') return handleScanPrinters(config)
  if (key === 'GET /api/v1/printers/unallocated') return handleUnallocatedPrinters(config)
  if (key === 'PUT /api/v1/printers/monitor/batch') return handleBatchUpdatePrinterMonitor(config)
  if (/^GET \/api\/v1\/printers\/[^/]+\/monitor$/.test(key)) return handleGetPrinterMonitor(config)
  if (/^PUT \/api\/v1\/printers\/[^/]+\/monitor$/.test(key)) return handleUpdatePrinterMonitor(config)
  if (/^GET \/api\/v1\/printers\/[^/]+\/history$/.test(key)) return handlePrinterHistory(config)
  if (/^GET \/api\/v1\/printers\/[^/]+\/statistics$/.test(key)) return handlePrinterStatistics(config)
  if (/^GET \/api\/v1\/printers\/[^/]+$/.test(key)) return handlePrinterDetail(config)
  if (key === 'POST /api/v1/printers/add') return handleAddPrinter(config)
  if (key === 'PUT /api/v1/printers/update') return handleUpdatePrinter(config)
  if (key === 'POST /api/v1/printers/batch-add') return handleBatchAddPrinters(config)
  if (key === 'PUT /api/v1/printers/positions') return handlePositions(config)
  if (key === 'POST /api/v1/print-files/page') return handleFilePage(config)
  if (key === 'POST /api/v1/print-files/upload') return handleUpload(config)
  if (key === 'POST /api/v1/print-files/batch-upload') return handleBatchUpload(config)
  if (key === 'POST /api/v1/print-files/folder/create') return handleCreateFolder(config)
  if (/^PUT \/api\/v1\/print-files\/folder\/[^/]+\/rename$/.test(key)) return handleRenameFolder(config)
  if (/^PUT \/api\/v1\/print-files\/folder\/[^/]+\/move$/.test(key)) return handleMoveFolder(config)
  if (/^DELETE \/api\/v1\/print-files\/folder\/[^/]+$/.test(key)) return handleDeleteFolder(config)
  if (key === 'GET /api/v1/print-files/tree') return handleFileTree(config)
  if (/^GET \/api\/v1\/print-files\/[^/]+\/preview$/.test(key)) return handleFilePreview(config)
  if (/^GET \/api\/v1\/print-files\/[^/]+\/thumbnail$/.test(key)) return handleThumbnail(config)
  if (/^GET \/api\/v1\/print-files\/[^/]+\/jobs$/.test(key)) return handleFileJobs(config)
  if (key === 'DELETE /api/v1/print-files/batch') return handleBatchDeleteFiles(config)
  if (key === 'PUT /api/v1/print-files/batch/move') return handleBatchMoveFiles(config)
  if (key === 'GET /api/v1/print-jobs/queue') return handleJobQueue(config)
  if (key === 'POST /api/v1/print-jobs/page') return handleJobPage(config)
  if (key === 'POST /api/v1/print-jobs/batch/preview') return handleBatchPreview(config)
  if (key === 'POST /api/v1/print-jobs/batch/retry-preview') return handleBatchRetryPreview(config)
  if (key === 'POST /api/v1/print-jobs/batch/confirm') return handleBatchConfirm(config)
  if (/^GET \/api\/v1\/print-jobs\/[^/]+$/.test(key)) return handleJobDetail(config)
  if (/^POST \/api\/v1\/print-jobs\/[^/]+\/reconcile$/.test(key)) return handleReconcileJob(config)
  if (key === 'POST /api/v1/print-jobs/create' || key === 'POST /api/v1/print-jobs') return handleCreateJob(config)
  if (key === 'POST /api/v1/print-jobs/safe/assign') return handleAssignJob(config)
  if (key === 'POST /api/v1/print-jobs/safe/confirm') return handleConfirmSafe(config)
  if (key === 'POST /api/v1/print-jobs/safe/start') return handleStartJob(config)
  if (/^POST \/api\/v1\/print-jobs\/[^/]+\/retry$/.test(key)) return handleRetryJob(config)
  if (/^POST \/api\/v1\/print-jobs\/[^/]+\/requeue$/.test(key)) return handleRequeueJob(config)
  if (/^PUT \/api\/v1\/print-jobs\/[^/]+\/priority$/.test(key)) return handleUpdateJobPriority(config)
  if (/^POST \/api\/v1\/control\/[^/]+\/(pause|resume|cancel|emergency-stop)$/.test(key)) return handlePrinterControl(config)
  if (/^DELETE \/api\/v1\/printers\/delete\/[^/]+$/.test(key)) return handleDeletePrinter(config)
  if (/^GET \/api\/v1\/print-files\/[^/]+\/download$/.test(key)) return handleDownload(config)
  if (/^DELETE \/api\/v1\/print-files\/[^/]+$/.test(key)) return handleDeleteFile(config)
  if (/^DELETE \/api\/v1\/print-jobs\/[^/]+$/.test(key)) return handleCancelJob(config)

  fail(404, 404, `Mock 未实现接口：${method} ${path}`)
}

export const isMockEnabled = runtimeEnv.VITE_USE_MOCK === 'true' || [
  'mock',
  'desktop-mock'
].includes(runtimeEnv.MODE)

if ((runtimeEnv.DEV || runtimeEnv.MODE === 'mock' || String(runtimeEnv.MODE || '').startsWith('desktop')) && typeof window !== 'undefined') {
  window.__FARM_RESET_MOCK__ = resetMockState
  window.__FARM_GET_LAST_BATCH_ADD_PAYLOAD__ = () => cloneMockData(mockState.lastBatchAddPayload || [])
  window.__FARM_GET_LAST_SCAN_SUBNET__ = () => mockState.lastScanSubnet || null
  window.__FARM_SET_DASHBOARD_LAYOUT_ERROR__ = failure => {
    mockState.dashboardLayoutError = cloneMockData(failure)
  }
}

export async function mockRequest(config) {
  if (config.signal?.aborted) {
    const error = new Error('请求已取消')
    error.name = 'CanceledError'
    error.code = 'ERR_CANCELED'
    throw error
  }
  await wait(MOCK_DELAY)
  if (config.signal?.aborted) {
    const error = new Error('请求已取消')
    error.name = 'CanceledError'
    error.code = 'ERR_CANCELED'
    throw error
  }
  const data = await route(config)
  return createMockSuccess(toPublicSemanticIds(data))
}
