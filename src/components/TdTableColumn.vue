<script setup>
import { inject, onMounted, onUnmounted, useSlots } from 'vue'

const props = defineProps({
  prop: { type: String, default: '' },
  label: { type: String, default: '' },
  width: { type: [String, Number], default: undefined },
  minWidth: { type: [String, Number], default: undefined },
  align: { type: String, default: undefined },
  fixed: { type: [String, Boolean], default: undefined },
  type: { type: String, default: undefined },
  checkProps: { type: [Object, Function], default: undefined },
  showOverflowTooltip: { type: Boolean, default: false }
})

const register = inject('farm-table-register-column')
const slots = useSlots()
let unregister

onMounted(() => {
  if (register) {
    unregister = register({ ...props, slot: slots.default })
  }
})

onUnmounted(() => unregister?.())
</script>

<template>
  <span v-if="false" />
</template>
