'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  recordTos: (record) => ipcRenderer.invoke('tos-record', record),
})
