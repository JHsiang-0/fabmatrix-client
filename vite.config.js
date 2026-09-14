import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { getContentSecurityPolicy } from './electron/security.cjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  const isDesktopMode = mode.startsWith('desktop')
  const isExplicitMockMode = ['mock', 'desktop-mock'].includes(mode)

  if (env.VITE_USE_MOCK === 'true' && !isExplicitMockMode) {
    throw new Error('正式构建禁止通过 VITE_USE_MOCK 启用 Mock，请使用显式 mock 脚本')
  }

  const contentSecurityPolicyPlugin = {
    name: 'farm-content-security-policy',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const policy = getContentSecurityPolicy({ isDevelopment: Boolean(context.server) })
        return html.replace('__FARM_CONTENT_SECURITY_POLICY__', policy)
      }
    }
  }

  return {
    base: mode.startsWith('desktop') ? './' : '/',
    plugins: [vue(), contentSecurityPolicyPlugin],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: isDesktopMode ? 5176 : 5173,
      strictPort: isDesktopMode,
      host: env.VITE_HOST === 'true' ? '0.0.0.0' : '127.0.0.1',
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:28081',
          changeOrigin: true,
        },
        '/ws': {
          target: env.VITE_WS_TARGET || 'ws://localhost:28081',
          ws: true,
          changeOrigin: true,
        },
        '/actuator': {
          target: env.VITE_API_TARGET || 'http://localhost:28081',
          changeOrigin: true,
        }
      }
    }
  }
})
