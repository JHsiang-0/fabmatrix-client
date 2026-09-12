import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')

test('新部署默认连接端口统一为 28081', async () => {
  const [vite, env, desktopEnv, serverConfig, electron, electronDist] = await Promise.all([
    read('vite.config.js'),
    read('.env.example'),
    read('.env.desktop.example'),
    read('src/utils/serverConfig.js'),
    read('tests/e2e/electron.spec.js'),
    read('tests/e2e/electron-dist.spec.js')
  ])

  assert.equal((vite.match(/localhost:28081/g) || []).length, 3)
  assert.doesNotMatch(vite, /localhost:8080/)
  assert.match(env, /VITE_API_BASE_URL=http:\/\/localhost:28081/)
  assert.match(env, /VITE_API_TARGET=http:\/\/localhost:28081/)
  assert.match(env, /VITE_WS_TARGET=ws:\/\/localhost:28081/)
  assert.match(desktopEnv, /VITE_API_BASE_URL=http:\/\/localhost:28081/)
  assert.match(desktopEnv, /VITE_WS_URL=ws:\/\/localhost:28081\/ws\/farm-status/)
  assert.match(serverConfig, /DESKTOP_API_BASE_URL = 'http:\/\/localhost:28081'/)
  assert.match(serverConfig, /DESKTOP_WS_URL = 'ws:\/\/localhost:28081\/ws\/farm-status'/)
  assert.match(electron, /apiBaseUrl: 'http:\/\/localhost:28081'/)
  assert.match(electron, /wsUrl: 'ws:\/\/localhost:28081\/ws\/farm-status'/)
  assert.match(electronDist, /apiBaseUrl: 'http:\/\/localhost:28081'/)
  assert.match(electronDist, /wsUrl: 'ws:\/\/localhost:28081\/ws\/farm-status'/)
})
