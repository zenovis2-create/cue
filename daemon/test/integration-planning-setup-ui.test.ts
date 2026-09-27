import { test, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createCueCore, initializeConfig } from '../../app/core.mjs';
import { registerIpcHandlers } from '../../app/ipc.mjs';
import { readLatestLocalHostSettings, LOCAL_GOAL_PLANNING_SETTINGS_ID, LOCAL_JSON_SETTINGS_ID } from '../src/selection/local-host-settings.js';

const limits = { maxInvocations: 2, timeoutMs: 60000, maxOutputBytes: 65536, maxOutputTokens: 2048 };

test('planning setup writes only dedicated disabled-by-default settings without preparing a run', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-planning-setup-')), worktree = join(root, 'work'); mkdirSync(worktree);
  const core = createCueCore(initializeConfig(join(root, 'data'), { worktreeRoot: worktree }), undefined,
    { orchestrationFactory: () => ({ available: false, reasons: ['offline'] }) });
  try {
    expect(core.localPlanningSetup()).toMatchObject({ templateId: 'goal-planning-v1', settingsId: 'goal-planning-default', configured: false, enabled: false, available: false });
    expect(core.configureLocalPlanning({ expectedRevision: null, enabled: true, limits })).toMatchObject({ configured: true, enabled: true, revision: 1, restartRequired: true, available: false });
    expect(readLatestLocalHostSettings(core.daemon.db, LOCAL_GOAL_PLANNING_SETTINGS_ID)?.settings).toMatchObject({ templateId: 'goal-planning-v1', enabled: true });
    expect(readLatestLocalHostSettings(core.daemon.db, LOCAL_JSON_SETTINGS_ID)).toBeNull();
    expect(core.daemon.db.prepare('SELECT count(*) n FROM task').get()).toEqual({ n: 0 });
    expect(() => core.configureLocalPlanning({ expectedRevision: null, enabled: true, limits })).toThrow();
  } finally { await core.close(); rmSync(root, { recursive: true, force: true }); }
});

test('planning setup IPC enforces exact bounded commands and trusted sender', () => {
  const handlers = new Map<string, Function>(), sender = {};
  const core = { localPlanningSetup: vi.fn(() => ({ revision: null })), configureLocalPlanning: vi.fn(() => ({ revision: 1 })) };
  const ipc = registerIpcHandlers({ handle: (key, handler) => handlers.set(key, handler) }, core as never,
    { isTrustedSender: event => event === sender });
  expect(() => handlers.get('cue:local-planning-setup')!({}, { operation: 'read' })).toThrow('sender denied');
  expect(ipc.invoke('cue:local-planning-setup', { operation: 'read' })).toEqual({ revision: null });
  expect(ipc.invoke('cue:local-planning-setup', { operation: 'configure', expectedRevision: null, enabled: true, limits })).toEqual({ revision: 1 });
  expect(core.configureLocalPlanning).toHaveBeenCalledWith({ expectedRevision: null, enabled: true, limits });
  for (const input of [{ operation: 'read', extra: true }, { operation: 'configure', expectedRevision: null, enabled: true, limits: { ...limits, timeoutMs: 1 } },
    { operation: 'configure', expectedRevision: null, enabled: true, limits, endpoint: 'https://other.example' }])
    expect(() => ipc.invoke('cue:local-planning-setup', input)).toThrow('input denied');
});

test('planning settings form reads and saves separately from JSON settings', async () => {
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  const reply = { templateId: 'goal-planning-v1', settingsId: 'goal-planning-default', revision: null, configured: false,
    enabled: false, limits: null, restartRequired: false, available: false, modelId: 'qwen38-27b-unc', endpoint: 'http://127.0.0.1:8085/v1' };
  const localPlanningSetup = vi.fn(async (input: any) => input.operation === 'read' ? reply : { ...reply, revision: 1, configured: true, enabled: input.enabled, limits: input.limits, restartRequired: true });
  Object.assign(dom.window, { cue: { localPlanningSetup } });
  dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
  try {
    await vi.waitFor(() => expect(localPlanningSetup).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(dom.window.document.querySelector('#local-planning-status')!.textContent).toContain('미등록'));
    expect(dom.window.document.querySelector('#local-planning-setup')!.hasAttribute('hidden')).toBe(false);
    dom.window.document.querySelector<HTMLInputElement>('#local-planning-enabled')!.checked = true;
    dom.window.document.querySelector<HTMLFormElement>('#local-planning-setup-form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(localPlanningSetup).toHaveBeenCalledTimes(2));
    expect(localPlanningSetup.mock.calls[1][0]).toEqual({ operation: 'configure', expectedRevision: null, enabled: true, limits });
    await vi.waitFor(() => expect(dom.window.document.querySelector('#local-planning-status')!.textContent).toContain('재시작'));
  } finally { dom.window.close(); }
});
