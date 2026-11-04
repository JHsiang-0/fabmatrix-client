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

export function printerModelGroups(data, now) {
  const { descriptor: d, observation: o } = data.model
  const current = isModelCurrent(data, now)
  const m = (value, unit = '', options = {}) => ({
    text: modelMeasurement(value, { current, now, unit, ...options }),
    description: `${modelLabel(value?.quality || 'UNAVAILABLE')} · ${modelLabel(value?.source || 'NONE')} · ${modelTime(value?.observedAt)}`
  })
  const list = (label, rows) => ({ label, rows: rows.map(([name, value]) => ({
    name, value: value?.text ?? value, description: value?.description
  })) })
  const groups = [
    list('设备与工具', [
      ['固件', `${d.firmwareFamily} ${d.firmwareVersion || ''}`.trim()], ['连接方式', modelLabel(d.connectionMode)],
      ['机器模式', modelLabel(d.machineMode)], ['仿真设备', d.emulated == null ? '未知' : d.emulated ? '是' : '否'],
      ['当前位置', d.locationLabel || '未配置'], ['配置耗材', d.configuredMaterial || '未配置'],
      ['配置喷嘴', modelNumber(d.configuredNozzleDiameterMm, ' mm')],
      ['当前工具', current ? o.currentToolId || '未知' : '数据过期'],
      ['主工具 / 热床', `${d.primaryToolId || '未知'} / ${d.primaryBedHeaterId || '未知'}`],
      ...d.tools.map(tool => [`工具 ${tool.name || tool.id}`, `加热器 ${tool.heaterIds.join('、') || '无'} · 风扇 ${tool.fanIds.join('、') || '无'} · 挤出机 ${tool.extruderIds.join('、') || '无'}`])
    ]),
    ...d.heaters.map(h => {
      const state = o.heaters.find(item => item.id === h.id)
      return list(`加热器 · ${h.name || h.id}`, [
        ['角色 / 依据', `${modelLabel(h.role)} / ${modelLabel(h.roleEvidence)}`],
        ['温度', m(state?.currentC, ' °C')], ['有效目标', m(state?.effectiveTargetC, ' °C')],
        ['工作目标', m(state?.activeTargetC, ' °C')], ['待机目标', m(state?.standbyTargetC, ' °C')],
        ['功率', m(state?.pwmRatio, '', { ratio: true })], ['模式', current ? modelLabel(state?.mode) : '数据过期']
      ])
    }),
    ...d.fans.map(f => {
      const state = o.fans.find(item => item.id === f.id)
      return list(`风扇 · ${f.name || f.id}`, [['角色', modelLabel(f.role)],
        ['功率', m(state?.pwmRatio, '', { ratio: true })], ['转速', m(state?.rpm, ' rpm')]])
    }),
    list('运动与坐标', [
      ['坐标系', modelLabel(o.motion.coordinateSpace)],
      ['速度倍率', m(o.motion.speedFactor, '', { ratio: true })], ['流量倍率', m(o.motion.flowFactor, '', { ratio: true })],
      ...d.axes.flatMap(axis => {
        const state = o.motion.axes.find(item => item.id === axis.id)
        return [[`${axis.name || axis.id} 位置`, m(state?.positionMm, ' mm')], [`${axis.name || axis.id} 已归零`, m(state?.homed)]]
      })
    ]),
    ...d.sensors.map(s => {
      const state = o.sensors.find(item => item.id === s.id)
      return list(`传感器 · ${s.name || s.id}`, [['类型', s.kind || '未知'], ['启用', m(state?.enabled)], ['读数', m(state?.reading, s.unit && s.unit !== 'BOOLEAN' ? ` ${s.unit}` : '')]])
    })
  ]
  const e = o.currentExecution
  groups.push(list(current ? '当前执行' : '最近观测执行（历史快照）', e ? [
    ['来源 / 类型', `${modelLabel(e.source)} / ${modelLabel(e.kind)}`], ['执行标识', e.id],
    ['首次观测', modelTime(e.firstObservedAt)], ['开始时间', modelTime(e.startedAt)],
    ['文件名', e.file?.name || '未知'], ['文件大小', Number.isSafeInteger(e.file?.sizeBytes) ? `${e.file.sizeBytes} B` : '未知'],
    ['文件摘要', e.file?.sha256 || '未知'], ['进度', m(e.progressPercent, '%')], ['进度依据', modelLabel(e.progressMethod)],
    ['文件位置', m(e.filePositionBytes, ' B', { integer: true })],
    ['打印时长', m(e.timing?.printSeconds, ' s')], ['总时长', m(e.timing?.totalSeconds, ' s')],
    ['有效打印', m(e.timing?.activeSeconds, ' s')], ['预热', m(e.timing?.warmupSeconds, ' s')],
    ['暂停时长', m(e.timing?.pausedSeconds, ' s')], ['切片预计总时长', m(e.timing?.slicerEstimatedTotalSeconds, ' s')],
    ['当前层', m(e.layers?.current, '', { integer: true })], ['总层数', m(e.layers?.total, '', { integer: true })],
    ['耗材长度', m(e.filamentLengthMm, ' mm')], ['预计剩余', m(e.estimatedRemaining?.seconds, ' s')],
    ['剩余时间依据', modelLabel(e.estimatedRemaining?.method)], ['估计置信度', modelNumber(e.estimatedRemaining?.confidence)]
  ] : [['执行情况', current ? '当前无执行' : '无法确认当前执行']]))
  const r = o.lastExecutionResult
  groups.push(list('上次执行结果（历史记录）', r ? [
    ['结果', modelLabel(r.outcome)], ['类型', modelLabel(r.kind)], ['确认依据', modelLabel(r.evidence)],
    ['结束时间', modelTime(r.endedAt)], ['观测时间', modelTime(r.observedAt)], ['原因代码', r.reasonCode || '无'], ['执行标识', r.executionId]
  ] : [['历史结果', '暂无记录']]))
  groups.push(list('能力描述', d.capabilities.map(c => [c.code, `${modelLabel(c.support)} · ${modelLabel(c.evidence)} · ${modelTime(c.detectedAt)}`])))
  groups.push(list('模型身份与采样', [
    ['设备标识', data.model.identity.deviceUid], ['来源实例', data.model.identity.sourceInstanceId],
    ['本地设备编号', data.model.identity.localPrinterId], ['启动标识', o.deviceBootId],
    ['模型版本', String(data.model.modelVersion)], ['描述 / 观测版本', `${d.revision} / ${o.revision}`],
    ['关联描述版本', String(o.descriptorRevision)], ['观测标识', o.id],
    ['采集开始', modelTime(o.captureStartedAt)], ['采样时间', modelTime(o.observedAt)],
    ['完整性', modelLabel(o.completeness)], ['最近成功通信', modelTime(o.connection.lastSuccessfulAt)],
    ['连续失败', String(o.connection.consecutiveFailures)],
    ...o.issues.map((issue, i) => [`问题 ${i + 1}`, `${modelLabel(issue.severity)} · ${issue.code}`])
  ]))
  return groups
}
