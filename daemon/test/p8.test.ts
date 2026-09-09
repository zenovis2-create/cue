import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { openLedger, type Ledger } from '../src/ledger.js';
import { displayStatus, ledgerTaskStates, mountScreen, readTaskCard } from '../src/ui/index.js';

const now = '2026-09-03T00:00:00.000Z';
const databases: Ledger[] = [];

function seed(state = 'running', taskId = 'task-main') {
  const db = openLedger(); databases.push(db);
  db.prepare('INSERT INTO task(id,state,blocked_reason,created_at) VALUES(?,?,?,?)').run(taskId, state, null, now);
  db.prepare('INSERT INTO envelope(envelope_hash,worktree_realpath,egress_json,created_at) VALUES(?,?,?,?)').run('env-main', 'C:/work', '[]', now);
  db.prepare('INSERT INTO run(id,task_id,envelope_hash,write_in_progress,started_at) VALUES(?,?,?,?,?)').run('run-main', taskId, 'env-main', 0, now);
  return db;
}

function mount(db: Ledger, taskId = 'task-main', onStop = vi.fn()) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const root = dom.window.document.querySelector<HTMLElement>('#root');
  if (!root) throw new Error('test root missing');
  return { dom, root, controller: mountScreen(root, db, taskId, onStop), onStop };
}

afterEach(() => { while (databases.length) databases.pop()?.close(); });

