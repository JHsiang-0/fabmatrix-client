import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { isFeatureEnabled } from '@/config/features'
import { useUserStore } from '@/stores/user'
import { message } from '@/utils/message'
import { resolveRouteAccess, ROUTE_ACCESS } from '@/utils/permissions'
import Layout from '@/layout/index.vue' // 引入刚写的布局组件

const APP_ROLES = ['ADMIN', 'OPERATOR', 'VIEWER']
const isDesktop = import.meta.env.MODE.startsWith('desktop')
const routerHistory = typeof window === 'undefined'
  ? createMemoryHistory(import.meta.env.BASE_URL)
  : isDesktop
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL)

const router = createRouter({
  history: routerHistory,
  routes: [
    {
      path: '/cloud/manage',
      name: 'cloud-management',
      component: () => import('../views/CloudManagement.vue'),
      meta: { requiresAuth: false, skipSessionRestore: true }
    },
    {
      path: '/cloud',
      name: 'cloud-dashboard',
      component: () => import('../views/CloudDashboard.vue'),
      meta: { requiresAuth: false, skipSessionRestore: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/server-connection',
      name: 'server-connection',
      component: () => import('../views/ServerConnection.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/403',
      name: 'forbidden',
      component: () => import('../views/RouteResult.vue'),
      meta: { title: '无权访问', requiresAuth: true, roles: APP_ROLES }
    },
    {
      path: '/404',
      name: 'not-found',
      component: () => import('../views/RouteResult.vue'),
      meta: { title: '页面不存在', requiresAuth: false, skipSessionRestore: true }
    },
    {
      path: '/dashboard/fullscreen',
      name: 'fullscreen-dashboard',
      component: () => import('../views/FullscreenDashboard.vue'),
      meta: { title: '实时设备看板', requiresAuth: true, roles: APP_ROLES, fullscreen: true }
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('../views/RequiredPasswordChange.vue'),
      meta: { requiresAuth: true, roles: APP_ROLES }
    },
    // 将 Layout 设置为根路由
    {
      path: '/',
      component: Layout, 
      meta: { requiresAuth: true, roles: APP_ROLES },
      children: [
        {
          path: '',
          name: 'dashboard',
          redirect: { name: 'dashboard-overview' }
        },
        {
          path: 'dashboard',
          name: 'dashboard-overview',
          component: () => import('../views/Dashboard.vue'),
          meta: { title: '概览仪表盘', hideBreadcrumb: true, pageScroll: true }
        },
        {
          path: 'printers',
          name: 'printers',
          component: () => import('../views/PrinterManage.vue'),
          meta: { title: '打印机管理', hideBreadcrumb: true }
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('../views/UserManagement.vue'),
          meta: { title: '用户管理', roles: ['ADMIN'], hideBreadcrumb: true }
        },
        {
          path: 'audit-logs',
          name: 'audit-logs',
          component: () => import('../views/AuditLog.vue'),
          meta: { title: '操作日志', roles: ['ADMIN'], hideBreadcrumb: true }
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('../views/Profile.vue'),
          meta: { title: '个人中心', hideBreadcrumb: true, pageScroll: true }
        },
        {
          path: 'files',
          name: 'files',
          component: () => import('../views/FileLibrary.vue'),
          meta: { title: '文件库', hideBreadcrumb: true }
        },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('../views/TaskManagement.vue'),
          redirect: '/tasks/queue',
          children: [
            {
              path: 'queue',
              name: 'tasks-queue',
              component: () => import('../views/JobQueue.vue'),
              meta: { title: '任务队列', hideBreadcrumb: true }
            },
            {
              path: 'history',
              name: 'tasks-history',
              component: () => import('../views/JobHistory.vue'),
              meta: { title: '打印历史', hideBreadcrumb: true }
            }
          ]
        },
        {
          path: 'batch-dispatch',
          name: 'batch-dispatch',
          component: () => import('../views/BatchDispatch.vue'),
          meta: { title: '批量手动派发', hideBreadcrumb: true, pageScroll: true, roles: ['ADMIN', 'OPERATOR'], feature: 'batchDispatch' }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found-fallback',
      redirect: { name: 'not-found' }
    }
  ]
})

// 全局路由守卫（门禁系统）
router.beforeEach(async (to) => {
  const disabledFeatureRoute = to.matched.find(record => (
    record.meta.feature && !isFeatureEnabled(record.meta.feature)
  ))
  if (disabledFeatureRoute) return { name: 'not-found' }
  if (to.matched.some(record => record.meta.skipSessionRestore)) return

  const userStore = useUserStore()

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const roleRequirements = to.matched
    .map(record => record.meta.roles)
    .filter(roles => Array.isArray(roles) && roles.length > 0)

  let access = resolveRouteAccess({
    path: to.path,
    requiresAuth,
    roleRequirements,
    token: userStore.token,
    restoreState: userStore.restoreState,
    role: userStore.userInfo.role
  })

  if (access === ROUTE_ACCESS.LOGIN_REQUIRED) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (access === ROUTE_ACCESS.RESTORE_REQUIRED) {
    const hadStoredToken = Boolean(userStore.token)
    const restored = await userStore.restoreSession()
    if (!restored) {
      if (hadStoredToken) message.warning('登录状态已失效，请重新登录')
      return requiresAuth
        ? { name: 'login', query: { redirect: to.fullPath } }
        : undefined
    }

    access = resolveRouteAccess({
      path: to.path,
      requiresAuth,
      roleRequirements,
      token: userStore.token,
      restoreState: userStore.restoreState,
      role: userStore.userInfo.role
    })
  }

  if (userStore.isAuthenticated && userStore.userInfo.mustChangePassword
      && to.name !== 'change-password') return { name: 'change-password' }
  if (userStore.isAuthenticated && !userStore.userInfo.mustChangePassword
      && to.name === 'change-password') return { name: 'printers' }

  if (access === ROUTE_ACCESS.AUTHENTICATED_LOGIN) {
    return { name: 'printers' }
  }

  if (access === ROUTE_ACCESS.UNKNOWN_ROLE) {
    userStore.logout()
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (access === ROUTE_ACCESS.FORBIDDEN) {
    message.error('当前账号没有访问该页面的权限')
    return { name: 'forbidden', query: { from: to.fullPath } }
  }
})

export default router
