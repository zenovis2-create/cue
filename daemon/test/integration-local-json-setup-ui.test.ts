import { test, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerIpcHandlers } from '../../app/ipc.mjs';

const limits = { maxInvocations: 2, timeoutMs: 60000, maxOutputBytes: 65536, maxOutputTokens: 2048 };
const configure = { operation: 'configure', expectedRevision: null, enabled: true, limits };
const metadata = { revision: null as number | null, configured: false, enabled: false, limits, available: false,
  restartRequired: false, modelId: 'fixed-qwen', endpoint: 'http://localhost:1234/v1', ranking: 'not-performed' };
test('setup IPC exact DTO and trusted frame; limits cannot grant paths, models or authority', () => {
  const handlers = new Map<string, (...args: any[]) => any>();
  const localJsonSetup = vi.fn(() => metadata), configureLocalJson = vi.fn(input => input);
  const sender = {}, frame = {};
  const api = registerIpcHandlers({ handle: (key, fn) => { handlers.set(key, fn); } }, { localJsonSetup, configureLocalJson } as never,
    { isTrustedSender: event => event.sender === sender && event.senderFrame === frame });
  const handle = handlers.get('cue:local-json-setup')!;
  for (const event of [null, { sender: {}, senderFrame: frame }, { sender, senderFrame: {} }]) expect(() => handle(event, configure)).toThrow('sender denied');
  expect(handle({ sender, senderFrame: frame }, { operation: 'read' })).toEqual(metadata);
  expect(api.invoke('cue:local-json-setup', configure)).toEqual({ expectedRevision: null, enabled: true, limits });
  const getter = vi.fn(); const accessor = { ...configure }; Object.defineProperty(accessor, 'enabled', { get: getter, enumerable: true });
  const invalid = [null, accessor, new Proxy(configure, {}), { operation: 'read', path: 'secret' }, { ...configure, modelId: 'other' },
    { ...configure, evidence: 'qualified' }, { ...configure, enabled: 1 }, { ...configure, expectedRevision: 0 },
    { ...configure, limits: { ...limits, maxInvocations: 1 } }, { ...configure, limits: { ...limits, timeoutMs: 120001 } },
    { ...configure, limits: { ...limits, maxOutputBytes: 1048577 } }, { ...configure, limits: { ...limits, maxOutputTokens: 32769 } }];
  for (const input of invalid) expect(() => api.invoke('cue:local-json-setup', input)).toThrow('input denied');
  expect(() => api.invoke('cue:local-json-setup', configure, {})).toThrow('input denied');
  expect(getter).not.toHaveBeenCalled(); expect(configureLocalJson).toHaveBeenCalledOnce();
});

function fixture() {
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  const api = { localJsonSetup: vi.fn(async (_input: any) => metadata),
    approve: vi.fn(async () => ({ approved: true })), stop: vi.fn(async () => ({ ok: true })),
    execute: vi.fn(async (_input: any): Promise<any> => ({ state: 'completed', taskId: 'task', runId: 'run', executionOwnership: { status: 'released' } })),
    selectionPreferences: vi.fn(async () => ({ available: true, mode: 'value', revision: 1 })),
    prepare: vi.fn(async () => ({ runId: 'run', taskId: 'task', threeLines: ['무엇을: 작업', '어디까지: 범위', '안 건드릴 것: 외부'],
      envelope: { expires_at: '2026-09-11', worktree_realpath: 'fixture', allowed_actions: [] }, orchestration: null })) };
  Object.assign(dom.window, { cue: api }); dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
  const doc = dom.window.document;
  const submit = (id: string) => doc.querySelector(id)!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  return { dom, api, doc, submit };
}
test('setup reads only; explicit form saves limits then restart blocks new preparation and clears approval', async () => {
  const f = fixture();
  try {
    await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#local-json-save')!.disabled).toBe(false));
    expect(f.api.localJsonSetup.mock.calls).toEqual([[{ operation: 'read' }]]);
    f.submit('#goal-form'); await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(false));
    f.doc.querySelector<HTMLInputElement>('#local-json-enabled')!.checked = true;
    f.api.localJsonSetup.mockResolvedValueOnce({ ...metadata, revision: 1, enabled: true, configured: true, restartRequired: true });
    f.submit('#local-json-setup-form');
    await vi.waitFor(() => expect(f.doc.querySelector('#local-json-status')!.textContent).toContain('재시작'));
    expect(f.api.localJsonSetup).toHaveBeenLastCalledWith(configure);
    expect(f.doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(true);
    expect(f.doc.querySelector('#what')!.textContent).toBe('');
    expect(f.doc.querySelector('#resource-pin')!.textContent).toContain('먼저');
    expect(f.doc.querySelector<HTMLSelectElement>('#selection-mode')!.disabled).toBe(true);
    f.submit('#goal-form'); expect(f.api.prepare).toHaveBeenCalledOnce();
    expect(f.doc.querySelector('#local-json-setup')!.textContent).toContain('설정 저장은 실행 자격 검증이 아닙니다');
  } finally { f.dom.window.close(); }
});

