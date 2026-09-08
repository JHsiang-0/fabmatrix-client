import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {
  resolveFolderActionPayload,
  resolveFolderActionValue,
  unwrapFolderTreeNode
} from '../src/utils/fileFolderActions.js'

const source = fs.readFileSync(new URL('../src/views/FileLibrary.vue', import.meta.url), 'utf8')
const apiSource = fs.readFileSync(new URL('../src/api/printFile.js', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('../src/components/file/FileDetailDrawer.vue', import.meta.url), 'utf8')
const folderTreeSource = fs.readFileSync(new URL('../src/components/file/FileFolderTree.vue', import.meta.url), 'utf8')
const uploadDialogSource = source.match(/<t-dialog[\s\S]*?header="批量上传切片文件"[\s\S]*?<\/t-dialog>/)?.[0] || ''
const moveDialogSource = source.match(/<t-dialog[^>]*header="批量移动文件"[\s\S]*?<\/t-dialog>/)?.[0] || ''

test('文件中心使用正式分页契约并提供文件夹树与单一主工作区', () => {
  assert.match(source, /<FileFolderTree[\s\S]*:current-parent-id="currentParentId"[\s\S]*@select="handleFolderSelect"[\s\S]*@create="openCreateFolderDialog"/)
  assert.match(source, /<t-aside width="208px" class="file-library-sidebar">/)
  assert.match(source, /<t-content class="file-library-content">/)
  assert.match(source, /parentId: currentParentId\.value/)
  assert.doesNotMatch(source, /navigateToRoot|navigateToFolder|<t-breadcrumb/)
  assert.match(source, /<TdTable :data="fileRows" row-key="id"/)
  assert.doesNotMatch(source, /file-library-workspace/)
  assert.match(source, /<t-card bordered class="file-library-sidebar-card" aria-label="文件夹导航">/)
  assert.match(source, /<t-card bordered class="file-library-toolbar-card" aria-label="文件操作工具栏">/)
  assert.match(source, /file-library-results-card file-library-table-card/)
  assert.doesNotMatch(source, /<t-form layout="inline" class="file-library-filter-form"/)
  assert.match(source, /class="file-library-status-region"/)
  assert.doesNotMatch(source, /class="file-library-results"/)
  assert.doesNotMatch(source, /class="file-library-content-card"/)
  assert.match(source, /const refreshLibrary = \(\) => fetchData\(\)/)
})

test('文件夹树只消费后端真实目录节点并保留路径和错误恢复', () => {
  assert.match(source, /import FileFolderTree from '@\/components\/file\/FileFolderTree\.vue'/)
  assert.match(folderTreeSource, /import \{ getFileTree \} from '@\/api\/printFile'/)
  assert.match(folderTreeSource, /await getFileTree\(\)/)
  assert.doesNotMatch(folderTreeSource, /__root__/)
  assert.match(folderTreeSource, /folders\.value\.filter\(isFolder\)/)
  assert.match(folderTreeSource, /aria-label="新建文件夹"/)
  assert.match(folderTreeSource, /theme="primary"[\s\S]*variant="outline"[\s\S]*size="small"[\s\S]*aria-label="新建文件夹"/)
  assert.doesNotMatch(folderTreeSource, /刷新文件夹列表|RefreshIcon|按目录查看文件/)
  assert.match(folderTreeSource, /@click="emit\('create'\)"/)
  assert.match(folderTreeSource, /#operations="\{ node \}"/)
  assert.match(folderTreeSource, /v-if="!unwrapFolderTreeNode\(node\)\?\.isDefault"/)
  assert.match(folderTreeSource, /<MoreIcon \/>/)
  assert.match(folderTreeSource, /trigger="click"/)
  assert.match(folderTreeSource, /folderActionOptions/)
  assert.match(folderTreeSource, /@click="dropdownAction => handleFolderAction\(dropdownAction, node\)"/)
  assert.match(folderTreeSource, /@click\.stop\n\s*>/)
  assert.match(folderTreeSource, /emit\('folder-action', payload\.folder, payload\.action\)/)
  assert.doesNotMatch(folderTreeSource, /emit\('delete', node\.data\)/)
  assert.match(folderTreeSource, /EditIcon/)
  assert.match(folderTreeSource, /FolderMoveIcon/)
  assert.match(folderTreeSource, /aria-label="`打开文件夹 \$\{node\.label\} 操作面板`"/)
  assert.match(folderTreeSource, /deletingFolderId/)
  assert.match(folderTreeSource, /Array\.isArray\(folder\.children\)[\s\S]*folder\.children\.filter\(isFolder\)/)
  assert.match(folderTreeSource, /activable[\s\S]*hover[\s\S]*expand-on-click-node/)
  assert.match(folderTreeSource, /@click="handleTreeClick"/)
  assert.match(folderTreeSource, /#label="\{ node \}"/)
  assert.match(folderTreeSource, /class="file-folder-tree__label" :title="node\.label"/)
  assert.match(folderTreeSource, /\.file-folder-tree__label[\s\S]*display: block[\s\S]*overflow: hidden[\s\S]*text-overflow: ellipsis[\s\S]*white-space: nowrap/)
  assert.match(folderTreeSource, /\.t-tree__label[\s\S]*flex: 1 1 auto[\s\S]*min-width: 0[\s\S]*max-width: 100%/)
  assert.match(folderTreeSource, /\.t-tree__item[\s\S]*min-width: 0/)
  assert.match(folderTreeSource, /Array\.isArray\(node\.path\)[\s\S]*Array\.isArray\(data\.path\)/)
  assert.match(folderTreeSource, /path\n {2}\}\)/)
  assert.match(folderTreeSource, /const path = Array\.isArray\(node\.path\)[\s\S]*Array\.isArray\(data\.path\)/)
  assert.match(folderTreeSource, /emit\('select', \{[\s\S]*id,[\s\S]*path\n {2}\}\)/)
  assert.match(folderTreeSource, /<t-alert v-if="error" theme="error"/)
  assert.match(folderTreeSource, /@click="refresh">重试<\/t-button>/)
  assert.doesNotMatch(folderTreeSource, /:max-height="treeMaxHeight"/)
  assert.match(folderTreeSource, /\.file-folder-tree__nodes[\s\S]*overflow: visible/)
  assert.doesNotMatch(folderTreeSource, /checkable|draggable|allow-drop|onDrop/)
})

test('文件夹 More 面板按 TDesign Dropdown click 签名传递三类动作', () => {
  const actionOptions = folderTreeSource.match(/const folderActionOptions = \[[\s\S]*?\n\]/)?.[0] || ''
  assert.match(actionOptions, /content: '重命名'[\s\S]*value: 'rename'[\s\S]*EditIcon/)
  assert.match(actionOptions, /content: '移动到'[\s\S]*value: 'move'[\s\S]*FolderMoveIcon/)
  assert.match(actionOptions, /content: '删除'[\s\S]*value: 'delete'[\s\S]*theme: 'error'[\s\S]*DeleteIcon/)
  assert.match(folderTreeSource, /const handleFolderAction = \(action, node\) =>/)
  assert.doesNotMatch(folderTreeSource, /handleFolderAction\(\$event/)
  assert.match(folderTreeSource, /\.t-tree__item:hover\)[\s\S]*\.t-tree__item:focus-within/)
  assert.match(folderTreeSource, /opacity: 0[\s\S]*pointer-events: none/)
  assert.match(folderTreeSource, /\.t-tree__item:focus-within\) \.file-folder-tree__more[\s\S]*pointer-events: auto/)
})

