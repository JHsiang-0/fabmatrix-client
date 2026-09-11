import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useDeviceStore } from './deviceStore'
import { useRealtimeStore } from './realtimeStore'
import { PRINTER_STATE, PRINTER_STATUS } from '@/utils/constants'
import { getDashboardLayout, saveDashboardLayout } from '@/api/dashboardLayout'
import {
  analyzeDevicePositions,
  calculateGridFit,
  createGridConfig,
  formatGridRowLabel,
  getDefaultGridConfig,
  getPhysicalColumn,
  getPhysicalRow,
  isAisleVisualColumn,
  isAisleVisualRow
} from '@/utils/gridLayout'

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value))

export const useGridStore = defineStore('grid', () => {
  const deviceStore = useDeviceStore()
  const realtimeStore = useRealtimeStore()
  const layoutSnapshot = ref(null)
  const layoutDraft = ref(null)
  const layoutLoading = ref(false)
  const layoutSaving = ref(false)
  const layoutError = ref(null)
  const layoutConflict = ref(null)
  const positionDraft = ref([])
  let layoutLoadGeneration = 0

  const activeLayout = computed(() => layoutDraft.value || layoutSnapshot.value)
  const layoutVersion = computed(() => layoutSnapshot.value?.version ?? null)
  const layoutLimits = computed(() => layoutSnapshot.value?.limits ?? null)
  const layoutDirty = computed(() => Boolean(layoutDraft.value)
    && JSON.stringify(layoutDraft.value) !== JSON.stringify(layoutSnapshot.value))
  const gridConfig = computed(() => createGridConfig(activeLayout.value || getDefaultGridConfig()))
  const invalidPositionDevices = computed(() => analyzeDevicePositions(deviceStore.rawDeviceList, gridConfig.value))

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
    const statusMap = realtimeStore.statusMap
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
    const addStatus = value => {
      const state = toDashboardState(value)
      if (Object.prototype.hasOwnProperty.call(counts, state)) counts[state]++
      else counts[PRINTER_STATE.UNKNOWN]++
    }
    if (deviceStore.rawDeviceList.length) {
      deviceStore.rawDeviceList.forEach(device => {
        const realtimeStatus = statusMap.get(String(device.id))
        addStatus(realtimeStatus?.unifiedState || realtimeStatus?.state || device.status)
      })
    } else {
      statusMap.forEach(status => addStatus(status.unifiedState || status.state))
    }
    return counts
  })

  async function loadLayout() {
    const generation = ++layoutLoadGeneration
    layoutLoading.value = true
    layoutError.value = null
    try {
      const response = await getDashboardLayout()
      if (generation !== layoutLoadGeneration) return layoutSnapshot.value
      const hasDraft = Boolean(layoutDraft.value)
      layoutSnapshot.value = response.data
      if (hasDraft) {
        layoutConflict.value = {
          reason: 'STALE_DRAFT',
          serverVersion: response.data?.version ?? null,
          conflicts: [],
          outOfBoundsPrinters: []
        }
      } else {
        layoutDraft.value = null
        positionDraft.value = []
        layoutConflict.value = null
      }
      return layoutSnapshot.value
    } catch (error) {
      if (generation === layoutLoadGeneration) layoutError.value = error
      throw error
    } finally {
      if (generation === layoutLoadGeneration) layoutLoading.value = false
    }
  }

  async function reconcileLayoutEvent(nextVersion) {
    if (!layoutSnapshot.value || nextVersion <= Number(layoutSnapshot.value.version || 0)) return
    if (layoutDraft.value) {
      layoutConflict.value = {
        reason: 'STALE_DRAFT',
        serverVersion: nextVersion,
        conflicts: [],
        outOfBoundsPrinters: []
      }
      return
    }
    try {
      await loadLayout()
      await deviceStore.fetchDeviceData()
    } catch (error) {
      layoutError.value = error
    }
  }

  async function recoverAfterRealtimeReconnect() {
    if (!layoutSnapshot.value) return
    try {
      const response = await getDashboardLayout()
      const latest = response.data
      if (latest.version > Number(layoutSnapshot.value.version || 0)) {
        if (layoutDraft.value) {
          layoutConflict.value = {
            reason: 'STALE_DRAFT',
            serverVersion: latest.version,
            conflicts: [],
            outOfBoundsPrinters: []
          }
        } else {
          layoutSnapshot.value = latest
        }
      }
      if (!layoutDraft.value) await deviceStore.fetchDeviceData()
    } catch (error) {
      layoutError.value = error
    }
  }

  watch(() => realtimeStore.layoutVersion, nextVersion => {
    const version = Number(nextVersion)
    if (Number.isInteger(version) && version > 0) void reconcileLayoutEvent(version)
  })

  watch(() => realtimeStore.wsConnectionState, (state, previousState) => {
    if (state === 'OPEN' && previousState && previousState !== 'OPEN') {
      void recoverAfterRealtimeReconnect()
    }
  })

  function beginLayoutEdit() {
    if (!layoutSnapshot.value) return null
    layoutDraft.value = clone(layoutSnapshot.value)
    layoutConflict.value = null
    layoutError.value = null
    return layoutDraft.value
  }

  function updateLayoutDraft(patch) {
    if (!layoutDraft.value) beginLayoutEdit()
    if (!layoutDraft.value || !patch || typeof patch !== 'object') return layoutDraft.value
    layoutDraft.value = { ...layoutDraft.value, ...clone(patch) }
    return layoutDraft.value
  }

  function setPositionDraft(changes) {
    positionDraft.value = clone(Array.isArray(changes) ? changes : [])
    return positionDraft.value
  }

  function cancelLayoutEdit() {
    layoutDraft.value = null
    positionDraft.value = []
    layoutConflict.value = null
    layoutError.value = null
  }

  async function saveLayoutDraft(changes = positionDraft.value, overflowPolicy = 'REJECT') {
    if (!layoutSnapshot.value || !activeLayout.value) return null
    layoutSaving.value = true
    layoutError.value = null
    try {
      const draft = normalizeDraftForRequest(activeLayout.value)
      const response = await saveDashboardLayout({
        expectedVersion: layoutSnapshot.value.version,
        ...draft,
        overflowPolicy,
        positionChanges: (Array.isArray(changes) ? changes : []).map(change => ({
          printerId: change?.printerId ?? change?.id,
          gridRow: change?.gridRow ?? null,
          gridCol: change?.gridCol ?? null
        }))
      })
      layoutSnapshot.value = response.data.layout
      layoutDraft.value = null
      positionDraft.value = []
      layoutConflict.value = null
      return response.data
    } catch (error) {
      layoutError.value = error
      if (Number(error?.status || error?.code) === 409) {
        layoutConflict.value = error.data || error.response?.data?.data || null
      }
      throw error
    } finally {
      layoutSaving.value = false
    }
  }

  function normalizeDraftForRequest(layout) {
    return {
      rowCount: layout.rowCount,
      columnCount: layout.columnCount,
      aisles: (layout.aisles || []).map(aisle => ({
        id: aisle.id,
        axis: aisle.axis,
        afterIndex: aisle.afterIndex,
        label: aisle.label,
        size: aisle.size
      }))
    }
  }

  return {
    layoutSnapshot,
    layoutDraft,
    layoutVersion,
    layoutLimits,
    layoutLoading,
    layoutSaving,
    layoutError,
    layoutConflict,
    layoutDirty,
    positionDraft,
    gridConfig,
    GRID_CONFIG: gridConfig,
    invalidPositionDevices,
    statusCounts,
    loadLayout,
    refreshLayout: loadLayout,
    beginLayoutEdit,
    updateLayoutDraft,
    setPositionDraft,
    cancelLayoutEdit,
    saveLayoutDraft,
    formatRowLabel: formatGridRowLabel,
    getPhysicalCol: visualColumn => getPhysicalColumn(visualColumn, gridConfig.value),
    getPhysicalColByIndex: index => getPhysicalColumn(index + 1, gridConfig.value),
    getPhysicalRowByIndex: index => getPhysicalRow(index + 1, gridConfig.value),
    isAisleCell: index => isAisleVisualColumn(index + 1, gridConfig.value),
    isAisleRowCell: index => isAisleVisualRow(index + 1, gridConfig.value),
    calculateGridFit: viewport => calculateGridFit(gridConfig.value, viewport)
  }
})
