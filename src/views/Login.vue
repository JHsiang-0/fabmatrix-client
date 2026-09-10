<template>
  <main class="login-page app-scroll-region">
    <section class="left-section" aria-label="系统介绍">
      <div class="characters-section">
        <AnimatedCharacters
          :is-typing="isTyping"
          :show-password="showPassword"
          :password-length="loginForm.password.length"
          :login-failed="loginFailed"
          :login-success="loginSuccess"
        />
      </div>

      <div class="intro-content">
        <h1>智能管理每一台打印机</h1>
        <p>实时掌握设备、任务与文件，让生产管理更简单。</p>
      </div>

      <div class="grid-overlay" />
      <div class="blur-circle blur-circle-1" />
      <div class="blur-circle blur-circle-2" />

      <footer class="login-footer">© 2024 FabMatrix 生产管理平台</footer>
    </section>

    <section class="right-section">
      <div class="form-wrapper">
        <header class="form-header">
            <h2 class="form-title">{{ setupMode ? '初始化管理员' : '欢迎回来' }}</h2>
            <p class="form-subtitle">{{ setupMode ? '首次使用请创建本地管理员账户' : '请输入您的账户信息以继续操作' }}</p>
        </header>

        <t-alert v-if="setupStatusError" class="setup-status-alert" theme="warning" :close-btn="false">
          <template #message>初始化状态暂时无法读取，请先使用登录；也可以重试。</template>
          <template #operation>
            <t-button size="small" variant="outline" :loading="setupStatusLoading" @click="loadSetupStatus">
              重试
            </t-button>
          </template>
        </t-alert>

        <form class="login-form" @submit.prevent="handleLogin">
          <div class="form-group">
            <label class="form-label" for="username">用户名</label>
            <input
              id="username"
              v-model="loginForm.username"
              class="form-input"
              type="text"
              placeholder="请输入用户名"
              autocomplete="username"
              required
              :aria-invalid="Boolean(errors.username)"
              :aria-describedby="errors.username ? 'username-error' : undefined"
              @focus="isTyping = true"
              @blur="isTyping = false"
            >
            <p v-if="errors.username" id="username-error" class="error-message" role="alert">{{ errors.username }}</p>
          </div>

          <div class="form-group">
            <label class="form-label" for="password">密码</label>
            <div class="password-wrapper">
              <input
                id="password"
                v-model="loginForm.password"
                class="form-input"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                autocomplete="current-password"
                required
                :aria-invalid="Boolean(errors.password)"
                :aria-describedby="errors.password ? 'password-error' : undefined"
                @focus="isTyping = true"
                @blur="isTyping = false"
              >
              <button
                class="password-toggle"
                type="button"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" x2="22" y1="2" y2="22" />
                </svg>
              </button>
            </div>
            <p v-if="errors.password" id="password-error" class="error-message" role="alert">{{ errors.password }}</p>
          </div>

          <div v-if="setupMode" class="form-group">
            <label class="form-label" for="confirm-password">确认密码</label>
            <input
              id="confirm-password"
              v-model="loginForm.confirmPassword"
              class="form-input"
              type="password"
              placeholder="请再次输入密码"
              autocomplete="new-password"
              required
              :aria-invalid="Boolean(errors.confirmPassword)"
              :aria-describedby="errors.confirmPassword ? 'confirm-password-error' : undefined"
            >
            <p v-if="errors.confirmPassword" id="confirm-password-error" class="error-message" role="alert">{{ errors.confirmPassword }}</p>
          </div>

          <div v-if="!setupMode" class="form-options">
            <label class="checkbox-label">
              <input v-model="rememberMe" class="checkbox" type="checkbox">
              <span>记住我</span>
            </label>
            <button class="text-link" type="button" @click="showForgotMessage">忘记密码？</button>
          </div>

          <t-alert v-if="errorMessage" class="error-alert" theme="error" :close-btn="false" role="alert">
            {{ errorMessage }}
          </t-alert>

          <button class="submit-button" type="submit" :disabled="loading">
            <t-loading v-if="loading" size="small" inherit-color />
            <span>{{ loading ? '处理中…' : (setupMode ? '创建管理员并进入系统' : '登录') }}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </form>

        <button v-if="setupMode" class="text-link setup-switch" type="button" @click="setupMode = false">
          已有账号，返回登录
        </button>
      </div>

      <t-button
        class="connection-link"
        variant="outline"
        theme="default"
        shape="circle"
        aria-label="配置服务器地址"
        title="配置服务器地址"
        @click="goServerConnection"
      >
        <SettingIcon size="20" />
      </t-button>
    </section>
  </main>
