import { ref, onScopeDispose } from 'vue'
import { defineStore } from 'pinia'

/** Shared read clock: samples expire even while HTTP/WebSocket delivers nothing. */
export const usePrinterStateClock = defineStore('printerStateClock', () => {
  const now = ref(Date.now())
  const timer = setInterval(() => { now.value = Date.now() }, 1000)
  timer.unref?.()
  onScopeDispose(() => clearInterval(timer))
  return { now }
})
