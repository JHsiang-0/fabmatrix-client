<template>
  <aside class="file-folder-tree" aria-label="文件夹导航">
    <div class="file-folder-tree__header">
      <div>
        <h2 class="file-folder-tree__title">文件夹列表</h2>
        <p class="file-folder-tree__description">按目录查看文件</p>
      </div>
      <t-space size="small">
        <t-button
          variant="text"
          shape="square"
          size="small"
          aria-label="新建文件夹"
          @click="emit('create')"
        >
          <AddIcon />
        </t-button>
        <t-button
          variant="text"
          shape="square"
          size="small"
          :loading="loading"
          aria-label="刷新文件夹列表"
          @click="refresh"
        >
          <RefreshIcon />
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
      :max-height="treeMaxHeight"
      @click="handleTreeClick"
      @expand="handleExpand"
    />
  </aside>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { AddIcon, SearchIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import { getFileTree } from '@/api/printFile'

defineOptions({ name: 'FileFolderTree' })

const ROOT_VALUE = '__root__'

const props = defineProps({
  currentParentId: { type: [String, Number], default: null },
  treeMaxHeight: { type: [String, Number], default: '100%' }
})

const emit = defineEmits(['select', 'loaded'])

const loading = ref(false)
const error = ref('')
const searchKeyword = ref('')
const folders = ref([])
const expandedKeys = ref([ROOT_VALUE])

const normalizeFolderName = folder => folder?.name ?? folder?.originalName ?? `文件夹 ${folder?.id ?? ''}`

const isFolder = node => node?.folder === true || node?.folder === 1 || node?.isFolder === true || node?.isFolder === 1

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
    children
  }
}

const treeData = computed(() => [{
  value: ROOT_VALUE,
  label: '我的文件夹',
  path: [],
  children: folders.value.filter(isFolder).map(folder => toTreeNode(folder))
}])

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

const activeKeys = computed(() => [props.currentParentId === null || props.currentParentId === undefined
  ? ROOT_VALUE
  : String(props.currentParentId)])

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
  const target = currentId === null || currentId === undefined ? ROOT_VALUE : currentId
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
  const id = String(node.value ?? data.value)
  if (id === ROOT_VALUE) {
    emit('select', { id: null, path: [] })
    return
  }

  emit('select', {
    id,
    path: Array.isArray(data.path) ? data.path : [{ id, name: data.label }]
  })
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
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: var(--app-spacing-4);
  overflow: hidden;
}

.file-folder-tree__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-spacing-2);
  flex: 0 0 auto;
  margin-bottom: var(--app-spacing-3);
}

.file-folder-tree__title {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--td-font-size-title-medium);
  font-weight: 600;
  line-height: var(--td-line-height-title-medium);
}

.file-folder-tree__description {
  margin: 4px 0 0;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  line-height: var(--td-line-height-body-small);
}

.file-folder-tree__search {
  flex: 0 0 auto;
  margin-bottom: var(--app-spacing-3);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-small);
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
  min-height: 0;
  overflow-y: auto;
}

.file-folder-tree :deep(.t-tree__label) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .file-folder-tree {
    min-height: 240px;
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }
}
</style>
