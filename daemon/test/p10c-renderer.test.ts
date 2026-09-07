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
const completedCard = { ...runningCard, state: 'completed', status: 'done', stage: 'verified', resultSummary: 'verified result' };
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
