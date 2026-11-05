import request from '@/utils/request'

// These endpoints belong to the selected local Server and use its administrator session.
export const getCloudConnection = () => request({ url: '/api/v1/cloud/connection', method: 'get', notifyError: false })
export const bindCloudGateway = data => request({ url: '/api/v1/cloud/bind', method: 'post', data, notifyError: false })
export const setCloudReporting = data => request({ url: '/api/v1/cloud/reporting', method: 'put', data, notifyError: false })
export const refreshCloudBinding = revision => request({ url: '/api/v1/cloud/refresh-binding', method: 'post', data: { revision }, notifyError: false })
export const unbindCloudGateway = revision => request({ url: '/api/v1/cloud/unbind', method: 'post', data: { revision }, notifyError: false })
