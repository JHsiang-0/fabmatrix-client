import { mockState } from './data.js'
import { toPublicPrinter, toPublicSemanticIds } from './server.js'

let mockEventSequence = 0
const mockSubscribers = new Set()

const normalizeIdentity = identity => ({
  userId: identity?.userId === undefined || identity?.userId === null ? null : String(identity.userId),
  role: String(identity?.role || '').toUpperCase()
})

const canReceive = (subscriber, message) => {
  if (message.type !== 'JOB_STATUS') return true
  if (subscriber.identity.role === 'ADMIN') return true
  return subscriber.identity.role === 'OPERATOR'
    && subscriber.identity.userId !== null
    && message.audienceUserId !== undefined
    && message.audienceUserId !== null
    && subscriber.identity.userId === String(message.audienceUserId)
}

const toWireMessage = message => {
  const { audienceUserId: _audienceUserId, ...wireMessage } = message
  return wireMessage
}

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

export function createMockWebSocketStream({ identity, onOpen, onMessage, onClose } = {}) {
  let tick = 0
  let sequence = 0
  const subscriber = { identity: normalizeIdentity(identity), onMessage, nextSequence: () => ++sequence }
  const emit = message => {
    if (!canReceive(subscriber, message)) return
    onMessage?.(toPublicSemanticIds({
      version: '1',
      eventId: `mock-event-${++mockEventSequence}`,
      sequence: subscriber.nextSequence(),
      timestamp: Date.now(),
      ...toWireMessage(message)
    }))
  }
  mockSubscribers.add(subscriber)

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
        audienceUserId: job?.userId,
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
      mockSubscribers.delete(subscriber)
      onClose?.()
    }
  }
}

/** 向当前所有 Mock 客户端广播服务端事件。 */
export function publishMockWebSocketEvent(message) {
  // 逻辑事件共享 eventId；sequence 按每个会话实际可见消息流单独递增。
  const eventId = `mock-event-${++mockEventSequence}`
  const timestamp = Date.now()
  mockSubscribers.forEach(subscriber => {
    if (!canReceive(subscriber, message)) return
    subscriber.onMessage?.(toPublicSemanticIds({
      version: '1',
      eventId,
      sequence: subscriber.nextSequence(),
      timestamp,
      ...toWireMessage(message)
    }))
  })
}
