<template>
  <aside class="file-folder-tree" aria-label="文件夹导航">
    <div class="file-folder-tree__header">
      <h2 class="file-folder-tree__title">文件夹列表</h2>
      <t-space class="file-folder-tree__actions" size="small">
        <t-button
          v-if="canCreateSelectedFolder"
          theme="primary"
          variant="outline"
          shape="square"
          size="small"
          aria-label="新建文件夹"
          title="新建文件夹"
          @click="emit('create')"
        >
          <AddIcon />
        </t-button>
      </t-space>
    </div>

    <t-input
      v-model="searchKeyword"
      class="file-folder-tree__search"
      placeholder="搜索文件夹"
      clearable
      borderless
      size="small"
    >
      <template #prefix-icon>
        <SearchIcon />
      </template>
    </t-input>

    <t-alert v-if="error" theme="error" :close-btn="false" class="file-folder-tree__error">
      {{ error }}
      <template #operation>
        <t-button variant="text" size="small" @click="refresh">重试</t-button>
      </template>
    </t-alert>

    <div v-if="loading" class="file-folder-tree__loading" role="status" aria-live="polite">
      <t-loading size="small" text="加载文件夹" />
    </div>
    <t-empty v-else-if="visibleTreeData.length === 0" size="small" description="暂无文件夹" />
    <t-tree
      v-else
      class="file-folder-tree__nodes"
      :data="visibleTreeData"
      :actived="activeKeys"
      :expanded="expandedKeys"
      activable
      hover
      expand-on-click-node
      @click="handleTreeClick"
      @expand="handleExpand"
    >
      <template #label="{ node }">
        <t-tooltip :content="node.label">
          <span
            class="file-folder-tree__label"
            :class="{ 'file-folder-tree__label--muted': unwrapFolderTreeNode(node)?.isForeignPrivateRoot === true }"
            :title="node.label"
          >
            {{ node.label }}
          </span>
        </t-tooltip>
      </template>
      <template #operations="{ node }">
        <span v-if="unwrapFolderTreeNode(node)?.canManage === true" class="file-folder-tree__operation-control">
          <t-dropdown
            :options="folderActionOptions"
            trigger="click"
            @click="dropdownAction => handleFolderAction(dropdownAction, node)"
          >
            <t-button
              class="file-folder-tree__more"
              variant="text"
              shape="square"
              size="small"
              :disabled="folderActionLoading || deletingFolderId !== null && deletingFolderId !== undefined"
              :aria-label="`打开文件夹 ${node.label} 操作面板`"
              :title="`打开文件夹 ${node.label} 操作面板`"
              @click.stop
            >
              <MoreIcon />
            </t-button>
          </t-dropdown>
        </span>
      </template>
    </t-tree>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { AddIcon, DeleteIcon, EditIcon, FolderMoveIcon, MoreIcon, SearchIcon } from 'tdesign-icons-vue-next'
import { getFileTree } from '@/api/printFile'
import { useUserStore } from '@/stores/user'
import { resolveFolderActionPayload, unwrapFolderTreeNode } from '@/utils/fileFolderActions'
import { renderIcon } from '@/utils/tdesign'

defineOptions({ name: 'FileFolderTree' })

const props = defineProps({
  currentParentId: { type: [String, Number], default: null },
  deletingFolderId: { type: [String, Number], default: null },
  folderActionLoading: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'loaded', 'create', 'folder-action'])

const folderActionOptions = [
  { content: '重命名', value: 'rename', prefixIcon: renderIcon(EditIcon) },
  { content: '移动到', value: 'move', prefixIcon: renderIcon(FolderMoveIcon) },
  { content: '删除', value: 'delete', theme: 'error', prefixIcon: renderIcon(DeleteIcon) }
]

const loading = ref(false)
const error = ref('')
const searchKeyword = ref('')
const folders = ref([])
const expandedKeys = ref([])
const userStore = useUserStore()
const currentUserId = computed(() => userStore.userInfo?.id)

const normalizeFolderName = folder => folder?.name ?? folder?.originalName ?? `文件夹 ${folder?.id ?? ''}`

const isFolder = node => node?.folder === true || node?.folder === 1 || node?.isFolder === true || node?.isFolder === 1

const hasIdentifier = value => value !== null && value !== undefined && String(value).trim() !== ''

const isRootFolder = folder => folder?.parentId === null
  || folder?.parentId === undefined
  || folder?.parentId === ''

