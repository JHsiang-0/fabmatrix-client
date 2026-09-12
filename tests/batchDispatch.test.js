import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { isFeatureEnabled } from '../src/config/features.js'
import { getNavigationItem } from '../src/config/navigation.js'
import {
  acquireBatchConfirmLock,
  createBatchPreviewRequest,
  isBatchConfirmItemSuccessful,
  normalizeBatchConfirmResult,
  releaseBatchConfirmLock,
  toBatchPreviewPayload
} from '../src/utils/batchDispatch.js'

const routerSource = await readFile(new URL('../src/router/index.js', import.meta.url), 'utf8')
const browserE2ESource = await readFile(new URL('./e2e/browser.spec.js', import.meta.url), 'utf8')
const electronE2ESource = await readFile(new URL('./e2e/electron.spec.js', import.meta.url), 'utf8')

test('当前版本隐藏批量派发入口并拒绝直接路由访问', () => {
  assert.equal(isFeatureEnabled('batchDispatch'), false)
  assert.equal(getNavigationItem('/batch-dispatch'), null)
  assert.match(routerSource, /feature: 'batchDispatch'/)
  assert.match(routerSource, /isFeatureEnabled\(record\.meta\.feature\)/)
  assert.match(routerSource, /if \(disabledFeatureRoute\) return \{ name: 'not-found' \}/)
  assert.match(routerSource, /skipSessionRestore: true/)
})

