import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useDeviceStore } from './deviceStore'
import { useRealtimeStore } from './realtimeStore'
import { PRINTER_STATE, PRINTER_STATUS } from '@/utils/constants'
import { getPhysicalColumn, isAisleVisualColumn } from '@/utils/gridLayout'

/**
 * 网格布局计算 Store
 * @description 负责网格布局常量和状态统计
 * @author Cline
 */
export const useGridStore = defineStore('grid', () => {
  // ============================================
  // 依赖其他 Store
  // ============================================

  const deviceStore = useDeviceStore()
  const realtimeStore = useRealtimeStore()

  const gridConfig = computed(() => deviceStore.gridConfig)

  // ============================================
  // Getters (Computed)
  // ============================================

  /**
   * 各状态设备数量统计
   * 基于 WebSocket 实时状态统计
   * @returns {Object} 状态计数对象
   */
  const statusCounts = computed(() => {
    const counts = {
      [PRINTER_STATE.UNKNOWN]: 0,
      [PRINTER_STATE.PRINTING]: 0,
      [PRINTER_STATE.STANDBY]: 0,
      [PRINTER_STATE.PAUSED]: 0,
      [PRINTER_STATE.COMPLETED]: 0,
      [PRINTER_STATE.FAULT]: 0,
      [PRINTER_STATE.SYS_ERROR]: 0,
      [PRINTER_STATE.PRINT_ERROR]: 0,
      [PRINTER_STATE.STARTING]: 0,
      [PRINTER_STATE.CANCELLED]: 0
    }

    const realtimeStatusMap = realtimeStore.statusMap
    const toDashboardState = value => {
      const state = String(value || PRINTER_STATE.UNKNOWN).toUpperCase()
      const stateMap = {
        [PRINTER_STATUS.OFFLINE]: PRINTER_STATE.UNKNOWN,
        [PRINTER_STATUS.UNKNOWN]: PRINTER_STATE.UNKNOWN,
        [PRINTER_STATUS.IDLE]: PRINTER_STATE.STANDBY,
        [PRINTER_STATUS.PREPARING]: PRINTER_STATE.STARTING,
        [PRINTER_STATUS.PRINTING]: PRINTER_STATE.PRINTING,
        [PRINTER_STATUS.PAUSED]: PRINTER_STATE.PAUSED,
        [PRINTER_STATUS.ERROR]: PRINTER_STATE.FAULT
      }
      return stateMap[state] || state
    }

    const addStatus = stateValue => {
      const state = toDashboardState(stateValue)
      if (Object.prototype.hasOwnProperty.call(counts, state)) {
        counts[state]++
      } else {
        counts[PRINTER_STATE.UNKNOWN]++
      }
    }

    // REST 快照提供设备全集，WebSocket 仅覆盖已收到实时事件的设备。
    if (deviceStore.rawDeviceList.length) {
      deviceStore.rawDeviceList.forEach(device => {
        const realtimeStatus = realtimeStatusMap.get(String(device.id))
        addStatus(realtimeStatus?.unifiedState || realtimeStatus?.state || device.status)
      })
    } else {
      // 首次 REST 请求尚未返回时，保留已有实时快照的即时反馈。
      realtimeStatusMap.forEach(status => {
        addStatus(status.unifiedState || status.state)
      })
    }

    return counts
  })

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * 格式化行标签（数字转字母）
   * @param {number} row - 行号（1-based）
   * @returns {string} 行标签（如 A, B, C...）
   */
  function formatRowLabel(row) {
    return String.fromCharCode(65 + row - 1)
  }

  /**
   * 根据网格列号获取物理列号（排除过道）
   * @param {number} gridCol - 网格列号（1-based）
   * @returns {number} 物理列号（1-12）
   */
  function getPhysicalCol(gridCol) {
    return getPhysicalColumn(gridCol, gridConfig.value)
  }

  /**
   * 根据矩阵列索引获取物理列号
   * @param {number} colIndex - 矩阵列索引（0-12）
   * @returns {number} 物理列号（1-12）
   */
  function getPhysicalColByIndex(colIndex) {
    return getPhysicalCol(colIndex + 1)
  }

  /**
   * 判断是否为过道单元格
   * @param {number} colIndex - 列索引（0-based）
   * @returns {boolean} 是否为过道
   */
  function isAisleCell(colIndex) {
    return isAisleVisualColumn(colIndex + 1, gridConfig.value)
  }

  // ============================================
  // Return
  // ============================================

  return {
    // Constants
    GRID_CONFIG: gridConfig,
    gridConfig,

    // Getters
    statusCounts,

    // Utilities
    formatRowLabel,
    getPhysicalCol,
    getPhysicalColByIndex,
    isAisleCell
  }
})
