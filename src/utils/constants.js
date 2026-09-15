/**
 * 全局常量定义
 * @module utils/constants
 */

// ============================================
// HTTP 状态码
// ============================================

/**
 * HTTP 状态码常量
 * @constant {Object}
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
}

// ============================================
// 业务状态码
// ============================================

/**
 * 业务状态码常量
 * @constant {Object}
 */
export const BUSINESS_CODE = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  ERROR: 500,
  PRINTER_OFFLINE: 10001,
  PRINTER_BUSY: 10002,
  DATABASE_ERROR: 5001,
  REDIS_ERROR: 5002,
  STORAGE_ERROR: 5003,
  DEVICE_NETWORK_ERROR: 5004
}

/**
 * 统一错误提示兜底文案。
 * @constant {Object}
 */
export const ERROR_MESSAGE_MAP = Object.freeze({
  [BUSINESS_CODE.BAD_REQUEST]: '请求参数错误，请检查后重试',
  [BUSINESS_CODE.UNAUTHORIZED]: '登录已过期，请重新登录',
  [BUSINESS_CODE.FORBIDDEN]: '当前账号没有执行此操作的权限',
  [BUSINESS_CODE.NOT_FOUND]: '请求的资源不存在',
  [BUSINESS_CODE.CONFLICT]: '当前资源存在冲突，请刷新后重试',
  [BUSINESS_CODE.UNPROCESSABLE_ENTITY]: '当前状态不允许执行此操作',
  [BUSINESS_CODE.ERROR]: '服务器内部错误，请稍后重试',
  [BUSINESS_CODE.PRINTER_OFFLINE]: '打印机当前离线或不可用',
  [BUSINESS_CODE.PRINTER_BUSY]: '打印机当前忙碌，请稍后重试',
  [BUSINESS_CODE.DATABASE_ERROR]: '数据库服务异常，请稍后重试',
  [BUSINESS_CODE.REDIS_ERROR]: '缓存服务异常，请稍后重试',
  [BUSINESS_CODE.STORAGE_ERROR]: '文件存储服务异常，请稍后重试',
  [BUSINESS_CODE.DEVICE_NETWORK_ERROR]: '打印设备网络异常，请检查设备连接'
})

// ============================================
// 打印机状态
// ============================================

/**
 * PrinterVO 与实时设备状态共用的正式状态集合。
 * ONLINE 不是后端持久化状态；连接状态应由实时连接生命周期单独表达。
 * @constant {Object}
 */
export const PRINTER_STATUS = Object.freeze({
  OFFLINE: 'OFFLINE',
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  PRINTING: 'PRINTING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  UNKNOWN: 'UNKNOWN'
})

export const PRINTER_STATUS_VALUES = Object.freeze(Object.values(PRINTER_STATUS))

/**
 * 正式打印机状态映射。页面、Mock 和实时状态适配应优先使用此映射。
 * @constant {Object}
 */
export const PRINTER_STATUS_MAP = Object.freeze({
  [PRINTER_STATUS.OFFLINE]: { label: '离线', type: 'default', level: 'unknown', icon: 'QuestionFilled' },
  [PRINTER_STATUS.IDLE]: { label: '待机', type: 'default', level: 'normal', icon: 'Coffee' },
  [PRINTER_STATUS.PREPARING]: { label: '准备中', type: 'warning', level: 'warning', icon: 'Loading' },
  [PRINTER_STATUS.PRINTING]: { label: '打印中', type: 'primary', level: 'normal', icon: 'VideoPlay' },
  [PRINTER_STATUS.PAUSED]: { label: '已暂停', type: 'warning', level: 'warning', icon: 'VideoPause' },
  [PRINTER_STATUS.ERROR]: { label: '故障', type: 'danger', level: 'fatal', icon: 'CircleCloseFilled' },
  [PRINTER_STATUS.UNKNOWN]: { label: '未知', type: 'default', level: 'unknown', icon: 'QuestionFilled' }
})

