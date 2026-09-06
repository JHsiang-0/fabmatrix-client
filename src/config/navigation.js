import {
  DashboardIcon,
  FileIcon,
  FolderOpenIcon,
  ListNumberedIcon,
  PrintIcon,
  UserIcon,
  FileIcon as AuditLogIcon
} from 'tdesign-icons-vue-next'

export const navigationGroups = [
  {
    key: 'workspace',
    label: '工作台',
    items: [
      { key: 'dashboard', title: '总览', to: '/dashboard', icon: DashboardIcon }
    ]
  },
  {
    key: 'printers',
    label: '打印机',
    items: [
      { key: 'printers', title: '打印机管理', to: '/printers', icon: PrintIcon }
    ]
  },
  {
    key: 'files',
    label: '文件',
    items: [
      { key: 'files', title: '文件库', to: '/files', icon: FolderOpenIcon }
    ]
  },
  {
    key: 'jobs',
    label: '任务',
    items: [
      { key: 'tasks-queue', title: '任务队列', to: '/tasks/queue', icon: ListNumberedIcon },
      { key: 'tasks-history', title: '打印历史', to: '/tasks/history', icon: FileIcon }
    ]
  },
  {
    key: 'batch-dispatch',
    label: '批量派发',
    items: [
      { key: 'tasks-batch', title: '批量派发', to: '/batch-dispatch', icon: ListNumberedIcon }
    ]
  },
  {
    key: 'management',
    label: '管理中心',
    items: [
      { key: 'users', title: '用户管理', to: '/users', icon: UserIcon, roles: ['ADMIN'] },
      { key: 'audit-logs', title: '操作日志', to: '/audit-logs', icon: AuditLogIcon, roles: ['ADMIN'] }
    ]
  },
  {
    key: 'profile',
    label: '个人中心',
    items: [
      { key: 'profile', title: '个人中心', to: '/profile', icon: UserIcon }
    ]
  }
]

export const navigationItems = navigationGroups.flatMap(group => group.items)

export function getNavigationItem(path) {
  return navigationItems.find(item => item.to === path) || null
}
