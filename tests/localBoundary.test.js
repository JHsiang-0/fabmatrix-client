import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('本地客户端的导航、路由和连接页只提供现场业务入口', async () => {
  const paths = ['src/config/navigation.js', 'src/components/layout/AppHeader.vue',
    'src/router/index.js', 'src/views/ServerConnection.vue']
  for (const path of paths) {
    const source = await readFile(new URL('../' + path, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /cloud-dashboard|cloud-management|云端平台|云端管理|云端只读看板/, path)
  }
})

test('本地客户端移除云账号模块并继续使用本地请求与完整设备模型', async () => {
  for (const path of ['src/api/cloud.js', 'src/stores/cloud.js', 'src/utils/cloudSession.js',
    'src/utils/cloudManagement.js', 'src/views/CloudDashboard.vue', 'src/views/CloudManagement.vue']) {
    assert.equal(existsSync(new URL('../' + path, import.meta.url)), false, path)
  }
  const request = await readFile(new URL('../src/utils/request.js', import.meta.url), 'utf8')
  assert.doesNotMatch(request, /createCloudTransport/)
  const printerApi = await readFile(new URL('../src/api/printer.js', import.meta.url), 'utf8')
  assert.match(printerApi, /\/model/)
})
