import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const connectionSource = await readFile(new URL('../src/views/ServerConnection.vue', import.meta.url), 'utf8')
const loginSource = await readFile(new URL('../src/views/Login.vue', import.meta.url), 'utf8')

test('服务器连接页保持分离的端点字段和双动作语义', () => {
  assert.match(connectionSource, /label="服务器 IP \/ 主机"/)
  assert.match(connectionSource, /label="端口"/)
  assert.match(connectionSource, /label="WebSocket 地址"/)
  assert.match(connectionSource, /wsUrl: initialConfig\.wsUrl/)
  assert.match(connectionSource, /@click="testConnection"/)
  assert.match(connectionSource, /@click="saveAndConnect"/)
  assert.match(connectionSource, /保存并连接成功，尚未保存配置|服务器连接测试成功，尚未保存配置/)
  assert.match(connectionSource, /saveServerConfig\(\{ apiBaseUrl, wsUrl: resolveWebSocketUrl\(\) \}\)/)
  assert.match(connectionSource, /<t-typography-text disabled>嘉东三维管理平台<\/t-typography-text>/)
  assert.doesNotMatch(connectionSource, /connection-brand__mark|>3D<|安全连接配置/)
  assert.doesNotMatch(connectionSource, /扫描局域网|发现服务器|lanDiscovery/)
})

test('初始化入口通过正式状态接口原位切换并提供重试', () => {
  assert.match(loginSource, /getFirstAdminSetupStatus\(\)/)
  assert.match(loginSource, /setupMode\.value = response\?\.data\?\.setupAvailable === true/)
  assert.match(loginSource, /@click="loadSetupStatus"/)
  assert.match(loginSource, /setupFirstAdmin\(\{[\s\S]*confirmPassword:/)
})
