const clone = value => JSON.parse(JSON.stringify(value))

const mockFileUrl = name => {
  const content = `; Mock G-code: ${name}\nG28\nG1 X10 Y10 F3000\nM104 S0\n`
  return `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`
}

const createSeedData = ({ initialized = true, dashboardLayout: layoutOverride = null, printers: printersOverride = null } = {}) => ({
  users: initialized ? [
    {
      id: 1,
      username: 'admin',
      password: 'Admin123',
      role: 'ADMIN',
      email: 'admin@farm.local',
      phone: null,
      enabled: true,
      createdAt: '2026-09-01T09:00:00',
      updatedAt: '2026-09-01T09:00:00'
    },
    {
      id: 2,
      username: 'operator',
      password: 'Operator123',
      role: 'OPERATOR',
      email: 'operator@farm.local',
      phone: null,
      enabled: true,
      createdAt: '2026-09-01T09:10:00',
      updatedAt: '2026-09-01T09:10:00'
    }
  ] : [],
  printers: printersOverride || [
    {
      id: 403,
      name: 'Printer_C0DA',
      machineNumber: 'A-01',
      ipAddress: '192.168.1.80',
      macAddress: 'AA:BB:CC:DD:EE:01',
      firmwareType: 'KLIPPER',
      status: 'PRINTING',
      isSafeToPrint: true,
      currentJobId: 1001,
      currentJobStatus: 'PRINTING',
      currentJobFileName: 'gearbox.gcode',
      currentMaterial: 'PLA',
      nozzleSize: 0.4,
      gridRow: 1,
      gridCol: 1,
      createdAt: '2026-09-01T10:00:00',
      updatedAt: '2026-09-02T17:10:30'
    },
    {
      id: 404,
      name: 'Printer_A12F',
      machineNumber: 'A-02',
      ipAddress: '192.168.1.81',
      macAddress: 'AA:BB:CC:DD:EE:02',
      firmwareType: 'KLIPPER',
      status: 'IDLE',
      isSafeToPrint: false,
      currentJobId: null,
      currentMaterial: 'PETG',
      nozzleSize: 0.4,
      gridRow: 1,
      gridCol: 2,
      createdAt: '2026-09-01T10:05:00',
      updatedAt: '2026-09-02T17:00:00'
    },
    {
      id: 405,
      name: 'Printer_B07E',
      machineNumber: 'A-03',
      ipAddress: '192.168.1.82',
      macAddress: 'AA:BB:CC:DD:EE:03',
      firmwareType: 'RRF',
      status: 'PAUSED',
      isSafeToPrint: true,
      currentJobId: 1002,
      currentJobStatus: 'PAUSED',
      currentJobFileName: 'enclosure.gcode',
      currentMaterial: 'ABS',
      nozzleSize: 0.6,
      gridRow: 1,
      gridCol: 3,
      createdAt: '2026-09-01T10:10:00',
      updatedAt: '2026-09-02T17:05:00'
    },
    {
      id: 406,
      name: 'Printer_OFFLINE',
      machineNumber: 'B-01',
      ipAddress: '192.168.1.83',
      macAddress: 'AA:BB:CC:DD:EE:04',
      firmwareType: 'KLIPPER',
      status: 'OFFLINE',
      isSafeToPrint: false,
      currentJobId: null,
      currentMaterial: 'PLA',
      nozzleSize: 0.4,
      gridRow: 2,
      gridCol: 1,
      createdAt: '2026-09-01T10:15:00',
      updatedAt: '2026-09-02T16:50:00'
    },
    {
      id: 407,
      name: 'Printer_ERROR',
      machineNumber: 'B-02',
      ipAddress: '192.168.1.84',
      macAddress: 'AA:BB:CC:DD:EE:05',
      firmwareType: 'RRF',
      status: 'ERROR',
      isSafeToPrint: false,
      currentJobId: null,
      currentMaterial: 'TPU',
      nozzleSize: 0.8,
      gridRow: 2,
      gridCol: 2,
      createdAt: '2026-09-01T10:20:00',
      updatedAt: '2026-09-02T16:45:00'
    },
    {
      id: 408,
      name: 'Printer_CLEAN',
      machineNumber: 'B-03',
      ipAddress: '192.168.1.85',
      macAddress: 'AA:BB:CC:DD:EE:06',
      firmwareType: 'KLIPPER',
      status: 'IDLE',
      isSafeToPrint: false,
      currentJobId: null,
      currentMaterial: 'PLA',
      nozzleSize: 0.4,
      gridRow: null,
      gridCol: null,
      createdAt: '2026-09-01T10:25:00',
      updatedAt: '2026-09-02T16:40:00'
    }
  ],
  dashboardLayout: layoutOverride || {
    rowCount: 4,
    columnCount: 12,
    aisles: [
      { id: 'default-column-aisle', axis: 'COLUMN', afterIndex: 7, label: '过道', size: 100 }
    ],
    version: 1,
    limits: {
      minRows: 1,
      maxRows: 30,
      minColumns: 1,
      maxColumns: 60,
      maxCells: 1800,
      maxAisles: 20,
      minAisleSize: 48,
      maxAisleSize: 240
    },
    updatedAt: '2026-09-02T16:40:00'
  },
  files: [
    {
      id: 1,
      parentId: null,
      folder: true,
      isFolder: 1,
      isDefault: false,
      visibility: 'PRIVATE',
      level: 1,
      originalName: '产品样件',
      safeName: 'product-samples',
      fileSize: 0,
      fileUrl: null,
      userId: 1,
      createdAt: '2026-09-01T09:30:00',
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
    },
    {
      id: 2,
      parentId: null,
      folder: true,
      isFolder: 1,
      isDefault: false,
      visibility: 'PUBLIC',
      level: 1,
      originalName: '测试文件',
      safeName: 'test-files',
      fileSize: 0,
      fileUrl: null,
      userId: 2,
      createdAt: '2026-09-01T09:35:00',
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
    },
    {
      id: 3,
      parentId: null,
      folder: true,
      isFolder: 1,
      isDefault: true,
      visibility: 'PRIVATE',
      level: 1,
      originalName: '我的文件夹',
      safeName: 'folder_default_1',
      fileSize: 0,
      fileUrl: null,
      userId: 1,
      createdAt: '2026-09-01T09:31:00',
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
    },
    {
      id: 4,
      parentId: null,
      folder: true,
      isFolder: 1,
      isDefault: true,
      visibility: 'PRIVATE',
      level: 1,
      originalName: '我的文件夹',
      safeName: 'folder_default_2',
      fileSize: 0,
      fileUrl: null,
      userId: 2,
      createdAt: '2026-09-01T09:36:00',
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
    },
    {
      id: 5,
      parentId: null,
      folder: true,
      isFolder: 1,
      isDefault: false,
      visibility: 'PUBLIC',
      level: 1,
      originalName: '公共文件',
      safeName: 'public-files',
      fileSize: 0,
      fileUrl: null,
      userId: 2,
      createdAt: '2026-09-01T09:40:00',
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
    },
    {
      id: 20,
      parentId: 3,
      folder: false,
      isFolder: 0,
      visibility: 'PRIVATE',
      originalName: 'gearbox.gcode',
      safeName: 'gearbox.gcode',
      fileSize: 123456,
      fileUrl: mockFileUrl('gearbox.gcode'),
      userId: 1,
      createdAt: '2026-09-02T17:00:00',
      estTime: 3600,
      estimatedSeconds: 3600,
      materialType: 'PLA',
      nozzleSize: 0.4,
      filamentWeight: 12.5,
      filamentLength: 3,
      nozzleTemp: 210,
      bedTemp: 60,
      layerHeight: 0.2,
      firstLayerHeight: 0.24,
      firstLayerNozzleTemp: 215,
      firstLayerBedTemp: 60,
      printCount: 4,
      successRate: 100
    },
    {
      id: 21,
      parentId: 3,
      folder: false,
      isFolder: 0,
      visibility: 'PRIVATE',
      originalName: 'enclosure.gcode',
      safeName: 'enclosure.gcode',
      fileSize: 245760,
      fileUrl: mockFileUrl('enclosure.gcode'),
      userId: 1,
      createdAt: '2026-09-02T16:30:00',
      estTime: 5400,
      estimatedSeconds: 5400,
      materialType: 'ABS',
      nozzleSize: 0.6,
      filamentWeight: 38.2,
      filamentLength: 8.2,
      nozzleTemp: 245,
      bedTemp: 90,
      layerHeight: 0.2,
      firstLayerHeight: 0.24,
      firstLayerNozzleTemp: 250,
      firstLayerBedTemp: 90,
      printCount: 2,
      successRate: 50
    },
    {
      id: 22,
      parentId: 1,
      folder: false,
      isFolder: 0,
      visibility: 'PRIVATE',
      originalName: 'bracket.gcode',
      safeName: 'bracket.gcode',
      fileSize: 65536,
      fileUrl: mockFileUrl('bracket.gcode'),
      userId: 1,
      createdAt: '2026-09-02T15:20:00',
      estTime: 1800,
      estimatedSeconds: 1800,
      materialType: 'PETG',
      nozzleSize: 0.4,
      filamentWeight: 8.4,
      filamentLength: 1.9,
      nozzleTemp: 235,
      bedTemp: 75,
      layerHeight: 0.16,
      firstLayerHeight: 0.2,
      firstLayerNozzleTemp: 240,
      firstLayerBedTemp: 75,
      printCount: 8,
      successRate: 87.5
    },
    {
      id: 23,
      parentId: 4,
      folder: false,
      isFolder: 0,
      visibility: 'PRIVATE',
      originalName: 'calibration.bgcode',
      safeName: 'calibration.bgcode',
      fileSize: 32768,
      fileUrl: mockFileUrl('calibration.bgcode'),
      userId: 2,
      createdAt: '2026-09-02T14:10:00',
      estTime: 900,
      estimatedSeconds: 900,
      materialType: 'PLA',
      nozzleSize: 0.4,
      filamentWeight: 3.2,
      filamentLength: 0.72,
      nozzleTemp: 205,
      bedTemp: 60,
      layerHeight: 0.2,
      firstLayerHeight: 0.24,
      firstLayerNozzleTemp: 210,
      firstLayerBedTemp: 60,
      printCount: 12,
      successRate: 100
    },
    {
      id: 24,
      parentId: 5,
      folder: false,
      isFolder: 0,
      visibility: 'PUBLIC',
      originalName: 'public-bracket.gcode',
      safeName: 'public-bracket.gcode',
      fileSize: 65536,
      fileUrl: mockFileUrl('public-bracket.gcode'),
      userId: 2,
      createdAt: '2026-09-02T13:20:00',
      estTime: 1200,
      estimatedSeconds: 1200,
      materialType: 'PETG',
      nozzleSize: 0.4,
      filamentWeight: 6,
      filamentLength: 1.4,
      printCount: 0,
      successRate: 0
    }
  ],
  jobs: [
    {
      id: 1001,
      fileId: 20,
      printerId: 403,
      userId: 1,
      operatorId: 2,
      priority: 80,
      status: 'PRINTING',
      progress: 35.5,
      startedAt: '2026-09-02T17:10:00',
      completedAt: null,
      errorReason: null,
      createdAt: '2026-09-02T17:00:00',
      updatedAt: '2026-09-02T17:10:30'
    },
    {
      id: 1002,
      fileId: 21,
      printerId: 405,
      userId: 1,
      operatorId: 2,
      priority: 60,
      status: 'PAUSED',
      progress: 62,
      startedAt: '2026-09-02T16:10:00',
      completedAt: null,
      errorReason: null,
      createdAt: '2026-09-02T16:00:00',
      updatedAt: '2026-09-02T16:50:00'
    },
    {
      id: 1003,
      fileId: 22,
      printerId: null,
      userId: 1,
      operatorId: null,
      priority: 40,
      status: 'QUEUED',
      progress: 0,
      startedAt: null,
      completedAt: null,
      errorReason: null,
      createdAt: '2026-09-02T15:30:00',
      updatedAt: '2026-09-02T15:30:00'
    },
    {
      id: 1004,
      fileId: 23,
      printerId: null,
      userId: 2,
      operatorId: null,
      priority: 20,
      status: 'COMPLETED',
      progress: 100,
      startedAt: '2026-09-02T14:20:00',
      completedAt: '2026-09-02T14:35:00',
      errorReason: null,
      createdAt: '2026-09-02T14:15:00',
      updatedAt: '2026-09-02T14:35:00'
    },
    {
      id: 1005,
      fileId: 20,
      printerId: null,
      userId: 1,
      operatorId: null,
      priority: 10,
      status: 'FAILED',
      progress: 18,
      startedAt: '2026-09-01T18:00:00',
      completedAt: null,
      errorReason: '喷嘴温度异常',
      createdAt: '2026-09-01T17:50:00',
      updatedAt: '2026-09-01T18:20:00'
    },
    {
      id: 1006,
      fileId: 21,
      printerId: null,
      userId: 2,
      operatorId: null,
      priority: 5,
      status: 'CANCELLED',
      progress: 0,
      startedAt: null,
      completedAt: null,
      errorReason: null,
      createdAt: '2026-09-01T16:00:00',
      updatedAt: '2026-09-01T16:10:00'
    }
  ],
  auditLogs: initialized ? [
    {
      id: 3,
      actorId: 1,
      actorUsername: 'admin',
      actorRole: 'ADMIN',
      action: 'JOB_CANCEL',
      targetType: 'JOB',
      targetId: '1006',
      targetLabel: '打印任务 #1006',
      result: 'SUCCESS',
      errorCode: null,
      occurredAt: '2026-09-02T18:20:00',
      traceId: 'mock-trace-003'
    },
    {
      id: 2,
      actorId: 2,
      actorUsername: 'operator',
      actorRole: 'OPERATOR',
      action: 'JOB_START',
      targetType: 'JOB',
      targetId: '1001',
      targetLabel: '打印任务 #1001',
      result: 'SUCCESS',
      errorCode: null,
      occurredAt: '2026-09-02T17:10:00',
      traceId: 'mock-trace-002'
    },
    {
      id: 1,
      actorId: 1,
      actorUsername: 'admin',
      actorRole: 'ADMIN',
      action: 'LOGIN',
      targetType: 'USER',
      targetId: '1',
      targetLabel: 'admin',
      result: 'SUCCESS',
      errorCode: null,
      occurredAt: '2026-09-01T09:00:00',
      traceId: 'mock-trace-001'
    }
  ] : [],
  batchPlans: [],
  nextIds: {
    users: '3',
    file: '25',
    folder: '6',
    job: '1007',
    printer: '409',
    batchPlan: '1',
    auditLog: '4'
  },
  sessions: {}
})