/**
 * 打印机设备状态常量 - 后端 WebSocket 推送的标准状态
 * @constant {Object}
 * @deprecated 旧版页面使用的聚合状态，仅用于迁移期间兼容；新的 REST/WS/Mock 数据使用 PRINTER_STATUS。
 */
export const PRINTER_STATE = Object.freeze({
  // ⚪ 未知/离线状态 (Unknown)
  UNKNOWN: 'UNKNOWN',       // 初始状态/离线断连状态

  // 🔴 致命级 (Danger)
  FAULT: 'FAULT',           // 设备故障 - 底层硬件/热失控急停
  SYS_ERROR: 'SYS_ERROR',   // 系统错误 - 配置或通讯崩溃

  // 🟡 警告/关注级 (Warning)
  PRINT_ERROR: 'PRINT_ERROR', // 打印中断 - 当前模型任务出错，机器本身健康
  STARTING: 'STARTING',       // 启动中
  PAUSED: 'PAUSED',           // 已暂停

  // 🔵 正常业务级 (Primary/Success/Info)
  PRINTING: 'PRINTING',     // 打印中
  COMPLETED: 'COMPLETED',   // 已完成
  STANDBY: 'STANDBY',       // 待机
  CANCELLED: 'CANCELLED'    // 已取消
})

/**
 * 打印机状态映射配置 - UX 故障分级优化
 * 按照工业级 UX 标准映射 TDesign 的主题颜色和中文文本
 * @constant {Object}
 */
export const PRINTER_STATE_MAP = Object.freeze({
  // ⚪ 未知/离线状态
  [PRINTER_STATE.UNKNOWN]: { label: '离线', type: 'default', level: 'unknown', icon: 'QuestionFilled' },

  // 🔴 致命级 (Danger)
  [PRINTER_STATE.FAULT]: { label: '硬件故障', type: 'danger', level: 'fatal', icon: 'CircleCloseFilled' },
  [PRINTER_STATE.SYS_ERROR]: { label: '系统错误', type: 'danger', level: 'fatal', icon: 'WarningFilled' },

  // 🟡 警告/关注级 (Warning)
  [PRINTER_STATE.PRINT_ERROR]: { label: '打印错误', type: 'warning', level: 'warning', icon: 'WarnTriangleFilled' },
  [PRINTER_STATE.STARTING]: { label: '启动中', type: 'warning', level: 'warning', icon: 'Loading' },
  [PRINTER_STATE.PAUSED]: { label: '已暂停', type: 'warning', level: 'warning', icon: 'VideoPause' },

  // 🔵 正常业务级
  [PRINTER_STATE.PRINTING]: { label: '打印中', type: 'primary', level: 'normal', icon: 'VideoPlay' },
  [PRINTER_STATE.COMPLETED]: { label: '已完成', type: 'success', level: 'normal', icon: 'SuccessFilled' },
  [PRINTER_STATE.STANDBY]: { label: '待机', type: 'default', level: 'normal', icon: 'Coffee' },
  [PRINTER_STATE.CANCELLED]: { label: '已取消', type: 'default', level: 'normal', icon: 'RemoveFilled' }
})

/**
 * 需要显示错误警报的状态列表
 * @constant {Array<string>}
 */
export const ERROR_ALERT_STATES = [
  PRINTER_STATE.FAULT,
  PRINTER_STATE.SYS_ERROR,
  PRINTER_STATE.PRINT_ERROR
]

/**
 * 进度状态映射
 * @constant {Object}
 */
export const PROGRESS_STATUS_MAP = {
  // exception - 红色（致命错误）
  [PRINTER_STATE.FAULT]: 'exception',
  [PRINTER_STATE.SYS_ERROR]: 'exception',

  // success - 绿色（完成）
  [PRINTER_STATE.COMPLETED]: 'success',

  // warning - 黄色（警告状态）
  [PRINTER_STATE.PRINT_ERROR]: 'warning',
  [PRINTER_STATE.PAUSED]: 'warning',
  [PRINTER_STATE.STARTING]: 'warning'
}

