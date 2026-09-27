import { test, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const summary = { mode: 'value', policyRevision: 'p1', currency: 'USD', unit: 'micro', limitUnits: '500', stageCount: 2, planDigest: 'a'.repeat(64),
  requirementsDigest: 'b'.repeat(64), requirements: [{ id: 'req1', text: '로그인 결과를 검증한다.', kind: 'code', required: true,
    checks: [{ checkerId: 'tests', revision: 'v1', parametersDigest: 'c'.repeat(64), targetIds: ['login'] }] }], stages: [
  { id: 'impl', role: 'implementation', dependencyIds: [], requirementIds: ['req1'], scopeIds: ['workspace'], candidateIds: ['candidate'] },
  { id: 'check', role: 'verifier', dependencyIds: ['impl'], requirementIds: ['req1'], scopeIds: ['workspace'], candidateIds: ['checker'] },
] };
function fixture() {
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  const prepare = vi.fn(async () => ({ threeLines: ['무엇을: 구현', '어디까지: 범위', '안 건드릴 것: 외부'],
    envelope: { expires_at: '2026-09-11T00:00:00.000Z', worktree_realpath: 'fixture', allowed_actions: ['read'] }, orchestration: summary as unknown }));
  Object.assign(dom.window, { cue: { prepare } });
  dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
  const submit = async () => {
    dom.window.document.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(dom.window.document.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(false));
  };
  return { dom, prepare, submit };
}
test('real prepare form shows policy and each dependency, requirement, scope and candidate before approval', async () => {
  const f = fixture();
  try {
    expect(f.dom.window.document.querySelector<HTMLElement>('#approval-plan')!.hidden).toBe(true);
    await f.submit();
    expect(f.prepare).toHaveBeenCalledOnce();
    expect(f.dom.window.document.querySelector<HTMLElement>('#approval-plan')!.hidden).toBe(false);
    expect(f.dom.window.document.querySelector('#approval-plan-summary')!.textContent).toContain('가성비 모드');
    const items = f.dom.window.document.querySelectorAll('#approval-plan-stages li');
    expect(items).toHaveLength(2);
    expect(items[1].textContent).toContain('선행 단계: impl');
    expect(items[1].textContent).toContain('요구사항: req1');
    expect(items[1].textContent).toContain('허용 범위: workspace');
    expect(items[1].textContent).toContain('후보: checker');
    const criteria = f.dom.window.document.querySelector('#approval-requirements')!.textContent;
    for (const expected of ['로그인 결과를 검증한다.', 'req1 · 코드 · 필수', '검사기: tests', '버전: v1', '대상: login', 'c'.repeat(64)]) expect(criteria).toContain(expected);
  } finally { f.dom.window.close(); }
});

test('approval shows every declared file path literally and clears it for a readonly plan', async () => {
  const f = fixture();
  try {
    const path = '<img src=x onerror=alert(1)>' + 'x'.repeat(200);
    const changeTargets = Array.from({ length: 64 }, (_, index) => ({ taskId: 'impl', targetId: `file${index}`,
      relativePath: index === 0 ? path : `src/file${index}.ts`, maxBackupBytes: 4096, rootContractDigest: 'd'.repeat(64) }));
    f.prepare.mockResolvedValueOnce({ ...(await f.prepare()), orchestration: { ...summary, changeTargets } });
    await f.submit();
    const doc = f.dom.window.document;
    expect(doc.querySelector<HTMLElement>('#approval-changes')!.hidden).toBe(false);
    expect(doc.querySelectorAll('#approval-change-targets li')).toHaveLength(64);
    expect(doc.querySelector('#approval-change-targets')!.textContent).toContain(path);
    expect(doc.querySelector('#approval-change-targets')!.textContent).toContain('src/file63.ts');
    expect(doc.querySelector('#approval-change-targets')!.textContent).toContain('4096바이트');
    expect(doc.querySelector('#approval-change-targets img')).toBeNull();
    await f.submit();
    expect(doc.querySelector<HTMLElement>('#approval-changes')!.hidden).toBe(true);
    expect(doc.querySelector('#approval-change-targets')!.childElementCount).toBe(0);
  } finally { f.dom.window.close(); }
});

test.each([{ changeTargets: [] }, { changeTargets: [{ relativePath: 'partial' }] }])('malformed target disclosure cannot leave approval enabled or stale paths visible (%j)', async ({ changeTargets }) => {
  const f = fixture();
  try {
    await f.submit();
    f.prepare.mockResolvedValueOnce({ ...(await f.prepare()), orchestration: { ...summary, changeTargets } });
    f.dom.window.document.querySelector('#goal-form')!.dispatchEvent(new f.dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(f.dom.window.document.querySelector('#quiet')!.textContent).toContain('변경 대상 목록을 확인할 수 없습니다.'));
    expect(f.dom.window.document.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(true);
    expect(f.dom.window.document.querySelector('#approval-change-targets')!.childElementCount).toBe(0);
  } finally { f.dom.window.close(); }
});

test('approval shows explicit localhost egress and renders destination text literally', async () => {
  const f = fixture();
  try {
    f.prepare.mockResolvedValueOnce({ threeLines: ['변환', '검사', '파일 변경 없음'],
      envelope: { expires_at: '2026-09-11T00:00:00.000Z', worktree_realpath: 'fixture', allowed_actions: ['command'],
        egress: ['http://127.0.0.1:8085/v1', '<img src=x onerror=alert(1)>'] } as any, orchestration: summary });
    await f.submit();
    const card = f.dom.window.document.querySelector('#envelope')!;
    expect(card.textContent).toContain('허용 네트워크: http://127.0.0.1:8085/v1');
    expect(card.textContent).not.toContain('네트워크 없음');
    expect(card.querySelector('img')).toBeNull();
  } finally { f.dom.window.close(); }
});
test('legacy preparation and preparation failure clear prior plan rather than leave stale approval detail', async () => {
  const f = fixture();
  try {
    await f.submit();
    f.prepare.mockResolvedValueOnce({ ...(await f.prepare()), orchestration: undefined });
    await f.submit();
    expect(f.dom.window.document.querySelector<HTMLElement>('#approval-plan')!.hidden).toBe(true);
    expect(f.dom.window.document.querySelector('#approval-plan-stages')!.childElementCount).toBe(0);
    expect(f.dom.window.document.querySelector('#approval-requirements')!.childElementCount).toBe(0);
    await f.submit();
    f.prepare.mockRejectedValueOnce(Error('prepare failed'));
    f.dom.window.document.querySelector('#goal-form')!.dispatchEvent(new f.dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(f.dom.window.document.querySelector('#quiet')!.textContent).toContain('prepare failed'));
    expect(f.dom.window.document.querySelector<HTMLElement>('#approval-plan')!.hidden).toBe(true);
    expect(f.dom.window.document.querySelector('#approval-plan-summary')!.textContent).toBe('');
    expect(f.dom.window.document.querySelector('#approval-requirements-summary')!.textContent).toBe('');
    expect(f.dom.window.document.querySelector<HTMLButtonElement>('#approve')!.disabled).toBe(true);
  } finally { f.dom.window.close(); }
});
test('requirements render hostile text literally and preserve all source-contract maximums', async () => {
  const f = fixture();
  try {
    const hostile = '<img src=x onerror=alert(1)>';
    const fullText = hostile + 'x'.repeat(16384 - hostile.length);
    const checks = Array.from({ length: 32 }, (_, n) => ({ checkerId: `checker${n}`, revision: 'v1', parametersDigest: 'd'.repeat(64), targetIds: Array.from({ length: 128 }, (_, i) => `target${i}`) }));
    const requirements = Array.from({ length: 256 }, (_, n) => ({ ...summary.requirements[0], id: `req${n}`, text: n === 0 ? fullText : hostile, checks: n === 0 ? checks : [] }));
    f.prepare.mockResolvedValueOnce({ ...(await f.prepare()), orchestration: { ...summary, requirements } });
    await f.submit();
    expect(f.dom.window.document.querySelectorAll('#approval-requirements > li')).toHaveLength(256);
    expect(f.dom.window.document.querySelector('.requirement-text')!.textContent).toBe(fullText);
    expect(f.dom.window.document.querySelectorAll('#approval-requirements > li:first-child .requirement-checks li')).toHaveLength(32);
    expect(f.dom.window.document.querySelector('.requirement-checks')!.textContent).toContain('target127');
    expect(f.dom.window.document.querySelector('#approval-requirements img')).toBeNull();
  } finally { f.dom.window.close(); }
});
test('missing criteria remain explicitly unregistered rather than implying acceptance', async () => {
  const f = fixture();
  try {
    f.prepare.mockResolvedValueOnce({ ...(await f.prepare()), orchestration: { ...summary, requirements: [], requirementsDigest: null } });
    await f.submit();
    expect(f.dom.window.document.querySelector('#approval-requirements-summary')!.textContent).toBe('기준 미등록 · 최종 인수 미확인');
    expect(f.dom.window.document.querySelector('#approval-requirements')!.childElementCount).toBe(0);
  } finally { f.dom.window.close(); }
});
test('model producer approval label retains explicit candidate, requirements and empty scopes', async () => {
  const f = fixture();
  try {
    f.prepare.mockResolvedValueOnce({ ...(await f.prepare()), orchestration: { ...summary, stages: [
      { ...summary.stages[0], id: 'model-output', role: 'model-producer', scopeIds: [], candidateIds: ['local-model'] },
    ] } });
    await f.submit();
    const text = f.dom.window.document.querySelector('#approval-plan-stages')!.textContent;
    for (const expected of ['모델 출력 생성', '후보: local-model', '요구사항: req1', '허용 범위: 없음']) expect(text).toContain(expected);
  } finally { f.dom.window.close(); }
});
test('generated output approval shows bounded metadata only and clears absent or failed preparation', async () => {
  const f = fixture();
  try {
    const hostile = '<img src=x onerror=alert(1)>';
    const target = { targetId: hostile, requirementId: 'req1', producerTaskId: 'producer', checkerId: 'transform-check', checkerRevision: 'v1',
      inputSha256: '1'.repeat(64), inputByteLength: 120, maxBytes: 1048576, parametersDigest: '2'.repeat(64), targetDigest: '3'.repeat(64),
      inputBytes: 'DO-NOT-RENDER-RAW-INPUT', secret: 'DO-NOT-RENDER-SECRET' };
    const prepared = await f.prepare();
    f.prepare.mockResolvedValueOnce({ ...prepared, orchestration: { ...summary, generatedOutputs: [target] } });
    await f.submit();
    const panel = f.dom.window.document.querySelector<HTMLElement>('#approval-generated')!;
    const text = panel.textContent!;
    expect(panel.hidden).toBe(false);
    for (const expected of [hostile, 'req1', 'producer', 'transform-check', 'v1', '120바이트', '1048576바이트', '1'.repeat(64), '2'.repeat(64), '3'.repeat(64)]) expect(text).toContain(expected);
    expect(text).not.toContain('DO-NOT-RENDER'); expect(panel.querySelector('img')).toBeNull();
    await f.submit();
    expect(panel.hidden).toBe(true); expect(f.dom.window.document.querySelector('#approval-generated-targets')!.childElementCount).toBe(0);
    f.prepare.mockResolvedValueOnce({ ...prepared, orchestration: { ...summary, generatedOutputs: Array.from({ length: 130 }, () => target) } });
    await f.submit();
    expect(f.dom.window.document.querySelectorAll('#approval-generated-targets > li')).toHaveLength(128);
    expect(f.dom.window.document.querySelector('#approval-generated-limit')!.textContent).toContain('128');
    f.prepare.mockRejectedValueOnce(Error('prepare failed'));
    f.dom.window.document.querySelector('#goal-form')!.dispatchEvent(new f.dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(f.dom.window.document.querySelector('#quiet')!.textContent).toContain('prepare failed'));
    expect(panel.hidden).toBe(true); expect(f.dom.window.document.querySelector('#approval-generated-targets')!.childElementCount).toBe(0);
  } finally { f.dom.window.close(); }
});
test('retry contract limits and digest are visible before approval and absent retry is cleared', async () => {
  const f = fixture();
  try {
    f.prepare.mockResolvedValueOnce({ ...(await f.prepare()), orchestration: { ...summary,
      retry: { maxAttemptsPerTask: 2, maxAttemptsTotal: 4, deadlineMs: 1000, contractDigest: 'e'.repeat(64) } } });
    await f.submit();
    const retry = f.dom.window.document.querySelector<HTMLElement>('#approval-retry')!;
    expect(retry.hidden).toBe(false);
    for (const text of ['최초 실행 포함 단계당 최대 2회', '전체 최대 4회', '기한:', 'e'.repeat(64), '기록·비용에 포함']) expect(retry.textContent).toContain(text);
    await f.submit();
    expect(retry.hidden).toBe(true); expect(retry.textContent).toBe('');
  } finally { f.dom.window.close(); }
});
test('hostile IDs are literal text and stage count is bounded', async () => {
  const f = fixture();
  try {
    const hostile = '<img src=x onerror=alert(1)>';
    f.prepare.mockResolvedValueOnce({ ...(await f.prepare()), orchestration: { ...summary, stages: Array.from({ length: 260 }, () => ({ ...summary.stages[0], id: hostile, candidateIds: [hostile] })) } });
    await f.submit();
    expect(f.dom.window.document.querySelectorAll('#approval-plan-stages li')).toHaveLength(256);
    expect(f.dom.window.document.querySelector('#approval-plan-stages')!.textContent).toContain(hostile);
    expect(f.dom.window.document.querySelector('#approval-plan img')).toBeNull();
    expect(f.dom.window.document.querySelector('#approval-plan-limit')!.textContent).toContain('256');
  } finally { f.dom.window.close(); }
});
