import request from '@/utils/request'
import { mapResponseData, normalizeId } from '@/utils/dataAdapters'
import { normalizeLayout } from '@/utils/gridLayout'

export const normalizeDashboardPosition = position => {
  if (!position || typeof position !== 'object') return position
  return {
    ...position,
    printerId: normalizeId(position.printerId),
    gridRow: position.gridRow ?? null,
    gridCol: position.gridCol ?? null
  }
}

export const normalizeDashboardLayout = data => normalizeLayout(data)

export const normalizeDashboardSaveResult = data => {
  if (!data || typeof data !== 'object') return data
  return {
    ...data,
    layout: normalizeDashboardLayout(data.layout),
    changedPositions: Array.isArray(data.changedPositions)
      ? data.changedPositions.map(normalizeDashboardPosition)
      : [],
    unallocatedPrinters: Array.isArray(data.unallocatedPrinters)
      ? data.unallocatedPrinters.map(normalizeDashboardPosition)
      : []
  }
}

export function getDashboardLayout(options = {}) {
  return request({
    url: '/api/v1/dashboard-layout',
    method: 'get',
    ...options
  }).then(response => mapResponseData(response, normalizeDashboardLayout))
}

export function saveDashboardLayout(payload) {
  return request({
    url: '/api/v1/dashboard-layout',
    method: 'put',
    data: payload
  }).then(response => mapResponseData(response, normalizeDashboardSaveResult))
}
