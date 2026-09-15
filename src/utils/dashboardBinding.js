const hasDeviceId = device => device?.id !== undefined && device?.id !== null

const isUnallocated = device => device?.gridRow == null && device?.gridCol == null

/**
 * 将服务端已保存的未分配设备与当前布局草稿合并。
 * 草稿中的坐标优先，确保刚绑定的设备立即从候选列表消失，刚解除绑定的设备立即出现。
 */
export function mergeDraftAvailableDevices(serverDevices = [], draftDevices = []) {
  const available = new Map()

  ;(Array.isArray(serverDevices) ? serverDevices : []).forEach(device => {
    if (hasDeviceId(device)) available.set(String(device.id), device)
  })

  ;(Array.isArray(draftDevices) ? draftDevices : []).forEach(device => {
    if (!hasDeviceId(device)) return

    const key = String(device.id)
    if (isUnallocated(device)) {
      available.set(key, { ...available.get(key), ...device })
    } else {
      available.delete(key)
    }
  })

  return [...available.values()]
}
