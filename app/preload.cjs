const { contextBridge, ipcRenderer } = require('electron');

const allowedApi = Object.freeze({
  prepare: input => ipcRenderer.invoke('cue:prepare', input),
  planningAvailability: () => ipcRenderer.invoke('cue:planning-availability'),
  preparePlanning: input => ipcRenderer.invoke('cue:prepare-planning', input),
  prepareFromPlanning: input => ipcRenderer.invoke('cue:prepare-from-planning', input),
  prepareJson: input => ipcRenderer.invoke('cue:prepare-json', input),
  localJsonSetup: input => ipcRenderer.invoke('cue:local-json-setup', input),
  localPlanningSetup: input => ipcRenderer.invoke('cue:local-planning-setup', input),
  approve: input => ipcRenderer.invoke('cue:approve', input),
  execute: input => ipcRenderer.invoke('cue:execute', input),
  stop: input => ipcRenderer.invoke('cue:stop', input),
  report: input => ipcRenderer.invoke('cue:report', input),
  resources: input => ipcRenderer.invoke('cue:resources', input),
  retrospective: input => ipcRenderer.invoke('cue:retrospective', input),
  candidateInventory: input => ipcRenderer.invoke('cue:candidate-inventory', input),
  nativeRecovery: input => ipcRenderer.invoke('cue:native-recovery', input),
  evaluation: input => ipcRenderer.invoke('cue:evaluation', input),
  workspaceSessions: input => ipcRenderer.invoke('cue:workspace-sessions', input),
  projects: input => ipcRenderer.invoke('cue:projects', input),
  userSessions: input => ipcRenderer.invoke('cue:user-sessions', input),
  selectionPreferences: () => ipcRenderer.invoke('cue:selection-preferences', { operation: 'read' }),
  setSelectionPreference: input => ipcRenderer.invoke('cue:selection-preferences', { operation: 'write', mode: input?.mode, expectedRevision: input?.expectedRevision }),
});

contextBridge.exposeInMainWorld('cue', allowedApi);
