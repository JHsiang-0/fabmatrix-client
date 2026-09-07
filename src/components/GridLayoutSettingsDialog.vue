<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="布局设置"
    width="620px"
    :confirm-btn="{ content: '应用布局', theme: 'primary' }"
    @confirm="handleConfirm"
  >
    <t-form label-align="top" class="grid-layout-form">
      <div class="grid-layout-form__basic">
        <t-form-item label="行数">
          <t-input-number v-model="draft.rowCount" :min="1" :max="30" theme="normal" />
        </t-form-item>
        <t-form-item label="设备列数">
          <t-input-number v-model="draft.columnCount" :min="1" :max="60" theme="normal" />
        </t-form-item>
      </div>

      <div class="grid-layout-form__heading">
        <div>
          <strong>过道</strong>
          <p>过道位置按实际设备列计算，不会改变已保存的设备坐标。</p>
        </div>
        <t-button variant="outline" size="small" @click="addAisle">新增过道</t-button>
      </div>

      <t-alert v-if="!draft.aisles.length" theme="info" :close-btn="false">
        当前未设置过道，网格将连续显示所有设备列。
      </t-alert>

      <div v-else class="grid-layout-aisles">
        <div v-for="(aisle, index) in draft.aisles" :key="aisle.id" class="grid-layout-aisle">
          <t-form-item label="设备列之后">
            <t-input-number v-model="aisle.afterColumn" :min="0" :max="draft.columnCount" theme="normal" />
          </t-form-item>
          <t-form-item label="名称">
            <t-input v-model="aisle.label" maxlength="12" />
          </t-form-item>
          <t-form-item label="宽度">
            <t-input-number v-model="aisle.width" :min="48" :max="240" suffix="px" theme="normal" />
          </t-form-item>
          <t-button theme="danger" variant="text" @click="removeAisle(index)">删除</t-button>
        </div>
      </div>

      <div class="grid-layout-form__footer">
        <span>默认布局：4 行 × 12 列，1 个过道</span>
        <t-button variant="text" @click="resetDraft">恢复默认</t-button>
      </div>
    </t-form>
  </t-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { createGridConfig, getDefaultGridConfig } from '@/utils/gridLayout'

defineOptions({ name: 'GridLayoutSettingsDialog' })

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:visible', 'confirm'])
const dialogVisible = ref(props.visible)
const draft = reactive({ rowCount: 1, columnCount: 1, aisles: [] })

function copyConfig(config) {
  const normalized = createGridConfig(config)
  draft.rowCount = normalized.rowCount
  draft.columnCount = normalized.columnCount
  draft.aisles = normalized.aisles.map(aisle => ({ ...aisle }))
}

function resetDraft() {
  copyConfig(getDefaultGridConfig())
}

function addAisle() {
  const occupied = new Set(draft.aisles.map(aisle => Number(aisle.afterColumn)))
  let afterColumn = Math.min(draft.columnCount, 1)
  while (occupied.has(afterColumn) && afterColumn < draft.columnCount) afterColumn += 1
  if (occupied.has(afterColumn)) return
  draft.aisles.push({
    id: `aisle-${Date.now()}`,
    afterColumn,
    label: '过道',
    width: 100
  })
}

function removeAisle(index) {
  draft.aisles.splice(index, 1)
}

function handleConfirm() {
  emit('confirm', createGridConfig(draft))
}

watch(() => props.visible, visible => {
  dialogVisible.value = visible
  if (visible) copyConfig(props.config)
})

watch(dialogVisible, visible => emit('update:visible', visible))

copyConfig(props.config)
</script>

<style scoped>
.grid-layout-form__basic {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-spacing-4);
}

.grid-layout-form__heading,
.grid-layout-form__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-3);
}

.grid-layout-form__heading {
  margin: var(--app-spacing-2) 0 var(--app-spacing-3);
}

.grid-layout-form__heading p,
.grid-layout-form__footer span {
  margin: var(--app-spacing-1) 0 0;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.grid-layout-aisles {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-3);
}

.grid-layout-aisle {
  display: grid;
  grid-template-columns: 1fr 1.3fr 1fr auto;
  align-items: end;
  gap: var(--app-spacing-3);
  padding: var(--app-spacing-3);
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
}

.grid-layout-aisle :deep(.t-form__item) {
  margin-bottom: 0;
}

.grid-layout-form__footer {
  margin-top: var(--app-spacing-4);
  padding-top: var(--app-spacing-3);
  border-top: 1px solid var(--app-border);
}

@media (max-width: 560px) {
  .grid-layout-form__basic,
  .grid-layout-aisle {
    grid-template-columns: 1fr;
  }

  .grid-layout-form__heading,
  .grid-layout-form__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
