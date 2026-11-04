import { formatDuration, formatFilament } from './formatters.js'

const FRESHNESS_MS = 30000
const labels = {
  ONLINE: '在线', OFFLINE: '离线', UNKNOWN: '未知', READY: '就绪', STARTING: '启动中',
  FAULT: '故障', MAINTENANCE: '维护中', IDLE: '空闲', PRINTING: '打印中', PAUSING: '暂停中',
  PAUSED: '已暂停', RESUMING: '恢复中', CANCELLING: '取消中', BUSY: '忙碌',
  CHANGING_TOOL: '换刀中', SIMULATING: '模拟中', COMPLETE: '完整', PARTIAL: '部分',
  INCONSISTENT: '不一致', SUPPORTED: '支持', UNSUPPORTED: '不支持', UNAVAILABLE: '不可用',
  INVALID: '无效数据', NOT_APPLICABLE: '不适用', GOOD: '有效', FARM: '本地任务', EXTERNAL: '外部任务',
  PRINT: '打印', SIMULATION: '模拟', COMPLETED: '已完成', CANCELLED: '已取消', FAILED: '失败',
  DEVICE_EXPLICIT: '设备明确报告', RECONCILED: '核对确认', UNCONFIRMED: '尚未确认',
  DEVICE: '设备实测', DEVICE_ESTIMATE: '设备估算', SLICER_ESTIMATE: '切片估算',
  FILE_OFFSET: '文件位置推算', SERVER_DERIVED: '服务端推算', NONE: '无来源',
  DEVICE_REPORTED: '设备报告', FILE: '文件推算', FILAMENT: '耗材推算', SLICER: '切片估算',
  SERVER_MODEL: '服务端模型', OFF: '关闭', ACTIVE: '工作', STANDBY: '待机',
  TOOL: '喷头', BED: '热床', CHAMBER: '腔体', OTHER: '其他', PART: '模型冷却', HOTEND: '热端',
  GCODE: 'G-code 坐标', MACHINE: '机器坐标', FFF: '熔融沉积', PROBED: '设备探测',
  CONFIGURED: '配置', ADAPTER: '协议适配', INFO: '提示', WARNING: '警告', ERROR: '错误', CRITICAL: '严重'
}

export const modelLabel = value => labels[value] || value || '未知'
export const modelTime = value => {
  const time = typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(time) ? new Date(time).toLocaleString('zh-CN', { hour12: false }) : '未知'
}
export const modelNumber = (value, unit = '') => typeof value === 'number' && Number.isFinite(value)
  ? `${Number(value.toFixed(2))}${unit}` : '未知'

/** Missing/unsupported models are explicit; never synthesize canonical data from legacy fields. */
export function readPrinterModel(data, printerId) {
  if (!data || !Number.isFinite(Date.parse(data.serverTime))) throw new Error('设备模型响应格式无效')
  if (data.model === null) return data
  const model = data.model
  if (model?.modelVersion !== 2) throw new Error('设备模型版本暂不支持，请升级客户端')
  if (String(model.identity?.localPrinterId) !== String(printerId)) throw new Error('设备模型身份不匹配')
  if (!model.descriptor || !model.observation?.connection || !model.observation.motion
      || !Number.isFinite(Date.parse(model.observation.observedAt))) throw new Error('设备模型内容不完整')
  for (const key of ['tools', 'heaters', 'fans', 'axes', 'sensors', 'capabilities']) {
    if (!Array.isArray(model.descriptor[key])) throw new Error('设备描述内容不完整')
  }
  for (const key of ['heaters', 'fans', 'sensors', 'issues']) {
    if (!Array.isArray(model.observation[key])) throw new Error('设备观测内容不完整')
  }
  if (!Array.isArray(model.observation.motion.axes)) throw new Error('设备运动信息不完整')
  return data
}

export function isModelCurrent(data, now) {
  const observation = data?.model?.observation
  const age = now - Date.parse(observation?.observedAt)
  return data?.stale === false && observation?.connection?.status === 'ONLINE'
    && observation.connection.monitorEnabled === true && age >= -5000 && age <= FRESHNESS_MS
}

/** Summary compatibility fields for the existing detail header; no control IDs are inferred. */
export function printerModelSummary(data, now) {
  if (!data?.model) return null
  const o = data.model.observation
  const current = isModelCurrent(data, now)
  const connectionStatus = current ? 'ONLINE' : o.connection.status === 'OFFLINE' ? 'OFFLINE' : 'UNKNOWN'
  const operation = { IDLE: 'IDLE', STARTING: 'PREPARING', PRINTING: 'PRINTING', PAUSED: 'PAUSED',
    PAUSING: 'PRINTING', RESUMING: 'PRINTING', CANCELLING: 'PRINTING' }[o.operationState] || 'UNKNOWN'
  const progress = o.currentExecution?.progressPercent
  const value = modelMeasurement(progress, { current, now, unit: '%' })
  return {
    status: current ? o.systemState === 'FAULT' ? 'ERROR' : operation : connectionStatus,
    connectionStatus, monitorEnabled: o.connection.monitorEnabled,
    lastSeenAt: o.connection.lastSuccessfulAt, consecutiveFailureCount: o.connection.consecutiveFailures,
    progress: current && progress?.quality === 'GOOD' && value.endsWith('%')
      && progress.value >= 0 && progress.value <= 100 ? progress.value : null,
    taskSource: current ? o.currentExecution?.source || 'NONE' : 'UNKNOWN',
    filename: current ? o.currentExecution?.file?.name || '' : ''
  }
}