test('文件夹操作解析完整下拉选项的 value 并兼容字符串动作', () => {
  for (const action of ['rename', 'move', 'delete']) {
    assert.equal(
      resolveFolderActionValue({ content: action, value: action }),
      action
    )
    assert.equal(resolveFolderActionValue(action), action)
  }

  assert.equal(resolveFolderActionValue(null), null)
  assert.equal(resolveFolderActionValue(undefined), undefined)
})

test('文件夹操作从 TDesign 外层节点解包真实对象并传递三类动作载荷', () => {
  const folder = {
    id: 'folder-42',
    parentId: 'folder-7',
    isDefault: false,
    name: '真实目录'
  }
  const treeNode = {
    value: folder.id,
    label: '展示标签',
    data: {
      value: folder.id,
      label: '展示标签',
      path: [{ id: folder.id, name: folder.name }],
      data: folder,
      children: []
    },
    children: []
  }

  const unwrappedFolder = unwrapFolderTreeNode(treeNode)
  assert.equal(unwrappedFolder, folder)
  assert.equal(unwrappedFolder.id, 'folder-42')
  assert.equal(unwrappedFolder.parentId, 'folder-7')
  assert.equal(unwrappedFolder.isDefault, false)
  assert.equal(unwrappedFolder.name, '真实目录')
  assert.notEqual(unwrappedFolder, treeNode.data)

  for (const action of ['rename', 'move', 'delete']) {
    const payload = resolveFolderActionPayload({ content: action, value: action }, treeNode)
    assert.equal(payload.folder, folder)
    assert.equal(payload.action, action)
    assert.notEqual(payload.folder, treeNode.data)
  }

  const defaultTreeNode = {
    ...treeNode,
    data: { ...treeNode.data, data: { ...folder, isDefault: true } }
  }
  assert.equal(unwrapFolderTreeNode(defaultTreeNode).isDefault, true)
})

