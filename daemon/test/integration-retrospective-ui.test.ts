import { test, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerIpcHandlers } from '../../app/ipc.mjs';

test('retrospective IPC exact data and trusted sender only; no executable fields', () => {
  const handlers = new Map<string, Function>();
  const core = { createRetrospective: vi.fn(x => x), readRetrospective: vi.fn(() => null) };
  const sender = {};
  const api = registerIpcHandlers({ handle: (key, fn) => { handlers.set(key, fn); } }, core as never, { isTrustedSender: event => event === sender });
  const command = { operation: 'create', draftId: 'draft', runId: 'run' };
  expect(() => handlers.get('cue:retrospective')!({}, command)).toThrow('sender denied');
  expect(handlers.get('cue:retrospective')!(sender, command)).toEqual({ draftId: 'draft', runId: 'run' });
  expect(api.invoke('cue:retrospective', { operation: 'read', draftId: 'draft' })).toBeNull();
  const getter = vi.fn(); const accessor = { ...command }; Object.defineProperty(accessor, 'runId', { get: getter, enumerable: true });
  for (const input of [null, accessor, new Proxy(command, {}), Object.create(command), { ...command, path: 'secret' }, { ...command, draftId: '' }, { ...command, runId: 'x'.repeat(129) }, { operation: 'read', draftId: 'draft', runId: 'run' }, { ...command, [Symbol()]: true }])
    expect(() => api.invoke('cue:retrospective', input)).toThrow('input denied');
  expect(() => api.invoke('cue:retrospective', command, {})).toThrow('input denied');
  expect(getter).not.toHaveBeenCalled(); expect(core.createRetrospective).toHaveBeenCalledOnce();
});
function fixture() {
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  const api = { retrospective: vi.fn(async (input: any): Promise<any> => draft(input.draftId, input.runId ?? 'old-run')),
    prepare: vi.fn(async () => ({ taskId: 'task', runId: 'run', threeLines: ['what', 'extent', 'excluded'], envelope: { expires_at: 'today', worktree_realpath: 'fixture', allowed_actions: [] } })),
 };
  Object.assign(dom.window, { cue: api }); dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
  const doc = dom.window.document;
  const button = (id: string) => doc.querySelector<HTMLButtonElement>(`#${id}`)!;
  const submit = (id: string) => doc.querySelector(`#${id}`)!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  return { dom, doc, api, button, submit };
}
function draft(draftId: string, runId: string) {
  return { version: 'cue-retrospective-v1', draftId, runId, scope: 'local-only', authority: 'reference-only', digest: 'a'.repeat(64), sourcesDigest: 'b'.repeat(64), sourceHashScope: 'safe-column-projection', sources: [{ projection: '<img src=x onerror=alert(1)>' }], summary: { observedTaskState: 'queued', totalAttempts: 0, unresolvedAttempts: 0, acceptance: 'not-assessed' } };
}
test('explicit create retries retain ID; new snapshot rotates once; text content is inert', async () => {
  const f = fixture();
  try {
    expect(f.api.retrospective).not.toHaveBeenCalled();
    await Promise.resolve(); f.submit('goal-form'); await vi.waitFor(() => expect(f.button('retrospective-create').disabled).toBe(false));
    const id = f.doc.querySelector<HTMLInputElement>('#retrospective-draft-id')!.value;
    f.api.retrospective.mockRejectedValueOnce(Error('lost response'));
    f.button('retrospective-create').click(); await vi.waitFor(() => expect(f.doc.querySelector('#retrospective-status')!.textContent).toContain('다시 시도'));
    f.button('retrospective-create').click(); await vi.waitFor(() => expect(f.doc.querySelector<HTMLElement>('#retrospective-output')!.hidden).toBe(false));
    expect(f.api.retrospective.mock.calls.map(x => x[0])).toEqual(Array(2).fill({ operation: 'create', draftId: id, runId: 'run' }));
    expect(f.doc.querySelector('#retrospective-provenance')!.textContent).toContain('<img'); expect(f.doc.querySelector('#retrospective-output img')).toBeNull();
    f.button('retrospective-new').click(); expect(f.doc.querySelector<HTMLInputElement>('#retrospective-draft-id')!.value).not.toBe(id);
    expect(f.api.retrospective).toHaveBeenCalledTimes(2);
  } finally { f.dom.window.close(); }
});
test('restart ID lookup works without current run; old responses and mismatched identity are discarded', async () => {
  const f = fixture();
  try {
    const input = f.doc.querySelector<HTMLInputElement>('#retrospective-lookup')!;
    let finish!: (value: any) => void;
    f.api.retrospective.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    input.value = 'first'; f.submit('retrospective-read-form');
    input.value = 'second'; input.dispatchEvent(new f.dom.window.Event('input'));
    f.submit('retrospective-read-form'); await vi.waitFor(() => expect(f.doc.querySelector('#retrospective-summary')!.textContent).toContain('second'));
    finish(draft('first', 'old-run')); await Promise.resolve();
    expect(f.doc.querySelector('#retrospective-summary')!.textContent).toContain('second');
    f.api.retrospective.mockResolvedValueOnce(draft('wrong', 'old-run')); f.submit('retrospective-read-form');
    await vi.waitFor(() => expect(f.doc.querySelector('#retrospective-status')!.textContent).toContain('다시 시도'));
    expect(f.doc.querySelector<HTMLElement>('#retrospective-output')!.hidden).toBe(true);
    f.api.retrospective.mockResolvedValueOnce(null); f.submit('retrospective-read-form');
    await vi.waitFor(() => expect(f.doc.querySelector('#retrospective-status')!.textContent).toContain('찾지 못'));
  } finally { f.dom.window.close(); }
});
test('template switch clears retrospective context and discards pending create', async () => {
  const f = fixture();
  try {
    await Promise.resolve(); f.submit('goal-form'); await vi.waitFor(() => expect(f.button('retrospective-create').disabled).toBe(false));
    let finish!: (value: any) => void; f.api.retrospective.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    f.button('retrospective-create').click(); const request = f.api.retrospective.mock.calls[0][0];
    f.doc.querySelector('#task-template')!.dispatchEvent(new f.dom.window.Event('change'));
    finish(draft(request.draftId, request.runId)); await Promise.resolve();
    expect(f.doc.querySelector<HTMLElement>('#retrospective-output')!.hidden).toBe(true);
    expect(f.button('retrospective-create').disabled).toBe(true);
  } finally { f.dom.window.close(); }
});
