import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCueCore, initializeConfig, AppDaemon } from '../../app/core.mjs';
import { assertAllowedChannel, IPC_CHANNELS, registerIpcHandlers } from '../../app/ipc.mjs';

const roots: string[] = [];
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const repoFile = (...parts: string[]) => join(repoRoot, ...parts);
const temp = () => { const value = mkdtempSync(join(tmpdir(), 'cue-p9-')); roots.push(value); return value; };
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

describe('Phase 9 Electron shell', () => {
  it('P9-1 has npm start and a main entrypoint', () => {
    const pkg = JSON.parse(readFileSync(repoFile('package.json'), 'utf8'));
    expect(pkg.scripts.start).toBe('electron .');
    expect(readFileSync(repoFile(pkg.main), 'utf8')).toContain('BrowserWindow');
  });

  it('P9-2 seals BrowserWindow and exposes an explicit preload API only', () => {
    const main = readFileSync(repoFile('app', 'main.mjs'), 'utf8');
    expect(main).toMatch(/contextIsolation:\s*true/u);
    expect(main).toMatch(/nodeIntegration:\s*false/u);
    expect(main).toMatch(/sandbox:\s*true/u);
    const renderer = ['index.html', 'renderer.js', 'styles.css'].map(name => readFileSync(repoFile('app', 'renderer', name), 'utf8')).join('\n');
    expect(renderer).not.toMatch(/require\s*\(|child_process|better-sqlite3|\bfs\b/u);
    const preload = readFileSync(repoFile('app', 'preload.cjs'), 'utf8');
    expect(preload).toContain("exposeInMainWorld('cue', allowedApi)");
    expect(preload).not.toMatch(/exposeInMainWorld\([^,]+,\s*ipcRenderer/u);
  });

  it('P9-3 freezes channels, rejects unknown channels, and cannot execute before approval', () => {
    expect(Object.isFrozen(IPC_CHANNELS)).toBe(true);
    expect(() => assertAllowedChannel('cue:shell')).toThrow('IPC channel denied');
    const root = temp(); const config = initializeConfig(join(root, 'data'), { worktreeRoot: root }); const core = createCueCore(config);
    const prepared = core.prepareGoal('one file');
    expect(() => core.execute(prepared.runId)).toThrow('approval required');
    core.close();
  });

  it('P9-4 creates first-run config once, reuses it, and stores no credentials', () => {
    const root = temp(); const data = join(root, 'data');
    const first = initializeConfig(data, { worktreeRoot: root });
    const second = initializeConfig(data, { worktreeRoot: temp() });
    expect(second).toEqual(first);
    const source = readFileSync(join(data, 'cue-config.json'), 'utf8');
    expect(source).not.toMatch(/credential|password|secret|token|api[_-]?key/iu);
  });

  it('P9-5 closes the owned daemon and never restarts after crash', () => {
    const root = temp(); const config = initializeConfig(join(root, 'data'), { worktreeRoot: root });
    const daemon = new AppDaemon(config); const core = createCueCore(config, daemon); const prepared = core.prepareGoal('one file'); core.approve(prepared.runId);
    daemon.crash(); expect(daemon.status).toBe('blocked/crash'); expect(() => core.execute(prepared.runId)).toThrow('daemon blocked/crash');
    expect(daemon.status).toBe('blocked/crash'); core.close(); expect(daemon.status).toBe('closed');
  });

  it('P9-6/P9-7 records approval and default autonomy without widening the envelope', () => {
    const root = temp(); const config = initializeConfig(join(root, 'data'), { worktreeRoot: root }); const core = createCueCore(config);
    const prepared = core.prepareGoal('one file'); expect(prepared.autonomy).toBe(3); const before = JSON.stringify(prepared.envelope);
    core.approve(prepared.runId);
    expect(core.daemon.db.prepare('SELECT decision FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({ decision: 'accept' });
    expect(core.daemon.db.prepare('SELECT level FROM run_autonomy WHERE run_id=?').get(prepared.runId)).toEqual({ level: 3 });
    expect(JSON.stringify(prepared.envelope)).toBe(before); core.close();
  });

  it('P9-8 emits no notification during normal progress', () => {
    const root = temp(); const config = initializeConfig(join(root, 'data'), { worktreeRoot: root }); const core = createCueCore(config);
    const ipcMain = { handle: vi.fn() }; registerIpcHandlers(ipcMain, core);
    const sources = ['main.mjs', 'ipc.mjs', 'core.mjs'].map(name => readFileSync(repoFile('app', name), 'utf8')).join('\n');
    expect(sources).not.toMatch(/new Notification|\.showNotification|webContents\.send/iu); core.close();
  });

  it('P9-10 builds completion totals only from ledger rows', () => {
    const root = temp(); const config = initializeConfig(join(root, 'data'), { worktreeRoot: root }); const core = createCueCore(config);
    const prepared = core.prepareGoal('one file', 2); core.approve(prepared.runId); const card = core.execute(prepared.runId);
    expect(card.approvalSummary).toBe('자동 승인 1건 · 거부 0건');
    expect(card.autonomySummary).toBe('자율성: ② · 자동 복구 0회'); core.close();
  });

  it('P9-11 app core has no static Buzz dependency', () => {
    const sources = ['main.mjs', 'ipc.mjs', 'core.mjs'].map(name => readFileSync(repoFile('app', name), 'utf8')).join('\n');
    expect(sources).not.toMatch(/buzz-adapter|CueBuzz|BuzzMessage/u);
  });
});