test.each(['resolve', 'reject'])('launch %s preserves identity against setup/template reset until terminal ledger', async outcome => {
  const f = fixture();
  try {
    await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#local-json-save')!.disabled).toBe(false));
    f.submit('#goal-form'); await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(false));
    let resolveLaunch!: (value: any) => void, rejectLaunch!: (error: Error) => void;
    let resolveStatus!: (value: any) => void;
    f.api.execute.mockImplementationOnce(() => new Promise((resolve, reject) => { resolveLaunch = resolve; rejectLaunch = reject; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveStatus = resolve; }));
    f.doc.querySelector<HTMLButtonElement>('#approve')!.click();
    await vi.waitFor(() => expect(f.api.execute).toHaveBeenCalledWith({ runId: 'run' }));
    f.submit('#local-json-setup-form'); f.submit('#goal-form');
    f.doc.querySelector('#task-template')!.dispatchEvent(new f.dom.window.Event('change'));
    expect(f.doc.querySelector<HTMLButtonElement>('#local-json-save')!.disabled).toBe(true);
    expect(f.api.localJsonSetup).toHaveBeenCalledOnce(); expect(f.api.prepare).toHaveBeenCalledOnce();
    if (outcome === 'resolve') resolveLaunch({ state: 'running' }); else rejectLaunch(Error('launch response lost'));
    await vi.waitFor(() => expect(f.api.execute).toHaveBeenCalledWith({ operation: 'status', taskId: 'task' }));
    expect(f.doc.querySelector<HTMLButtonElement>('#stop')!.disabled).toBe(false);
    expect(f.doc.querySelector('#stop')!.closest('[hidden]')).toBeNull();
    if (outcome === 'reject') expect(f.doc.querySelector('#state-title')!.textContent).toBe('실행 상태 미확인');
    f.submit('#local-json-setup-form'); expect(f.api.localJsonSetup).toHaveBeenCalledOnce();
    f.doc.querySelector<HTMLButtonElement>('#stop')!.click();
    await vi.waitFor(() => expect(f.api.stop).toHaveBeenCalledWith({ runId: 'run' }));
    await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#local-json-save')!.disabled).toBe(false));
    resolveStatus({ state: 'completed', taskId: 'task', runId: 'run', executionOwnership: { status: 'released' } }); await Promise.resolve(); await Promise.resolve();
  } finally { f.dom.window.close(); }
});
test('blocked with missing, unknown or unresolved ownership retains Stop until matching released ledger', async () => {
  const f = fixture();
  try {
    await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#local-json-save')!.disabled).toBe(false));
    f.submit('#goal-form'); await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(false));
    const blocked = { state: 'blocked', runId: 'run', taskId: 'task' };
    const statuses = [undefined, { status: 'unknown' }, { status: 'unresolved' }, { status: 'released' }];
    let settle!: (value: any) => void;
    f.api.execute.mockImplementation(async input => input.operation === 'status' ? new Promise(resolve => { settle = resolve; }) : blocked);
    f.doc.querySelector<HTMLButtonElement>('#approve')!.click();
    await vi.waitFor(() => expect(f.api.execute).toHaveBeenCalledTimes(2));
    for (let index = 0; index < statuses.length; index++) {
      // A released receipt belonging to a different run cannot unlock this run.
      settle({ ...blocked, runId: index === 3 ? 'other-run' : 'run', executionOwnership: statuses[index] });
      await vi.waitFor(() => expect(f.api.execute).toHaveBeenCalledTimes(index + 3));
      expect(f.doc.querySelector<HTMLButtonElement>('#local-json-save')!.disabled).toBe(true);
      expect(f.doc.querySelector('#stop')!.closest('[hidden]')).toBeNull();
      f.submit('#local-json-setup-form'); expect(f.api.localJsonSetup).toHaveBeenCalledOnce();
    }
    settle({ ...blocked, executionOwnership: { status: 'released' } });
    await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#local-json-save')!.disabled).toBe(false));
  } finally { f.dom.window.close(); }
});

test('CAS conflict refreshes revision; malicious host metadata stays text and late preparation cannot revive approval', async () => {
  const f = fixture();
  try {
    await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#local-json-save')!.disabled).toBe(false));
    let settle!: (value: any) => void;
    f.api.prepare.mockImplementationOnce(() => new Promise(resolve => { settle = resolve; }));
    f.submit('#goal-form');
    f.api.localJsonSetup.mockRejectedValueOnce(Error('conflict')).mockResolvedValueOnce({ ...metadata, revision: 2, modelId: '<img src=x>' });
    f.submit('#local-json-setup-form');
    await vi.waitFor(() => expect(f.doc.querySelector('#local-json-status')!.textContent).toContain('저장하지 못했습니다'));
    settle({}); await Promise.resolve(); await Promise.resolve();
    expect(f.doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(true);
    expect(f.doc.querySelector('img')).toBeNull(); expect(f.doc.querySelector('#local-json-identity')!.textContent).toContain('<img src=x>');
    f.api.localJsonSetup.mockResolvedValueOnce({ ...metadata, revision: 3, restartRequired: true });
    f.submit('#local-json-setup-form');
    await vi.waitFor(() => expect(f.api.localJsonSetup).toHaveBeenLastCalledWith({ ...configure, enabled: false, expectedRevision: 2 }));
    await vi.waitFor(() => expect(f.doc.querySelector('#local-json-status')!.textContent).toContain('재시작'));
  } finally { f.dom.window.close(); }
});
