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
    <t-menu :value="activePath" :collapsed="props.collapsed && !props.isMobile" theme="light" class="app-menu app-scroll-region">
      <t-menu-group v-for="group in visibleGroups" :key="group.key" :title="props.collapsed && !props.isMobile ? '' : group.label">
        <t-menu-item
          v-for="item in group.items"
          :key="item.key"
          :value="item.to"
          @click="handleItemClick(item)"
        >
          <template #icon>
            <component :is="item.icon" size="18" />
          </template>
          {{ item.title }}
        </t-menu-item>
      </t-menu-group>
    </t-menu>

    <div v-if="!props.collapsed || props.isMobile" class="app-sidebar__footer">
      <span>FabMatrix</span>
      <span>生产管理平台</span>
    </div>
  </t-aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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

const activePath = computed(() => route.path)
const visibleGroups = computed(() => navigationGroups.map(group => ({
  ...group,
  items: group.items.filter(item => !item.roles || userStore.hasRole(item.roles))
})).filter(group => group.items.length > 0))

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

.app-menu {
  min-height: 0;
  padding: var(--app-spacing-3) var(--app-spacing-2);
  border-right: 0;
  overflow-y: auto;
  flex: 1;
}

.app-sidebar__footer {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-1);
  padding: var(--app-spacing-4) var(--app-spacing-5);
  color: var(--app-text-placeholder);
  font-size: 0.75rem;
  border-top: 1px solid var(--app-border);
  flex-shrink: 0;
}

:deep(.t-menu__group-title) {
  padding: var(--app-spacing-3) var(--app-spacing-3) var(--app-spacing-1);
  color: var(--app-text-placeholder);
  font-size: 0.75rem;
}

:deep(.t-menu__item) {
  margin: var(--app-spacing-1) 0;
  border-radius: var(--app-radius);
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
