<template>
  <div class="profile-page app-page-shell app-page-background">
    <PageHeader title="个人中心" description="管理个人资料与登录安全设置" />
    <div class="profile-workspace">
      <t-card class="profile-account-card">
        <div class="profile-account-card__header">
          <div class="profile-account-card__identity">
            <t-avatar size="64px" shape="circle">
              {{ (userStore.userInfo.username || 'U').slice(0, 1).toUpperCase() }}
            </t-avatar>
            <div>
              <p class="profile-account-card__eyebrow">当前账户</p>
              <h2 class="profile-account-card__title">{{ userStore.userInfo.username || '未登录用户' }}</h2>
              <t-tag theme="primary" variant="light-outline">
                {{ userStore.userInfo.role || '未设置角色' }}
              </t-tag>
            </div>
          </div>
          <t-tag theme="success" variant="light-outline">已登录</t-tag>
        </div>
        <t-descriptions class="profile-account-card__details" :column="2" size="small">
          <t-descriptions-item label="用户 ID">{{ userId || '—' }}</t-descriptions-item>
          <t-descriptions-item label="账户角色">{{ userStore.userInfo.role || '—' }}</t-descriptions-item>
        </t-descriptions>
      </t-card>

      <div class="profile-grid">
        <t-card title="个人资料" class="profile-card">
          <t-loading v-if="profileLoading && !profileLoaded" class="profile-loading" />
          <t-alert v-else-if="profileError" theme="error" :close-btn="false">
            {{ profileError }}
            <template #operation><t-button size="small" variant="outline" @click="loadProfile">重试</t-button></template>
          </t-alert>
          <t-form v-else :data="profileForm" :rules="profileRules" label-align="top" @submit="saveProfile">
            <t-alert v-if="profileSaveError" theme="error" :close-btn="false" class="profile-form-alert">{{ profileSaveError }}</t-alert>
            <t-form-item label="用户名">
              <t-input :value="userStore.userInfo.username" disabled />
            </t-form-item>
            <t-form-item name="email" label="邮箱">
              <t-input v-model="profileForm.email" placeholder="请输入邮箱（可选）" clearable />
            </t-form-item>
            <t-form-item name="phone" label="手机号">
              <t-input v-model="profileForm.phone" placeholder="请输入手机号（可选）" clearable />
            </t-form-item>
            <t-space>
              <t-button theme="primary" type="submit" :loading="profileLoading" :disabled="!profileDirty">保存资料</t-button>
              <t-button variant="outline" :disabled="!profileDirty || profileLoading" @click="cancelProfileChanges">取消修改</t-button>
            </t-space>
          </t-form>
        </t-card>

        <t-card title="账户安全" class="profile-card">
          <t-alert v-if="passwordError" theme="error" :close-btn="false" class="profile-form-alert">{{ passwordError }}</t-alert>
          <t-form :data="passwordForm" :rules="passwordRules" label-align="top" @submit="savePassword">
            <t-form-item name="oldPassword" label="当前密码">
              <t-input v-model="passwordForm.oldPassword" type="password" autocomplete="current-password" />
            </t-form-item>
            <t-form-item name="newPassword" label="新密码">
              <t-input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" />
            </t-form-item>
            <t-form-item name="confirmPassword" label="确认新密码">
              <t-input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" />
            </t-form-item>
            <p class="profile-password-hint">密码长度 6-20 位，必须包含大写字母、小写字母和数字。</p>
            <t-button theme="primary" type="submit" :loading="passwordLoading">修改密码</t-button>
          </t-form>
        </t-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { changePassword, getProfile, updateProfile } from '@/api/user'
import { useUserStore } from '@/stores/user'
import { confirmMessage, message } from '@/utils/message'
import PageHeader from '@/components/layout/PageHeader.vue'

defineOptions({ name: 'ProfileView' })

const userStore = useUserStore()
const router = useRouter()
const userId = userStore.userInfo.id
const profileLoading = ref(false)
const profileLoaded = ref(false)
const profileError = ref('')
const passwordLoading = ref(false)
const profileSaveError = ref('')
const passwordError = ref('')
const profileForm = reactive({ email: '', phone: '' })
const savedProfile = reactive({ email: '', phone: '' })
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const profileDirty = computed(() => profileForm.email !== savedProfile.email || profileForm.phone !== savedProfile.phone)

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,20}$/
const profileRules = {
  email: [{ email: true, message: '邮箱格式不正确', trigger: 'blur' }],
  phone: [{ pattern: /^$|^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }]
}
const passwordRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }, {
    validator: value => passwordPattern.test(value) ? true : { result: false, message: '密码必须为6-20位且包含大小写字母和数字' },
    trigger: 'blur'
  }],
  confirmPassword: [{ required: true, message: '请再次输入新密码', trigger: 'blur' }, {
    validator: value => value === passwordForm.newPassword ? true : { result: false, message: '两次输入的新密码不一致' },
    trigger: 'blur'
  }]
}

