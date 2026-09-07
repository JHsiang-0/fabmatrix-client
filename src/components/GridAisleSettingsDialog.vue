<template>
  <t-dialog
    v-model:visible="dialogVisible"
    :header="isEditing ? '编辑过道' : '设置过道'"
    width="440px"
    :confirm-btn="{ content: isEditing ? '保存设置' : '确认设置', theme: 'primary' }"
    @confirm="handleConfirm"
  >
    <t-form label-align="top">
      <t-alert theme="info" :close-btn="false" class="aisle-settings__notice">
        将在第 {{ index }} {{ axisLabel }}后插入过道，不会改变已有设备的物理坐标。
      </t-alert>
      <t-form-item label="过道名称">
        <t-input v-model="draft.label" maxlength="12" placeholder="请输入过道名称" />
      </t-form-item>
      <t-form-item :label="axis === 'row' ? '过道高度' : '过道宽度'">
        <t-input-number v-model="draft.size" :min="48" :max="240" suffix="px" theme="normal" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

defineOptions({ name: 'GridAisleSettingsDialog' })

const props = defineProps({
  visible: { type: Boolean, default: false },
  axis: { type: String, default: 'column' },
  index: { type: Number, default: 1 },
  aisle: { type: Object, default: null }
})

const emit = defineEmits(['update:visible', 'confirm'])
const dialogVisible = ref(props.visible)
const draft = reactive({ label: '过道', size: 100 })
const isEditing = computed(() => Boolean(props.aisle))
const axisLabel = computed(() => props.axis === 'row' ? '行' : '列')

function copyDraft() {
  draft.label = props.aisle?.label || '过道'
  draft.size = props.aisle?.size || (props.axis === 'row' ? 80 : 100)
}

function handleConfirm() {
  emit('confirm', {
    label: draft.label.trim() || '过道',
    size: Number(draft.size) || (props.axis === 'row' ? 80 : 100)
  })
}

watch(() => props.visible, visible => {
  dialogVisible.value = visible
  if (visible) copyDraft()
})

watch(dialogVisible, visible => emit('update:visible', visible))

copyDraft()
</script>

<style scoped>
.aisle-settings__notice {
  margin-bottom: var(--app-spacing-4);
}
</style>
