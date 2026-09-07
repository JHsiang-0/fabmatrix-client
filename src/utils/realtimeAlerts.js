/**
 * 将后端冻结的 WebSocket 业务消息转换为可展示的告警。
 * 告警只对明确的离线事件和失败任务生成，避免首次 SNAPSHOT 中的大量离线设备造成告警洪水。
 */
export function toRealtimeAlert(message = {}) {
  const type = message.type
  const printerId = message.printerId
  const data = message.data || {}

  if (type === 'PRINTER_OFFLINE' && printerId !== undefined && printerId !== null) {
    return {
      id: `printer-offline:${printerId}`,
      theme: 'warning',
      title: `打印机 #${printerId} 已离线`,
      message: data.reason || data.message || data.systemMessage || '设备暂时无法连接'
    }
  }

  const jobId = data.jobId ?? message.jobId
  const status = String(data.status || data.currentJobStatus || '').toUpperCase()
  if (type === 'JOB_STATUS' && status === 'FAILED' && jobId !== undefined && jobId !== null) {
    return {
      id: `job-failed:${jobId}`,
      theme: 'danger',
      title: `打印任务 #${jobId} 执行失败`,
      message: data.errorReason || data.message || '任务失败，请查看任务详情'
    }
  }

  return null
}

/**
 * 规范化后端 SNAPSHOT 的 data.printers 结构，兼容早期数组和映射格式。
 */
export function toRealtimeSnapshotEntries(snapshotData) {
  if (Array.isArray(snapshotData?.printers)) {
    return snapshotData.printers
      .filter(printer => printer && typeof printer === 'object')
      .map(printer => ({
        printerId: printer.printerId ?? printer.id,
        data: printer.data && typeof printer.data === 'object' ? printer.data : printer
      }))
      .filter(entry => entry.printerId !== undefined && entry.printerId !== null)
  }

  if (Array.isArray(snapshotData)) {
    return snapshotData
      .filter(entry => entry && typeof entry === 'object')
      .map(entry => ({
        printerId: entry.printerId ?? entry.id,
        data: entry.data && typeof entry.data === 'object' ? entry.data : entry
      }))
      .filter(entry => entry.printerId !== undefined && entry.printerId !== null)
  }

  if (snapshotData && typeof snapshotData === 'object') {
    return Object.entries(snapshotData).map(([printerId, data]) => ({ printerId, data }))
  }

  return []
}

/**
 * 获取状态恢复时需要清除的告警 ID。
 */
export function getRealtimeAlertClearId(message = {}) {
  const type = message.type
  const printerId = message.printerId
  const data = message.data || {}

  const stateSource = String(message.stateSource || data.stateSource || '').toUpperCase()
  const connectionStatus = String(data.connectionStatus || '').toUpperCase()
  if ((type === 'COMMUNICATION_HEALTH' || stateSource === 'COMMUNICATION_HEALTH')
    && connectionStatus === 'ONLINE'
    && printerId !== undefined && printerId !== null) {
    return `printer-offline:${printerId}`
  }

  if (type === 'PRINTER_STATUS' && printerId !== undefined && printerId !== null) {
    const state = String(data.unifiedState || data.state || '').toUpperCase()
    if (state && state !== 'OFFLINE' && state !== 'UNKNOWN') {
      return `printer-offline:${printerId}`
    }
  }

  if (type === 'JOB_STATUS') {
    const jobId = data.jobId ?? message.jobId
    const status = String(data.status || data.currentJobStatus || '').toUpperCase()
    if (jobId !== undefined && jobId !== null && status && status !== 'FAILED') {
      return `job-failed:${jobId}`
    }
  }

  return null
}
