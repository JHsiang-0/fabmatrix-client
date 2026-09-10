<template>
  <header class="desktop-titlebar" aria-label="应用标题栏" @dblclick="handleDoubleClick">
    <div class="desktop-titlebar__brand">
      <img src="/icon.png" alt="" aria-hidden="true" class="desktop-titlebar__logo">
      <span class="desktop-titlebar__title">嘉东三维联动3D打印机实时控制系统</span>
    </div>

    <div class="desktop-titlebar__actions" aria-label="窗口控制">
      <t-button variant="text" shape="square" class="desktop-titlebar__button desktop-titlebar__button--minimize"
        aria-label="最小化窗口" title="最小化" @click="minimize">
        <MinusIcon size="16" />
      </t-button>
      <t-button variant="text" shape="square" class="desktop-titlebar__button"
        :aria-label="isMaximized ? '还原窗口' : '最大化窗口'" :title="isMaximized ? '还原' : '最大化'" @click="toggleMaximize">
        <FullscreenExitIcon v-if="isMaximized" size="16" />
        <FullscreenIcon v-else size="16" />
      </t-button>
      <t-button variant="text" shape="square" class="desktop-titlebar__button desktop-titlebar__button--close"
        aria-label="关闭窗口" title="关闭" @click="closeWindow">
        <CloseIcon size="16" />
      </t-button>
    </div>
  </header>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { CloseIcon, FullscreenExitIcon, FullscreenIcon, MinusIcon } from 'tdesign-icons-vue-next'

defineOptions({ name: 'DesktopTitleBar' })

const isMaximized = ref(false)
let removeStateListener = null

const applyWindowState = state => {
  isMaximized.value = Boolean(state?.isMaximized)
}

const minimize = () => window.farmDesktop?.minimize?.()
const toggleMaximize = () => window.farmDesktop?.toggleMaximize?.().then(applyWindowState)
const closeWindow = () => window.farmDesktop?.close?.()

const handleDoubleClick = event => {
  if (event.target.closest('button, a, input, select, textarea')) return
  void toggleMaximize()
}

onMounted(async () => {
  const state = await window.farmDesktop?.getWindowState?.()
  applyWindowState(state)
  removeStateListener = window.farmDesktop?.onWindowStateChange?.(applyWindowState) || null
})

onUnmounted(() => {
  removeStateListener?.()
})
</script>

<style scoped>
.desktop-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 var(--app-desktop-titlebar-height);
  width: 100%;
  min-width: 0;
  padding-left: var(--app-spacing-4);
  color: var(--app-text-primary);
  background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
  -webkit-app-region: drag;
  user-select: none;
}

.desktop-titlebar__brand,
.desktop-titlebar__actions {
  display: flex;
  align-items: center;
}

.desktop-titlebar__brand {
  min-width: 0;
  gap: var(--app-spacing-2);
}

.desktop-titlebar__logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.desktop-titlebar__title {
  overflow: hidden;
  font-size: var(--td-font-size-body-medium);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-titlebar__actions {
  align-self: stretch;
  -webkit-app-region: no-drag;
}

.desktop-titlebar__button {
  width: 46px;
  height: 100%;
  padding: 0;
  color: var(--app-text-secondary);
  border-radius: 0;
}

.desktop-titlebar__button:hover {
  color: var(--app-text-primary);
  background: var(--app-surface-hover);
}

.desktop-titlebar__button--close:hover {
  color: var(--app-text-on-brand);
  background: var(--app-danger);
}

@media (max-width: 480px) {
  .desktop-titlebar {
    padding-left: var(--app-spacing-3);
  }

  .desktop-titlebar__button {
    width: 40px;
  }
}
</style>
