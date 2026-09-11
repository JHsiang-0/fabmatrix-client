import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getPrinterDetail, getPrinterList, batchUpdatePositions, updatePrinter } from '@/api/printer'
import { collectAllPages } from '@/utils/pagination'

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
   * 兼容旧调用方的扁平设备集合。
   * 网格矩阵必须由 gridStore 的服务端布局配置计算，不能在设备 Store
   * 内按固定 4×13 轨道生成；保留该字段只为旧组件过渡。
   */
  const deviceMatrix = computed(() => rawDeviceList.value)

  // ============================================
  // Actions
  // ============================================

  /**
   * 获取全部设备数据。
   * @description 看板必须保留未分配、半空、重复和越界坐标，交由布局层生成异常清单。
   */
  async function fetchDeviceData() {
    loading.value = true
    error.value = null
    try {
      const firstPage = await getPrinterList({ pageNum: 1, pageSize: 100 })
      const records = await collectAllPages(
        (pageNum, pageSize) => getPrinterList({ pageNum, pageSize }),
        firstPage
      )

      // 直接赋值，触发 rawDeviceList 的响应式更新；异常位置不能在这里静默丢弃。
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
    removeDeviceFromBoard,
    getDeviceById
  }
})
