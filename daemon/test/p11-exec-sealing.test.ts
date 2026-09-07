import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope } from '../src/envelope.js';
import { launchAppContainerWorker } from '../src/worker-enforcement.js';
import { spawnOwned, resolveSealedExecutable } from '../src/process-launch.js';

const roots: string[] = [];
const ledgers: ReturnType<typeof openLedger>[] = [];
function temp() { const root = mkdtempSync(join(tmpdir(), 'cue-p11-exec-')); roots.push(root); return root; }
afterEach(() => { for (const db of ledgers.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
function setup() {
  const worktree = temp(), db = openLedger(), now = new Date().toISOString(); ledgers.push(db);
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t', 'running', null, now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('e', worktree, '[]', now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r', 't', 'e', 1, now);
  const envelope = normalizeEnvelope({ run_id: 'r', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'] });
  return { db, worktree, envelope, owner: { cwd: worktree, task_id: 't', run_id: 'r' } };
}
describe.skipIf(process.platform !== 'win32')('P11 executable sealing', () => {
  it('rejects PATH and junction aliases into a writable worktree and verifies existence', () => {
    const root = temp(), aliases = temp(), planted = join(root, 'planted.exe'); copyFileSync(process.execPath, planted);
    const alias = join(aliases, 'alias'); symlinkSync(root, alias, 'junction');
    expect(() => resolveSealedExecutable('planted.exe', [root], { PATH: root })).toThrow('writable worktree');
    expect(() => resolveSealedExecutable(join(alias, 'planted.exe'), [root])).toThrow('writable worktree');
    expect(() => resolveSealedExecutable(join(root, 'absent.exe'))).toThrow('not found');
    expect(isAbsolute(resolveSealedExecutable('powershell.exe', [root], { PATH: root }))).toBe(true);
    expect(dirname(resolveSealedExecutable('powershell.exe', [root], { PATH: root })).toLowerCase()).toContain('windows');
  });
  it('refuses a planted absolute worker binary and records a violation before launch', async () => {
    const s = setup(), planted = join(s.worktree, 'planted.exe'); copyFileSync(process.execPath, planted);
    let error: unknown; let launched: ReturnType<typeof launchAppContainerWorker> | undefined;
    try { launched = launchAppContainerWorker(s.db, s.envelope, s.owner, { executable: planted, args: ['-e', 'process.exit(0)'], cwd: s.worktree }); } catch (caught) { error = caught; }
    if (launched) await launched.completion;
    expect(String(error)).toMatch(/executable.*writable worktree/i);
    expect(s.db.prepare("SELECT content FROM artifact WHERE kind='enforcement_violation'").all()).toEqual([{ content: 'executable_sealing' }]);
    expect(s.db.prepare('SELECT count(*) n FROM session_handle').get()).toEqual({ n: 0 });
  }, 30_000);
  it('refuses an owned launch from another writable worktree in the ledger', async () => {
    const s = setup(), other = temp(), planted = join(other, 'planted.exe'); copyFileSync(process.execPath, planted);
    s.db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('other', other, '[]', new Date().toISOString());
    let error: unknown; let launched: ReturnType<typeof spawnOwned> | undefined;
    try { launched = spawnOwned(s.db, s.owner, planted, ['-e', 'process.exit(0)']); } catch (caught) { error = caught; }
    if (launched) await new Promise(resolve => launched!.child.once('close', resolve));
    expect(String(error)).toMatch(/executable.*writable worktree/i);
    expect(s.db.prepare("SELECT content FROM artifact WHERE kind='enforcement_violation'").all()).toEqual([{ content: 'executable_sealing' }]);
  });
  it('denies a planted executable launched as a shell descendant', async () => {
    const s = setup(), planted = join(s.worktree, 'planted.exe'); copyFileSync(process.execPath, planted);
    const launched = launchAppContainerWorker(s.db, s.envelope, s.owner, { executable: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; $p=[Diagnostics.Process]::Start('${planted.replace(/'/gu, "''")}', '-e process.exit(0)'); $p.WaitForExit(); exit $p.ExitCode`], cwd: s.worktree, timeoutMs: 20_000 });
    const result = await launched.completion;
    expect(result.exitCode).not.toBe(0);
    expect(result.violation, JSON.stringify(result)).toBe('executable_sealing');
    expect(result.stderr).toMatch(/not enough quota/iu);
  }, 30_000);
});