test('文件中心不伪造材料和统计值，并覆盖上传删除结果态', () => {
  assert.doesNotMatch(source, /materialType \|\| 'PLA'/)
  assert.doesNotMatch(source, /filamentWeight \|\| 0/)
  assert.doesNotMatch(source, /filamentLength \|\| 0/)
  assert.doesNotMatch(source, /printCount \|\| 0/)
  assert.match(source, /formatMetric/)
  assert.match(source, /retryableFiles/)
  assert.match(source, /items.length !== ids.length/)
  assert.match(source, /message\.error\(error\?\.message \|\| '删除失败'\)/)
  assert.match(source, /deleteFolder\(id\)/)
  assert.match(source, /仅删除空文件夹，不会删除其中的文件/)
  assert.match(source, /currentParentId\.value = folder\.parentId \?\? null/)
  assert.match(source, /@folder-action="handleFolderAction"/)
  assert.match(source, /renameFolder\(folder\.id, \{ folderName: renameFolderForm\.name \}\)/)
  assert.match(source, /moveFolder\(folder\.id, \{ parentId: targetParentId \}\)/)
  assert.match(source, /header="重命名文件夹"[\s\S]*<t-form[\s\S]*<t-input/)
  assert.match(source, /header="移动到"[\s\S]*<t-select/)
  assert.match(source, /folderActionLoading/)
  assert.match(source, /仅移动文件夹目录记录，不会移动其中的文件/)
  assert.match(source, /folder\.isDefault/)
  assert.match(source, /isDescendantFolder/)
})

test('文件库工具栏将操作、视图和搜索合并为一行', () => {
  assert.match(source, /<div class="file-library-filter-form"[\s\S]*aria-label="文件筛选条件">/)
  assert.match(source, /<t-space class="file-library-toolbar-actions"[\s\S]*break-line>/)
  const toolbarActions = source.match(/<t-space class="file-library-toolbar-actions"[\s\S]*?<\/t-space>/)?.[0] || ''
  assert.doesNotMatch(toolbarActions, /新建文件夹|刷新/)
  assert.match(toolbarActions, />\s*上传\s*<\/t-button>/)
  assert.doesNotMatch(source, /<t-space class="file-library-toolbar__actions"/)
  assert.match(source, /v-model="searchKeyword"[\s\S]*@keyup\.enter="handleSearch"/)
  assert.doesNotMatch(source, /materialFilter|placeholder="材质筛选"/)
  assert.doesNotMatch(source, /@click="resetSearch"|const resetSearch = \(\) =>/)
  assert.match(source, /fileName: searchKeyword\.value \|\| undefined/)
  assert.doesNotMatch(source, /keyword:/)
})

