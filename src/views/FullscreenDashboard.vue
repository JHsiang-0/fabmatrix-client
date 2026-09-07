<template>
  <div class="fullscreen-dashboard" :class="{ 'is-compact': viewportWidth < 768 }">
    <FarmDashboard :realtime-notice-override="realtimeNotice">
      <template #fullscreen-action>
        <t-button class="dashboard-action-button" theme="danger" variant="base" size="small" @click.stop="leaveFullscreenDashboard">
          退出全屏
        </t-button>
      </template>
    </FarmDashboard>

    <div v-if="!fullscreenSupported" class="fullscreen-dashboard__support-notice">
      <t-alert theme="warning" title="当前浏览器不支持原生全屏，仍可使用监控看板" :close-btn="false" />
    </div>

    <div v-if="snapshotError" class="fullscreen-dashboard__state fullscreen-dashboard__state--error">
      <t-card bordered>
        <t-alert theme="error" title="实时看板快照加载失败" :close-btn="false">
          <template #default>{{ snapshotErrorMessage }}</template>
          <template #operation>
            <t-button size="small" variant="outline" :loading="retrying" @click="retrySnapshot">重试</t-button>
          </template>
        </t-alert>
      </t-card>
    </div>

    <div v-else-if="snapshotLoading" class="fullscreen-dashboard__state">
      <t-card bordered>
        <t-loading text="正在加载打印机快照..." />
      </t-card>
    </div>

    <div v-else-if="noDevices" class="fullscreen-dashboard__state">
      <t-card bordered>
        <t-empty type="empty" title="看板暂无设备" description="请先在打印机管理中分配设备位置">
          <template #action>
            <t-button theme="primary" @click="router.push('/printers')">前往设备管理</t-button>
          </template>
        </t-empty>
      </t-card>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FarmDashboard from '@/components/FarmDashboard.vue'
import { usePrinterStore } from '@/stores/printer'
import { exitAppFullscreen } from '@/utils/fullscreen'

defineOptions({ name: 'FullscreenDashboard' })

const router = useRouter()
const store = usePrinterStore()
const viewportWidth = ref(window.innerWidth)
const fullscreenSupported = ref(true)
const retrying = ref(false)
const reconnecting = ref(false)
let leaving = false
let removeDesktopFullscreenListener = null

const snapshotLoading = computed(() => store.loading && !store.rawDeviceList.length)
const snapshotError = computed(() => store.deviceError)
const snapshotErrorMessage = computed(() => snapshotError.value?.message || '无法获取设备快照，请检查服务连接后重试')
const noDevices = computed(() => !store.loading && !snapshotError.value && !store.rawDeviceList.length)
const realtimeNotice = computed(() => {
  if (store.isRecovering) return '正在恢复实时状态，当前显示最近一次可用快照'
  if (store.isRealtimeStale) return '实时数据已陈旧，当前看板需要重新收敛'
  if (store.wsConnectionState !== 'OPEN') return 'WebSocket 未连接，当前显示 REST 快照'
  return ''
})

const leaveFullscreenDashboard = () => {
  if (leaving) return
  leaving = true

  // 不等待全屏 API 的异步结果，确保按钮点击后立即恢复普通页面。
  void exitAppFullscreen().catch(error => {
    console.warn('退出全屏失败，将继续返回普通监控页:', error)
  })
  void router.replace({ name: 'printers' })
}

const handleBrowserFullscreenChange = () => {
  if (window.farmDesktop?.isDesktop) return

  if (!document.fullscreenElement) {
    void leaveFullscreenDashboard()
  }
}

const handleDesktopFullscreenChange = isFullscreen => {
  if (!isFullscreen) {
    void leaveFullscreenDashboard()
  }
}

const handleKeydown = event => {
  if (event.key === 'Escape') void leaveFullscreenDashboard()
}

const handleViewportResize = () => {
  viewportWidth.value = window.innerWidth
}

const retrySnapshot = async () => {
  if (retrying.value) return
  retrying.value = true
  try {
    await store.fetchDeviceData()
    reconnectRealtime()
  } catch (error) {
    console.warn('重试打印机快照失败:', error)
  } finally {
    retrying.value = false
  }
}

const reconnectRealtime = () => {
  if (reconnecting.value || store.wsConnectionState === 'OPEN') return
  reconnecting.value = true
  store.connectWs()
  window.setTimeout(() => {
    reconnecting.value = false
  }, 800)
}

onMounted(() => {
  fullscreenSupported.value = Boolean(
    window.farmDesktop?.isDesktop ||
    (document.fullscreenEnabled && document.documentElement.requestFullscreen)
  )
  document.addEventListener('fullscreenchange', handleBrowserFullscreenChange)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleViewportResize)
  removeDesktopFullscreenListener = window.farmDesktop?.onFullscreenChange?.(handleDesktopFullscreenChange) || null
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleBrowserFullscreenChange)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleViewportResize)
  removeDesktopFullscreenListener?.()
  void exitAppFullscreen().catch(() => {})
})
</script>

<style scoped>
.fullscreen-dashboard {
  position: relative;
  width: 100vw;
  height: 100dvh;
  min-height: 100%;
  overflow: hidden;
  background: var(--app-page-background);
}

.fullscreen-dashboard__support-notice {
  position: fixed;
  top: var(--app-spacing-4);
  left: 50%;
  z-index: 101;
  width: min(560px, calc(100vw - var(--app-spacing-8)));
  transform: translateX(-50%);
}

.fullscreen-dashboard__support-notice { top: var(--app-spacing-4); }

.fullscreen-dashboard__state {
  position: fixed;
  inset: 0;
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--app-spacing-6);
  background: color-mix(in srgb, var(--app-page-background) 86%, transparent);
}

.fullscreen-dashboard__state .t-card { width: min(520px, 100%); }
.fullscreen-dashboard__state--error .t-card { width: min(680px, 100%); }

@media (max-width: 767px) {
  .fullscreen-dashboard__support-notice { top: 3.75rem; }
}
</style>
