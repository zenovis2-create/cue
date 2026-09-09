import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCueCore, initializeConfig } from '../../app/core.mjs';

const roots: string[] = [];
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

function temp(): string {
  const root = mkdtempSync(join(tmpdir(), 'cue-p12-enforcement-core-'));
  roots.push(root);
  return root;
}

async function until(check: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error('FAIL: enforcement core timeout');
    await delay(20);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

describe.skipIf(process.platform !== 'win32')('P12 enforcement terminal state', () => {
  it('never retries an approved run after an enforcement violation poisons its turn', async () => {
    const root = temp();
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    mkdirSync(worktree);
    mkdirSync(sourceHome);
    writeFileSync(join(sourceHome, 'auth.json'), '{}');

    const launchHost = vi.fn((db, owner) => {
      db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
        .run(owner.task_id, owner.run_id, 'enforcement_violation', 'filesystem', new Date().toISOString());
      return {
        session: { pid: 4200 + launchHost.mock.calls.length },
        child: { pid: 4200 + launchHost.mock.calls.length },
        stop() {},
        done: Promise.resolve({
          threadId: 'thread-poisoned',
          turnId: 'turn-poisoned',
          status: 'failed',
          finalMessage: '',
          controllerPid: 4200 + launchHost.mock.calls.length,
          workerPids: [4300 + launchHost.mock.calls.length],
          successfulToolCalls: 0,
          controllerStderr: '',
          error: 'CUE_ENFORCEMENT_VIOLATION: filesystem',
          failureKind: 'enforcement',
          goalVerification: { passed: false, reason: 'model_not_completed', changedPaths: [] },
        }),
      };
    });

    const core = createCueCore(
      initializeConfig(join(root, 'state'), { worktreeRoot: worktree }),
      undefined,
      { binary: process.execPath, codexHome: sourceHome, launchHost } as any,
    );
    try {
      const prepared = core.prepareGoal('Create result.txt', 3);
      core.approve(prepared.runId);
      core.execute(prepared.runId);
      await until(() => core.completion(prepared.taskId).state !== 'running');

      expect(launchHost).toHaveBeenCalledTimes(1);
      expect(core.completion(prepared.taskId)).toMatchObject({
        state: 'blocked',
        blockedReason: 'enforcement_violation',
        recoveryAttempts: 0,
      });
      expect(core.daemon.db.prepare('SELECT count(*) AS n FROM recovery_attempt_v2 WHERE run_id=?').get(prepared.runId)).toEqual({ n: 0 });
      expect(core.daemon.db.prepare('SELECT count(*) AS n FROM workspace_write_lease WHERE run_id=?').get(prepared.runId)).toEqual({ n: 0 });
    } finally {
      core.close();
    }
  });
});
