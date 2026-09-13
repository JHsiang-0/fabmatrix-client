import assert from 'node:assert/strict'
import test from 'node:test'

const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  },
  location: { protocol: 'http:', host: '127.0.0.1:5173' }
}

const {
  clearServerConfig,
  buildServerBaseUrl,
  getApiBaseUrl,
  getEnvironmentServerConfig,
  getServerConfig,
  getWebSocketBaseUrl,
  deriveWebSocketEndpoint,
  deriveWebSocketUrl,
  isValidServerHost,
  normalizeServerUrl,
  parseServerEndpoint,
  resolveEnvironmentServerConfig,
  saveServerConfig
} = await import('../src/utils/serverConfig.js')

test('normalizes and validates server URLs without accepting credentials or unsupported protocols', () => {
  assert.equal(normalizeServerUrl(' http://192.168.0.10:8080/ '), 'http://192.168.0.10:8080')
  assert.equal(normalizeServerUrl('ftp://192.168.0.10:8080'), '')
  assert.equal(normalizeServerUrl('http://user:password@192.168.0.10:8080'), '')
})

test('拆分并重建服务器 IP、端口和协议', () => {
  assert.deepEqual(parseServerEndpoint('https://farm.example.com:8443'), {
    protocol: 'https',
    host: 'farm.example.com',
    port: '8443'
  })
  assert.equal(buildServerBaseUrl({ protocol: 'http', host: '192.168.0.10', port: '8080' }), 'http://192.168.0.10:8080')
  assert.equal(buildServerBaseUrl({ protocol: 'http', host: '192.168.0.10', port: '0' }), '')
})

test('服务器地址输入只接受纯 IP、主机名或 IPv6', () => {
  assert.equal(isValidServerHost('192.168.0.10'), true)
  assert.equal(isValidServerHost('farm.local'), true)
  assert.equal(isValidServerHost('::1'), true)
  assert.equal(isValidServerHost('http://farm.local'), false)
  assert.equal(isValidServerHost('farm.local/api'), false)
  assert.equal(isValidServerHost('192.168.0.256'), false)
  assert.equal(buildServerBaseUrl({ protocol: 'http', host: 'farm.local/api', port: '8080' }), '')
  assert.equal(buildServerBaseUrl({ protocol: 'http', host: '::1', port: '8080' }), 'http://[::1]:8080')
})

test('uses the saved server endpoint for HTTP and derives its WebSocket endpoint', () => {
  saveServerConfig({ apiBaseUrl: 'http://192.168.0.10:8080' })
  assert.equal(getApiBaseUrl(), 'http://192.168.0.10:8080')
  assert.equal(getWebSocketBaseUrl(), 'ws://192.168.0.10:8080/ws/farm-status')
  assert.deepEqual(getServerConfig(), {
    apiBaseUrl: 'http://192.168.0.10:8080',
    wsUrl: ''
  })
})

test('derives WebSocket protocol, host, port and path from the current API endpoint', () => {
  assert.equal(deriveWebSocketUrl('http://farm.example:28081/api'), 'ws://farm.example:28081/ws/farm-status')
  assert.equal(deriveWebSocketUrl('https://farm.example:8443'), 'wss://farm.example:8443/ws/farm-status')
  assert.deepEqual(deriveWebSocketEndpoint({ protocol: 'http', host: '192.168.0.10', port: '28081' }), {
    protocol: 'ws',
    address: '192.168.0.10:28081/ws/farm-status'
  })
  assert.deepEqual(deriveWebSocketEndpoint({ protocol: 'https', host: 'farm.example', port: '8443' }), {
    protocol: 'wss',
    address: 'farm.example:8443/ws/farm-status'
  })
})

test('prefers an explicitly saved WebSocket endpoint and clears only connection settings', () => {
  saveServerConfig({
    apiBaseUrl: 'https://farm.example.com',
    wsUrl: 'wss://socket.example.com/ws/farm-status'
  })
  assert.equal(getWebSocketBaseUrl(), 'wss://socket.example.com/ws/farm-status')
  clearServerConfig()
  assert.equal(getServerConfig().apiBaseUrl, '')
})

test('preserves legal custom WebSocket ports and rejects invalid ports', () => {
  assert.deepEqual(saveServerConfig({
    apiBaseUrl: 'http://farm.example.com:28081',
    wsUrl: 'ws://socket.example.com:29090/ws/farm-status'
  }), {
    apiBaseUrl: 'http://farm.example.com:28081',
    wsUrl: 'ws://socket.example.com:29090/ws/farm-status'
  })
  assert.throws(
    () => saveServerConfig({ apiBaseUrl: 'http://farm.example.com:28081', wsUrl: 'ws://socket.example.com:0/ws/farm-status' }),
    /WebSocket 端口必须是 1 到 65535 的数字/
  )
  assert.throws(
    () => saveServerConfig({ apiBaseUrl: 'http://farm.example.com:28081', wsUrl: 'ws://socket.example.com:65536/ws/farm-status' }),
    /请输入有效的 WebSocket 地址/
  )
})

test('启动配置读取不受已保存地址影响', () => {
  saveServerConfig({ apiBaseUrl: 'http://saved.example:8080' })
  assert.deepEqual(getEnvironmentServerConfig(), { apiBaseUrl: '', wsUrl: '' })
})

test('桌面模式在无显式环境变量时使用 tracked 28081 默认值', () => {
  const expected = {
    apiBaseUrl: 'http://localhost:28081',
    wsUrl: ''
  }
  assert.deepEqual(resolveEnvironmentServerConfig({ mode: 'desktop' }), expected)
  assert.deepEqual(resolveEnvironmentServerConfig({ mode: 'desktop-mock' }), expected)
  assert.deepEqual(resolveEnvironmentServerConfig({ mode: 'production' }), { apiBaseUrl: '', wsUrl: '' })
})

test('桌面模式自定义 API 未配置 WebSocket 时保留空 wsUrl 并由运行时跟随新地址推导', () => {
  assert.deepEqual(resolveEnvironmentServerConfig({
    mode: 'desktop',
    apiBaseUrl: 'http://farm.example:29090'
  }), {
    apiBaseUrl: 'http://farm.example:29090',
    wsUrl: ''
  })

  saveServerConfig({ apiBaseUrl: 'http://farm.example:29090' })
  assert.equal(getWebSocketBaseUrl(), 'ws://farm.example:29090/ws/farm-status')
})

test('桌面模式显式环境变量优先于 tracked 默认值', () => {
  assert.deepEqual(resolveEnvironmentServerConfig({
    mode: 'desktop-release',
    apiBaseUrl: 'http://farm.example:8080',
    wsUrl: 'ws://farm.example:8080/ws/farm-status'
  }), {
    apiBaseUrl: 'http://farm.example:8080',
    wsUrl: 'ws://farm.example:8080/ws/farm-status'
  })
})
