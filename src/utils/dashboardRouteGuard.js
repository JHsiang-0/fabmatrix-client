export async function guardDashboardRouteLeave({
  isSaving,
  hasUnsavedChanges,
  confirmDiscard,
  clearEditingState,
  notifySaving
}) {
  const blockWhileSaving = () => {
    if (!isSaving()) return false
    notifySaving('保存中请稍候')
    return true
  }

  if (blockWhileSaving()) return false

  if (hasUnsavedChanges()) {
    try {
      await confirmDiscard()
    } catch {
      return false
    }
    // 用户确认期间可能已经触发保存，此时“放弃”也不能清理正在提交的草稿。
    if (blockWhileSaving()) return false
  }

  clearEditingState()
  return true
}