const isForeignPrivateRoot = folder => {
  if (folder?.visibility === 'PUBLIC' || !isRootFolder(folder)) return false
  if (!hasIdentifier(folder?.userId) || !hasIdentifier(currentUserId.value)) return false
  return String(folder.userId) !== String(currentUserId.value)
}

const toTreeNode = (folder, ancestors = []) => {
  const id = String(folder.id)
  const name = normalizeFolderName(folder)
  const path = [...ancestors, { id, name }]
  const children = Array.isArray(folder.children)
    ? folder.children.filter(isFolder).map(child => toTreeNode(child, path))
    : []

  return {
    value: id,
    label: name,
    path,
    data: {
      ...folder,
      visibility: folder.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
      id,
      parentId: folder.parentId ?? null,
      isDefault: Boolean(folder.isDefault ?? folder.defaultFolder),
      isForeignPrivateRoot: isForeignPrivateRoot(folder)
    },
    children
  }
}

const folderNodes = computed(() => folders.value.filter(isFolder).map(folder => toTreeNode(folder)))

const treeData = computed(() => folderNodes.value)

const canCreateSelectedFolder = computed(() => {
  if (props.currentParentId === null || props.currentParentId === undefined) return true
  return folders.value.find(folder => String(folder.id) === String(props.currentParentId))?.canCreate === true
})

const filterTree = (nodes, keyword) => {
  if (!keyword) return nodes

  return nodes.reduce((result, node) => {
    const children = filterTree(node.children || [], keyword)
    if (node.label.includes(keyword) || children.length) {
      result.push({ ...node, children })
    }
    return result
  }, [])
}

const visibleTreeData = computed(() => filterTree(treeData.value, searchKeyword.value.trim()))

const activeKeys = computed(() => props.currentParentId === null || props.currentParentId === undefined
  ? []
  : [String(props.currentParentId)])

const virtualGroupValues = new Set(['private', 'public', '__private__', '__public__'])

const getNodeLayers = context => {
  const layers = []
  const visited = new Set()
  const visit = value => {
    if (!value || typeof value !== 'object' || visited.has(value)) return
    visited.add(value)
    layers.push(value)
    visit(value.node)
    visit(value.data)
    visit(value.rawNode)
  }
  visit(context)
  return layers
}

const isVirtualGroupNode = context => {
  const layers = getNodeLayers(context)
  if (layers.some(layer => layer.isGroup === true)) return true

  return layers.some(layer => ['value', 'key', 'id'].some(field => {
    const value = layer[field]
    return value !== undefined
      && value !== null
      && virtualGroupValues.has(String(value).trim().toLowerCase())
  }))
}

const normalizeExpandedKeys = keys => {
  const validKeys = new Set()
  const visit = nodes => nodes.forEach(node => {
    validKeys.add(String(node.value))
    visit(node.children || [])
  })
  visit(treeData.value)
  return keys.filter(key => validKeys.has(String(key))).map(String)
}

const findNodePath = (nodes, targetValue, ancestors = []) => {
  for (const node of nodes) {
    const nodeValue = String(node.value)
    if (nodeValue === String(targetValue)) return [...ancestors, nodeValue]
    const childPath = findNodePath(node.children || [], targetValue, [...ancestors, nodeValue])
    if (childPath.length) return childPath
  }
  return []
}

const getAllNodeKeys = nodes => nodes.flatMap(node => [
  String(node.value),
  ...getAllNodeKeys(node.children || [])
])

const syncExpandedKeys = currentId => {
  const target = currentId
  expandedKeys.value = normalizeExpandedKeys([
    ...expandedKeys.value,
    ...findNodePath(treeData.value, target),
    ...(searchKeyword.value.trim() ? getAllNodeKeys(visibleTreeData.value) : [])
  ])
}

const fetchTree = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await getFileTree()
    folders.value = Array.isArray(response.data) ? response.data : []
    syncExpandedKeys(props.currentParentId)
    emit('loaded', folders.value)
  } catch (requestError) {
    console.error('获取文件夹树失败:', requestError)
    error.value = requestError?.message || '文件夹列表加载失败，请重试'
  } finally {
    loading.value = false
  }
}

const refresh = () => fetchTree()

const handleTreeClick = context => {
  const node = context?.node
  if (!node) return

  const data = node.data || node
  if (isVirtualGroupNode(context)) return
  const id = String(node.value ?? data.value)
  const path = Array.isArray(node.path)
    ? node.path
    : Array.isArray(data.path) ? data.path : [{ id, name: data.label }]
  emit('select', {
    id,
    path
  })
}

