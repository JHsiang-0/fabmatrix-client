const RESULT_STATUSES = ['IDLE', 'RUNNING', 'COMPLETED', 'FAILED']
const ITEM_STATUSES = {
  UPDATED: { label: '地址已更新', theme: 'success' },
  UNCHANGED: { label: '地址未变', theme: 'default' },
  NOT_FOUND: { label: '未找到设备', theme: 'warning' },
  MISSING_MAC: { label: '缺少设备标识', theme: 'warning' },
  UNSUPPORTED_PROTOCOL: { label: '协议暂不支持', theme: 'warning' },
  CONFLICT: { label: '地址或身份冲突', theme: 'danger' },
  SKIPPED: { label: '已跳过', theme: 'warning' }
}

const textValue = value => value == null ? '' : String(value)
const countValue = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0

/** 只保留设备地址同步的公开字段，ID 按字符串处理。 */
export function normalizeRediscoveryResult(data) {
  if (!data || typeof data !== 'object' || !RESULT_STATUSES.includes(data.status)) {
    throw new Error('设备地址同步结果无效，请重新查询')
  }
  return {
    scanId: data.scanId == null ? null : String(data.scanId),
    status: data.status,
    message: textValue(data.message),
    startedAt: data.startedAt ?? null,
    finishedAt: data.finishedAt ?? null,
    subnets: Array.isArray(data.subnets) ? data.subnets.map(textValue) : [],
    scannedAddressCount: countValue(data.scannedAddressCount),
    updatedCount: countValue(data.updatedCount),
    unchangedCount: countValue(data.unchangedCount),
    unresolvedCount: countValue(data.unresolvedCount),
    items: (Array.isArray(data.items) ? data.items : []).map(item => ({
      printerId: textValue(item.printerId),
      printerName: textValue(item.printerName),
      oldIpAddress: item.oldIpAddress == null ? null : textValue(item.oldIpAddress),
      newIpAddress: item.newIpAddress == null ? null : textValue(item.newIpAddress),
      status: textValue(item.status),
      message: textValue(item.message)
    }))
  }
}

export const getRediscoveryItemStatus = status => ITEM_STATUSES[status] || { label: '待核对', theme: 'warning' }

/** 串行轮询，组件卸载/身份失效后忽略在途结果并停止定时器。 */
export function createPrinterRediscoverySession({
  start,
  getStatus,
  canManage,
  onUpdate,
  onPending = () => {},
  onComplete = () => {},
  onError = () => {},
  schedule = setTimeout,
  cancel = clearTimeout
}) {
  let active = true
  let pending = false
  let timer = null
  let latest = null
  let generation = 0
  let completedScanId = null

  const clearTimer = () => {
    if (timer !== null) cancel(timer)
    timer = null
  }

  const isCurrent = id => active && id === generation && canManage()

  const request = async (submit = false) => {
    if (!active || !canManage() || pending || (submit && latest?.status === 'RUNNING')) return
    clearTimer()
    pending = true
    onPending(true)
    const id = ++generation
    try {
      const response = await (submit ? start() : getStatus())
      if (!isCurrent(id)) return
      const result = normalizeRediscoveryResult(response?.data)
      const wasRunning = latest?.status === 'RUNNING'
      latest = result
      onUpdate(result)
      if (result.status === 'COMPLETED' && (submit || wasRunning) && completedScanId !== result.scanId) {
        completedScanId = result.scanId
        onComplete(result)
      }
      if (result.status === 'RUNNING') {
        timer = schedule(() => {
          timer = null
          void request()
        }, 2000)
      }
    } catch (error) {
      if (isCurrent(id)) onError(error)
    } finally {
      if (isCurrent(id)) {
        pending = false
        onPending(false)
      }
    }
  }

  return {
    start: () => request(true),
    resume: () => request(),
    dispose() {
      active = false
      generation += 1
      clearTimer()
    }
  }
}
