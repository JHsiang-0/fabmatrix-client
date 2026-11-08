import assert from 'node:assert/strict'
import test from 'node:test'
import { AUDIT_ACTION_OPTIONS, getAuditActionLabel, getAuditResultView, getAuditTargetLabel } from '../src/utils/auditView.js'

test('审计视图将已知动作和目标转换为用户文案', () => {
  assert.equal(getAuditActionLabel('JOB_CANCEL'), '取消打印任务')
  assert.equal(getAuditTargetLabel({ targetType: 'PRINTER', targetId: '12' }), '打印机 #12')
  assert.deepEqual(getAuditResultView('SUCCESS'), { label: '成功', theme: 'success' })
})

test('未知审计动作不把原始枚举直接当作界面文案', () => {
  assert.equal(getAuditActionLabel('UNRECOGNIZED_ACTION'), '其他操作')
  assert.equal(getAuditActionLabel(), '未记录动作')
})

test('远程操作和独立授权变更显示中文并可在已有动作筛选中选取', () => {
  for (const [value, label] of Object.entries({ REMOTE_CONTROL_ENABLE: '允许远程暂停', REMOTE_CONTROL_DISABLE: '关闭远程暂停', REMOTE_PAUSE: '远程暂停打印', REMOTE_TEMPERATURE_ENABLE: '允许远程温度设置', REMOTE_TEMPERATURE_DISABLE: '关闭远程温度设置', REMOTE_SET_HEATER_TARGET: '设置加热器目标温度' })) {
    assert.equal(getAuditActionLabel(value), label)
    assert.ok(AUDIT_ACTION_OPTIONS.some(option => option.value === value && option.label === label))
  }
  assert.equal(getAuditTargetLabel({ targetType: 'REMOTE_COMMAND', targetId: 'command-1' }), '远程操作 #command-1')
})

test('统一授权及新增生产控制使用独立审计文案，不改写历史暂停授权含义', () => {
  for (const action of ['REMOTE_UNIFIED_CONTROL_ENABLE', 'REMOTE_UNIFIED_CONTROL_DISABLE', 'REMOTE_RESUME', 'REMOTE_CANCEL',
    'REMOTE_SET_FAN_SPEED', 'REMOTE_SET_SPEED_FACTOR', 'REMOTE_SET_FLOW_FACTOR', 'REMOTE_HEATERS_OFF']) {
    assert.notEqual(getAuditActionLabel(action), '其他操作')
    assert.ok(AUDIT_ACTION_OPTIONS.some(option => option.value === action))
  }
  assert.equal(getAuditActionLabel('REMOTE_CONTROL_ENABLE'), '允许远程暂停')
})