</template>

<script setup>
defineOptions({ name: 'LoginView' })
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SettingIcon } from 'tdesign-icons-vue-next'
import { message } from '@/utils/message'
import { useUserStore } from '@/stores/user'
import { getFirstAdminSetupStatus, setupFirstAdmin } from '@/api/user'
import AnimatedCharacters from '@/components/login/AnimatedCharacters.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loading = ref(false)
const setupMode = ref(false)
const rememberMe = ref(false)
const showPassword = ref(false)
const isTyping = ref(false)
const setupStatusLoading = ref(false)
const setupStatusError = ref(false)
const loginFailed = ref(false)
const loginSuccess = ref(false)
const errorMessage = ref('')
const loginForm = reactive({ username: '', password: '', confirmPassword: '' })
const errors = reactive({ username: '', password: '', confirmPassword: '' })

let feedbackTimer

const validateForm = () => {
  errors.username = ''
  errors.password = ''
  errors.confirmPassword = ''
  let valid = true

  if (!loginForm.username.trim()) {
    errors.username = '请输入用户名'
    valid = false
  } else if (loginForm.username.trim().length < 3 || loginForm.username.trim().length > 20) {
    errors.username = '用户名长度应为 3-20 个字符'
    valid = false
  }

  if (setupMode.value && loginForm.username.trim() && !/^[a-zA-Z0-9_]+$/.test(loginForm.username.trim())) {
    errors.username = '用户名只能包含字母、数字和下划线'
    valid = false
  }

  if (!loginForm.password) {
    errors.password = '请输入密码'
    valid = false
  } else if (loginForm.password.length < 6 || loginForm.password.length > 20) {
    errors.password = '密码长度应为 6-20 个字符'
    valid = false
  } else if (setupMode.value && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,20}$/.test(loginForm.password)) {
    errors.password = '初始化密码必须为 6-20 位，且包含大小写字母和数字'
    valid = false
  }

  if (setupMode.value) {
    if (!loginForm.confirmPassword) {
      errors.confirmPassword = '请再次输入密码'
      valid = false
    } else if (loginForm.confirmPassword !== loginForm.password) {
      errors.confirmPassword = '两次输入的密码不一致'
      valid = false
    }
  }

  return valid
}

const showForgotMessage = () => {
  message.info('请联系管理员重置密码')
}

const goServerConnection = () => router.push({ name: 'server-connection' })

const loadSetupStatus = async () => {
  setupStatusLoading.value = true
  setupStatusError.value = false
  try {
    const response = await getFirstAdminSetupStatus()
    setupMode.value = response?.data?.setupAvailable === true
  } catch (error) {
    setupStatusError.value = true
    // 初始化状态查询失败时仍保留普通登录入口，避免后端临时不可用导致页面无法使用。
    console.warn('[Login] 首次管理员初始化状态查询失败', error)
  } finally {
    setupStatusLoading.value = false
  }
}

const handleLogin = async () => {
  if (!validateForm()) return

  loading.value = true
  errorMessage.value = ''
  loginFailed.value = false
  loginSuccess.value = false

  try {
    loginForm.username = loginForm.username.trim()
    if (setupMode.value) {
      const response = await setupFirstAdmin({
        username: loginForm.username,
        password: loginForm.password,
        confirmPassword: loginForm.confirmPassword
      })
      userStore.userLoginWithResult(response.data, { remember: true })
      message.success('管理员初始化成功')
    } else {
      await userStore.userLogin({
        username: loginForm.username,
        password: loginForm.password
      }, { remember: rememberMe.value })
      message.success('登录成功')
    }
    loginSuccess.value = true
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/'
    await router.push(redirect)
  } catch (error) {
    if (Number(error?.status || error?.code) === 409) setupMode.value = false
    errorMessage.value = error.message || '登录失败，请检查用户名和密码'
    loginFailed.value = true
    clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => {
      loginFailed.value = false
    }, 3000)
  } finally {
    loading.value = false
  }
}
onMounted(loadSetupStatus)
onUnmounted(() => clearTimeout(feedbackTimer))
</script>

<style scoped>
.login-page {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  background: var(--app-surface);
}

.left-section {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  overflow: hidden;
  padding: clamp(1.5rem, 4vw, 3rem);
  color: var(--app-text-on-brand);
  background: linear-gradient(135deg, var(--app-text-primary), var(--app-primary-active) 55%, var(--app-primary));
}

.intro-content,
.characters-section {
  position: relative;
  z-index: 2;
}

