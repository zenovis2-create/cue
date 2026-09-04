const { contextBridge, ipcRenderer } = require('electron');

const allowedApi = Object.freeze({
  prepare: input => ipcRenderer.invoke('cue:prepare', input),
  approve: input => ipcRenderer.invoke('cue:approve', input),
  execute: input => ipcRenderer.invoke('cue:execute', input),
  stop: input => ipcRenderer.invoke('cue:stop', input),
  status: input => ipcRenderer.invoke('cue:status', input),
});

contextBridge.exposeInMainWorld('cue', allowedApi);
