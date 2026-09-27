import { test, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

function fixture(available = true) {
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  const api = {
    selectionPreferences: vi.fn(async () => ({ available, mode: 'value', revision: 2 })),
    setSelectionPreference: vi.fn(async (input: { mode: string; expectedRevision: number }) => ({ available: true, mode: input.mode, revision: input.expectedRevision + 1 })),
    prepare: vi.fn(async (input: { selectionMode?: string }) => ({ taskId: 'task', runId: 'prepared-run', threeLines: ['무엇을: 작업', '어디까지: 범위', '안 건드릴 것: 외부'],
      envelope: { expires_at: '2026-09-11T00:00:00.000Z', worktree_realpath: 'fixture', allowed_actions: ['read'] },
      orchestration: available ? { mode: input.selectionMode, policyRevision: 'p1', currency: 'TEST', unit: 'micro', limitUnits: 100, stageCount: 0, planDigest: 'a'.repeat(64), stages: [] } : null })),
    approve: vi.fn(async () => ({ approved: true })),
    execute: vi.fn(async () => ({ state: 'completed', taskId: 'task', runId: 'prepared-run', executionOwnership: { status: 'released' }, status: 'completed', stage: 'fixture', orchestration: null })),
  };
  Object.assign(dom.window, { cue: api });
  dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
  const document = dom.window.document;
  const mode = document.querySelector<HTMLSelectElement>('#selection-mode')!;
  const change = (value: string) => { mode.value = value; mode.dispatchEvent(new dom.window.Event('change')); };
  const submit = () => document.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  return { dom, document, api, mode, change, submit };
}
test('four modes load the saved default, explicit choice prepares run, CAS saves only future default', async () => {
  const f = fixture();
  try {
    await vi.waitFor(() => expect(f.mode.disabled).toBe(false));
    expect([...f.mode.options].map(option => option.value)).toEqual(['efficiency', 'performance', 'value', 'speed']);
    expect(f.mode.value).toBe('value');
    f.change('performance'); f.submit();
    await vi.waitFor(() => expect(f.api.prepare).toHaveBeenCalledOnce());
    expect(f.api.prepare.mock.calls[0][0]).toMatchObject({ selectionMode: 'performance' });
    await vi.waitFor(() => expect(f.document.querySelector('#approval-plan-summary')!.textContent).toContain('고성능 모드'));
    f.change('speed');
    expect(f.document.querySelector('#selection-status')!.textContent).toContain('승인 대기 계획은 유지');
    f.document.querySelector<HTMLButtonElement>('#selection-save')!.click();
    await vi.waitFor(() => expect(f.api.setSelectionPreference).toHaveBeenCalledWith({ mode: 'speed', expectedRevision: 2 }));
    expect(f.document.querySelector('#approval-plan-summary')!.textContent).toContain('고성능 모드');
    f.document.querySelector<HTMLButtonElement>('#approve')!.click();
    await vi.waitFor(() => expect(f.api.approve).toHaveBeenCalledWith({ runId: 'prepared-run' }));
    await vi.waitFor(() => expect(f.document.querySelector('#state-title')!.textContent).toBe('완료'));
    expect(f.api.prepare).toHaveBeenCalledOnce();
  } finally { f.dom.window.close(); }
});
test('unsupported host hides controls and legacy preparation omits mode without pretending availability', async () => {
  const f = fixture(false);
  try {
    await vi.waitFor(() => expect(f.document.querySelector('#selection-status')!.textContent).toContain('지원하지 않습니다'));
    expect(f.document.querySelector<HTMLElement>('#selection-controls')!.hidden).toBe(true);
    expect(f.mode.disabled).toBe(true);
    f.submit();
    await vi.waitFor(() => expect(f.api.prepare).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(f.document.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(false));
    expect(f.api.prepare.mock.calls[0][0]).not.toHaveProperty('selectionMode');
    f.document.querySelector<HTMLButtonElement>('#selection-save')!.click();
    expect(f.api.setSelectionPreference).not.toHaveBeenCalled();
  } finally { f.dom.window.close(); }
});
test('conflicted save reports failure and refreshes revision without silently changing current choice', async () => {
  const f = fixture();
  try {
    await vi.waitFor(() => expect(f.mode.disabled).toBe(false));
    f.api.setSelectionPreference.mockRejectedValueOnce(Error('selection_preference_conflict'));
    f.api.selectionPreferences.mockResolvedValueOnce({ available: true, mode: 'efficiency', revision: 3 });
    f.change('speed'); f.document.querySelector<HTMLButtonElement>('#selection-save')!.click();
    await vi.waitFor(() => expect(f.document.querySelector('#selection-status')!.textContent).toContain('저장하지 못했습니다'));
    expect(f.mode.value).toBe('speed');
    f.document.querySelector<HTMLButtonElement>('#selection-save')!.click();
    await vi.waitFor(() => expect(f.api.setSelectionPreference).toHaveBeenLastCalledWith({ mode: 'speed', expectedRevision: 3 }));
    await vi.waitFor(() => expect(f.document.querySelector('#selection-status')!.textContent).toContain('기본 속도 모드를 저장했습니다'));
  } finally { f.dom.window.close(); }
});
