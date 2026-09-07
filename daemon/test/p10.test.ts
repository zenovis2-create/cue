import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const live = JSON.parse(readFileSync(resolve('../evidence/P10C/p10c_live_result.json'), 'utf8'));
const electron = JSON.parse(readFileSync(resolve('../evidence/P10C/p10c_electron_run.json'), 'utf8'));

describe('Phase 10 real engine evidence (superseded by split Phase 10-C runtime)', () => {
  it('P10-1 records two goal-derived immutable action sets and removes the old literal', () => {
    expect(live.verdict).toBe('PASS');
    expect(live.runs).toHaveLength(2);
    expect(live.runs[0].allowedActions).not.toEqual(live.runs[1].allowedActions);
    for (const run of live.runs) {
      expect(run.allowedActions).toEqual(expect.arrayContaining(['command', 'file_change']));
      expect(run.allowedActions.some((action: string) => action.startsWith('goal:'))).toBe(true);
    }
    expect(readFileSync(resolve('../app/core.mjs'), 'utf8')).not.toContain('cue-p9-live.txt');
  });

  it('P10-2/P10-3 records distinct inspected artifacts and real controller/worker PIDs', () => {
    expect(live.runs[0].contentVerified).toBe(true);
    expect(live.runs[1].contentVerified).toBe(true);
    expect(live.runs[0].sha256).not.toBe(live.runs[1].sha256);
    expect(live.runs[0].content).not.toBe(live.runs[1].content);
    for (const run of live.runs) {
      expect(run.card.state).toBe('completed');
      expect(run.card.workerPids.length).toBeGreaterThan(0);
      expect(new Set(run.card.workerPids).size).toBe(run.card.workerPids.length);
      expect(live.sessions.some((session: any) => session.runId === run.runId && session.role === 'controller' && session.boundary === 'host-model-only')).toBe(true);
      expect(live.sessions.some((session: any) => session.runId === run.runId && session.role === 'tool_worker' && session.boundary === 'appcontainer-capability-zero')).toBe(true);
    }
  });

  it('P10-4 through P10-8 remain executable OS-level gates in the replacement suites', () => {
    const core = readFileSync(resolve('test/p10c-core.test.ts'), 'utf8');
    const worker = readFileSync(resolve('test/p10c-worker.test.ts'), 'utf8');
    for (const title of [
      'relaunches real controller and AppContainer worker PIDs',
      'stops both the host controller and the live AppContainer worker',
      'blocks a controller crash without automatically resuming it',
      'reconciles a previously running write as blocked/crash without auto-resume on restart',
    ]) expect(core).toContain(title);
    for (const title of [
      'OS boundary deny an obfuscated write outside',
      'denies a junction escape',
      'real socket attempt',
    ]) expect(worker).toContain(title);
  });

  it('P10-9 through P10-11 preserves explicit approval, standalone Electron completion, and no progress notification', () => {
    expect(electron).toMatchObject({ windowCreated: true, adapterMode: 'none', state: 'completed' });
    expect(electron.rendered.state).toBe('completed');
    expect(electron.sessions.some((session: any) => session.role === 'tool_worker' && session.boundary === 'appcontainer-capability-zero')).toBe(true);
    const app = ['core.mjs', 'ipc.mjs', 'main.mjs'].map(file => readFileSync(resolve('../app', file), 'utf8')).join('\n');
    expect(app).not.toMatch(/new Notification|\.showNotification|webContents\.send/iu);
    expect(app).toContain("throw new Error('approval required')");
  });

  it('P10-12 keeps the historical PARTIAL labels intact', () => {
    for (const file of ['P3/p3c_result.json', 'P4/p4_result.json', 'P6/p6_result.json']) {
      expect(readFileSync(resolve('../evidence', file), 'utf8')).toContain('PARTIAL');
    }
  });
});
