export const FEATURES = Object.freeze({
  batchDispatch: false
})

export function isFeatureEnabled(feature) {
  return FEATURES[feature] === true
}
