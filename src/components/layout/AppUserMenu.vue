<template>
  <t-dropdown trigger="click" @click="handleCommand">
    <t-button variant="text" class="user-menu-trigger" aria-label="打开用户菜单">
      <t-avatar size="32" :image="userStore.userInfo.avatar || undefined">
        {{ userStore.userInfo.username?.charAt(0).toUpperCase() || 'U' }}
      </t-avatar>
      <span class="user-menu-trigger__name">{{ userStore.userInfo.username || '管理员' }}</span>
      <ChevronDownIcon size="16" class="user-menu-trigger__arrow" />
    </t-button>

    <template #dropdown>
      <t-dropdown-menu>
        <t-dropdown-item value="profile">
          <template #prefixIcon><UserIcon size="16" /></template>
          个人中心
        </t-dropdown-item>
        <t-dropdown-item value="logout">
          <template #prefixIcon><PoweroffIcon size="16" /></template>
          退出登录
        </t-dropdown-item>
      </t-dropdown-menu>
    </template>
  </t-dropdown>
</template>

<script setup>
import { useRouter } from 'vue-router'
import {
  ChevronDownIcon,
  PoweroffIcon,
  UserIcon
} from 'tdesign-icons-vue-next'
import { useUserStore } from '@/stores/user'
import { confirmMessage, message } from '@/utils/message'

defineOptions({ name: 'AppUserMenu' })

const router = useRouter()
const userStore = useUserStore()

const handleCommand = item => {
  const command = typeof item === 'string' ? item : item?.value

  if (command === 'profile') {
    router.push('/profile')
  } else if (command === 'logout') {
    confirmMessage('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      userStore.logout()
      router.push('/login')
      message.success('已退出登录')
    }).catch(() => {})
  }
}
</script>

<style scoped>
.user-menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.875rem;
  min-height: 40px;
  padding: 0 0.5rem;
  color: var(--app-text-primary);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.user-menu-trigger:hover {
  background: var(--app-surface-muted);
}

.user-menu-trigger__name {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  max-width: 8rem;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-trigger__arrow {
  color: var(--app-text-secondary);
  transition: transform 0.2s ease;
}

.user-menu-trigger:hover .user-menu-trigger__arrow {
  transform: translateY(1px);
}
</style>
