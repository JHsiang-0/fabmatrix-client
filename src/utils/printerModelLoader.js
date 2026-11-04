/** One in-flight request; device/session changes invalidate even transports ignoring abort. */
export function createPrinterModelLoader({ fetchModel, onChange, isActive = () => true,
  schedule = setTimeout, cancelSchedule = clearTimeout, now = Date.now }) {
  let generation = 0
  let printerId = null
  let timer = null
  let controller = null
  let busy = false
  let state = { loading: false, data: null, error: '', receivedAt: null }
  const publish = patch => { state = { ...state, ...patch }; onChange(state) }
  const stop = () => {
    generation += 1
    printerId = null
    cancelSchedule(timer)
    controller?.abort()
    controller = null
    busy = false
    publish({ loading: false, data: null, error: '', receivedAt: null })
  }
  const refresh = async () => {
    if (!printerId || busy || !isActive()) return
    cancelSchedule(timer)
    const currentGeneration = generation
    controller = new AbortController()
    busy = true
    publish({ loading: true })
    const current = () => generation === currentGeneration && isActive()
    try {
      const data = await fetchModel(printerId, { signal: controller.signal })
      if (current()) publish({ data, error: '', receivedAt: now() })
    } catch (error) {
      if (current()) publish({ data: null, error: error?.message || '设备状态加载失败', receivedAt: null })
    } finally {
      if (current()) {
        busy = false
        publish({ loading: false })
        timer = schedule(refresh, state.error ? 30000 : 5000)
      }
    }
  }
  const start = id => { stop(); printerId = id; void refresh() }
  return { start, stop, refresh }
}
