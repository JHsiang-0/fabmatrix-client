<template>
  <t-dialog :visible="Boolean(user)" :header="`重置密码：${user?.username || ''}`" :confirm-btn="{ loading: busy, content: '重置并退出原会话' }" :cancel-btn="{ disabled: busy }" :close-on-overlay-click="false" :close-btn="!busy" @confirm="submit" @close="close">
    <t-alert theme="warning" :close-btn="false" class="mb-3">重置后原登录全部失效。请安全告知员工临时密码；员工下次登录必须修改。</t-alert>
    <t-alert v-if="error" theme="error" :close-btn="false">{{ error }}</t-alert>
    <t-form label-align="top">
      <t-form-item label="临时密码"><t-input v-model="password" type="password" autocomplete="new-password" /></t-form-item>
      <t-form-item label="确认临时密码"><t-input v-model="confirmPassword" type="password" autocomplete="new-password" /></t-form-item>
      <p>{{ PASSWORD_RULE_MESSAGE }}</p>
    </t-form>
  </t-dialog>
</template>
<script setup>
import { ref, watch } from 'vue'
import { resetUserPassword } from '@/api/user'
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/utils/password'
import { message } from '@/utils/message'
const props = defineProps({ user: { type: Object, default: null } })
const emit = defineEmits(['close', 'success'])
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const busy = ref(false)
watch(() => props.user, () => { password.value = ''; confirmPassword.value = ''; error.value = '' })
const close = () => { if (!busy.value) emit('close') }
const submit = async () => {
  if (busy.value || !props.user) return
  if (!isValidPassword(password.value)) { error.value = PASSWORD_RULE_MESSAGE; return }
  if (password.value !== confirmPassword.value) { error.value = '两次输入的密码不一致'; return }
  busy.value = true
  error.value = ''
  try {
    await resetUserPassword(props.user.id, { password: password.value, confirmPassword: confirmPassword.value })
    password.value = ''; confirmPassword.value = ''
    message.success('密码已重置，员工下次登录必须修改')
    emit('success'); emit('close')
  } catch (cause) { error.value = cause.message || '重置失败，请重试' }
  finally { busy.value = false }
}
</script>
