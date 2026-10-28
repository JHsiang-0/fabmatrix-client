<template>
  <main class="required-password-page">
    <t-card title="请修改临时密码" class="required-password-card">
      <t-alert theme="warning" :close-btn="false">这是首次登录或管理员重置后的临时密码。修改完成后才能使用系统。</t-alert>
      <t-alert v-if="error" theme="error" :close-btn="false">{{ error }}</t-alert>
      <t-form :data="form" label-align="top" @submit="submit">
        <t-form-item name="oldPassword" label="临时密码"><t-input v-model="form.oldPassword" type="password" autocomplete="current-password" /></t-form-item>
        <t-form-item name="newPassword" label="新密码"><t-input v-model="form.newPassword" type="password" autocomplete="new-password" /></t-form-item>
        <t-form-item name="confirmPassword" label="确认新密码"><t-input v-model="form.confirmPassword" type="password" autocomplete="new-password" /></t-form-item>
        <p>{{ PASSWORD_RULE_MESSAGE }}</p>
        <t-space>
          <t-button type="submit" :loading="busy">修改并重新登录</t-button>
          <t-button variant="outline" :disabled="busy" @click="leave">退出登录</t-button>
        </t-space>
      </t-form>
    </t-card>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { changePassword } from '@/api/user'
import { useUserStore } from '@/stores/user'
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/utils/password'
import { message } from '@/utils/message'

const user = useUserStore()
const router = useRouter()
const busy = ref(false)
const error = ref('')
const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const leave = async () => {
  try { await user.endSession() } catch { /* 本地登录状态仍会清理。 */ }
  await router.replace({ name: 'login' })
}
const submit = async () => {
  if (busy.value) return
  error.value = ''
  if (!form.oldPassword || !isValidPassword(form.newPassword)) { error.value = PASSWORD_RULE_MESSAGE; return }
  if (form.newPassword !== form.confirmPassword) { error.value = '两次输入的新密码不一致'; return }
  busy.value = true
  try {
    await changePassword(user.userInfo.id, { ...form })
    Object.assign(form, { oldPassword: '', newPassword: '', confirmPassword: '' })
    user.logout()
    message.success('密码已修改，请使用新密码登录')
    await router.replace({ name: 'login' })
  } catch (cause) { error.value = cause.message || '修改失败，请重试' }
  finally { busy.value = false }
}
</script>

<style scoped>
.required-password-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--td-bg-color-page); }
.required-password-card { width: min(100%, 480px); }
.required-password-card :deep(.t-alert) { margin-bottom: 20px; }
</style>
