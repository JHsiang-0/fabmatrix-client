const runtimeEnv = import.meta.env || {}

export const FEATURE_DISABLED = Object.freeze({
  code: 10004,
  message: '功能暂未开放'
})

export const FEATURES = Object.freeze({
  // V3 验收完成后可通过构建环境显式开启；准正式版默认关闭。
  batchDispatch: runtimeEnv.VITE_FEATURE_BATCH_DISPATCH === 'true'
})

export function isFeatureEnabled(feature) {
  return FEATURES[feature] === true
}

export function createFeatureDisabledError(feature) {
  const error = new Error(FEATURE_DISABLED.message)
  error.code = FEATURE_DISABLED.code
  error.feature = feature
  return error
}

export function assertFeatureEnabled(feature) {
  if (!isFeatureEnabled(feature)) throw createFeatureDisabledError(feature)
}
