const normalizeText = value => String(value ?? '').trim()
const normalizeMac = value => normalizeText(value).toUpperCase().replace(/-/g, ':')
const isIntegerValue = value => value !== null && value !== '' && Number.isInteger(Number(value))

export const createScanDeviceKey = (device, index) => [
  isIntegerValue(index) ? Number(index) : 'unknown',
  normalizeText(device?.ipAddress) || 'no-ip',
  normalizeMac(device?.macAddress) || 'no-mac'
].join('|')

export const getDiscoveryStatus = device => {
  const rawStatus = normalizeText(
    device?.discoveryStatus || device?.discoveryState || device?.status
  ).toUpperCase().replace(/-/g, '_')

  if (rawStatus === 'UNKNOWN_MAC') return { code: 'UNKNOWN_MAC', label: '未知 MAC', theme: 'warning' }
  if (rawStatus === 'NEW' || device?.isNewDevice === true) {
    return { code: 'NEW', label: '新', theme: 'success' }
  }
  if (rawStatus === 'EXISTING' || rawStatus === 'KNOWN' || device?.isNewDevice === false) {
    return { code: 'EXISTING', label: '已知', theme: 'primary' }
  }
  return { code: 'UNKNOWN_MAC', label: '未知 MAC', theme: 'warning' }
}

export const getDiscoveryStats = devices => (Array.isArray(devices) ? devices : []).reduce((stats, device) => {
  const code = getDiscoveryStatus(device).code
  stats.total += 1
  if (code === 'NEW') stats.newCount += 1
  else if (code === 'EXISTING') stats.existingCount += 1
  else stats.unknownCount += 1
  return stats
}, { total: 0, newCount: 0, existingCount: 0, unknownCount: 0 })

const findUnusedItemIndex = (items, usedIndexes, predicate) => items.findIndex((item, index) => (
  !usedIndexes.has(index) && predicate(item)
))

const findBatchItemIndex = (items, usedIndexes, device, submittedIndex) => {
  let itemIndex = findUnusedItemIndex(items, usedIndexes, item => (
    isIntegerValue(item?.index) && Number(item.index) === submittedIndex
  ))
  if (itemIndex >= 0) return itemIndex

  const ipAddress = normalizeText(device?.ipAddress)
  if (ipAddress) {
    itemIndex = findUnusedItemIndex(items, usedIndexes, item => normalizeText(item?.ipAddress) === ipAddress)
    if (itemIndex >= 0) return itemIndex
  }

  const macAddress = normalizeMac(device?.macAddress)
  if (macAddress) {
    itemIndex = findUnusedItemIndex(items, usedIndexes, item => normalizeMac(item?.macAddress) === macAddress)
  }
  return itemIndex
}

export const applyBatchUpsertResult = (scanDevices, submittedDevices, result = {}) => {
  const sourceDevices = Array.isArray(scanDevices) ? scanDevices : []
  const submitted = Array.isArray(submittedDevices) ? submittedDevices : []
  const items = Array.isArray(result?.items) ? result.items : []
  const usedItemIndexes = new Set()
  const resultsByKey = new Map()
  const aggregateHasFailure = Number(result?.failedCount || 0) > 0

  submitted.forEach((device, submittedIndex) => {
    const itemIndex = findBatchItemIndex(items, usedItemIndexes, device, submittedIndex)
    const item = itemIndex >= 0 ? items[itemIndex] : null
    if (itemIndex >= 0) usedItemIndexes.add(itemIndex)
    const success = item ? item.success === true : !aggregateHasFailure
    const reason = normalizeText(item?.reason) || (success ? '处理成功' : '服务端未返回该设备的失败原因')
    resultsByKey.set(device.scanKey, { success, reason })
  })

  const failedKeys = []
  const succeededKeys = []
  const devices = sourceDevices.map(device => {
    const batchResult = resultsByKey.get(device.scanKey)
    if (!batchResult) return device
    if (batchResult.success) succeededKeys.push(device.scanKey)
    else failedKeys.push(device.scanKey)
    return { ...device, batchResult }
  })

  return { devices, failedKeys, succeededKeys }
}