// ============================================
// 任务状态
// ============================================

/**
 * 打印任务状态常量
 * @constant {Object}
 */
export const JOB_STATUS = Object.freeze({
  QUEUED: 'QUEUED',
  ASSIGNED: 'ASSIGNED',
  UPLOADING: 'UPLOADING',
  READY: 'READY',
  PRINTING: 'PRINTING',
  PAUSED: 'PAUSED',
  RECONCILING: 'RECONCILING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
})

export const JOB_STATUS_VALUES = Object.freeze(Object.values(JOB_STATUS))

/**
 * 正式任务状态映射，供任务页面和实时任务事件共享文案与颜色。
 * @constant {Object}
 */
export const JOB_STATUS_MAP = Object.freeze({
  [JOB_STATUS.QUEUED]: { label: '排队中', type: 'default' },
  [JOB_STATUS.ASSIGNED]: { label: '已分配', type: 'primary' },
  [JOB_STATUS.UPLOADING]: { label: '上传中', type: 'warning' },
  [JOB_STATUS.READY]: { label: '待启动', type: 'success' },
  [JOB_STATUS.PRINTING]: { label: '打印中', type: 'primary' },
  [JOB_STATUS.PAUSED]: { label: '已暂停', type: 'warning' },
  [JOB_STATUS.RECONCILING]: { label: '核对中', type: 'warning' },
  [JOB_STATUS.COMPLETED]: { label: '已完成', type: 'success' },
  [JOB_STATUS.FAILED]: { label: '失败', type: 'danger' },
  [JOB_STATUS.CANCELLED]: { label: '已取消', type: 'default' }
})

/**
 * 任务优先级常量
 * @constant {Object}
 */
export const JOB_PRIORITY = {
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW'
}

// ============================================
// 网格布局配置
// ============================================

/**
 * 工厂网格布局配置
 * @constant {Object}
 */
export const GRID_CONFIG = {
  ROWS: 4,
  COLS: 12, // 实际设备列数
  TOTAL_COLS: 13, // 包含过道的总列数
  AISLE_COL: 8, // 过道在第8列（视觉位置，1-based）
  AISLE_COL_INDEX: 7, // 过道列的数组索引（0-based）
  CELL_HEIGHT: 140, // 单元格高度（px）
  CELL_MIN_WIDTH: 100 // 单元格最小宽度（px）
}

// ============================================
// ASCII 码
// ============================================

/**
 * ASCII 码常量
 * @constant {Object}
 */
export const ASCII = {
  UPPER_A: 65, // 'A' 的 ASCII 码
  UPPER_Z: 90  // 'Z' 的 ASCII 码
}

// ============================================
// 分页配置
// ============================================

/**
 * 默认分页配置
 * @constant {Object}
 */
export const PAGINATION = {
  DEFAULT_PAGE_NUM: 1,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
}

// ============================================
// 请求配置
// ============================================

/**
 * 请求超时配置（毫秒）
 * @constant {Object}
 */
export const REQUEST_TIMEOUT = {
  DEFAULT: 10000,
  DEVICE_BATCH: 2 * 60 * 1000, // 局域网设备批量导入/同步最多等待 2 分钟
  UPLOAD: 30 * 60 * 1000, // 上传文件超时时间（30分钟）
  DOWNLOAD: 30000 // 下载文件超时时间
}

// ============================================
// 耗材类型
// ============================================

/**
 * 支持的耗材类型
 * @constant {Array<string>}
 */
export const MATERIAL_TYPES = ['PLA', 'ABS', 'PETG', 'TPU', 'ASA', 'PC', 'Nylon']

/**
 * 喷头尺寸选项
 * @constant {Array<string>}
 */
export const NOZZLE_SIZES = ['0.4', '0.6', '0.8']

// ============================================
// 固件类型
// ============================================

/**
 * 支持的固件类型
 * @constant {Array<string>}
 */
export const FIRMWARE_TYPES = Object.freeze(['KLIPPER', 'RRF'])
