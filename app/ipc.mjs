export const IPC_CHANNELS = Object.freeze(['cue:prepare', 'cue:approve', 'cue:execute', 'cue:stop']);

export function assertAllowedChannel(channel) {
  if (!IPC_CHANNELS.includes(channel)) throw new Error(`IPC channel denied: ${channel}`);
  return channel;
}

export function registerIpcHandlers(ipcMain, core) {
  const handlers = Object.freeze({
    'cue:prepare': (_event, input) => core.prepareGoal(String(input?.goal ?? ''), Number(input?.autonomy ?? 3)),
    'cue:approve': (_event, input) => core.approve(String(input?.runId ?? '')),
    'cue:execute': (_event, input) => {
      if (input?.operation === 'status') return core.completion(String(input?.taskId ?? ''));
      if (input?.operation !== undefined) throw new Error('IPC operation denied');
      return core.execute(String(input?.runId ?? ''));
    },
    'cue:stop': (_event, input) => core.stop(String(input?.runId ?? '')),
  });
  for (const channel of IPC_CHANNELS) ipcMain.handle(channel, handlers[channel]);
  return Object.freeze({ invoke(channel, ...args) { return handlers[assertAllowedChannel(channel)](null, ...args); } });
}
