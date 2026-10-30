import { createCloudTransport } from '@/utils/request'

const transport = createCloudTransport()

const execute = async (baseURL, token, method, url, data, signal) => {
  try {
    const response = await transport.request({ baseURL, method, url, data, signal,
      headers: { Authorization: token ? `Bearer ${token}` : null } })
    return response.data
  } catch (error) {
    if (error?.code === 'ERR_CANCELED') {
      const canceled = new Error('Cloud request canceled')
      canceled.name = 'CanceledError'
      throw canceled
    }
    // Do not propagate Axios config objects containing cloud tokens or login passwords.
    const sanitized = new Error('Cloud request failed')
    sanitized.status = Number(error?.response?.status || 0)
    throw sanitized
  }
}

export const cloudApi = {
  login: (baseURL, username, password, signal) => execute(baseURL, '', 'post', '/api/v1/auth/login', { username, password }, signal),
  request: execute
}
