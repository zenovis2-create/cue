import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({ run: vi.fn(), terminate: vi.fn() }));
vi.mock('../src/process-launch.js', () => ({ runProcessSync: mocks.run }));
vi.mock('../src/process-termination.js', async (original) => ({ ...await original(), terminateVerifiedTree: mocks.terminate }));

import { openLedger, type Ledger } from '../src/ledger.js';
import { fenceInterruptedSessions } from '../src/recovery.js';

let root = '';
let db: Ledger;
const result = (stdout: string, status = 0, stderr = '') => ({ status, stdout, stderr, pid: 1, signal: null, output: [] }) as any;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cue-startup-identity-'));
  db = openLedger(join(root, 'ledger.sqlite'));
  db.prepare("INSERT INTO task(id,state,created_at) VALUES('task','running','2026-09-15T00:00:00.000Z')").run();
  db.prepare("INSERT INTO envelope(envelope_hash,worktree_realpath,egress_json,created_at) VALUES('env',?,'[]','2026-09-15T00:00:00.000Z')").run(root);
  db.prepare("INSERT INTO run(id,task_id,envelope_hash,write_in_progress,started_at) VALUES('run','task','env',1,'2026-09-15T00:00:00.000Z')").run();
});
afterEach(() => { vi.clearAllMocks(); if (db.open) db.close(); rmSync(root, { recursive: true, force: true }); });

function session(startTime: unknown, pid: unknown = 424242): void {
  db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)')
    .run('handle', pid, startTime, root, 'task', 'run');
}

describe.skipIf(process.platform !== 'win32')('startup exact process identity', () => {
  it.each([
    ['the former nearby-timestamp exploit', '2026-09-15T10:00:09.1234567Z'],
    ['a one-tick sub-millisecond mismatch', '2026-09-15T10:00:00.1234566Z'],
  ])('refuses %s without terminating', (_label, observed) => {
    session('2026-09-15T10:00:00.1234567Z');
    mocks.run.mockReturnValue(result(`${observed}\r\n`));
    expect(fenceInterruptedSessions(db)).toBe(0);
    expect(mocks.run.mock.calls[0]?.[2]).toMatchObject({ timeout: 15_000, windowsHide: true });
    expect(mocks.terminate).not.toHaveBeenCalled();
    expect(db.prepare("SELECT content FROM artifact WHERE kind='startup_fence'").get()).toEqual({ content: 'pid_identity_mismatch_refused' });
  });

  it('accepts only the same exact instant, preserving sub-millisecond precision and offset equivalence', () => {
    session('2026-09-15T19:00:00.1234567+09:00');
    mocks.run.mockReturnValue(result('2026-09-15T10:00:00.1234567Z\r\n'));
    expect(fenceInterruptedSessions(db)).toBe(1);
    expect(mocks.terminate).toHaveBeenCalledOnce();
    expect(mocks.terminate).toHaveBeenCalledWith(424242, '2026-09-15T19:00:00.1234567+09:00');
    expect(db.prepare("SELECT content FROM artifact WHERE kind='startup_fence'").get()).toEqual({ content: 'terminated_verified_session' });
  });

  it.each([
    ['malformed creation identity', '2026-09-15T10:00:00Z extra', 424242],
    ['invalid calendar identity', '2026-02-30T10:00:00.1234567Z', 424242],
    ['invalid pid', '2026-09-15T10:00:00.1234567Z', 0],
  ])('fails closed for %s before querying', (_label, startTime, pid) => {
    session(startTime, pid);
    expect(fenceInterruptedSessions(db)).toBe(0);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.terminate).not.toHaveBeenCalled();
  });

  it('does not mistake a failed identity query for process death', () => {
    session('2026-09-15T10:00:00.1234567Z');
    mocks.run.mockReturnValue(result('', 1, 'query failed'));
    expect(() => fenceInterruptedSessions(db)).toThrow(/process query failed/);
    expect(mocks.terminate).not.toHaveBeenCalled();
    expect(db.prepare("SELECT count(*) AS n FROM artifact WHERE kind='startup_fence'").get()).toEqual({ n: 0 });
  });
});
