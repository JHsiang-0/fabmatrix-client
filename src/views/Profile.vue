<template>
  <div class="profile-page app-page-shell app-page-background">
    <PageHeader title="个人中心" description="管理个人资料与登录安全设置" />
    <div class="profile-grid">
      <t-card bordered hover-shadow title="个人资料" class="profile-card profile-card--profile">
        <t-loading v-if="profileLoading && !profileLoaded" class="profile-loading" />
        <t-alert v-else-if="profileError" theme="error" :close-btn="false">
          {{ profileError }}
          <template #operation><t-button size="small" variant="outline" @click="loadProfile">重试</t-button></template>
        </t-alert>
        <t-form v-else :data="profileForm" :rules="profileRules" label-align="top" class="profile-form" @submit="saveProfile">
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
          <t-space class="profile-form__actions">
            <t-button theme="primary" type="submit" :loading="profileLoading" :disabled="!profileDirty">保存资料</t-button>
            <t-button variant="outline" :disabled="!profileDirty || profileLoading" @click="cancelProfileChanges">取消修改</t-button>
          </t-space>
        </t-form>
      </t-card>

      <t-card bordered hover-shadow title="修改密码" class="profile-card profile-card--security">
        <t-alert v-if="passwordError" theme="error" :close-btn="false" class="profile-form-alert">{{ passwordError }}</t-alert>
        <t-form :data="passwordForm" :rules="passwordRules" label-align="top" class="profile-form" @submit="savePassword">
          <t-form-item name="oldPassword" label="当前密码">
            <t-input v-model="passwordForm.oldPassword" type="password" autocomplete="current-password" />
          </t-form-item>
          <t-form-item name="newPassword" label="新密码">
            <t-input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" />
          </t-form-item>
          <t-form-item name="confirmPassword" label="确认新密码">
            <t-input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" />
          </t-form-item>
          <p class="profile-password-hint">{{ PASSWORD_RULE_MESSAGE }}</p>
          <t-button theme="primary" type="submit" :loading="passwordLoading">修改密码</t-button>
        </t-form>
      </t-card>
    </div>
    <t-card title="登录会话" class="mt-4"><LoginSessionPanel /></t-card>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { changePassword, getProfile, updateProfile } from '@/api/user'
import { useUserStore } from '@/stores/user'
import { confirmMessage, message } from '@/utils/message'
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/utils/password'
import LoginSessionPanel from '@/components/LoginSessionPanel.vue'
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

const profileRules = {
  email: [{ email: true, message: '邮箱格式不正确', trigger: 'blur' }],
  phone: [{ pattern: /^$|^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }]
}
const passwordRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }, {
    validator: value => isValidPassword(value) ? true : { result: false, message: PASSWORD_RULE_MESSAGE },
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
  min-width: 0;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-spacing-6);
  width: min(100%, 1080px);
  margin: 0 auto;
  min-width: 0;
}

.profile-card {
  align-self: start;
  min-width: 0;
  border-color: var(--app-border);
  background: var(--app-surface);
}

.profile-card :deep(.t-card__body) {
  min-width: 0;
}

.profile-form {
  min-width: 0;
}

.profile-form :deep(.t-form__item) {
  margin-bottom: var(--app-spacing-4);
}

.profile-form :deep(.t-input),
.profile-form :deep(.t-input-adornment) {
  max-width: 100%;
}

.profile-form-alert {
  margin-bottom: var(--app-spacing-4);
}

.profile-form__actions {
  flex-wrap: wrap;
}

.profile-password-hint {
  margin: 0 0 var(--app-spacing-4);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-caption);
  line-height: 1.5;
}

@media (max-width: 900px) {
  .profile-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 520px) {
  .profile-grid {
    gap: var(--app-spacing-4);
  }

  .profile-card :deep(.t-card__header),
  .profile-card :deep(.t-card__body) {
    padding-left: var(--app-spacing-4);
    padding-right: var(--app-spacing-4);
  }

  .profile-form__actions {
    width: 100%;
  }

  .profile-form__actions :deep(.t-button) {
    flex: 1 1 auto;
  }
}
</style>

<style scoped>
.profile-loading { min-height: 180px; }
</style>
