<template>
  <t-header class="app-header">
    <div class="app-header__left">
      <t-button
        variant="text"
        class="header-icon-button"
        :aria-label="collapsed ? '展开菜单' : '收起菜单'"
        :title="collapsed ? '展开菜单' : '收起菜单'"
        @click="$emit('toggle-sidebar')"
      >
        <ViewListIcon size="20" />
      </t-button>

    </div>

    <div class="app-header__right">
      <div
        class="app-header__realtime-control"
        :class="{ 'app-header__realtime-control--with-action': !isWsConnected || isRealtimeStale }"
        aria-label="实时设备连接状态"
      >
        <t-tag
          size="small"
          variant="dark"
          shape="round"
          :theme="realtimeTheme"
          :title="realtimeDescription"
          aria-live="polite"
          class="app-header__realtime-status"
        >
          {{ realtimeLabel }}
        </t-tag>
        <t-button
          v-if="!isWsConnected || isRealtimeStale"
          :theme="realtimeTheme"
          variant="outline"
          shape="round"
          size="small"
          class="app-header__reconnect"
          aria-label="重新连接实时状态"
          @click="reconnectRealtime"
        >
          重连
        </t-button>
      </div>
      <t-button
        theme="default"
        variant="base"
        shape="round"
        class="app-header__dashboard-action"
        aria-label="设备看板"
        title="设备看板"
        @click="openFullscreenDashboard"
      >
        <template #icon><DesktopIcon size="18" /></template>
        设备看板
      </t-button>
      <t-button variant="text" class="header-icon-button" aria-label="消息通知" title="通知中心暂未开放" disabled>
        <MailIcon size="19" />
      </t-button>
      <t-button variant="text" class="header-icon-button app-header__optional-action" aria-label="帮助中心" title="帮助中心暂未开放" disabled>
        <HelpCircleIcon size="19" />
      </t-button>
      <t-button variant="text" class="header-icon-button app-header__optional-action" aria-label="系统设置" title="系统设置暂未开放" disabled>
        <SettingIcon size="19" />
      </t-button>
      <AppUserMenu />
    </div>
  </t-header>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import {
  DesktopIcon,
  HelpCircleIcon,
  MailIcon,
  SettingIcon,
  ViewListIcon
} from 'tdesign-icons-vue-next'
import { enterAppFullscreen } from '@/utils/fullscreen'
import { useRealtimeStore } from '@/stores/printer/realtimeStore'
import AppUserMenu from './AppUserMenu.vue'

defineOptions({ name: 'AppHeader' })

defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle-sidebar'])

const router = useRouter()
const realtimeStore = useRealtimeStore()
const { wsConnectionState, isWsConnected, isRealtimeStale, isRecovering } = storeToRefs(realtimeStore)

const realtimeLabel = computed(() => {
  if (isRecovering.value) return '恢复中'
  if (isRealtimeStale.value) return '数据陈旧'
  if (isWsConnected.value) return '实时已连接'
  return wsConnectionState.value === 'CONNECTING' ? '实时连接中' : '实时未连接'
})
const realtimeTheme = computed(() => {
  if (isRealtimeStale.value || isRecovering.value || wsConnectionState.value === 'CONNECTING') return 'warning'
  if (isWsConnected.value) return 'success'
  return 'danger'
})
const realtimeDescription = computed(() => (
  isRealtimeStale.value
    ? '实时连接异常，当前数据可能不是最新'
    : isWsConnected.value
      ? '实时设备状态已连接'
      : '实时设备状态尚未连接'
))
const reconnectRealtime = () => realtimeStore.connectWs()

const openFullscreenDashboard = async () => {
  try {
    await enterAppFullscreen()
  } catch (error) {
    console.warn('进入原生全屏失败，将继续打开全屏看板:', error)
  }

  router.push('/dashboard/fullscreen')
}

</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--app-header-height);
  padding: 0 var(--app-content-padding);
  background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
}

.app-header__left,
.app-header__right {
  display: flex;
  align-items: center;
}

.app-header__left {
  gap: 1.25rem;
}

.app-header__right {
  gap: 0.5rem;
}

.app-header__dashboard-action {
  flex-shrink: 0;
  white-space: nowrap;
}

.app-header__realtime-control {
  display: inline-flex;
  align-items: center;
  gap: 0;
  min-height: 32px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 999px;
  white-space: nowrap;
}

.app-header__realtime-status {
  border-radius: 999px;
  white-space: nowrap;
}

.app-header__realtime-control--with-action .app-header__realtime-status {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.app-header__reconnect {
  min-height: 28px;
  margin-left: -1px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.header-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--app-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.header-icon-button:hover {
  color: var(--app-text-primary);
  background: var(--app-surface-muted);
}

@media (max-width: 768px) {
  .app-header {
    padding: 0 var(--app-spacing-4);
  }

  .app-header__right .app-header__optional-action {
    display: none;
  }

  .app-header__realtime-control {
    display: none;
  }
}
</style>
