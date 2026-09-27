import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { openLedger } from '../src/ledger.js';

const roots: string[] = [];
const children = new Set<ChildProcess>();
const fixture = join(process.cwd(), 'test', 'fixtures', 'integration-driver-wait-crash-child.mjs');

async function terminateOwned(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, 'close');
  child.kill('SIGTERM');
  await closed;
}
async function nextJson(child: ChildProcess): Promise<any> {
  const lines = createInterface({ input: child.stdout! });
  for await (const line of lines) { lines.close(); return JSON.parse(line); }
  throw new Error('restart fixture closed before output');
}
async function waitFor(predicate: () => boolean): Promise<void> {
  for (let n = 0; n < 300; n++) { if (predicate()) return; await new Promise(resolveDelay => setTimeout(resolveDelay, 10)); }
  throw new Error('restart fixture timed out');
}
function launch(mode: string, database: string, worktree: string, marker: string): ChildProcess {
  const child = spawn(process.execPath, [fixture, mode, database, worktree, marker], { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child); child.once('close', () => children.delete(child)); return child;
}

afterEach(async () => {
  for (const child of [...children]) await terminateOwned(child);
  for (const root of roots.splice(0)) { const target = resolve(root); expect(isAbsolute(target) && target.startsWith(resolve(tmpdir()) + '\\') && target.includes('cue-wait-process-restart-')).toBe(true); rmSync(target, { recursive: true, force: true }); }
});

describe('S3 real Node-process wait delivery restart', () => {
  it('does not redeliver a durably claimed response after death before acknowledgement', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-wait-process-restart-')); roots.push(root);
    const database = join(root, 'ledger.db'), worktree = join(root, 'worktree'), marker = join(root, 'delivery-marker.jsonl'); mkdirSync(worktree);
    const first = launch('crash-window', database, worktree, marker);
    let stderr = ''; first.stderr!.on('data', chunk => { stderr += String(chunk); });
    const ready = await nextJson(first);
    await waitFor(() => existsSync(marker) && readFileSync(marker, 'utf8').trim().split(/\r?\n/u).length === 1);
    const before = openLedger(database);
    expect(before.prepare('SELECT COUNT(*) n FROM orchestration_wait_dispatch_claim').get()).toEqual({ n: 1 });
    expect(before.prepare('SELECT COUNT(*) n FROM orchestration_wait_delivery_observation').get()).toEqual({ n: 0 }); before.close();
    await terminateOwned(first); expect(stderr).toBe('');

    const second = launch('reopen', database, worktree, marker); const secondClosed = once(second, 'close'); let secondError = ''; second.stderr!.on('data', chunk => { secondError += String(chunk); });
    const reopened = await nextJson(second); const [code] = await secondClosed;
    expect(code, secondError).toBe(0);
    expect(ready.databasePath).toBe(resolve(database));
    expect(ready.pid).not.toBe(reopened.pid);
    expect(reopened.result).toMatchObject({ requestId: 'restart-request', responseId: 'restart-response', attemptId: ready.attemptId, identityId: ready.identityId, delivery: 'blocked-unresolved', newlyClaimed: false });
    expect(reopened.persistedIdentity).toEqual({ attempt_id: ready.attemptId, identity_id: ready.identityId, durable_ref: ready.durableRef });
    expect(reopened).toMatchObject({ callbackCount: 0, claimCount: 1, observationCount: 0 });
    const markers = readFileSync(marker, 'utf8').trim().split(/\r?\n/u).map(line => JSON.parse(line));
    expect(markers).toHaveLength(1); expect(markers[0]).toMatchObject({ pid: ready.pid, attemptId: ready.attemptId, identityId: ready.identityId, requestId: 'restart-request', responseId: 'restart-response' });
  }, 30_000);
});
