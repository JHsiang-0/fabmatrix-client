export const initialRemotePausePolicy = () => ({ policy: null, supported: null, loading: false, busy: false, error: '' })

const policy = value => {
  if (typeof value?.enabled !== 'boolean' || !Number.isSafeInteger(value?.revision) || value.revision < 0) {
    throw new Error('INVALID_REMOTE_POLICY')
  }
  const result = { enabled: value.enabled, revision: value.revision }
  if (value.temperatureSupported !== undefined || value.temperatureEnabled !== undefined) {
    if (typeof value.temperatureSupported !== 'boolean' || typeof value.temperatureEnabled !== 'boolean'
      || (!value.temperatureSupported && value.temperatureEnabled)) throw new Error('INVALID_TEMPERATURE_POLICY')
    result.temperatureSupported = value.temperatureSupported
    result.temperatureEnabled = value.temperatureEnabled
  }
  return result
}
const status = error => error?.status ?? error?.response?.status

// The local administrator grants a separate, versioned permission. Reporting alone never enables it.
export function createRemotePausePolicy({ state, read, write, current, scope, confirm, canChange, onBusy = () => {}, onSuccess = () => {} }) {
  let generation = 0
  async function load() {
    if (!current() || state.loading || state.busy) return
    const request = ++generation
    const expectedScope = scope()
    state.loading = true
    try {
      const result = policy(await read())
      if (current() && request === generation && scope() === expectedScope) {
        state.policy = result; state.supported = true; state.error = ''
      }
    } catch (error) {
      if (current() && request === generation && scope() === expectedScope) {
        state.policy = null
        state.supported = status(error) === 404 ? false : null
        state.error = status(error) === 404
          ? '当前 Server 尚不支持远程暂停，请先升级 Server。'
          : '读取远程暂停授权失败，请重试。'
      }
    } finally {
      if (request === generation) state.loading = false
    }
  }

  async function changeSetting(field, enabled) {
    if (typeof enabled !== 'boolean' || !current() || !canChange() || state.loading || state.busy || !state.policy || state.supported !== true) return
    const temperature = field === 'temperatureEnabled'
    if (temperature && state.policy.temperatureSupported !== true) return
    const expectedScope = scope()
    const revision = state.policy.revision
    state.busy = true
    onBusy(true)
    state.error = ''
    try {
      if (enabled) await confirm(
        temperature ? '允许具有此农场操作权限的云账号设置喷嘴和热床目标温度？设为 0°C 会关闭对应加热器。此授权与远程暂停分别管理。' : '允许具有此农场操作权限的云账号暂停当前打印？此授权与数据上报分别管理。',
        temperature ? '允许远程温度设置' : '允许远程暂停')
      if (!current() || scope() !== expectedScope) return
      const result = policy(await write({ [field]: enabled, revision }))
      if (current() && scope() === expectedScope) {
        state.policy = result
        onSuccess(temperature ? (enabled ? '已允许远程温度设置' : '远程温度设置已关闭') : (enabled ? '已允许远程暂停' : '远程暂停已关闭'))
      }
    } catch (error) {
      if (!current() || scope() !== expectedScope) return
      if (error === 'cancel' || error === 'close') return
      if (status(error) === 409) {
        state.busy = false
        await load()
        if (current() && scope() === expectedScope) state.error = '设置已被其他管理员更新，已刷新，请重新确认。'
      } else {
        state.error = status(error) === 404
          ? '当前 Server 尚不支持远程暂停，请先升级 Server。'
          : '修改远程控制授权失败，请刷新后重试。'
        if (status(error) === 404) { state.policy = null; state.supported = false }
        else state.policy = null
      }
    } finally {
      state.busy = false
      onBusy(false)
    }
  }

  function clear() {
    generation += 1
    Object.assign(state, initialRemotePausePolicy())
  }
  return { load, change: enabled => changeSetting('enabled', enabled), changeTemperature: enabled => changeSetting('temperatureEnabled', enabled), clear }
}
