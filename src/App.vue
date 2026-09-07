<template>
  <div v-cloak class="app-root" :class="{ 'app-root--desktop': isDesktopApp }">
    <DesktopTitleBar v-if="showDesktopTitleBar" />
    <div id="app-container">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import DesktopTitleBar from '@/components/layout/DesktopTitleBar.vue'
import { useUserStore } from '@/stores/user'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'

defineOptions({ name: 'AppRoot' })

const route = useRoute()
const isDesktopApp = Boolean(window.farmDesktop?.isDesktop)
const showDesktopTitleBar = computed(() => isDesktopApp && !route.matched.some(record => record.meta?.fullscreen))
const userStore = useUserStore()
const realtimeStore = useRealtimeStore()
const isProtectedRoute = computed(() => route.matched.some(record => record.meta?.requiresAuth))

watch(
  [isProtectedRoute, () => userStore.token],
  ([shouldConnect, token]) => {
    if (shouldConnect && token) realtimeStore.connectWs()
    else realtimeStore.disconnectWs()
  },
  { immediate: true }
)

onUnmounted(() => realtimeStore.disconnectWs())
</script>

<style>
/* ============================================
   v-cloak: 防止 Vue 未加载完成时显示内容
   ============================================ */
[v-cloak] {
  display: none !important;
}

.app-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

#app-container {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