test('文件详情仅展示安全元数据并区分缩略图不可用', () => {
  assert.match(detailSource, /暂无缩略图/)
  assert.match(detailSource, /file.thumbnailError/)
  assert.doesNotMatch(detailSource, /rustfsKey|safeName|fileUrl/)
  assert.doesNotMatch(detailSource, /上传用户ID/)
  assert.match(source, /getThumbnailUrl\(fileId\)/)
})

test('文件库使用 TDesign 视图分段并永久显示选择列', () => {
  assert.match(source, /const viewMode = ref\('list'\)/)
  assert.match(source, /const fileRows = computed\(\(\) => fileList\.value\)/)
  assert.match(source, /<TdTable :data="fileRows" row-key="id"/)
  assert.match(source, /@row-click="handleTableRowClick"/)
  assert.match(source, /@click="handleFileClick\(file\)"/)
  assert.match(source, /<t-card[\s\S]*class="file-card"/)
  assert.doesNotMatch(source, /<t-button[^>]*>\s*详情\s*<\/t-button>/)
  assert.doesNotMatch(source, /<t-form layout="inline" class="file-library-filter-form"/)
  assert.doesNotMatch(source, /description="管理可见的切片文件与目录/)
  assert.doesNotMatch(source, /label="当前位置"|label="模式"|批量选择模式|>批量选择</)
  assert.doesNotMatch(source, /file-library-results-heading|file-library-results-title|根目录文件|目录内容/)
  assert.doesNotMatch(source, /isBatchMode|文件操作模式|file-library-mode-controls|<t-radio-button :value="true">选择<\/t-radio-button>/)
  assert.match(source, /class="file-library-view-mode"[\s\S]*aria-label="文件视图"/)
  assert.match(source, /class="file-library-view-mode"[\s\S]*size="medium"/)
  assert.match(source, /aria-label="网格视图"/)
  assert.match(source, /aria-label="列表视图"/)
  assert.doesNotMatch(source, /class="file-view-toggle"/)
  assert.match(source, /class="file-library-search-actions"/)
  assert.match(source, /class="file-library-search-input"/)
  assert.match(source, /\.file-library-search-input :deep\(\.t-input\)[\s\S]*background: var\(--app-surface-muted\)[\s\S]*border-color: transparent/)
  assert.match(folderTreeSource, /\.file-folder-tree__search :deep\(\.t-input\)[\s\S]*background: var\(--app-surface-muted\)[\s\S]*box-shadow: none/)
  assert.match(source, /\.file-library-toolbar-card :deep\(\.t-card__body\)[\s\S]*padding: var\(--app-spacing-3\) var\(--app-spacing-4\)/)
  assert.match(source, /\.file-library-results-card :deep\(\.t-card__body\)[\s\S]*padding: 0/)
  assert.match(source, /<t-card v-if="fileList\.length && viewMode === 'list'" bordered class="file-library-results-card file-library-table-card"/)
  assert.match(source, /<TdTableColumn type="selection" width="50" align="center" :check-props="getRowCheckProps" \/>/)
  assert.match(source, /height="100%"[\s\S]*@selection-change/)
  assert.doesNotMatch(source, /calc\(100vh - 244px\)/)
  assert.match(source, /\.file-library-main[\s\S]*width: 100%/)
  assert.match(source, /\.file-table-view :deep\(\.t-table__content\)[\s\S]*overflow-y: auto/)
  assert.match(source, /\.file-grid-view[\s\S]*width: 100%[\s\S]*height: 100%/)
  assert.match(source, /<Grid :size="16" \/>[\s\S]*<List :size="16" \/>/)
  assert.match(source, /<TdTable :data="fileRows"[\s\S]*height="100%" hover/)
  assert.match(source, /farm-context-menu-position/)
  assert.doesNotMatch(source, /viewMode = ref\('grid'\)/)
  assert.doesNotMatch(source, /value: 'open'/)
  assert.match(source, /class="file-library-filter-form"[\s\S]*class="file-grid-view app-scroll-region"[\s\S]*class="file-table-view"[\s\S]*class="file-library-pagination"/)
})

test('文件库列表表头单行、数据行紧凑且保留横向滚动', () => {
  assert.match(source, /file-table-view :deep\(\.t-table__header[\s\S]*white-space: nowrap/)
  assert.match(source, /file-table-view :deep\(\.t-table__body[\s\S]*border-bottom: 1px solid var\(--td-component-border\)/)
  assert.match(source, /file-table-view :deep\(\.t-table__body > tr:hover > td\)/)
  assert.match(source, /min-width: 1000px/)
  assert.match(source, /white-space: nowrap/)
  assert.match(source, /text-overflow: ellipsis/)
  assert.match(source, /<TdTableColumn prop="filamentWeight" label="耗材重量" width="85">/)
})

test('文件库提供批量移动 API、目标校验、操作锁定和部分失败保留', () => {
  assert.match(apiSource, /url: '\/api\/v1\/print-files\/batch\/move'/)
  assert.match(apiSource, /method: 'put'/)
  assert.match(apiSource, /data: \{ ids, parentId \}/)
  assert.match(source, /moveBatchFiles\(ids, targetParentId\)/)
  assert.match(source, /批量移动 \(\{\{ selectedIds\.length \}\}\)/)
  assert.match(source, /header="批量移动文件"/)
  assert.match(moveDialogSource, /<t-form[\s\S]*目标文件夹[\s\S]*<t-select/)
  assert.match(moveDialogSource, /batchMoveResults/)
  assert.match(source, /批量移动结果不完整，请刷新后重试未确认的项目/)
  assert.match(source, /目标目录与当前目录相同，无需移动/)
  assert.match(source, /请选择目标目录/)
  assert.match(source, /BATCH_MOVE_ROOT_VALUE/)
  assert.match(source, /selectedIds\.value = failedItems\.map\(item => item\.id\)/)
  assert.match(source, /await folderTreeRef\.value\?\.refresh\(\)/)
  assert.match(source, /batchMoving/)
})

test('文件库批量上传逐文件请求并维护独立进度', () => {
  assert.match(source, /runUploadQueue\(files, async \(file, index\)/)
  assert.match(source, /formData\.append\('file', file\)/)
  assert.match(source, /uploadFileStates/)
  assert.match(source, /state\.progress/)
  assert.match(source, /concurrency: 3/)
  assert.doesNotMatch(source, /batchUploadFiles\(/)
  assert.match(source, /isBatchUploadSuccess/)
})

test('文件库批量上传弹窗使用 TDesign 居中配置并固定视口内滚动', () => {
  assert.match(uploadDialogSource, /placement="center"/)
  assert.match(uploadDialogSource, /dialog-class-name="file-upload-dialog"/)
  assert.match(uploadDialogSource, /:prevent-scroll-through="true"/)
  assert.match(uploadDialogSource, /class="file-upload-dialog__file-list"[\s\S]*pendingUploadFiles/)
  assert.match(uploadDialogSource, /<template #footer>[\s\S]*file-upload-dialog__footer[\s\S]*取消上传[\s\S]*开始上传/)
  assert.match(source, /max-height: min\(320px, calc\(100vh - 300px\)\)/)
  assert.match(source, /\.file-upload-dialog__file-list[\s\S]*overflow-y: auto/)
})

test('文件库批量上传保留横向拖拽区和精确提示文案', () => {
  assert.match(uploadDialogSource, /class="farm-upload__content"[\s\S]*<UploadFilled \/>[\s\S]*拖拽多个切片文件到此处 或 <em>点击上传<\/em>/)
  assert.match(uploadDialogSource, /支持 \.gcode、\.g、\.3mf、\.stl 格式，最多 100 个文件；单个文件不超过 1GB。/)
  assert.doesNotMatch(uploadDialogSource, /批量会按单请求约 1GB 自动分组/)
  assert.match(source, /\.farm-upload__content[\s\S]*display: flex[\s\S]*align-items: center[\s\S]*width: 100%/)
})

test('文件库网格和列表均提供 TDesign 右键辅助菜单且只映射正式动作', () => {
  assert.match(source, /trigger="context-menu"/)
  assert.match(source, /const getContextMenuOptions = file =>/)
  assert.match(source, /const handleContextMenuClick = \(value, file\) =>/)
  assert.match(source, /value: 'detail'/)
  assert.match(source, /value: 'download'/)
  assert.match(source, /value: 'batch-delete'/)
  assert.match(source, /DownloadIcon as Download/)
  assert.doesNotMatch(source, /value: '(rename|move|copy|share)'/)
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

test('文件库成功率统一使用分档 TDesign 标签，不再混入进度条', () => {
  const gridRate = source.match(/<div class="file-card__success-rate">[\s\S]*?<\/div>/)?.[0] || ''
  const tableRate = source.match(/<TdTableColumn prop="successRate"[\s\S]*?<\/TdTableColumn>/)?.[0] || ''

  assert.match(gridRate, /<t-tag[\s\S]*:theme="getSuccessRateTheme\(file\.successRate\)"/)
  assert.doesNotMatch(gridRate, /t-progress/)
  assert.match(tableRate, /<t-tag[\s\S]*:theme="getSuccessRateTheme\(row\.successRate\)"/)
  assert.doesNotMatch(tableRate, /t-progress/)
  assert.match(source, /if \(!Number\.isFinite\(rate\) \|\| rate <= 0\) return 'default'/)
  assert.match(source, /if \(rate < 50\) return 'danger'/)
  assert.match(source, /if \(rate < 80\) return 'warning'/)
  assert.match(source, /return 'success'/)
  assert.match(source, /file-card__success-rate-tag[\s\S]*text-overflow: ellipsis/)
  assert.match(source, /file-table__rate-tag[\s\S]*text-overflow: ellipsis/)
})

test('文件详情使用紧凑无边框水平描述、底部大按钮并保护长文本布局', () => {
  const descriptions = detailSource.match(/<t-descriptions[\s\S]*?\/t-descriptions>/g) || []

  assert.equal(descriptions.length, 2)
  assert.equal((detailSource.match(/<t-divider/g) || []).length, 3)
  assert.match(detailSource, /<t-divider class="file-detail-drawer__summary-divider"\s*\/>/)
  assert.equal((detailSource.match(/class="file-detail-drawer__section file-detail-drawer__info-card"/g) || []).length, 1)
  assert.equal((detailSource.match(/<div class="file-detail-drawer__info-section"/g) || []).length, 2)
  assert.match(detailSource, /<t-divider class="file-detail-drawer__info-divider"\s*\/>/)
  assert.match(detailSource, /\.file-detail-drawer__body[\s\S]*gap: var\(--app-spacing-1\)/)
  assert.match(detailSource, /\.file-detail-drawer :deep\(\.t-divider\)[\s\S]*height: 1px[\s\S]*min-height: 1px[\s\S]*margin: -2px 0/)
  assert.match(detailSource, /\.file-detail-drawer__info-card[\s\S]*padding: var\(--app-spacing-1\) var\(--app-spacing-2\)[\s\S]*background: var\(--td-bg-color-secondarycontainer\)/)
  assert.match(detailSource, /\.file-detail-drawer__info-card[\s\S]*border: 1px solid var\(--td-component-border\)/)
  assert.match(detailSource, /\.file-detail-drawer__section[\s\S]*gap: var\(--app-spacing-1\)/)
  assert.match(detailSource, /\.file-detail-drawer__section h3[\s\S]*line-height: 1\.2/)
  for (const description of descriptions) {
    assert.match(description, /class="file-detail-drawer__descriptions"/)
    assert.match(description, /:column="3"/)
    assert.match(description, /\bcolon\b/)
    assert.match(description, /layout="horizontal"/)
    assert.match(description, /item-layout="horizontal"/)
    assert.match(description, /table-layout="auto"/)
    assert.match(description, /size="small"/)
    assert.match(description, /:bordered="false"/)
    assert.doesNotMatch(description, /\sbordered(?:\s|>)/)
  }
  assert.match(detailSource, /\.file-detail-drawer__descriptions :deep\(\.t-descriptions__body > tbody > tr > td\)[\s\S]*padding: var\(--app-spacing-1\) 0[\s\S]*line-height: 1\.25/)
  assert.match(detailSource, /\.file-detail-drawer__descriptions :deep\(\.t-descriptions__label\)[\s\S]*min-width: 0[\s\S]*width: 1%[\s\S]*max-width: 100%[\s\S]*white-space: nowrap[\s\S]*word-break: keep-all/)
  assert.match(detailSource, /\.file-detail-drawer__descriptions :deep\(\.t-descriptions__content\)[\s\S]*min-width: 0[\s\S]*width: auto[\s\S]*max-width: 100%/)
  assert.doesNotMatch(detailSource, /\.t-descriptions__(?:label|content)[\s\S]*max-width: 0/)
  assert.equal((detailSource.match(/<t-descriptions-item label="[^"]+">/g) || []).length, 12)
  assert.doesNotMatch(descriptions.join('\n'), /<t-tag theme="primary" variant="light-outline"/)
  assert.doesNotMatch(detailSource, /file-detail-drawer__label-tag/)
  for (const label of [
    '预计耗时', '文件大小', '耗材重量', '所需线长', '喷嘴要求', '上传时间',
    '常规层高', '首层层高', '喷嘴温度', '首层喷嘴温度', '热床温度', '首层热床温度'
  ]) {
    assert.match(detailSource, new RegExp(`<t-descriptions-item label="${label}">`))
  }
  assert.doesNotMatch(detailSource.match(/<section class="file-detail-drawer__summary"[\s\S]*?<\/section>/)?.[0] || '', /<t-button/)
  const footerActions = detailSource.match(/<div class="file-detail-drawer__footer-actions"[\s\S]*?<\/div>/)?.[0] || ''
  assert.ok(footerActions.indexOf('下载') < footerActions.indexOf('打印'))
  assert.match(footerActions, /下载[\s\S]*打印/)
  assert.match(detailSource, /file-detail-drawer__footer-actions[\s\S]*\.t-button[\s\S]*flex: 1 1 0/)
  assert.match(detailSource, /file-detail-drawer__value[\s\S]*text-overflow: ellipsis[\s\S]*white-space: nowrap/)
  assert.match(detailSource, /<t-tooltip[\s\S]*class="file-detail-drawer__name-tooltip"[\s\S]*:content="String\(file\.originalName \|\| '未命名文件'\)"/)
  assert.match(detailSource, /<t-tooltip[\s\S]*class="file-detail-drawer__material-tooltip"[\s\S]*:content="String\(file\.materialType \|\| '未指定'\)"/)
  assert.doesNotMatch(detailSource, /file-detail-drawer__name[^>]*:title=/)
  assert.doesNotMatch(detailSource, /file-detail-drawer__material-tag[^>]*:title=/)
  assert.match(detailSource, /<t-tooltip class="file-detail-drawer__value-tooltip" :content="formatDurationValue\(file\.estTime\)"/)
  assert.match(detailSource, /<t-tooltip class="file-detail-drawer__value-tooltip" :content="formatFileSizeValue\(file\.fileSize\)"/)
  assert.match(detailSource, /<t-tooltip class="file-detail-drawer__value-tooltip" :content="formatDateTimeValue\(file\.createdAt\)"/)
  assert.match(detailSource, /const formatDurationValue = value => isEmptyValue\(value\) \? '-' : formatDuration\(value\)/)
  assert.match(detailSource, /const formatFileSizeValue = value => isEmptyValue\(value\) \? '-' : formatFileSize\(value\)/)
  assert.match(detailSource, /const formatDateTimeValue = value => isEmptyValue\(value\) \? '-' : formatDateTime\(value\)/)
  assert.match(detailSource, /file-detail-drawer__material-tag[\s\S]*max-width: 100%[\s\S]*text-overflow: ellipsis/)
  assert.match(detailSource, /<div v-else-if="jobs.length > 0" class="file-detail-drawer__jobs-table">/)
  assert.match(detailSource, /table-layout="fixed"[\s\S]*class="file-detail-drawer__jobs-table"|class="file-detail-drawer__jobs-table"[\s\S]*table-layout="fixed"/)
  assert.match(detailSource, /file-detail-drawer__jobs-table :deep\(\.t-table__content\)[\s\S]*overflow-x: hidden/)
  assert.match(detailSource, /<t-tooltip class="file-detail-drawer__value-tooltip" :content="String\(slotProps\.row\.id \?\? '-'\)"/)
  assert.match(detailSource, /<t-tooltip class="file-detail-drawer__job-status-tooltip" :content="String\(slotProps\.row\.status \|\| '-'\)"/)
  assert.match(detailSource, /<t-tooltip class="file-detail-drawer__value-tooltip" :content="formatDateTimeValue\(slotProps\.row\.createdAt\)"/)
  assert.match(detailSource, /file-detail-drawer__footer-actions :deep\(\.t-button\)[\s\S]*width: 100%/)
  assert.doesNotMatch(detailSource, /file-detail-drawer__actions/)
})

test('文件库长文本使用 TDesign Tooltip 并保留省略和容器保护', () => {
  for (const className of [
    'file-card__name',
    'file-card__material-tag',
    'file-table__name',
    'file-table__type-tag',
    'file-table__metric',
    'file-table__rate-tag',
    'file-upload-dialog__item-name'
  ]) {
    assert.match(source, new RegExp(`<t-tooltip[\\s\\S]*${className}`))
  }

  assert.match(source, /:content="getFileNameLabel\(file\.originalName\)"/)
  assert.match(source, /:content="getFileNameLabel\(row\.originalName\)"/)
  assert.match(source, /:content="String\(file\.materialType \|\| '未指定'\)"/)
  assert.match(source, /:content="String\(row\.materialType \|\| '未指定'\)"/)
  assert.match(source, /:content="String\(state\.file\.name \|\| '未命名文件'\)"/)
  assert.match(source, /const getFileNameLabel = value => String\(value \|\| '未命名文件'\)/)
  assert.doesNotMatch(source, /file-card__name[^>]*:title=/)
  assert.doesNotMatch(source, /file-table__name[^>]*:title=/)
  assert.doesNotMatch(source, /file-table__metric[^>]*:title=/)
  assert.doesNotMatch(source, /file-upload-dialog__item-name[^>]*:title=/)
  assert.match(source, /file-card__name-tooltip[\s\S]*min-width: 0[\s\S]*overflow: hidden/)
  assert.match(source, /file-table__name-tooltip[\s\S]*text-overflow: ellipsis|file-table__name[\s\S]*text-overflow: ellipsis/)
  assert.match(source, /file-table-view :deep\(\.t-table\)[\s\S]*table-layout: fixed/)
  assert.match(source, /file-table-view :deep\(\.t-table__content\)[\s\S]*overflow-y: auto/)
})
