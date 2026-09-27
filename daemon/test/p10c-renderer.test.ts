import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const repo = resolve(import.meta.dirname, '..', '..');
const html = readFileSync(resolve(repo, 'app', 'renderer', 'index.html'), 'utf8');
const renderer = readFileSync(resolve(repo, 'app', 'renderer', 'renderer.js'), 'utf8');
const delay = (ms: number) => new Promise(resolvePromise => setTimeout(resolvePromise, ms));

const runningCard = {
  state: 'running', status: 'active', stage: 'isolated execution', approvalSummary: '1 approval', autonomySummary: 'bounded',
  isolatedToolCalls: 1, workerPids: [41001], resultSummary: '', blockedReason: null,
};
const completedCard = { ...runningCard, taskId: 'task-renderer', runId: 'run-renderer', executionOwnership: { status: 'released' }, state: 'completed', status: 'done', stage: 'verified', resultSummary: 'verified result' };
const prepared = {
  runId: 'run-renderer', taskId: 'task-renderer', threeLines: ['무엇을: 테스트', '어디까지: workspace', '안 건드릴 것: network'],
  envelope: { worktree_realpath: 'C:\\workspace', expires_at: '2099-01-01T00:00:00Z', allowed_actions: ['command'] },
};

function loadRenderer(api: Record<string, unknown>): JSDOM {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'file:///cue/index.html' });
  Object.defineProperty(dom.window, 'cue', { value: api, configurable: false });
  dom.window.eval(renderer);
  return dom;
}

async function submitAndApprove(dom: JSDOM): Promise<void> {
  const { document } = dom.window;
  (document.querySelector('#goal') as HTMLTextAreaElement).value = 'renderer transport goal';
  document.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await delay(0);
  (document.querySelector('#approve') as HTMLButtonElement).click();
  await delay(20);
}

describe('renderer ledger-grounded transport errors', () => {
  it('requires a separate run-bound exploration checkbox and ignores stale preparation responses', async () => {
    const approvals: unknown[] = [];
    let resolveFirst!: (value: typeof prepared) => void;
    const first = new Promise<typeof prepared>(resolve => { resolveFirst = resolve; });
    let prepareCalls = 0;
    const exploration = { candidateId: 'paid-candidate', limitUnits: 20, currency: 'USD', unit: 'micro', taskIds: ['make'], authorizationDigest: 'a'.repeat(64), consentDigest: 'b'.repeat(64) };
    const dom = loadRenderer({
      prepare: async () => ++prepareCalls === 1 ? first : { ...prepared, runId: `run-${prepareCalls}`, orchestration: prepareCalls === 2 ? { exploration } : null },
      approve: async (input: unknown) => { approvals.push(input); return { ok: true }; },
      execute: async () => new Promise(() => {}), stop: async () => ({ ok: true }),
    });
    const { document } = dom.window;
    const goal = document.querySelector('#goal') as HTMLTextAreaElement;
    goal.value = 'first'; document.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    goal.value = 'second'; document.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await delay(0);
    const consent = document.querySelector('#exploration-consent') as HTMLElement;
    const checkbox = document.querySelector('#allow-exploration') as HTMLInputElement;
    expect(consent.hidden).toBe(false); expect(checkbox.checked).toBe(false);
    expect(consent.textContent).toContain('전체 예산 상한에 포함');
    expect(consent.textContent).toContain('대상 작업 1개');
    expect(consent.textContent).not.toMatch(/[ab]{64}|authorization|consentDigest/u);
    checkbox.checked = true;
    resolveFirst({ ...prepared, orchestration: null } as typeof prepared);
    await delay(0);
    expect(consent.hidden).toBe(false); expect(checkbox.checked).toBe(true);
    (document.querySelector('#approve') as HTMLButtonElement).click();
    await delay(0);
    expect(approvals).toEqual([{ runId: 'run-2', allowExploration: true }]);
    (document.querySelector('#stop') as HTMLButtonElement).click();
    await delay(0);
    expect(consent.hidden).toBe(true); expect(checkbox.checked).toBe(false);
    dom.window.close();
  });

  it('clears exploration consent on a new preparation and keeps it clear after an error or ordinary result', async () => {
    let calls = 0;
    const exploration = { candidateId: 'paid-candidate', limitUnits: 20, currency: 'USD', unit: 'micro', taskIds: ['make'], authorizationDigest: 'a'.repeat(64), consentDigest: 'b'.repeat(64) };
    const dom = loadRenderer({
      prepare: async () => {
        calls += 1;
        if (calls === 1) return { ...prepared, orchestration: { exploration } };
        if (calls === 2) throw Error('prepare failed');
        return { ...prepared, runId: 'ordinary-run', orchestration: null };
      }, approve: async () => ({ ok: true }), execute: async () => new Promise(() => {}), stop: async () => ({ ok: true }),
    });
    const { document } = dom.window, submit = async () => {
      document.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await delay(0);
    };
    (document.querySelector('#goal') as HTMLTextAreaElement).value = 'consent reset';
    await submit();
    const consent = document.querySelector('#exploration-consent') as HTMLElement, checkbox = document.querySelector('#allow-exploration') as HTMLInputElement;
    checkbox.checked = true;
    const errorSubmit = submit();
    expect(consent.hidden).toBe(true); expect(checkbox.checked).toBe(false);
    await errorSubmit;
    expect(consent.hidden).toBe(true); expect(checkbox.checked).toBe(false);
    await submit();
    expect(consent.hidden).toBe(true); expect(checkbox.checked).toBe(false);
    dom.window.close();
  });

  it('keeps the last running ledger card and retries after a polling transport failure', async () => {
    let statusCalls = 0;
    const dom = loadRenderer({
      prepare: async () => prepared,
      approve: async () => ({ ok: true }),
      execute: async (input: { operation?: string }) => {
        if (input.operation !== 'status') return runningCard;
        statusCalls += 1;
        if (statusCalls === 1) throw new Error('temporary IPC failure');
        return completedCard;
      },
      stop: async () => ({ ok: true }),
    });
    await submitAndApprove(dom);
    const { document } = dom.window;
    expect((document.querySelector('#result') as HTMLElement).dataset.state).toBe('running');
    expect((document.querySelector('#transport-error') as HTMLElement).textContent).toMatch(/temporary IPC failure/u);
    await delay(500);
    expect(statusCalls).toBeGreaterThanOrEqual(2);
    expect((document.querySelector('#result') as HTMLElement).dataset.state).toBe('completed');
    expect((document.querySelector('#transport-error') as HTMLElement).hidden).toBe(true);
    dom.window.close();
  });

  it('preserves running state and re-enables stop when stop transport fails', async () => {
    const dom = loadRenderer({
      prepare: async () => prepared,
      approve: async () => ({ ok: true }),
      execute: async (input: { operation?: string }) => input.operation === 'status' ? new Promise(() => {}) : runningCard,
      stop: async () => { throw new Error('stop IPC unavailable'); },
    });
    await submitAndApprove(dom);
    const { document } = dom.window;
    (document.querySelector('#stop') as HTMLButtonElement).click();
    await delay(30);
    expect((document.querySelector('#result') as HTMLElement).dataset.state).toBe('running');
    expect((document.querySelector('#stop') as HTMLButtonElement).disabled).toBe(false);
    expect((document.querySelector('#transport-error') as HTMLElement).textContent).toMatch(/stop IPC unavailable/u);
    dom.window.close();
  });
});