export const mockState = createSeedData()

export function resetMockState(options = {}) {
  const seed = createSeedData(options)
  Object.keys(mockState).forEach(key => {
    mockState[key] = clone(seed[key])
  })
}

export const normalizeMockId = value => value == null ? null : String(value).trim()

export const sameMockId = (left, right) => {
  const normalizedLeft = normalizeMockId(left)
  const normalizedRight = normalizeMockId(right)
  return normalizedLeft !== null && normalizedLeft === normalizedRight
}

export const sameOptionalMockId = (left, right) => (
  (left == null && right == null) || sameMockId(left, right)
)

export const compareMockIds = (left, right) => {
  const leftId = normalizeMockId(left)
  const rightId = normalizeMockId(right)
  if (leftId === null || rightId === null) return 0
  return BigInt(leftId) < BigInt(rightId) ? -1 : BigInt(leftId) > BigInt(rightId) ? 1 : 0
}

export const isValidMockId = value => {
  const normalized = normalizeMockId(value)
  return Boolean(normalized && /^\d+$/.test(normalized) && BigInt(normalized) > 0n)
}

export function nextMockId(type) {
  const id = normalizeMockId(mockState.nextIds[type])
  if (!isValidMockId(id)) throw new Error(`Mock ID 序列无效: ${type}`)
  mockState.nextIds[type] = (BigInt(id) + 1n).toString()
  return id
}

export function cloneMockData(value) {
  return clone(value)
}
