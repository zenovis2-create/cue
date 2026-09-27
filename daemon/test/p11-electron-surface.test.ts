import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { IPC_CHANNELS, registerIpcHandlers } from '../../app/ipc.mjs';

describe('P11 explicit renderer boundary', () => {
  it('exposes exact execution, report, resource and selection preference functions', () => {
    let surface: Record<string, unknown> = {};
    const invoke = vi.fn();
    runInNewContext(readFileSync(new URL('../../app/preload.cjs', import.meta.url), 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld: (_name: string, api: Record<string, unknown>) => { surface = api; } }, ipcRenderer: { invoke } }),
    });
    expect(Object.keys(surface).sort()).toEqual(['approve', 'candidateInventory', 'evaluation', 'execute', 'localJsonSetup', 'localPlanningSetup', 'nativeRecovery', 'planningAvailability', 'prepare', 'prepareFromPlanning', 'prepareJson', 'preparePlanning', 'projects', 'report', 'resources', 'retrospective', 'selectionPreferences', 'setSelectionPreference', 'stop', 'userSessions', 'workspaceSessions']);
    expect(Object.values(surface).every(value => typeof value === 'function')).toBe(true);
    expect(Object.isFrozen(surface)).toBe(true);
    const approval = Object.freeze({ runId: 'run-approved', allowExploration: true as const });
    (surface.approve as (input: typeof approval) => unknown)(approval);
    expect(invoke).toHaveBeenCalledWith('cue:approve', approval);
    expect(IPC_CHANNELS).toEqual(['cue:prepare', 'cue:planning-availability', 'cue:prepare-planning', 'cue:prepare-from-planning', 'cue:approve', 'cue:execute', 'cue:stop', 'cue:selection-preferences', 'cue:report', 'cue:resources', 'cue:prepare-json', 'cue:local-json-setup', 'cue:local-planning-setup', 'cue:retrospective', 'cue:candidate-inventory', 'cue:native-recovery', 'cue:evaluation', 'cue:workspace-sessions', 'cue:projects', 'cue:user-sessions']);
  });

  it('forwards only exact approval commands and never invokes Core for malformed inputs', () => {
    const approve = vi.fn(() => ({ approved: true, runId: 'run-approved' }));
    const ipc = registerIpcHandlers({ handle: vi.fn() }, { approve } as never);
    expect(ipc.invoke('cue:approve', { runId: 'run-approved' })).toEqual({ approved: true, runId: 'run-approved' });
    expect(approve).toHaveBeenLastCalledWith('run-approved');
    expect(ipc.invoke('cue:approve', { runId: 'run-approved', allowExploration: true })).toEqual({ approved: true, runId: 'run-approved' });
    expect(approve).toHaveBeenLastCalledWith('run-approved', { allowExploration: true });
    approve.mockClear();
    let getterCalls = 0;
    const getter = Object.defineProperty({}, 'runId', { enumerable: true, get() { getterCalls += 1; return 'run-approved'; } });
    const malformed = [null, {}, getter, { runId: 'run-approved', allowExploration: false }, { runId: 'run-approved', allowExploration: true, extra: true },
      Object.create({ runId: 'run-approved' }), new Proxy({ runId: 'run-approved' }, { get() { getterCalls += 1; throw Error('proxy'); } })];
    for (const input of malformed) expect(() => ipc.invoke('cue:approve', input)).toThrow('IPC approval input denied');
    expect(getterCalls).toBe(0);
    expect(approve).not.toHaveBeenCalled();
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