const handleFolderAction = (action, node) => {
  const payload = resolveFolderActionPayload(action, node)
  if (payload && payload.folder.canManage === true) emit('folder-action', payload.folder, payload.action)
}

const handleExpand = keys => {
  expandedKeys.value = keys
}

watch(() => props.currentParentId, currentId => {
  syncExpandedKeys(currentId)
})

watch(searchKeyword, () => {
  syncExpandedKeys(props.currentParentId)
})

onMounted(fetchTree)

defineExpose({ refresh })
</script>

<style scoped>
.file-folder-tree {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  align-self: stretch;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: var(--app-spacing-4);
  overflow: hidden;
}

.file-folder-tree__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  gap: var(--app-spacing-2);
  flex: 0 0 auto;
  margin-bottom: var(--app-spacing-3);
  padding-right: var(--app-spacing-1);
}

.file-folder-tree__actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
  min-width: var(--td-comp-size-m);
  margin-right: var(--app-spacing-1);
}

.file-folder-tree__title {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-medium);
  font-weight: 600;
  line-height: var(--td-line-height-title-medium);
}

.file-folder-tree__search {
  flex: 0 0 auto;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin-bottom: var(--app-spacing-3);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-small);
  border: 1px solid transparent;
  box-shadow: none;
}

.file-folder-tree__search :deep(.t-input) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border-color: transparent;
  background: var(--app-surface-muted);
  box-shadow: none;
}

.file-folder-tree__search :deep(.t-input__wrap) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.file-folder-tree__search :deep(.t-input__inner) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.file-folder-tree__error {
  flex: 0 0 auto;
  margin-bottom: var(--app-spacing-3);
}

.file-folder-tree__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-height: 80px;
  color: var(--app-text-secondary);
}

.file-folder-tree__nodes {
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  overflow: visible;
}

.file-folder-tree :deep(.t-tree__label) {
  display: flex;
  flex: 1 1 0%;
  width: 0;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-folder-tree__label {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-folder-tree__label--muted {
  color: var(--td-text-color-secondary);
}

.file-folder-tree :deep(.t-tree__item) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border-radius: var(--td-radius-default);
}

.file-folder-tree :deep(.t-tree__label > span) {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.file-folder-tree :deep(.t-tree) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.file-folder-tree :deep(.t-tree__list) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.file-folder-tree :deep(.t-tree__operations) {
  flex: 0 0 var(--td-comp-size-m);
  width: var(--td-comp-size-m);
  min-width: var(--td-comp-size-m);
  max-width: var(--td-comp-size-m);
  box-sizing: border-box;
  margin-left: var(--app-spacing-1);
}

.file-folder-tree :deep(.t-tree__item:hover),
.file-folder-tree :deep(.t-tree__item:focus-within) {
  background-color: var(--td-bg-color-container-hover);
}

.file-folder-tree :deep(.t-tree__item:hover .t-tree__label),
.file-folder-tree :deep(.t-tree__item:focus-within .t-tree__label),
.file-folder-tree :deep(.t-tree__item.t-is-active .t-tree__label) {
  background-color: transparent;
}

.file-folder-tree :deep(.t-tree__item.t-is-active) {
  background-color: var(--td-brand-color-light);
}

.file-folder-tree__more {
  display: inline-flex;
  flex: 0 0 auto;
  width: var(--td-comp-size-m);
  height: var(--td-comp-size-m);
  padding: 0;
  color: var(--app-text-secondary);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s ease;
}

.file-folder-tree__operation-control {
  display: inline-flex;
  flex: 0 0 var(--td-comp-size-m);
  width: var(--td-comp-size-m);
  min-width: var(--td-comp-size-m);
  max-width: var(--td-comp-size-m);
}

.file-folder-tree__operation-control :deep(.t-dropdown) {
  display: inline-flex;
  flex: 0 0 var(--td-comp-size-m);
  width: var(--td-comp-size-m);
}

.file-folder-tree :deep(.t-tree__item:hover) .file-folder-tree__more,
.file-folder-tree :deep(.t-tree__item:focus-within) .file-folder-tree__more,
.file-folder-tree__more:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

.file-folder-tree__more:hover {
  color: var(--app-text-primary);
  background: var(--app-surface-muted);
}

@media (max-width: 768px) {
  .file-folder-tree {
    min-height: 240px;
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }
}
</style>
