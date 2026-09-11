export async function guardDashboardRouteLeave({
  to,
  isSaving,
  isAuthenticated = () => true,
  hasUnsavedChanges,
  confirmDiscard,
  clearEditingState,
  notifySaving
}) {
  const allowAuthenticationExit = () => {
    const isLoginTarget = to?.name === 'login' || to?.path === '/login'
    if (!isLoginTarget && isAuthenticated()) return false
    // 保存请求继续自行落定；组件卸载后负责延迟清理 Store，不在这里破坏请求状态。
    if (!isSaving()) clearEditingState()
    return true
  }

  const blockWhileSaving = () => {
    if (!isSaving()) return false
    notifySaving('保存中请稍候')
    return true
  }

  if (allowAuthenticationExit()) return true
  if (blockWhileSaving()) return false

  if (hasUnsavedChanges()) {
    try {
      await confirmDiscard()
    } catch {
      return allowAuthenticationExit()
    }
    if (allowAuthenticationExit()) return true
    // 用户确认期间可能已经触发保存，此时“放弃”也不能清理正在提交的草稿。
    if (blockWhileSaving()) return false
  }

  clearEditingState()
  return true
}
