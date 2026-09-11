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
  const draftBaseVersion = ref(null)
  let layoutLoadGeneration = 0
  let layoutLoadController = null
  let editGeneration = 0
  let refreshGeneration = 0

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

  const isCancelled = error => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'

  async function loadLayout() {
    const generation = ++layoutLoadGeneration
    const editGenerationAtRequest = editGeneration
    layoutLoadController?.abort()
    const abortController = new AbortController()
    layoutLoadController = abortController
    layoutLoading.value = true
    layoutError.value = null
    try {
      const response = await getDashboardLayout({ signal: abortController.signal })
      if (generation !== layoutLoadGeneration) return layoutSnapshot.value
      const hasDraft = draftBaseVersion.value !== null
      // A response that started before editing must not replace the frozen
      // baseline or clear the user's draft after editing has begun.
      if (hasDraft || editGeneration !== editGenerationAtRequest) {
        const serverVersion = response.data?.version ?? null
        if (Number(serverVersion) > Number(draftBaseVersion.value || 0)) {
          layoutConflict.value = {
            reason: 'STALE_DRAFT',
            serverVersion,
            conflicts: [],
            outOfBoundsPrinters: []
          }
        }
        return response.data
      }
      layoutSnapshot.value = response.data
      layoutDraft.value = null
      positionDraft.value = []
      draftBaseVersion.value = null
      layoutConflict.value = null
      return layoutSnapshot.value
    } catch (error) {
      if (generation === layoutLoadGeneration && !isCancelled(error)) layoutError.value = error
      if (isCancelled(error)) return layoutSnapshot.value
      throw error
    } finally {
      if (generation === layoutLoadGeneration) {
        layoutLoading.value = false
        if (layoutLoadController === abortController) layoutLoadController = null
      }
    }
  }

  async function refreshLayout(options = {}) {
    const generation = ++refreshGeneration
    const editGenerationAtRequest = editGeneration
    const latest = await loadLayout()
    if (generation !== refreshGeneration) return layoutSnapshot.value
    if (layoutDraft.value && editGeneration !== editGenerationAtRequest) return latest
    const minimumVersion = Number(options.minimumVersion || 0)
    if (!layoutDraft.value && minimumVersion > 0
      && Number(latest?.version || 0) < minimumVersion) return latest
    await deviceStore.fetchDeviceData()
    if (generation !== refreshGeneration) return layoutSnapshot.value
    return latest
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
      await refreshLayout({ minimumVersion: Number(realtimeStore.layoutVersion || nextVersion) })
    } catch (error) {
      if (!isCancelled(error)) layoutError.value = error
    }
  }

  async function recoverAfterRealtimeReconnect() {
    if (!layoutSnapshot.value) return
    try {
      if (layoutDraft.value) await loadLayout()
      else await refreshLayout()
    } catch (error) {
      if (!isCancelled(error)) layoutError.value = error
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

  function startLayoutEdit() {
    if (!layoutSnapshot.value) return null
    editGeneration++
    layoutDraft.value = clone(layoutSnapshot.value)
    draftBaseVersion.value = layoutSnapshot.value.version
    layoutConflict.value = null
    layoutError.value = null
    return layoutDraft.value
  }

  const beginLayoutEdit = startLayoutEdit

  function updateLayoutDraft(patch) {
    if (!layoutDraft.value) startLayoutEdit()
    if (!layoutDraft.value || !patch || typeof patch !== 'object') return layoutDraft.value
    layoutDraft.value = { ...layoutDraft.value, ...clone(patch) }
    return layoutDraft.value
  }

  function setPositionDraft(changes) {
    positionDraft.value = clone(Array.isArray(changes) ? changes : [])
    return positionDraft.value
  }

  function discardLayoutEdit() {
    editGeneration++
    layoutDraft.value = null
    positionDraft.value = []
    draftBaseVersion.value = null
    layoutConflict.value = null
    layoutError.value = null
  }

  async function cancelLayoutEdit(options = {}) {
    const shouldReload = options.reloadStale !== false
      && layoutConflict.value?.reason === 'STALE_DRAFT'
    discardLayoutEdit()
    if (shouldReload) return refreshLayout()
    return layoutSnapshot.value
  }

  async function saveLayoutDraft(changes = positionDraft.value, overflowPolicy = 'REJECT') {
    if (!layoutSnapshot.value || !layoutDraft.value || draftBaseVersion.value === null) return null
    if (layoutConflict.value?.reason === 'STALE_DRAFT') {
      const staleError = new Error('布局草稿已过期，请重新载入后再保存')
      staleError.code = 409
      staleError.status = 409
      staleError.data = layoutConflict.value
      throw staleError
    }
    layoutSaving.value = true
    layoutError.value = null
    try {
      const draft = normalizeDraftForRequest(activeLayout.value)
      const response = await saveDashboardLayout({
        expectedVersion: draftBaseVersion.value,
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
      draftBaseVersion.value = null
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
    draftBaseVersion,
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
    refreshLayout,
    beginLayoutEdit,
    startLayoutEdit,
    updateLayoutDraft,
    setPositionDraft,
    discardLayoutEdit,
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