describe('Phase 8 real DOM ledger UI', () => {
  it('P8-1 renders conversation and current-work containers in the default two-column screen', () => {
    const { root } = mount(seed());
    const conversation = root.querySelector('[data-conversation]');
    const rail = root.querySelector('[data-current-work]');
    expect(conversation).not.toBeNull(); expect(conversation?.textContent).toBe('대화');
    expect(rail).not.toBeNull(); expect(rail?.textContent).toContain('현재 작업');
    expect(root.querySelector('[data-annotation-canvas]')).toBeNull();
  });

  it('P8-2 replaces only the left conversation with an annotation canvas and preserves rail node identity', () => {
    const { root, controller } = mount(seed());
    const railBefore = root.querySelector('[data-current-work]');
    controller.openCapture();
    expect(root.querySelector('[data-conversation]')).toBeNull();
    expect(root.querySelector('[data-annotation-canvas]')?.textContent).toBe('주석 캔버스');
    expect(root.querySelector('[data-current-work]')).toBe(railBefore);
  });

  it('P8-3 keeps progress/stage vocabulary and invokes the real stop callback after canvas transition', () => {
    const { root, controller, onStop } = mount(seed());
    const statusBefore = root.querySelector('[data-progress-status]')?.textContent;
    const stageBefore = root.querySelector('[data-stage]')?.textContent;
    controller.openCapture();
    expect(root.querySelector('[data-progress-status]')?.textContent).toBe(statusBefore);
    expect(root.querySelector('[data-stage]')?.textContent).toBe(stageBefore);
    const stop = root.querySelector<HTMLButtonElement>('[data-stop]');
    expect(stop?.textContent).toBe('중단'); stop?.click(); expect(onStop).toHaveBeenCalledOnce();
  });

  it('P8-4 maps queued to exact status 유휴', () => expect(displayStatus('queued')).toBe('유휴'));
  it('P8-4 maps running to exact status 작업 중', () => expect(displayStatus('running')).toBe('작업 중'));
  it('P8-4 maps blocked to exact status 막힘', () => expect(displayStatus('blocked')).toBe('막힘'));
  it('P8-4 maps completed to exact status 완료', () => expect(displayStatus('completed')).toBe('완료'));
  it('P8-4 maps every ledger state and fails visibly for an unknown state', () => {
    expect(ledgerTaskStates.map(displayStatus)).toEqual(['유휴', '작업 중', '작업 중', '막힘', '완료', '막힘']);
    expect(() => displayStatus('invented')).toThrow('unknown ledger task state: invented');
  });

  it('P8-5 looks up recent work by task_id, never by a session id', () => {
    const db = seed('running', 'task-lookup');
    db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)')
      .run('session-not-a-task', 321, now, 'C:/work', 'task-lookup', 'run-main');
    expect(readTaskCard(db, 'task-lookup').taskId).toBe('task-lookup');
    expect(() => readTaskCard(db, 'session-not-a-task')).toThrow('task not found: session-not-a-task');
    const source = readFileSync(resolve('src/ui/model.ts'), 'utf8');
    expect(source).toContain('WHERE task_id=?'); expect(source).not.toContain('FROM session_handle');
  });

  it('P8-6 omits the orphan badge node when the ledger count is zero', () => {
    const { root } = mount(seed()); expect(root.querySelector('[data-orphan-badge]')).toBeNull();
  });

  it('P8-6 shows an orphan badge whose count equals the ledger query', () => {
    const db = seed();
    const insert = db.prepare('INSERT INTO orphan_session_observation(handle,pid,start_time,observed_at) VALUES(?,?,?,?)');
    insert.run('orphan-a', 41, now, now); insert.run('orphan-b', 42, now, now);
    const { root } = mount(db);
    expect(root.querySelector('[data-orphan-badge]')?.textContent).toBe('고아 2건');
    expect(readTaskCard(db, 'task-main').orphanCount).toBe(2);
  });

  it.each(['completed', 'blocked'])('P8-7 renders exact approval totals for %s and 자세히 opens a detail node', state => {
    const db = seed(state);
    const insert = db.prepare('INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES(?,?,?,?,?,?,?,?)');
    insert.run('run-main', 'env-main', 'th', 'i1', 'a1', 0, 'accept', now);
    insert.run('run-main', 'env-main', 'th', 'i2', 'a2', 0, 'accept', now);
    insert.run('run-main', 'env-main', 'th', 'i3', 'a3', 0, 'decline', now);
    const { root } = mount(db);
    expect(root.querySelector('[data-approval-summary]')?.textContent).toBe('자동 승인 2건 · 거부 1건 · 자세히');
    expect(root.querySelector('[data-task-detail]')).toBeNull();
    root.querySelector<HTMLButtonElement>('[data-detail-button]')?.click();
    expect(root.querySelector('[data-task-detail]')?.textContent).toBe('작업 task-main · 실행 run-main');
  });

  it('P8-8 displays autonomy ③ and exactly three ledgered recovery attempts', () => {
    const db = seed();
    db.prepare('INSERT INTO run_autonomy(run_id,level,retry_cap,recorded_at) VALUES(?,?,?,?)').run('run-main', 3, 4, now);
    const insert = db.prepare('INSERT INTO recovery_attempt_v2(run_id,parent_attempt_id,ordinal,rung,hypothesis,outcome,created_at) VALUES(?,?,?,?,?,?,?)');
    insert.run('run-main', null, 1, 1, 'first', 'retry', now);
    insert.run('run-main', 1, 2, 2, 'second', 'retry', now);
    insert.run('run-main', 2, 3, 3, 'third', 'recovered', now);
    const { root } = mount(db);
    expect(root.querySelector('[data-autonomy-summary]')?.textContent).toBe('자율성: ③ · 자동 복구 3회');
    expect(readTaskCard(db, 'task-main').recoveryAttempts).toBe(3);
  });

  it('P8 safety gate keeps UI imports read-only and tests use real DOM queries/clicks', () => {
    const source = ['src/ui/model.ts', 'src/ui/screen.ts'].map(file => readFileSync(resolve(file), 'utf8')).join('\n');
    expect(source).not.toMatch(/child_process|process-launch|session-spawn|spawnOwned|spawnVendor|\bUPDATE\b|\bINSERT\b|\bDELETE\b/iu);
    const tests = readFileSync(resolve('test/p8.test.ts'), 'utf8');
    expect(tests).toContain('querySelector'); expect(tests).toContain('.click()');
    expect(tests).not.toContain(['toMatch', 'Snapshot'].join(''));
  });
});
