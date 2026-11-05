import {
  DashboardIcon,
  FolderOpenIcon,
  PrintIcon,
  QueueIcon,
  SendIcon,
  SettingIcon,
  UserCircleIcon
} from 'tdesign-icons-vue-next'
import { isFeatureEnabled } from './features.js'

export const navigationGroups = [
  {
    key: 'workspace',
    label: '工作台',
    icon: DashboardIcon,
    items: [{ key: 'dashboard', title: '概览仪表盘', to: '/dashboard' }]
  },
  {
    key: 'printers',
    label: '打印机',
    icon: PrintIcon,
    items: [{ key: 'printers', title: '打印机管理', to: '/printers' }]
  },
  {
    key: 'files',
    label: '文件',
    icon: FolderOpenIcon,
    items: [{ key: 'files', title: '文件库', to: '/files' }]
  },
  {
    key: 'jobs',
    label: '任务',
    icon: QueueIcon,
    items: [
      { key: 'tasks-queue', title: '任务队列', to: '/tasks/queue' },
      { key: 'tasks-history', title: '打印历史', to: '/tasks/history' }
    ]
  },
  {
    key: 'batch-dispatch',
    label: '批量派发',
    icon: SendIcon,
    items: [{ key: 'tasks-batch', title: '批量派发', to: '/batch-dispatch', feature: 'batchDispatch' }]
  },
  {
    key: 'management',
    label: '管理中心',
    icon: SettingIcon,
    items: [
      { key: 'users', title: '用户管理', to: '/users', roles: ['ADMIN'] },
      { key: 'audit-logs', title: '操作日志', to: '/audit-logs', roles: ['ADMIN'] }
    ]
  },
  {
    key: 'settings',
    label: '设置',
    icon: SettingIcon,
    items: [{ key: 'cloud-connection', title: '云端连接', to: '/settings/cloud-connection', roles: ['ADMIN'] }]
  },
  {
    key: 'profile',
    label: '个人中心',
    icon: UserCircleIcon,
    items: [{ key: 'profile', title: '个人中心', to: '/profile' }]
  }
]

export function getEnabledNavigationGroups() {
  return navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.feature || isFeatureEnabled(item.feature))
    }))
    .filter(group => group.items.length > 0)
}

export const navigationItems = getEnabledNavigationGroups().flatMap(group => group.items)

export function getNavigationItem(path) {
  return navigationItems.find(item => item.to === path) || null
}
