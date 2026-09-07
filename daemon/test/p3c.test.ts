import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger } from '../src/ledger.js';
import { envelopeHash, normalizeEnvelope, type Envelope } from '../src/envelope.js';
import { completeTaskCard, runEnforcedWorker, runWorkerLifecycle } from '../src/worker-enforcement.js';

const roots: string[] = [];
function temp(prefix: string) { mkdirSync(resolve('.test-state'), { recursive: true }); const value = mkdtempSync(resolve(`.test-state/${prefix}`)); roots.push(value); return value; }
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function setup() {
  const worktree = temp('p3c-work-');
  const envelope = normalizeEnvelope({ run_id: 'r3c', worktree_realpath: worktree, egress: [], expires_at: '2026-09-03T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['command'] } satisfies Envelope);
  const db = openLedger(), hash = envelopeHash(envelope), now = '2026-09-02T01:00:00.000Z';
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t3c', 'running', null, now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(hash, worktree, '[]', now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r3c', 't3c', hash, 0, now);
  return { db, envelope };
}

describe('Phase 3C AppContainer enforcement', () => {
  it('blocks a runtime-computed outside path in a non-Node worker', () => {
    const s = setup(), outside = temp('p3c-runtime-out-'), target = join(outside, 'runtime-escape.txt');
    const encoded = Buffer.from(target).toString('base64');
    const result = runEnforcedWorker(s.envelope, { executable: 'powershell.exe', args: ['-NoProfile', '-Command', `$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'));Set-Content -LiteralPath $p -Value escape`], cwd: s.envelope.worktree_realpath });
    expect(result.violation).toBe('filesystem'); expect(existsSync(target)).toBe(false); s.db.close();
  }, 30_000);

  it('blocks a non-Node worker from a real local socket when egress is empty', async () => {
    const server = createServer(socket => socket.end()); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address(); if (typeof address !== 'object' || !address) throw new Error('listener missing');
    const s = setup();
    const result = runEnforcedWorker(s.envelope, { executable: 'powershell.exe', args: ['-NoProfile', '-Command', `$c=[Net.Sockets.TcpClient]::new();$c.Connect('127.0.0.1',${address.port});$c.Close()`], cwd: s.envelope.worktree_realpath });
    server.close(); await once(server, 'close');
    expect(result.violation).toBe('network_gate'); expect(result.result?.status).not.toBe(0); s.db.close();
  });

  it('allows a non-Node worker to write inside and removes its ephemeral ACE', () => {
    const s = setup(), target = join(s.envelope.worktree_realpath, 'inside.txt');
    const result = runEnforcedWorker(s.envelope, { executable: 'powershell.exe', args: ['-NoProfile', '-Command', `Set-Content -LiteralPath '${target}' -Value ok`], cwd: s.envelope.worktree_realpath });
    expect(result.result?.status, JSON.stringify({ stdout: result.result?.stdout, stderr: result.result?.stderr, error: String(result.result?.error) })).toBe(0); expect(existsSync(target)).toBe(true);
    const acl = spawnSync('icacls.exe', [s.envelope.worktree_realpath], { encoding: 'utf8' }).stdout;
    expect(acl).not.toMatch(/S-1-15-2-\d+-\d+-\d+-\d+-\d+-\d+-\d+:/u); s.db.close();
  });
});

describe('Phase 3C production wiring', () => {
  it('records execution from the real worker lifecycle', () => {
    const s = setup();
    const result = runWorkerLifecycle(s.envelope, { executable: 'powershell.exe', args: ['-NoProfile', '-Command', 'exit 0'], cwd: s.envelope.worktree_realpath }, { db: s.db, execution: { run_id: 'r3c', thread_id: 'thread', item_id: null, approval_id: null, execution_id: 'actual-worker', execution_ordinal: 0 } });
    expect(result.result?.status).toBe(0);
    expect(s.db.prepare('SELECT execution_id FROM execution_event').get()).toEqual({ execution_id: 'actual-worker' }); s.db.close();
  });

  it('renders the ledger label through the completion-card path', () => {
    const s = setup();
    expect(completeTaskCard(s.db, 't3c')).toEqual({ completed: true, approvalLabel: '자동 승인 0건 · 거부 0건' });
    expect(s.db.prepare('SELECT state FROM task').get()).toEqual({ state: 'completed' }); s.db.close();
  });
});
