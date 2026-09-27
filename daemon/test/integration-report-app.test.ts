import { afterEach, expect, test, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { createCueCore, initializeConfig } from '../../app/core.mjs';
import { registerIpcHandlers, IPC_CHANNELS } from '../../app/ipc.mjs';
import { openReportWindow } from '../../app/report-window.mjs';
const dispose: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of dispose.splice(0)) await fn(); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-report-app-')), workspace = join(root, 'workspace'); mkdirSync(workspace);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: workspace });
  const core = createCueCore(config); dispose.push(async () => { await core.close(); rmSync(root, { recursive: true, force: true }); });
  const prepared = core.prepareGoal('report fixture'); const db = core.daemon.db;
  const envelope = db.prepare('SELECT envelope_hash FROM run WHERE id=?').get(prepared.runId) as { envelope_hash: string };
  db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run(prepared.runId, envelope.envelope_hash, 'a'.repeat(64), JSON.stringify({ revision: 'v1', tasks: [{ id: 'maker', role: 'model-producer', dependencyIds: [] }] }));
  db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run(prepared.runId, 'maker', 'pending');
  return { root, core, prepared };
}
test('same core ledger exports known orchestration only into host state reports directory', () => {
  const { core, root, prepared } = fixture(); const artifact = core.exportRunReport(prepared.runId);
  expect(artifact.path.startsWith(join(root, 'data', 'reports'))).toBe(true);
  expect(readFileSync(artifact.path, 'utf8')).toContain('pending');
  const html = readFileSync(artifact.path, 'utf8');
  expect(html).toContain('separate-read-transaction'); expect(html).toContain('baseReportDigest');
  expect(html).toContain('stored-evidence-unavailable'); // Deliberately incomplete strict outcome fixture.
  expect(() => core.exportRunReport('../escape')).toThrow(); expect(() => core.exportRunReport('unknown')).toThrow();
  const legacy = core.prepareGoal('legacy'); expect(() => core.exportRunReport(legacy.runId)).toThrow('unavailable');
});

test('outer transaction export is rejected before creating any report output', () => {
  const { core, root, prepared } = fixture(); const db = core.daemon.db;
  db.exec('BEGIN');
  try { expect(() => core.exportRunReport(prepared.runId)).toThrow('outcome_report_boundary'); }
  finally { db.exec('ROLLBACK'); }
  expect(existsSync(join(root, 'data', 'reports'))).toBe(false);
});
test('preexisting reports junction cannot redirect output into worktree', () => {
  const { core, root, prepared } = fixture(); symlinkSync(join(root, 'workspace'), join(root, 'data', 'reports'), 'junction');
  expect(() => core.exportRunReport(prepared.runId)).toThrow();
});
test('all actual IPC handlers require main window and main frame; reports expose no path', async () => {
  const { core, prepared } = fixture(); const main = {}, frame = {}, captured = new Map<string, Function>(); const open = vi.fn();
  registerIpcHandlers({ handle: (name, fn) => { captured.set(name, fn); } }, core, {
    isTrustedSender: event => event.sender === main && event.senderFrame === frame, openReport: open });
  for (const channel of IPC_CHANNELS) for (const event of [null, { sender: {}, senderFrame: frame }, { sender: main, senderFrame: {} }])
    expect(() => captured.get(channel)!(event, {})).toThrow('sender denied');
  const response = await captured.get('cue:report')!({ sender: main, senderFrame: frame }, { runId: prepared.runId });
  expect(response.status).toBe('opened'); expect(response.path).toBeUndefined(); expect(open).toHaveBeenCalledTimes(1);
  await expect(captured.get('cue:report')!({ sender: main, senderFrame: frame }, { runId: prepared.runId, path: 'evil' })).rejects.toThrow();
  const closed = registerIpcHandlers({ handle: vi.fn() }, core);
  await expect(closed.invoke('cue:report', { runId: prepared.runId })).rejects.toThrow();
  expect(captured.get('cue:selection-preferences')!({ sender: main, senderFrame: frame }, { operation: 'read' }).mode).toBe('efficiency');
});
test('report window is a separate script-free no-preload session with navigation/network/permission denial', async () => {
  const { core, prepared } = fixture(); const artifact = core.exportRunReport(prepared.runId);
  const verifiedBytes = readFileSync(artifact.path);
  let settings: any, network: any, permission: any, popup: any; const events = new Map();
  const isolated = { setPermissionRequestHandler: (fn: any) => { permission = fn; }, setPermissionCheckHandler: vi.fn(), on: vi.fn(), webRequest: { onBeforeRequest: (fn: any) => { network = fn; } } };
  class Window { constructor(options: any) { settings = options; } webContents = { on: (name: string, fn: any) => events.set(name, fn), setWindowOpenHandler: (fn: any) => { popup = fn; } }; loadURL = vi.fn(async (_url: string) => { writeFileSync(artifact.path, 'replaced after verification'); }); show = vi.fn(); destroy = vi.fn(); }
  const session = { fromPartition: vi.fn((_partition: string, _options: unknown) => isolated) };
  const win = await openReportWindow({ BrowserWindow: Window, session }, artifact);
  const loadedUrl = win.loadURL.mock.calls[0][0] as string;
  expect(loadedUrl.startsWith('data:text/html;base64,')).toBe(true);
  expect(Buffer.from(loadedUrl.split(',')[1], 'base64')).toEqual(verifiedBytes);
  expect(readFileSync(artifact.path, 'utf8')).toBe('replaced after verification');
  expect(settings.webPreferences).toMatchObject({ session: isolated, javascript: false, nodeIntegration: false, contextIsolation: true, sandbox: true });
  expect(settings.webPreferences.preload).toBeUndefined(); expect(session.fromPartition.mock.calls[0][0]).not.toContain('persist:');
  const callback = vi.fn(); network({ url: 'https://evil', resourceType: 'mainFrame' }, callback); expect(callback).toHaveBeenLastCalledWith({ cancel: true });
  network({ url: win.loadURL.mock.calls[0][0], resourceType: 'mainFrame' }, callback); expect(callback).toHaveBeenLastCalledWith({ cancel: false });
  permission(null, 'camera', callback); expect(callback).toHaveBeenLastCalledWith(false);
  expect(popup()).toEqual({ action: 'deny' }); for (const fn of events.values()) { const event = { preventDefault: vi.fn() }; fn(event); expect(event.preventDefault).toHaveBeenCalled(); }
});
test('report button captures observed run ID and hides for legacy cards', async () => {
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  try {
    const report = vi.fn(async () => ({ status: 'opened' })); (dom.window as any).cue = { report };
    dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
    dom.window.eval(`renderCard({state:'running',status:'running',stage:'x',orchestration:{runId:'actual-run',stages:[],budget:{},activity:[]}})`);
    const button = dom.window.document.querySelector<HTMLButtonElement>('#report')!;
    expect(button.hidden).toBe(false); button.click(); await Promise.resolve();
    expect(report).toHaveBeenCalledWith({ runId: 'actual-run' });
    dom.window.eval(`renderCard({state:'completed',status:'completed',stage:'x',orchestration:null})`);
    expect(button.hidden).toBe(true); expect(button.dataset.runId).toBe('');
  } finally { dom.window.close(); }
});
