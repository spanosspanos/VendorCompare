'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // ToS
  recordTos: (record) => ipcRenderer.invoke('tos-record', record),

  // Ollama model management
  checkModel: (name) => ipcRenderer.invoke('ollama-check-model', name),
  pullModel: (name) => ipcRenderer.invoke('ollama-pull-model', name),
  onPullProgress: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('ollama-pull-progress', handler)
    // Return cleanup function
    return () => ipcRenderer.removeListener('ollama-pull-progress', handler)
  },
})
