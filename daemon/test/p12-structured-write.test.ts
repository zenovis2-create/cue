import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCueWorkspaceCall } from '../src/host-codex-controller.js';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope } from '../src/envelope.js';
import { launchAppContainerWorker } from '../src/worker-enforcement.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-p12-write-text-'));
  roots.push(root);
  const db = openLedger();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-write', 'running', null, now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-write', root, '[]', now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-write', 'task-write', 'envelope-write', 1, now);
  const envelope = normalizeEnvelope({
    run_id: 'run-write',
    allowed_actions: ['command', 'file_change'],
    worktree_realpath: root,
    egress: [],
    expires_at: '2099-01-01T00:00:00Z',
    autonomy_level: 'bounded',
  });
  return { root, db, envelope };
}

describe('P12 structured exact-text worker operation', () => {
  it('writes literal UTF-8 bytes without shell-quoting changes inside AppContainer', async () => {
    const { root, db, envelope } = fixture();
    try {
      const content = 'alpha-from-cue\n따옴표 " 그대로';
      const command = parseCueWorkspaceCall({
        namespace: null,
        tool: 'cue_workspace',
        arguments: { operation: 'write_text', path: 'nested/alpha-live.txt', content },
      }, root);
      const worker = launchAppContainerWorker(db, envelope, {
        cwd: root,
        task_id: 'task-write',
        run_id: 'run-write',
      }, command);
      const result = await worker.completion;

      expect(result.exitCode).toBe(0);
      expect(result.violation).toBeUndefined();
      expect(readFileSync(join(root, 'nested', 'alpha-live.txt'))).toEqual(Buffer.from(content, 'utf8'));
    } finally {
      db.close();
    }
  }, 30_000);

  it('rejects text that cannot round-trip as exact UTF-8 bytes', () => {
    expect(() => parseCueWorkspaceCall({
      namespace: null,
      tool: 'cue_workspace',
      arguments: { operation: 'write_text', path: 'invalid.txt', content: '\ud800' },
    }, 'C:/approved')).toThrow('write_text content must contain valid Unicode scalar values');
  });

  it('rejects paths that cannot round-trip as exact UTF-8 bytes', () => {
    expect(() => parseCueWorkspaceCall({
      namespace: null,
      tool: 'cue_workspace',
      arguments: { operation: 'write_text', path: 'bad-\ud800.txt', content: 'safe' },
    }, 'C:/approved')).toThrow('write_text path must contain valid Unicode scalar values');
  });

  it('rejects a structured write whose encoded Windows command line exceeds the safe budget', () => {
    const longRelativePath = `${Array.from({ length: 300 }, () => '界界界界界界界界界界').join('/')}.txt`;
    expect(() => parseCueWorkspaceCall({
      namespace: null,
      tool: 'cue_workspace',
      arguments: { operation: 'write_text', path: longRelativePath, content: 'x'.repeat(16_384) },
    }, 'C:/approved')).toThrow('write_text request exceeds the safe Windows command-line budget');
  });

  it('rejects traversal before any worker can launch', () => {
    expect(() => parseCueWorkspaceCall({
      namespace: null,
      tool: 'cue_workspace',
      arguments: { operation: 'write_text', path: '../outside.txt', content: 'denied' },
    }, 'C:/approved')).toThrow('write_text path escapes the approved worktree');
  });
});
