import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const apiSource = read('../src/api/dashboardLayout.js')
const gridStoreSource = read('../src/stores/printer/gridStore.js')
const deviceStoreSource = read('../src/stores/printer/deviceStore.js')

test('布局 API 使用正式 GET/PUT 资源并把 Long printerId 转为字符串', () => {
  assert.match(apiSource, /url: '\/api\/v1\/dashboard-layout'/g)
  assert.match(apiSource, /method: 'get'/)
  assert.match(apiSource, /method: 'put'/)
  assert.match(apiSource, /printerId: normalizeId\(position\.printerId\)/)
  assert.match(apiSource, /normalizeDashboardSaveResult/)
})

test('默认布局纵向过道位于第 7 列之后，并保留横向过道校验语义', () => {
  const layoutSource = read('../src/utils/gridLayout.js')
  assert.match(layoutSource, /id: 'default-column-aisle',[\s\S]*afterIndex: 7/)
  assert.match(layoutSource, /axis === 'ROW' \? rowCount : columnCount/)
})

test('gridStore 保留服务端快照与编辑草稿，并以 expectedVersion 保存', () => {
  assert.match(gridStoreSource, /const layoutSnapshot = ref\(null\)/)
  assert.match(gridStoreSource, /const layoutDraft = ref\(null\)/)
  assert.match(gridStoreSource, /const draftBaseVersion = ref\(null\)/)
  assert.match(gridStoreSource, /const draftOwner = ref\(null\)/)
  assert.match(gridStoreSource, /const layoutSavingOwner = ref\(null\)/)
  assert.match(gridStoreSource, /expectedVersion: draftBaseVersion\.value/)
  assert.match(gridStoreSource, /function startLayoutEdit\(\)/)
  assert.match(gridStoreSource, /if \(!ownsOperation\(\)\) return \{ \.\.\.response\.data, operationApplied: false \}/)
  assert.match(gridStoreSource, /function discardLayoutEdit\(owner = draftOwner\.value\)/)
  assert.match(gridStoreSource, /layoutConflict\.value = error\.data/)
  assert.doesNotMatch(gridStoreSource, /localStorage/)
})

test('deviceStore 不再过滤异常位置并会遍历分页', () => {
  assert.match(deviceStoreSource, /getPrinterList\(\{ pageNum: 1, pageSize: 100 \}, \{ signal \}\)/)
  assert.match(deviceStoreSource, /collectAllPages/)
  assert.doesNotMatch(deviceStoreSource, /const filtered = records\.filter/)
  assert.doesNotMatch(deviceStoreSource, /rawDeviceList\.value = filtered/)
})
