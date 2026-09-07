/**
 * Printer Store 组合导出
 * @description 将 deviceStore、realtimeStore、gridStore 组合为统一的 usePrinterStore API
 * 保持与原有 printerStore.js 的 API 兼容性
 */

import { storeToRefs } from 'pinia'
import { reactive, computed } from 'vue'
import { useDeviceStore } from './deviceStore'
import { useRealtimeStore } from './realtimeStore'
import { useGridStore } from './gridStore'

/**
 * 组合式 Printer Store
 * @description 统一导出所有 printer 相关状态和方法，保持向下兼容
 *
 * 关键说明：
 * - 使用 storeToRefs() 提取 Pinia store 的响应式 refs
 * - 直接用 device.someRef 或 computed(() => device.someRef) 无法正确追踪 Pinia 内部 ref 的变化
 * - storeToRefs() 会为每个 state/getter 创建一个正确的响应式 ref
 *
 * @returns {Object} 组合后的 Store 对象
 */
export function usePrinterStore() {
  const device = useDeviceStore()
  const realtime = useRealtimeStore()
  const grid = useGridStore()

  // ============================================
  // 使用 storeToRefs 正确提取响应式状态
  // 这样 rawDeviceList、deviceMatrix 等 ref 才能正确追踪 Pinia 内部状态变化
  // ============================================
  const {
    rawDeviceList,
    loading,
    error: deviceError,
    version,
    deviceById,
    totalDevices,
    deviceMatrix,
  } = storeToRefs(device)

  const {
    wsConnectionState,
    isWsConnected,
    alerts,
    isRealtimeStale,
    isRecovering,
  } = storeToRefs(realtime)

  // realTimeStatus 是 computed 返回的 Proxy，不是 ref，需要特殊处理
  const realTimeStatusRef = computed(() => realtime.realTimeStatus)

  const {
    statusCounts,
    gridConfig,
  } = storeToRefs(grid)

  // ============================================
  // 使用 reactive() 包裹返回对象，确保 refs 自动解包
  // 这样 store.deviceMatrix 直接是数组，不需要 .value
  // 模板中也能正确使用，watch(() => store.deviceMatrix) 也能正确追踪
  // ============================================
  return reactive({
    // ============================================
    // State refs (来自 deviceStore - 通过 storeToRefs 保持响应式)
    // ============================================
    rawDeviceList,
    loading,
    deviceError,
    version,

    // ============================================
    // Getters refs (来自 deviceStore - 通过 storeToRefs 保持响应式)
    // ============================================
    deviceById,
    totalDevices,
    deviceMatrix,

    // ============================================
    // State refs (来自 realtimeStore)
    // ============================================
    realTimeStatus: realTimeStatusRef,
    wsConnectionState,
    isWsConnected,
    alerts,
    isRealtimeStale,
    isRecovering,

    // ============================================
    // Getters (来自 gridStore)
    // ============================================
    statusCounts,

    // ============================================
    // Constants (来自 gridStore) - 非响应式
    // ============================================
    GRID_CONFIG: gridConfig,
    gridConfig,

    // ============================================
    // Actions (来自 deviceStore) - 非响应式函数
    // ============================================
    fetchDeviceData: device.fetchDeviceData,
    updateDevicePositions: device.updatePositions,
    updateDevice: device.updateDevice,
    updateGridConfig: device.updateGridConfig,
    resetGridConfig: device.resetGridConfig,
    removeDeviceFromBoard: device.removeDeviceFromBoard,
    getDeviceById: device.getDeviceById,

    // ============================================
    // Actions (来自 realtimeStore)
    // ============================================
    connectWs: realtime.connectWs,
    disconnectWs: realtime.disconnectWs,
    getDeviceRealTimeStatus: realtime.getDeviceRealTimeStatus,
    clearRealTimeStatus: realtime.clearRealTimeStatus,
    dismissAlert: realtime.dismissAlert,

    // ============================================
    // Utilities (来自 gridStore)
    // ============================================
    formatRowLabel: grid.formatRowLabel,
    getPhysicalCol: grid.getPhysicalCol,
    getPhysicalColByIndex: grid.getPhysicalColByIndex,
    isAisleCell: grid.isAisleCell,

    // ============================================
    // 初始化/清理方法
    // ============================================

    /**
     * 初始化打印机数据并连接 WebSocket
     */
    async initialize() {
      await device.fetchDeviceData()
      realtime.connectWs()
    },

    /**
     * 清理所有资源
     */
    destroy() {
      realtime.disconnectWs()
    }
  })
}

// 默认导出保持兼容
export default usePrinterStore

// 单独导出子 Store，供高级使用场景
export { useDeviceStore, useRealtimeStore, useGridStore }
