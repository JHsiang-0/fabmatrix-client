export function createLatestRequestGuard() {
  let latestRequestId = 0
  let active = true

  return {
    begin() {
      if (!active) return null
      latestRequestId += 1
      return latestRequestId
    },
    isCurrent(requestId) {
      return active && requestId === latestRequestId
    },
    invalidate() {
      active = false
      latestRequestId += 1
    }
  }
}
