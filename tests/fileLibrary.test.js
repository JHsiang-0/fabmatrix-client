import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/views/FileLibrary.vue', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('../src/components/file/FileDetailDrawer.vue', import.meta.url), 'utf8')

test('文件中心使用正式分页契约并提供单一主工作区导航', () => {
  assert.doesNotMatch(source, /getFileTree|<t-tree|handleTreeClick|file-library-sidebar|file-library-tree/)
  assert.match(source, /parentId: currentParentId\.value/)
  assert.match(source, /const navigateToRoot = \(\)/)
  assert.match(source, /const navigateToFolder = \(folder\)/)
  assert.match(source, /<t-breadcrumb separator="\/">/)
  assert.match(source, /<TdTable :data="fileRows" row-key="id"/)
  assert.match(source, /<t-card bordered class="file-library-workspace app-page-card"/)
  assert.match(source, /<t-form layout="inline" class="file-library-filter-form"/)
  assert.match(source, /class="file-library-results"/)
  assert.doesNotMatch(source, /class="file-library-content-card"/)
  assert.match(source, /const refreshLibrary = \(\) => fetchData\(\)/)
})

test('文件中心不伪造材料和统计值，并覆盖上传删除结果态', () => {
  assert.doesNotMatch(source, /materialType \|\| 'PLA'/)
  assert.doesNotMatch(source, /filamentWeight \|\| 0/)
  assert.doesNotMatch(source, /filamentLength \|\| 0/)
  assert.doesNotMatch(source, /printCount \|\| 0/)
  assert.match(source, /formatMetric/)
  assert.match(source, /retryableFiles/)
  assert.match(source, /items.length !== ids.length/)
  assert.match(source, /error\?\.response\?\.status === 422/)
})

test('文件库工具栏使用统一 Space 并提供正式字段查询与重置', () => {
  assert.match(source, /<t-space class="file-library-toolbar__actions"[\s\S]*break-line>/)
  assert.doesNotMatch(source, /<div class="file-library-toolbar__actions">/)
  assert.match(source, /v-model="searchKeyword"[\s\S]*@keyup\.enter="handleSearch"/)
  assert.match(source, /v-model="materialFilter"[\s\S]*@keyup\.enter="handleSearch"/)
  assert.match(source, /@click="resetSearch"/)
  assert.match(source, /const resetSearch = \(\) =>/)
  assert.match(source, /fileName: searchKeyword\.value \|\| undefined/)
  assert.match(source, /materialType: materialFilter\.value \|\| undefined/)
  assert.doesNotMatch(source, /keyword:/)
})

test('文件详情仅展示安全元数据并区分缩略图不可用', () => {
  assert.match(detailSource, /暂无缩略图/)
  assert.match(detailSource, /file.thumbnailError/)
  assert.doesNotMatch(detailSource, /rustfsKey|safeName|fileUrl/)
  assert.doesNotMatch(detailSource, /上传用户ID/)
  assert.match(source, /getThumbnailUrl\(fileId\)/)
})

test('文件库默认使用可滚动 TDesign 列表并通过行或卡片打开详情', () => {
  assert.match(source, /const viewMode = ref\('list'\)/)
  assert.match(source, /const fileRows = computed\(\(\) => fileList\.value\.map/)
  assert.match(source, /<TdTable :data="fileRows" row-key="id"/)
  assert.match(source, /@row-click="handleTableRowClick"/)
  assert.match(source, /@click="handleFileClick\(file\)"/)
  assert.match(source, /<t-card[\s\S]*class="file-card"/)
  assert.doesNotMatch(source, /<t-button[^>]*>\s*详情\s*<\/t-button>/)
  assert.match(source, /<t-form layout="inline" class="file-library-filter-form"/)
  assert.match(source, /height="100%"[\s\S]*@selection-change/)
  assert.doesNotMatch(source, /calc\(100vh - 244px\)/)
  assert.match(source, /\.file-library-main[\s\S]*width: 100%/)
  assert.match(source, /\.file-table-view :deep\(\.t-table__content\)[\s\S]*overflow-y: auto/)
  assert.doesNotMatch(source, /viewMode = ref\('grid'\)/)
})

test('文件详情抽屉使用 TDesign 关闭同步并避免旧版卡片拼装', () => {
  assert.match(detailSource, /v-model:visible="drawerVisible"/)
  assert.match(detailSource, /aria-label="关闭文件详情"/)
  assert.match(detailSource, /<t-descriptions/)
  assert.doesNotMatch(detailSource, /class="grid grid-cols|class="bg-white|class="space-y-/)
  assert.match(detailSource, /@click="emit\('retry'\)"/)
  assert.match(detailSource, /@click="emit\('retry-jobs'\)"/)
  assert.match(source, /@retry="retryFileDetail"/)
  assert.match(source, /@retry-jobs="retryFileJobs"/)
  assert.match(source, /const loadFileDetail = async fileId =>/)
  assert.match(source, /const loadFileJobs = async fileId =>/)
  assert.match(source, /const retryFileDetail = \(\) =>/)
  assert.match(source, /const retryFileJobs = \(\) =>/)
  assert.match(source, /await refreshLibrary\(\)/)
})
