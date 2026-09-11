import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'

const duplicateWindow = 1200
let lastErrorMessage = ''
let lastErrorAt = 0
let suppressNextErrorUntil = 0

const getMessageText = content => {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object' && typeof content.message === 'string') {
    return content.message
  }
  return String(content ?? '')
}

const showError = (content, options) => {
  const text = getMessageText(content)
  const now = Date.now()
  if (suppressNextErrorUntil > now) {
    suppressNextErrorUntil = 0
    return undefined
  }
  if (text && text === lastErrorMessage && now - lastErrorAt < duplicateWindow) {
    return undefined
  }
  lastErrorMessage = text
  lastErrorAt = now
  return MessagePlugin.error(content, options)
}

/**
 * Display a request-layer error once. Page-level catch blocks may show the
 * same error again; the message facade suppresses that immediate duplicate.
 */
export function notifyRequestError(error) {
  suppressNextErrorUntil = Date.now() + duplicateWindow
  return MessagePlugin.error(getMessageText(error))
}

// Keep the TDesign API surface used by the app while making error notices
// idempotent. Success/info/warning intentionally retain their original calls.
export const messageFacade = {
  success: (...args) => MessagePlugin.success(...args),
  info: (...args) => MessagePlugin.info(...args),
  warning: (...args) => MessagePlugin.warning(...args),
  error: showError,
  loading: (...args) => MessagePlugin.loading(...args),
  closeAll: (...args) => MessagePlugin.closeAll(...args)
}

/**
 * 统一消息提示，封装 TDesign 消息 API。
 */
export const message = messageFacade

/**
 * 显示确认对话框，并以 Promise 形式返回用户选择。
 * 保持业务代码原有的 await/then/catch 使用方式。
 */
export function confirmMessage(content, title = '提示', options = {}) {
  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (callback) => {
      if (settled) return
      settled = true
      callback()
    }

    let dialog
    const closeDialog = (callback) => {
      // 传入自定义 onClose 后，TDesign 不再执行默认的隐藏逻辑。
      dialog?.hide?.()
      settle(callback)
    }

    dialog = DialogPlugin.confirm({
      header: title,
      body: content,
      theme: options.type === 'danger' ? 'danger' : options.type === 'warning' ? 'warning' : 'default',
      confirmBtn: options.confirmButtonText || '确定',
      cancelBtn: options.cancelButtonText || '取消',
      closeOnOverlayClick: options.closeOnOverlayClick ?? true,
      onConfirm: () => closeDialog(resolve),
      onCancel: () => closeDialog(() => reject('cancel')),
      onClose: () => closeDialog(() => reject('cancel'))
    })
  })
}

export default message
