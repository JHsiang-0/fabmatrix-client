import { mockState } from './data.js'
import { toPublicPrinter } from './server.js'

let mockEventSequence = 0

const toState = status => ({
  status,
  unifiedState: status,
  state: status
})

const buildPrinterData = printer => ({
  stateSource: 'DEVICE_POLL',
  ...toState(printer.status),
  currentJobId: printer.currentJobId,
  currentJobFileName: printer.currentJobFileName,
  progress: printer.currentJobId ? 62 : 0,
  toolTemperature: printer.status === 'PRINTING' ? 210 : 25,
  toolTarget: printer.status === 'PRINTING' ? 210 : 0,
  bedTemperature: printer.status === 'PRINTING' ? 60 : 25,
  bedTarget: printer.status === 'PRINTING' ? 60 : 0
})

export function createMockWebSocketStream({ onOpen, onMessage, onClose } = {}) {
  let tick = 0
  let sequence = 0
  const emit = message => onMessage?.({
    version: '1',
    eventId: `mock-event-${++mockEventSequence}`,
    sequence: ++sequence,
    timestamp: Date.now(),
    ...message
  })

  onOpen?.()
  emit({
    type: 'SNAPSHOT',
    data: {
      printers: mockState.printers.map(toPublicPrinter)
    }
  })

  const timer = window.setInterval(() => {
    tick += 1
    const printer = mockState.printers[tick % mockState.printers.length]
    if (!printer) return

    if (printer.status === 'OFFLINE') {
      emit({ type: 'PRINTER_OFFLINE', printerId: printer.id, data: { message: '设备暂时离线' } })
      return
    }

    emit({ type: 'PRINTER_STATUS', printerId: printer.id, data: buildPrinterData(printer) })
    if (printer.currentJobId) {
      const job = mockState.jobs.find(item => String(item.id) === String(printer.currentJobId))
      emit({
        type: 'JOB_STATUS',
        printerId: printer.id,
        data: {
          jobId: job?.id,
          currentJobId: printer.currentJobId,
          status: job?.status || 'PRINTING',
          progress: Math.min(62 + tick, 99)
        }
      })
    }
  }, 5000)

  return {
    close() {
      window.clearInterval(timer)
      onClose?.()
    }
  }
}
