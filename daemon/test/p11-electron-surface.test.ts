import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { IPC_CHANNELS, registerIpcHandlers } from '../../app/ipc.mjs';

describe('P11 four-function renderer boundary', () => {
  it('exposes exactly the original four functions at preload execution', () => {
    let surface: Record<string, unknown> = {};
    runInNewContext(readFileSync(new URL('../../app/preload.cjs', import.meta.url), 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld: (_name: string, api: Record<string, unknown>) => { surface = api; } }, ipcRenderer: { invoke: vi.fn() } }),
    });
    expect(Object.keys(surface).sort()).toEqual(['approve', 'execute', 'prepare', 'stop']);
    expect(Object.values(surface).every(value => typeof value === 'function')).toBe(true);
    expect(Object.isFrozen(surface)).toBe(true);
    expect(IPC_CHANNELS).toEqual(['cue:prepare', 'cue:approve', 'cue:execute', 'cue:stop']);
  });

  it('status reads cannot execute and unknown operations are refused', () => {
    const core = { execute: vi.fn(() => { throw new Error('approval required'); }), completion: vi.fn(() => ({ state: 'running' })) };
    const ipc = registerIpcHandlers({ handle: vi.fn() }, core as never);
    expect(ipc.invoke('cue:execute', { operation: 'status', taskId: 'task' })).toEqual({ state: 'running' });
    expect(core.execute).not.toHaveBeenCalled();
    expect(() => ipc.invoke('cue:execute', { operation: 'bypass' })).toThrow('IPC operation denied');
    expect(() => ipc.invoke('cue:execute', { runId: 'run' })).toThrow('approval required');
    expect(() => ipc.invoke('cue:status', {})).toThrow('IPC channel denied');
  });
});
