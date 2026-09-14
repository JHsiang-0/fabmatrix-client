const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('farmDesktop', Object.freeze({
  isDesktop: true,
  isPackaged: process.isPackaged,
  setFullscreen: fullscreen => ipcRenderer.invoke('farm-window:set-fullscreen', Boolean(fullscreen)),
  getWindowState: () => ipcRenderer.invoke('farm-window:get-state'),
  minimize: () => ipcRenderer.invoke('farm-window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('farm-window:toggle-maximize'),
  close: () => ipcRenderer.invoke('farm-window:close'),
  onWindowStateChange: callback => {
    const listener = (_event, state) => callback(Object.freeze({
      isMaximized: Boolean(state?.isMaximized),
      isFullscreen: Boolean(state?.isFullscreen)
    }))
    ipcRenderer.on('farm-window:state-changed', listener)
    return () => ipcRenderer.removeListener('farm-window:state-changed', listener)
  },
  getRuntimeInfo: () => ipcRenderer.invoke('farm-runtime:get-info'),
  onFullscreenChange: callback => {
    const listener = (_event, fullscreen) => callback(Boolean(fullscreen))
    ipcRenderer.on('farm-window:fullscreen-changed', listener)
    return () => ipcRenderer.removeListener('farm-window:fullscreen-changed', listener)
  }
}))