test('批量派发导航、路由和业务 E2E 共享同一个功能开关', () => {
  for (const source of [browserE2ESource, electronE2ESource]) {
    assert.match(source, /isFeatureEnabled\('batchDispatch'\)/)
    assert.match(source, /feature: 'batchDispatch'/)
  }
  assert.match(browserE2ESource, /test\.skip\(batchDispatchEnabled/)
  assert.match(browserE2ESource, /test\.skip\(!batchDispatchEnabled/)
})

test('v2 批量派发只展示 v3 预留标识，不包含自动派单动作', async () => {
  const source = await readFile(new URL('../src/views/BatchDispatch.vue', import.meta.url), 'utf8')
  assert.match(source, /v3 自动派单：规划中/)
  assert.doesNotMatch(source, /autoAssign/)
})

test('builds a plan-level preview context and keeps action on each client item', () => {
  const request = createBatchPreviewRequest({
    fileIds: [101, '102'],
    printerIds: [201, 202],
    strategy: 'ROUND_ROBIN',
    action: 'START_AFTER_CONFIRM',
    requestId: 'preview-test'
  })

  assert.equal(request.requestId, 'preview-test')
  assert.deepEqual(request.items, [
    { fileId: '101', printerId: '201' },
    { fileId: '102', printerId: '202' }
  ])
  assert.deepEqual(toBatchPreviewPayload(request), {
    fileIds: ['101', '102'],
    printerIds: ['201', '202'],
    strategy: 'ROUND_ROBIN',
    action: 'START_AFTER_CONFIRM'
  })
})

test('auto match keeps printer assignment empty until preview suggestions arrive', () => {
  const request = createBatchPreviewRequest({
    fileIds: ['file-a', 'file-b'],
    printerIds: ['printer-a'],
    strategy: 'AUTO_MATCH'
  })

  assert.ok(request.requestId.startsWith('batch-preview-'))
  assert.deepEqual(request.items.map(item => item.printerId), [null, null])
})

test('does not treat recovery-required results as successful jobs', () => {
  const [item] = normalizeBatchConfirmResult({
    planId: 'plan-1',
    items: [{
      itemId: 'item-1',
      jobId: 'job-1',
      status: 'RECOVERY_REQUIRED',
      recoveryAction: 'OPEN_EXISTING_JOB',
      retryable: false
    }]
  }).items

  assert.equal(isBatchConfirmItemSuccessful(item), false)
  assert.equal(item.jobId, 'job-1')
  assert.equal(item.recoveryAction, 'OPEN_EXISTING_JOB')
})

test('批量确认适配严格保留 Java DispatchPlanItemVO，并由 status 推导成功', () => {
  const [item] = normalizeBatchConfirmResult({
    planId: 'plan-1',
    items: [{
      itemId: 'item-1',
      fileId: 101,
      fileName: 'gearbox.gcode',
      printerId: 201,
      printerName: 'Printer_A12F',
      printerStatus: 'IDLE',
      canExecute: false,
      status: 'ASSIGNED',
      reasonCode: null,
      message: '已派发到打印机，未启动',
      jobId: 1007,
      sourcePlanId: null,
      sourceItemId: null,
      recoveryAction: null,
      attemptCount: 1,
      retryable: false,
      success: true,
      errorCode: null,
      job: { id: 1007 }
    }]
  }).items

  assert.deepEqual(Object.keys(item).sort(), [
    'attemptCount', 'canExecute', 'fileId', 'fileName', 'itemId', 'jobId',
    'message', 'printerId', 'printerName', 'printerStatus', 'reasonCode',
    'recoveryAction', 'retryable', 'sourceItemId', 'sourcePlanId', 'status'
  ])
  assert.equal(item.fileId, '101')
  assert.equal(item.printerId, '201')
  assert.equal(isBatchConfirmItemSuccessful(item), true)
  assert.equal('success' in item, false)
  assert.equal('errorCode' in item, false)
  assert.equal('job' in item, false)
})

test('批量确认快速双击只打开一个确认框并只发送一个确认请求', async () => {
  const state = { confirming: { value: false }, actionLoadingKey: { value: '' } }
  const plan = { planId: 'plan-1', version: 2, itemIds: ['item-1'], confirmationToken: 'token-1' }
  const requestCalls = []
  let resolvePrompt
  let promptCalls = 0
  const confirmMessage = () => {
    promptCalls += 1
    return new Promise(resolve => { resolvePrompt = resolve })
  }
  const confirmRequest = async payload => {
    requestCalls.push({ url: '/api/v1/print-jobs/batch/confirm', payload })
    return { data: { planId: plan.planId } }
  }
  const confirm = async () => {
    if (!acquireBatchConfirmLock({ ...state, planId: plan.planId })) return false
    try {
      await confirmMessage()
      await confirmRequest(plan)
      return true
    } finally {
      releaseBatchConfirmLock(state)
    }
  }

  const first = confirm()
  const second = confirm()
  assert.equal(promptCalls, 1)
  assert.equal(await second, false)
  assert.equal(requestCalls.length, 0)
  assert.equal(state.confirming.value, true)
  assert.equal(state.actionLoadingKey.value, 'confirm:plan-1')

  resolvePrompt()
  assert.equal(await first, true)
  assert.equal(requestCalls.length, 1)
  assert.equal(requestCalls[0].url, '/api/v1/print-jobs/batch/confirm')
  assert.equal(state.confirming.value, false)
  assert.equal(state.actionLoadingKey.value, '')
})

test('批量确认取消或请求异常后释放锁并允许再次操作', async () => {
  const state = { confirming: { value: false }, actionLoadingKey: { value: '' } }
  let promptCalls = 0
  const confirmMessage = () => {
    promptCalls += 1
    if (promptCalls === 1) return Promise.reject('cancel')
    return Promise.resolve()
  }
  const confirm = async confirmRequest => {
    if (!acquireBatchConfirmLock({ ...state, planId: 'plan-2' })) return false
    try {
      await confirmMessage()
      await confirmRequest()
      return true
    } finally {
      releaseBatchConfirmLock(state)
    }
  }

  const cancelled = confirm(async () => {})
  await assert.rejects(cancelled, error => error === 'cancel')
  assert.equal(state.confirming.value, false)
  assert.equal(state.actionLoadingKey.value, '')

  let requestCalls = 0
  assert.equal(await confirm(async () => { requestCalls += 1 }), true)
  assert.equal(promptCalls, 2)
  assert.equal(requestCalls, 1)
  assert.equal(state.confirming.value, false)
  assert.equal(state.actionLoadingKey.value, '')

  await assert.rejects(confirm(async () => { throw new Error('request failed') }), /request failed/)
  assert.equal(requestCalls, 1)
  assert.equal(state.confirming.value, false)
  assert.equal(state.actionLoadingKey.value, '')
})