/** Every measurement has its own quality/time; zero and false remain valid values. */
export function modelMeasurement(measurement, { current, now, unit = '', ratio = false, integer = false }) {
  if (!current) return '数据过期'
  if (!measurement) return '不可用'
  if (measurement.quality !== 'GOOD') return modelLabel(measurement.quality || 'UNAVAILABLE')
  const age = now - Date.parse(measurement.observedAt)
  if (!Number.isFinite(age) || age < -5000 || age > FRESHNESS_MS) return '数据过期'
  const value = measurement.value
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value !== 'number' || !Number.isFinite(value)
      || (integer && !Number.isSafeInteger(value))) return '无效数据'
  return modelNumber(ratio ? value * 100 : value, ratio ? '%' : unit)
}

/** Curated operational view. Technical identity and schema metadata stay out of the user interface. */
export function printerModelView(data, now) {
  const { descriptor: d, observation: o } = data.model
  const current = isModelCurrent(data, now)
  const available = value => value?.quality === 'GOOD' || value?.quality === 'INVALID'
  const m = (value, unit = '', options = {}) => ({
    value: modelMeasurement(value, { current, now, unit, ...options }),
    description: `${modelLabel(value?.quality || 'UNAVAILABLE')} · ${modelLabel(value?.source || 'NONE')} · ${modelTime(value?.observedAt)}`
  })
  const duration = value => {
    const result = m(value)
    if (current && value?.quality === 'GOOD' && Number.isFinite(value.value)
        && value.value >= 0 && !['数据过期', '无效数据'].includes(result.value)) {
      result.value = formatDuration(value.value)
    }
    return result
  }
  const row = (name, measurement, unit = '', options = {}) => available(measurement)
    ? { name, ...m(measurement, unit, options) } : null
  const heaters = d.heaters.map(heater => {
    const state = o.heaters.find(item => item.id === heater.id)
    const peers = d.heaters.filter(item => item.role === heater.role)
    const roleName = ['TOOL', 'BED', 'CHAMBER'].includes(heater.role) ? modelLabel(heater.role) : '加热器'
    const name = heater.name && heater.name !== heater.id ? heater.name
      : `${roleName}${peers.length > 1 ? ` ${peers.findIndex(item => item.id === heater.id) + 1}` : ''}`
    return {
      id: heater.id, name, temperature: m(state?.currentC, ' °C'),
      target: available(state?.effectiveTargetC) ? m(state.effectiveTargetC, ' °C') : null,
      mode: current && ['STANDBY', 'FAULT'].includes(state?.mode) ? modelLabel(state.mode) : '',
      fault: current && state?.mode === 'FAULT'
    }
  })
  const e = o.currentExecution
  const currentLayer = row('当前层', e?.layers?.current, '', { integer: true })
  const totalLayers = row('总层数', e?.layers?.total, '', { integer: true })
  const layer = currentLayer && totalLayers
    ? { name: '层数', value: `${currentLayer.value} / ${totalLayers.value}`, description: currentLayer.description }
    : currentLayer || totalLayers
  const filament = row('已用耗材', e?.filamentLengthMm, ' mm')
  if (filament?.value.endsWith(' mm') && e.filamentLengthMm.value >= 0) {
    filament.value = formatFilament(e.filamentLengthMm.value)
  }
  const printMetrics = e ? [
    available(e.timing?.printSeconds) ? { name: '已打印', ...duration(e.timing.printSeconds) } : null,
    available(e.estimatedRemaining?.seconds) ? { name: '预计剩余', ...duration(e.estimatedRemaining.seconds) } : null,
    layer, filament
  ].filter(Boolean) : []
  const moreGroups = [
    ...d.heaters.map(h => {
      const state = o.heaters.find(item => item.id === h.id)
      return { label: heaters.find(item => item.id === h.id).name, rows: [
        row('功率', state?.pwmRatio, '', { ratio: true }),
        state?.mode === 'STANDBY' ? row('待机目标', state?.standbyTargetC, ' °C') : null
      ].filter(Boolean) }
    }),
    ...d.fans.map(f => {
      const state = o.fans.find(item => item.id === f.id)
      return { label: f.name || f.id, rows: [
        row('风扇功率', state?.pwmRatio, '', { ratio: true }), row('转速', state?.rpm, ' rpm')
      ].filter(Boolean) }
    }),
    { label: '运动', rows: [row('速度倍率', o.motion.speedFactor, '', { ratio: true }),
      row('流量倍率', o.motion.flowFactor, '', { ratio: true }),
      ...d.axes.flatMap(axis => {
        const state = o.motion.axes.find(item => item.id === axis.id)
        return [row(`${axis.name || axis.id} 位置`, state?.positionMm, ' mm'), row(`${axis.name || axis.id} 已归零`, state?.homed)]
      })].filter(Boolean) },
    ...d.sensors.map(s => {
      const state = o.sensors.find(item => item.id === s.id)
      return { label: s.name || s.id, rows: [row('启用', state?.enabled), row('检测值', state?.reading,
        s.unit && s.unit !== 'BOOLEAN' ? ` ${s.unit}` : '')].filter(Boolean) }
    })
  ].filter(group => group.rows.length)
  const r = o.lastExecutionResult
  return {
    heaters, printMetrics, moreGroups, execution: e ? { current, simulation: e.kind === 'SIMULATION' } : null,
    lastResult: r ? { label: r.kind === 'SIMULATION' ? '上次模拟' : '上次打印',
      outcome: modelLabel(r.outcome), theme: { COMPLETED: 'success', CANCELLED: 'default', FAILED: 'danger' }[r.outcome] || 'warning',
      at: modelTime(r.endedAt || r.observedAt), evidence: modelLabel(r.evidence) } : null
  }
}