const loadProfile = async () => {
  profileLoading.value = true
  profileError.value = ''
  try {
    const response = await getProfile(userId)
    const nextProfile = {
      email: response.data?.email ?? '',
      phone: response.data?.phone ?? ''
    }
    Object.assign(profileForm, nextProfile)
    Object.assign(savedProfile, nextProfile)
    profileLoaded.value = true
  } catch (error) {
    profileError.value = error?.message || '个人资料加载失败，请重试。'
    message.error(profileError.value)
  } finally {
    profileLoading.value = false
  }
}

const saveProfile = async ({ validateResult }) => {
  if (validateResult !== true) return
  profileLoading.value = true
  profileSaveError.value = ''
  try {
    const data = {
      email: profileForm.email.trim() || null,
      phone: profileForm.phone.trim() || null
    }
    await updateProfile(userId, data)
    Object.assign(profileForm, { email: data.email || '', phone: data.phone || '' })
    Object.assign(savedProfile, profileForm)
    userStore.userInfo = { ...userStore.userInfo, ...data }
    message.success('资料保存成功')
  } catch (error) {
    profileSaveError.value = error?.message || '资料保存失败，请重试。'
    message.error(profileSaveError.value)
  } finally {
    profileLoading.value = false
  }
}

const cancelProfileChanges = async () => {
  if (!profileDirty.value) return
  try {
    await confirmMessage('放弃当前未保存的资料修改吗？', '取消修改', {
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
      type: 'warning'
    })
  } catch {
    return
  }
  Object.assign(profileForm, savedProfile)
}

const savePassword = async ({ validateResult }) => {
  if (validateResult !== true) return
  try {
    await confirmMessage('修改密码成功后，当前会话将退出，请使用新密码重新登录。', '确认修改密码', {
      confirmButtonText: '确认修改',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  passwordLoading.value = true
  passwordError.value = ''
  try {
    await changePassword(userId, {
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword
    })
    message.success('密码修改成功，请重新登录')
    userStore.logout()
    await router.replace({ name: 'login' })
  } catch (error) {
    passwordError.value = error?.message || '密码修改失败，请检查当前密码后重试。'
    message.error(passwordError.value)
  } finally {
    passwordLoading.value = false
  }
}

const handleBeforeUnload = event => {
  if (!profileDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  loadProfile()
  window.addEventListener('beforeunload', handleBeforeUnload)
})
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload))
</script>

<style scoped>
.profile-page {
  min-height: 100%;
  overflow: visible;
}

.profile-workspace {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--app-spacing-5);
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.profile-account-card {
  border-color: var(--td-brand-color-2);
  background: var(--td-brand-color-1);
}

.profile-account-card :deep(.t-card__body) {
  padding: var(--app-spacing-5) var(--app-spacing-6);
}

.profile-account-card__header,
.profile-account-card__identity {
  display: flex;
  align-items: center;
}

.profile-account-card__header {
  justify-content: space-between;
  gap: var(--app-spacing-4);
}

.profile-account-card__identity {
  gap: var(--app-spacing-4);
  min-width: 0;
}

.profile-account-card__eyebrow,
.profile-account-card__title {
  margin: 0;
}

.profile-account-card__eyebrow {
  color: var(--app-text-secondary);
  font-size: 12px;
}

.profile-account-card__title {
  margin: 2px 0 6px;
  color: var(--app-text-primary);
  font-size: 20px;
  line-height: 1.3;
}

.profile-account-card__details {
  margin-top: var(--app-spacing-5);
  padding-top: var(--app-spacing-4);
  border-top: 1px solid var(--td-brand-color-2);
}

.profile-grid {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-spacing-5);
  width: 100%;
  min-width: 0;
  min-height: 0;
  align-items: stretch;
}

.profile-card {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  height: 100%;
  min-width: 0;
}

.profile-card :deep(.t-card__body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.profile-card :deep(.t-form) {
  width: min(100%, 560px);
}

.profile-form-alert {
  margin-bottom: var(--app-spacing-4);
}

.profile-password-hint {
  margin: 0 0 var(--app-spacing-4);
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .profile-grid {
    flex: 0 0 auto;
    grid-template-columns: minmax(0, 1fr);
  }

  .profile-card {
    height: auto;
  }
}
</style>

<style scoped>
.profile-loading { min-height: 180px; }
</style>
