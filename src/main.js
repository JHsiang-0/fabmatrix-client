import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import TDesign from 'tdesign-vue-next'
import { getEnvironmentServerConfig, getWebSocketBaseUrl } from '@/utils/serverConfig'
import '@/utils/rootFontSize'

// Tailwind 仅提供布局工具；应用主题层在 TDesign 样式之后映射语义 Token。
import '@/styles/index.css'
import 'tdesign-vue-next/es/style/index.css'
import '@/styles/theme.css'

import App from './App.vue'
import router from './router'

if (typeof window !== 'undefined' && !window.farmDesktop?.isPackaged
  && (import.meta.env.DEV || import.meta.env.MODE.startsWith('desktop'))) {
  window.__FARM_RUNTIME_DIAGNOSTICS__ = () => {
    const environmentConfig = getEnvironmentServerConfig()

    return {
      mode: import.meta.env.MODE,
      baseUrl: import.meta.env.BASE_URL,
      useMock: ['mock', 'desktop-mock'].includes(import.meta.env.MODE),
      apiBaseUrl: environmentConfig.apiBaseUrl,
      wsUrl: getWebSocketBaseUrl()
    }
  }
}

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)
app.use(TDesign)

app.mount('#app')
