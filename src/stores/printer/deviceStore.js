import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getPrinterDetail, getPrinterList, batchUpdatePositions, updatePrinter } from '@/api/printer'
import {
  createGridConfig,
  getDefaultGridConfig,
  getVisualColumns,
  getVisualRows,
  loadGridConfig,
  saveGridConfig
} from '@/utils/gridLayout'

const MAX_DETAIL_CACHE_SIZE = 100

/**
 * 设备数据管理 Store
 * @description 负责打印机设备的基础数据管理（CRUD、位置更新）
 */
export const useDeviceStore = defineStore('device', () => {
  // ============================================
  // State
  // ============================================

  /** 原始设备数据列表 */
  const rawDeviceList = ref([])

  /** 加载状态 */
  const loading = ref(false)

  /** 最近一次打印机快照请求错误，供看板原位恢复使用 */
  const error = ref(null)

  /** 数据版本号 */
  const version = ref(0)

  const gridConfig = ref(loadGridConfig())

  /** 按 ID 缓存后端返回的 PrinterVO 详情 */
  const detailsById = ref(new Map())

  /** 详情请求状态 */
  const detailLoading = ref(false)

  function cacheDeviceDetail(detail) {
    const key = String(detail.id)
    const nextDetails = new Map(detailsById.value)
    nextDetails.delete(key)
    nextDetails.set(key, detail)
    while (nextDetails.size > MAX_DETAIL_CACHE_SIZE) {
      nextDetails.delete(nextDetails.keys().next().value)
    }
    detailsById.value = nextDetails
  }

  // ============================================
  // Getters (Computed)
  // ============================================

  /**
   * 设备 ID 映射表，用于快速查找 O(1)
   */
  const deviceById = computed(() => {
    const map = new Map()
    rawDeviceList.value.forEach(device => {
      map.set(String(device.id), device)
    })
    return map
  })

  /**
   * 设备总数
   */
  const totalDevices = computed(() => rawDeviceList.value.length)

  /**
   * 将扁平设备数组转换为包含行列过道的二维视觉矩阵
   * 直接依赖 rawDeviceList.value，确保数据更新后自动重新计算
   */
  const deviceMatrix = computed(() => {
    const config = gridConfig.value
    // 使用 Map 优化查找性能 O(n) -> O(1)
    const deviceMap = new Map()
    rawDeviceList.value.forEach(device => {
      if (typeof device.gridRow !== 'number' || device.gridRow <= 0
        || typeof device.gridCol !== 'number' || device.gridCol <= 0) return
      const key = `${device.gridRow},${device.gridCol}`
      deviceMap.set(key, device)
    })

    const visualColumns = getVisualColumns(config)
    const visualRows = getVisualRows(config)
    const matrix = []
    visualRows.forEach(visualRow => {
      const rowData = []
      visualColumns.forEach(column => {
        if (visualRow.type === 'aisle' || column.type === 'aisle') {
          rowData.push(`aisle:${visualRow.id || column.id}`)
          return
        }

        const key = `${visualRow.number},${column.number}`
        rowData.push(deviceMap.get(key) || null)
      })
      matrix.push(rowData)
    })

    return matrix
  })

  // ============================================
  // Actions
  // ============================================

  /**
   * 获取设备数据
   * @description 从 API 获取打印机列表，并过滤掉无效坐标的设备
   */
  async function fetchDeviceData() {
    loading.value = true
    error.value = null
    try {
      const response = await getPrinterList({ pageSize: 100 })
      const records = response.data?.records || []

      // 保留完整 REST 快照供统计使用，deviceMatrix 内部只渲染有效坐标设备。
      rawDeviceList.value = records
      version.value++
    } catch (requestError) {
      console.error('[DeviceStore] 获取设备数据失败:', requestError)
      error.value = requestError
      throw requestError
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取真实打印机详情并缓存，失败时不以列表行或伪造温度替代。
   */
  async function fetchDeviceDetail(deviceId) {
    detailLoading.value = true
    try {
      const response = await getPrinterDetail(deviceId)
      const detail = response?.data || null
      if (detail) {
        cacheDeviceDetail(detail)
      }
      return detail
    } finally {
      detailLoading.value = false
    }
  }

  /**
   * 批量更新设备位置
   */
  async function updatePositions(payload) {
    await batchUpdatePositions(payload)
    await fetchDeviceData()
  }

  /**
   * 更新单个打印机信息
   */
  async function updateDevice(data) {
    await updatePrinter(data)
    await fetchDeviceData()
  }

  function updateGridConfig(config) {
    gridConfig.value = saveGridConfig(createGridConfig(config))
    return gridConfig.value
  }

  function resetGridConfig() {
    gridConfig.value = saveGridConfig(getDefaultGridConfig())
    return gridConfig.value
  }

  /**
   * 从看板移除设备（设置 gridRow/gridCol 为 null）
   */
  async function removeDeviceFromBoard(deviceId) {
    const payload = [{
      id: deviceId,
      gridRow: null,
      gridCol: null
    }]
    await updatePositions(payload)
  }

  /**
   * 根据 ID 获取设备
   */
  function getDeviceById(deviceId) {
    return deviceById.value.get(String(deviceId))
  }

  // ============================================
  // Return
  // ============================================

  return {
    // State
    rawDeviceList,
    loading,
    error,
    version,
    gridConfig,
    detailsById,
    detailLoading,

    // Getters
    deviceById,
    totalDevices,
    deviceMatrix,

    // Actions
    fetchDeviceData,
    fetchDeviceDetail,
    updatePositions,
    updateDevice,
    updateGridConfig,
    resetGridConfig,
    removeDeviceFromBoard,
    getDeviceById
  }
})