.characters-section {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 400px;
  margin: auto 0;
}

.intro-content {
  max-width: 28rem;
}

.intro-content h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(1.5rem, 2.6vw, 2.25rem);
  line-height: 1.2;
}

.intro-content p {
  margin: 0;
  color: rgb(255 255 255 / 78%);
  font-size: clamp(0.875rem, 1.2vw, 1rem);
  line-height: 1.7;
}

.grid-overlay,
.blur-circle {
  position: absolute;
  pointer-events: none;
}

.grid-overlay {
  inset: 0;
  opacity: 0.25;
  background-image: linear-gradient(rgb(255 255 255 / 6%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 6%) 1px, transparent 1px);
  background-size: 1.25rem 1.25rem;
}

.blur-circle {
  border-radius: 9999px;
  filter: blur(5rem);
}

.blur-circle-1 {
  top: 20%;
  right: 10%;
  width: 14rem;
  height: 14rem;
  background: rgb(129 140 248 / 24%);
}

.blur-circle-2 {
  bottom: 10%;
  left: 15%;
  width: 18rem;
  height: 18rem;
  background: rgb(192 132 252 / 18%);
}

.right-section {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: clamp(1.5rem, 5vw, 4rem);
  background: var(--app-surface);
}

.form-wrapper {
  width: 100%;
  max-width: 26.25rem;
}

.form-header {
  margin-bottom: clamp(1.5rem, 4vh, 2.5rem);
  text-align: center;
}

.form-title {
  margin: 0 0 0.5rem;
  color: var(--app-text-primary);
  font-size: clamp(1.5rem, 2.5vw, 1.875rem);
  line-height: 1.25;
}

.form-subtitle {
  color: var(--app-text-secondary);
  font-size: 0.875rem;
}

.form-subtitle {
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  color: var(--app-text-primary);
  font-size: 0.875rem;
  font-weight: 600;
}

.form-input {
  width: 100%;
  height: 3rem;
  padding: 0 1rem;
  color: var(--app-text-primary);
  font: inherit;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 0.5rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input::placeholder {
  color: var(--app-text-placeholder);
}

.form-input:focus {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px var(--app-primary-light);
}

.password-wrapper {
  position: relative;
}

.password-wrapper .form-input {
  padding-right: 3rem;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  color: var(--app-text-placeholder);
  background: transparent;
  border: 0;
  cursor: pointer;
  transform: translateY(-50%);
}

.password-toggle:hover {
  color: var(--app-primary-active);
}

.password-toggle svg,
.submit-button svg {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--app-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
}

.checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: var(--app-primary);
}

.text-link {
  padding: 0;
  color: var(--app-primary);
  font: inherit;
  font-size: 0.875rem;
  background: none;
  border: 0;
  cursor: pointer;
}

.text-link:hover {
  text-decoration: underline;
}

.setup-switch {
  display: block;
  width: fit-content;
  margin: 1rem auto 0;
}

.connection-link {
  position: absolute;
  right: clamp(1.5rem, 5vw, 4rem);
  bottom: clamp(1rem, 3vh, 2rem);
}

.login-footer {
  position: relative;
  z-index: 2;
  margin: 0;
  color: rgb(255 255 255 / 62%);
  font-size: 0.75rem;
  text-align: left;
  pointer-events: none;
}

.error-message {
  margin: 0;
  color: var(--app-danger);
  font-size: 0.8125rem;
}

.error-alert {
  padding: 0.75rem;
  color: var(--app-danger);
  font-size: 0.875rem;
  line-height: 1.5;
  background: var(--app-danger-light);
  border: 1px solid var(--app-danger);
  border-radius: 0.5rem;
}

.submit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  height: 3rem;
  color: var(--app-text-on-brand);
  font: inherit;
  font-weight: 600;
  background: var(--app-text-primary);
  border: 0;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}

.submit-button:hover:not(:disabled) {
  box-shadow: 0 0.625rem 1.5rem rgb(17 24 39 / 20%);
  transform: translateY(-2px);
}

.submit-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

@media (max-width: 1024px) {
  .login-page {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .left-section {
    display: none;
  }

  .right-section {
    min-height: 100%;
    padding-bottom: 5rem;
  }

  .login-footer {
    display: none;
  }

  .connection-link {
    position: static;
    align-self: flex-end;
    margin-top: 1rem;
  }
}

@media (max-width: 480px) {
  .right-section {
    align-items: flex-start;
    padding: 2rem 1.25rem 4rem;
  }

  .form-options {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .submit-button,
  .form-input {
    transition: none;
  }
}
</style>
