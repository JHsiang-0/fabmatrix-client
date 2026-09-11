export function createFullscreenLeaveHandler({ navigate, isNavigationFailure, exitFullscreen, onError }) {
  let leaving = false

  return {
    isLeaving: () => leaving,
    async leave() {
      if (leaving) return false
      leaving = true
      try {
        const failure = await navigate()
        if (isNavigationFailure(failure)) {
          leaving = false
          return false
        }
        await exitFullscreen()
        return true
      } catch (error) {
        leaving = false
        onError?.(error)
        return false
      }
    }
  }
}
