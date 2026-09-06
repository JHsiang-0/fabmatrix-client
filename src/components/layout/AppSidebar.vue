<template>
  <t-aside
    class="app-sidebar"
    :class="{
      'app-sidebar--collapsed': props.collapsed && !props.isMobile,
      'app-sidebar--mobile-hidden': props.isMobile && !props.mobileOpen,
      'app-sidebar--mobile-open': props.isMobile && props.mobileOpen
    }"
    :width="props.isMobile ? 'var(--app-sidebar-mobile-width)' : (props.collapsed ? 'var(--app-sidebar-collapsed-width)' : 'var(--app-sidebar-width)')"
  >
    <div class="app-sidebar__top-spacer" aria-hidden="true" />

    <t-menu
      v-model:expanded="expandedGroupKeys"
      :value="activePath"
      :collapsed="props.collapsed && !props.isMobile"
      :expand-mutex="true"
      expand-type="normal"
      theme="light"
      class="app-menu app-scroll-region"
    >
      <t-submenu v-for="group in visibleGroups" :key="group.key" :value="group.key">
        <template #icon>
          <component :is="group.icon" size="18" />
        </template>
        <template #title>{{ group.label }}</template>
        <t-menu-item
          v-for="item in group.items"
          :key="item.key"
          :value="item.to"
          @click="handleItemClick(item)"
        >
          {{ item.title }}
        </t-menu-item>
      </t-submenu>
    </t-menu>

    <div v-if="!props.collapsed || props.isMobile" class="app-sidebar__footer">
      <span>FabMatrix</span>
      <t-tag class="app-sidebar__version" size="small" theme="default" variant="light" shape="round">v{{ appVersion }}</t-tag>
    </div>
  </t-aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import packageJson from '../../../package.json'
import { useUserStore } from '@/stores/user'
import { navigationGroups } from '@/config/navigation'

defineOptions({ name: 'AppSidebar' })

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  mobileOpen: {
    type: Boolean,
    default: false
  }
})

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const appVersion = packageJson.version

const activePath = computed(() => route.path)
const visibleGroups = computed(() => navigationGroups.map(group => ({
  ...group,
  items: group.items.filter(item => !item.roles || userStore.hasRole(item.roles))
})).filter(group => group.items.length > 0))
const expandedGroupKeys = ref([])

const syncExpandedGroup = () => {
  const activeGroup = visibleGroups.value.find(group => group.items.some(item => item.to === route.path))
  if (activeGroup) expandedGroupKeys.value = [activeGroup.key]
}

watch([() => route.path, visibleGroups], syncExpandedGroup, { immediate: true })

const handleItemClick = item => {
  if (route.path !== item.to) {
    router.push(item.to)
  }
}

</script>

<style scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--app-surface);
  border-right: 1px solid var(--app-border);
  flex-shrink: 0;
  transition: width 0.2s ease, transform 0.2s ease;
}

.app-sidebar__top-spacer {
  box-sizing: border-box;
  flex: 0 0 var(--app-header-height);
  height: var(--app-header-height);
  border-bottom: 1px solid var(--app-border);
}

.app-menu {
  min-height: 0;
  padding: var(--app-spacing-3) var(--app-spacing-2);
  border-right: 0;
  overflow-y: auto;
  flex: 1;
}

.app-sidebar__footer {
  display: flex;
  align-items: center;
  gap: var(--app-spacing-2);
  padding: var(--app-spacing-2) var(--app-spacing-5);
  color: var(--app-text-placeholder);
  font-size: 0.75rem;
  line-height: 24px;
  border-top: 1px solid var(--app-border);
  flex-shrink: 0;
  white-space: nowrap;
}

.app-sidebar__footer > span,
.app-sidebar__version {
  font-size: 0.75rem;
  line-height: 24px;
}

:deep(.t-menu__item) {
  margin: 2px 0;
  border-radius: var(--app-radius);
}

:deep(.t-submenu__item) {
  margin: 1px 0;
}

:deep(.t-menu__item.t-is-active) {
  color: var(--app-primary);
  background: var(--app-primary-light);
}

@media (max-width: 768px) {
  .app-sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 1001;
    width: var(--app-sidebar-mobile-width) !important;
    transform: translateX(0);
  }

  .app-sidebar.app-sidebar--mobile-hidden {
    transform: translateX(-100%);
  }
}
</style>
