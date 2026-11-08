const ACTION_LABELS = Object.freeze({
  LOGIN: '登录',
  LOGOUT: '退出登录',
  JOB_CREATE: '创建打印任务',
  JOB_CANCEL: '取消打印任务',
  JOB_START: '启动打印任务',
  JOB_RETRY: '重试打印任务',
  JOB_REQUEUE: '重新排队任务',
  PRINTER_CREATE: '新增打印机',
  PRINTER_UPDATE: '更新打印机',
  PRINTER_DELETE: '移除打印机',
  FILE_UPLOAD: '上传文件',
  FILE_DELETE: '删除文件',
  USER_CREATE: '创建用户',
  USER_UPDATE: '更新用户',
  USER_ENABLE: '启用用户',
  USER_DISABLE: '停用用户',
  USER_PASSWORD_RESET: '管理员重置密码',
  USER_PASSWORD_CHANGE: '修改密码',
  USER_FIRST_PASSWORD_CHANGE: '首次修改临时密码',
  USER_ROLE_CHANGE: '调整岗位角色',
  SESSION_REVOKE: '退出登录会话',
  SESSION_REVOKE_ALL: '批量退出登录会话',
  CLOUD_BIND: '绑定云网关',
  CLOUD_PAIR: '扫码配对云网关',
  CLOUD_ENABLE: '开启云端上报',
  CLOUD_DISABLE: '关闭云端上报',
  CLOUD_UNBIND: '解除云网关绑定',
  CLOUD_CONNECTION_CHANGE: '变更云端连接',
  REMOTE_CONTROL_ENABLE: '允许远程暂停',
  REMOTE_CONTROL_DISABLE: '关闭远程暂停',
  REMOTE_PAUSE: '远程暂停打印'
})

const TARGET_LABELS = Object.freeze({
  JOB: '打印任务',
  PRINTER: '打印机',
  FILE: '文件',
  USER: '用户',
  CLOUD_GATEWAY: '云网关',
  REMOTE_COMMAND: '远程操作'
})

export const AUDIT_ACTION_OPTIONS = Object.freeze(
  Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))
)

export const AUDIT_TARGET_OPTIONS = Object.freeze(
  Object.entries(TARGET_LABELS).map(([value, label]) => ({ value, label }))
)

export function getAuditActionLabel(action) {
  const code = String(action || '').trim().toUpperCase()
  return ACTION_LABELS[code] || (code ? '其他操作' : '未记录动作')
}

export function getAuditTargetTypeLabel(targetType) {
  const code = String(targetType || '').trim().toUpperCase()
  return TARGET_LABELS[code] || (code ? '其他资源' : '未指定资源')
}

export function getAuditTargetLabel(log = {}) {
  if (log.targetLabel) return log.targetLabel
  const targetType = getAuditTargetTypeLabel(log.targetType)
  return log.targetId ? `${targetType} #${log.targetId}` : targetType
}

export function getAuditResultView(result) {
  return String(result || '').toUpperCase() === 'SUCCESS'
    ? { label: '成功', theme: 'success' }
    : { label: '失败', theme: 'danger' }
}
