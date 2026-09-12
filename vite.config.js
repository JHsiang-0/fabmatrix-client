import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  const isDesktopMode = mode.startsWith('desktop')

  if (mode === 'production' && env.VITE_USE_MOCK === 'true') {
    throw new Error('生产环境禁止启用 VITE_USE_MOCK，请检查环境变量配置')
  }

  return {
    base: mode.startsWith('desktop') ? './' : '/',
    plugins: [vue()],
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
