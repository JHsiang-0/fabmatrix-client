export const REMOTE_CONTROL_ACTION_LABELS = Object.freeze({
  PAUSE: '暂停打印', RESUME: '恢复打印', CANCEL: '取消打印', SET_HEATER_TARGET: '喷嘴 / 热床温度',
  SET_FAN_SPEED: '料冷风扇', SET_SPEED_FACTOR: '打印速度倍率', SET_FLOW_FACTOR: '挤出倍率', HEATERS_OFF: '关闭全部加热'
})
export const initialRemoteControlPolicy = () => ({ policy: null, supported: null, loading: false, busy: false, error: '' })

const policy = value => {
  if (!Number.isSafeInteger(value?.revision) || value.revision < 1) throw new Error('INVALID_REMOTE_POLICY')
  if (!Object.hasOwn(value, 'remoteEnabled') && value.unifiedControlSupported !== true) {
    return { remoteEnabled: false, unifiedControlSupported: false, authorizationVersion: 0,
      requiresReauthorization: value.enabled === true || value.temperatureEnabled === true,
      supportedActions: [], revision: value.revision }
  }
  if (typeof value.remoteEnabled !== 'boolean' || value.unifiedControlSupported !== true
    || value.authorizationVersion !== 1 || typeof value.requiresReauthorization !== 'boolean'
    || (value.remoteEnabled && value.requiresReauthorization)
    || !Array.isArray(value.supportedActions) || value.supportedActions.length < 1 || value.supportedActions.length > 8
    || value.supportedActions.some(action => !Object.hasOwn(REMOTE_CONTROL_ACTION_LABELS, action))
    || new Set(value.supportedActions).size !== value.supportedActions.length) throw new Error('INVALID_UNIFIED_REMOTE_POLICY')
  return { remoteEnabled: value.remoteEnabled, unifiedControlSupported: true, authorizationVersion: 1,
    requiresReauthorization: value.requiresReauthorization, supportedActions: [...value.supportedActions], revision: value.revision }
}
const status = error => error?.status ?? error?.response?.status
const upgradeMessage = '当前 Server 尚不支持统一远程控制，请先升级 Server。'

// One explicit catalog consent; reporting and historical per-action flags never grant it.
export function createRemoteControlPolicy({ state, read, write, current, scope, confirm, canChange, onBusy = () => {}, onSuccess = () => {} }) {
  let generation = 0
  async function load() {
    if (!current() || state.loading || state.busy) return
    const request = ++generation
    const expectedScope = scope()
    state.loading = true
    try {
      const result = policy(await read())
      if (current() && request === generation && scope() === expectedScope) {
        state.policy = result
        state.supported = result.unifiedControlSupported
        state.error = result.unifiedControlSupported ? '' : upgradeMessage
      }
    } catch (error) {
      if (current() && request === generation && scope() === expectedScope) {
        state.policy = null
        state.supported = status(error) === 404 ? false : null
        state.error = status(error) === 404 ? upgradeMessage : '读取远程控制授权失败，请重试。'
      }
    } finally {
      if (request === generation) state.loading = false
    }
  }

  async function change(enabled) {
    if (typeof enabled !== 'boolean' || !current() || !canChange() || state.loading || state.busy || !state.policy || state.supported !== true) return
    const request = ++generation
    const expectedScope = scope()
    const revision = state.policy.revision
    const actions = [...state.policy.supportedActions]
    state.busy = true
    onBusy(true)
    state.error = ''
    try {
      if (enabled) await confirm(
        `允许具有此农场操作权限的云账号执行以下控制：${actions.map(action => REMOTE_CONTROL_ACTION_LABELS[action]).join('、')}？每次操作仍需通过现场设备状态和权限检查，取消打印不可恢复。此开关不影响数据上报。`,
        '允许远程控制')
      if (!current() || request !== generation || scope() !== expectedScope) return
      const result = policy(await write({ remoteEnabled: enabled, authorizationVersion: 1, revision }))
      if (!result.unifiedControlSupported || result.remoteEnabled !== enabled || result.requiresReauthorization
        || result.revision !== revision + 1 || result.supportedActions.some(action => !actions.includes(action))) {
        throw new Error('REMOTE_POLICY_NOT_APPLIED')
      }
      if (current() && request === generation && scope() === expectedScope) {
        state.policy = result
        onSuccess(enabled ? '已允许远程控制' : '远程控制已关闭')
      }
    } catch (error) {
      if (!current() || request !== generation || scope() !== expectedScope) return
      if (error === 'cancel' || error === 'close') return
      if (status(error) === 409) {
        state.busy = false
        await load()
        if (current() && scope() === expectedScope) state.error = '设置已被其他管理员更新，已刷新，请重新确认。'
      } else {
        state.error = status(error) === 404 ? upgradeMessage : '修改远程控制授权失败，请刷新后重试。'
        state.policy = null
        if (status(error) === 404) state.supported = false
      }
    } finally {
      if (request === generation) { state.busy = false; onBusy(false) }
      else if (!state.busy) onBusy(false)
    }
  }

  function clear() {
    generation += 1
    Object.assign(state, initialRemoteControlPolicy())
    onBusy(false)
  }
  return { load, change, clear }
}
