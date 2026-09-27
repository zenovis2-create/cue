import { test, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { registerIpcHandlers } from '../../app/ipc.mjs';

const command = { templateId: 'generated-json-v1', inputText: '{"x":1}', autonomy: 3, selectionMode: 'value' };
test('JSON IPC validates exact data and trusted sender before host preparation', () => {
  const handlers = new Map<string, (...args: any[]) => any>();
  const prepareJsonTemplate = vi.fn(input => input);
  const sender = {}, frame = {};
  const api = registerIpcHandlers({ handle: (key, fn) => { handlers.set(key, fn); } }, { prepareJsonTemplate } as never,
    { isTrustedSender: event => event.sender === sender && event.senderFrame === frame });
  const handle = handlers.get('cue:prepare-json')!;
  for (const event of [null, { sender: {}, senderFrame: frame }, { sender, senderFrame: {} }]) expect(() => handle(event, command)).toThrow('sender denied');
  expect(handle({ sender, senderFrame: frame }, command)).toEqual(command);
  const getter = vi.fn(() => 'generated-json-v1');
  const accessor = { ...command }; Object.defineProperty(accessor, 'templateId', { enumerable: true, get: getter });
  const trap = vi.fn();
  const invalid = [null, accessor, new Proxy({}, { getPrototypeOf: trap }), { ...command, path: 'C:/secret' },
    { ...command, permissions: ['write'] }, { ...command, autonomy: 4 }, { ...command, selectionMode: 'admin' },
    { ...command, templateId: '../other' }, { ...command, inputText: '' }, { ...command, inputText: '한'.repeat(349526) }];
  for (const value of invalid) expect(() => api.invoke('cue:prepare-json', value)).toThrow('input denied');
  expect(() => api.invoke('cue:prepare-json', command, 'extra')).toThrow('input denied');
  expect(getter).not.toHaveBeenCalled(); expect(trap).not.toHaveBeenCalled();
  expect(prepareJsonTemplate).toHaveBeenCalledOnce();
  expect(api.invoke('cue:prepare-json', { ...command, inputText: 'a'.repeat(1048576) }).inputText.length).toBe(1048576);
});

const prepared = { runId: 'json-run', taskId: 'task', threeLines: ['무엇을: JSON 변환', '어디까지: 고정 기준', '안 건드릴 것: 외부'],
  envelope: { expires_at: '2026-09-11T00:00:00Z', worktree_realpath: 'fixture', allowed_actions: ['read'] }, orchestration: null };
function fixture() {
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  const api = { selectionPreferences: vi.fn(async () => ({ available: true, mode: 'value', revision: 1 })),
    prepare: vi.fn(async (_input: unknown) => prepared), prepareJson: vi.fn(async (_input: unknown) => prepared), approve: vi.fn(),
    resources: vi.fn(async (input: { operation: string }) => input.operation === 'list' ? [] : { runId: 'json-run', pinSha256: 'a'.repeat(64), packages: [] }) };
  Object.assign(dom.window, { cue: api }); dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
  const doc = dom.window.document;
  const template = doc.querySelector<HTMLSelectElement>('#task-template')!;
  const change = (value: string) => { template.value = value; template.dispatchEvent(new dom.window.Event('change')); };
  const submit = () => doc.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  return { dom, doc, api, template, change, submit };
}
test('actual form defaults general; explicit JSON sends raw text only to dedicated preparation', async () => {
  const f = fixture();
  try {
    await vi.waitFor(() => expect(f.doc.querySelector<HTMLSelectElement>('#selection-mode')!.disabled).toBe(false));
    expect(f.template.value).toBe('general');
    f.doc.querySelector<HTMLTextAreaElement>('#goal')!.value = '{"general":"stay general"}'; f.submit();
    await vi.waitFor(() => expect(f.api.prepare).toHaveBeenCalledOnce()); expect(f.api.prepareJson).not.toHaveBeenCalled();
    f.change('generated-json-v1');
    expect(f.doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(true);
    const raw = '{"x":"</textarea><img src=x onerror=alert(1)>"}';
    f.doc.querySelector<HTMLTextAreaElement>('#json-input')!.value = raw; f.submit();
    await vi.waitFor(() => expect(f.api.prepareJson).toHaveBeenCalledWith({ ...command, inputText: raw }));
    await vi.waitFor(() => expect(f.doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(false));
    expect(f.doc.querySelector('img')).toBeNull(); expect(f.doc.querySelector('#what')!.textContent).toBe('JSON 변환');
    expect(f.doc.querySelector('#envelope')!.textContent).not.toContain(raw);
    f.change('general'); expect(f.doc.querySelector('#envelope')!.textContent).toBe('');
    expect(f.doc.querySelector('#resource-pin')!.textContent).toContain('먼저');
    expect(f.doc.querySelector<HTMLTextAreaElement>('#json-input')!.disabled).toBe(true);
  } finally { f.dom.window.close(); }
});
test('template change discards late preparation and host failure never falls back', async () => {
  const f = fixture();
  try {
    await vi.waitFor(() => expect(f.doc.querySelector<HTMLSelectElement>('#selection-mode')!.disabled).toBe(false));
    let settle!: (value: typeof prepared) => void;
    f.api.prepareJson.mockImplementationOnce(() => new Promise(resolve => { settle = resolve; }));
    f.change('generated-json-v1'); f.doc.querySelector<HTMLTextAreaElement>('#json-input')!.value = '{}'; f.submit();
    f.change('general'); settle(prepared); await Promise.resolve(); await Promise.resolve();
    expect(f.doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(true);
    expect(f.doc.querySelector('#what')!.textContent).toBe('');
    expect(f.api.resources.mock.calls.filter(([input]) => input.operation === 'pin')).toHaveLength(0);
    f.change('generated-json-v1'); f.api.prepareJson.mockRejectedValueOnce(Error('JSON host unavailable')); f.submit();
    await vi.waitFor(() => expect(f.doc.querySelector('#quiet')!.textContent).toContain('JSON host unavailable'));
    expect(f.api.prepare).not.toHaveBeenCalled(); expect(f.doc.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(true);
  } finally { f.dom.window.close(); }
});
