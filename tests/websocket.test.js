import test from 'node:test'
import assert from 'node:assert/strict'

class FakeWebSocket {
  static instances = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = FakeWebSocket.CONNECTING
    this.listeners = new Map()
    this.sent = []
    FakeWebSocket.instances.push(this)
    queueMicrotask(() => this.open())
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set()
    handlers.add(handler)
    this.listeners.set(type, handlers)
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler)
  }

  emit(type, event = {}) {
    this.listeners.get(type)?.forEach(handler => handler(event))
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.emit('open', { type: 'open' })
  }

  message(data) {
    this.emit('message', { data })
  }

  serverClose(code = 1006, reason = 'network') {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', { code, reason })
  }

  send(data) {
    this.sent.push(data)
  }

  close(code = 1000, reason = '') {
    if (this.readyState === FakeWebSocket.CLOSED) return
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', { code, reason })
  }
}

const originalWebSocket = globalThis.WebSocket
globalThis.WebSocket = FakeWebSocket
const { WebSocketClient } = await import('../src/utils/websocket.js')

test.after(() => {
  globalThis.WebSocket = originalWebSocket
})

test('parses JSON messages and cleans up on destroy', async () => {
  FakeWebSocket.instances.length = 0
  const client = new WebSocketClient('ws://farm.test/ws', {
    autoConnect: false,
    heartbeatInterval: null
  })
  const messages = []
  client.on('message', message => messages.push(message))

  await client.connect()
  const socket = FakeWebSocket.instances[0]
  socket.message(JSON.stringify({ type: 'SNAPSHOT', data: { printers: [] } }))

  assert.equal(client.getState(), 'OPEN')
  assert.deepEqual(messages, [{ type: 'SNAPSHOT', data: { printers: [] } }])

  client.destroy()
  assert.equal(client.getState(), 'CLOSED')
  assert.equal(client.isConnected(), false)
})

test('reconnects after an unexpected close with bounded backoff', async () => {
  FakeWebSocket.instances.length = 0
  const client = new WebSocketClient('ws://farm.test/ws', {
    autoConnect: false,
    reconnectDelay: 5,
    maxReconnectDelay: 5,
    maxReconnectAttempts: 1,
    heartbeatInterval: null
  })
  await client.connect()
  FakeWebSocket.instances[0].serverClose()

  // 客户端为避免过密重连，最小退避时间为 100ms。
  await new Promise(resolve => setTimeout(resolve, 140))
  assert.equal(FakeWebSocket.instances.length, 2)
  assert.equal(client.getState(), 'OPEN')

  client.destroy()
})

test('does not send application heartbeat and reconnects after inactivity timeout', async () => {
  FakeWebSocket.instances.length = 0
  const client = new WebSocketClient('ws://farm.test/ws', {
    autoConnect: false,
    reconnectDelay: 5,
    maxReconnectDelay: 5,
    maxReconnectAttempts: 1,
    inactivityTimeout: 20
  })
  await client.connect()
  const firstSocket = FakeWebSocket.instances[0]

  await new Promise(resolve => setTimeout(resolve, 140))
  assert.deepEqual(firstSocket.sent, [])
  assert.equal(FakeWebSocket.instances.length, 2)
  assert.equal(client.getState(), 'OPEN')

  client.destroy()
})

test('does not reconnect after an intentional close', async () => {
  FakeWebSocket.instances.length = 0
  const client = new WebSocketClient('ws://farm.test/ws', {
    autoConnect: false,
    reconnectDelay: 5,
    maxReconnectAttempts: 1,
    heartbeatInterval: null
  })
  await client.connect()
  client.close()

  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(FakeWebSocket.instances.length, 1)
  assert.equal(client.getState(), 'CLOSED')

  client.destroy()
})

test('never logs token-bearing native events, socket objects or error details', async () => {
  FakeWebSocket.instances.length = 0
  const secret = 'jwt-super-secret-value'
  const captured = []
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
  }
  console.log = (...args) => captured.push(args)
  console.warn = (...args) => captured.push(args)
  console.error = (...args) => captured.push(args)

  try {
    const client = new WebSocketClient(`ws://farm.test/ws?token=${secret}`, {
      autoConnect: false,
      maxReconnectAttempts: 0
    })
    client.on('error', () => {
      throw new Error(secret)
    })
    await client.connect()
    const socket = FakeWebSocket.instances[0]
    socket.emit('error', { type: 'error', target: socket, config: { token: secret } })
    socket.serverClose(1000, `token=${secret}`)
    client.destroy()
  } finally {
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  }

  assert.equal(JSON.stringify(captured).includes(secret), false)
  assert.equal(captured.flat().some(value => typeof value === 'object' && value !== null), false)
})
