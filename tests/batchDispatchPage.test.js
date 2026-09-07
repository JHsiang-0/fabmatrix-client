import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/views/BatchDispatch.vue', import.meta.url), 'utf8')
const adapterSource = fs.readFileSync(new URL('../src/utils/batchDispatch.js', import.meta.url), 'utf8')

test('批量派发使用 TDesign Steps 展示资源、预览、确认和结果阶段', () => {
  assert.match(source, /<t-steps/)
  assert.match(source, /无副作用预览/)
  assert.match(source, /逐项结果/)
  assert.match(source, /currentStep/)
  assert.match(source, /<t-tabs/)
  assert.match(source, /可恢复失败/)
  assert.match(source, /需打开已有任务/)
})

test('批量派发一次只展示当前步骤，并提供可回退的步骤操作', () => {
  assert.match(source, /const activeStep = ref\(0\)/)
  assert.match(source, /currentStep === 0/)
  assert.match(source, /currentStep === 1/)
  assert.match(source, /currentStep === 2 \|\| currentStep === 3/)
  assert.match(source, /v-else class="dispatch-panel" aria-labelledby="dispatch-result-title"/)
  assert.match(source, /下一步：配置策略/)
  assert.match(source, /@click="goToSelection"/)
  assert.match(source, /@click="goToStrategy"/)
})

test('批量派发资源来自完整真实文件树并复用上传契约校验', () => {
  assert.match(source, /getFileTree\(\)/)
  assert.match(source, /collectFolderIds/)
  assert.match(source, /getFileList\(/)
  assert.match(source, /folder: false/)
  assert.match(source, /parentId: null/)
  assert.match(source, /seenFileIds/)
  assert.match(source, /validateBatchUploadSelection/)
  assert.match(source, /normalizeBatchUploadResult/)
  assert.match(source, /uploadProgress/)
  assert.match(source, /最多选择 100 个文件和 100 台打印机/)
  assert.match(source, /file\.originalName/)
})

test('批量预览和确认只展示后端字段，并保留幂等回放与恢复入口', () => {
  assert.doesNotMatch(source, /previewData\.requestId/)
  assert.doesNotMatch(source, /previewData\.suggestions/)
  assert.doesNotMatch(source, /:closable=/)
  assert.match(source, /replayConfirm/)
  assert.match(source, /retryPreviewBatchDispatch/)
  assert.match(source, /sourcePlanId/)
  assert.match(source, /confirmationToken: previewData\.value\.confirmationToken/)
  assert.match(source, /errorCode.*错误码/)
  assert.match(source, /#recovery/)
  assert.doesNotMatch(adapterSource, /item-\$\{index\}/)
})
