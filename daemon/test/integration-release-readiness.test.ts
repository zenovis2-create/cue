import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, expect, test } from 'vitest';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const load = async () => await import(new URL('../../scripts/reuse/cue-release-readiness.mjs', import.meta.url).href) as {
  buildReadiness(input: Record<string, unknown>): any;
  renderReadinessHtml(report: any): string;
  readinessGenerationId(report:any, generatorBytes:Uint8Array):string;
};
const spec = '## 7\n첫 제품 이정표는 S0~S4. S5 개선을 입증하기 전에는 완료로 표시하지 않는다. S6~S7은 확장/설명 계층이다.';
const map = '| A07 | S0~S4 첫 이정표와 S5 최적화 입증, S6~S7 확장 완료를 별도 표시한다. |';

function fixture(overrides: Partial<Record<string, string[]>> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cue-readiness-')); roots.push(root);
  const docs = join(root, 'docs'), evidence = join(root, 'evidence'); mkdirSync(docs); mkdirSync(evidence);
  writeFileSync(join(evidence, 'proof.md'), 'proof');
  const defaults: Record<string, string[]> = { common: ['x'], S0: ['x'], S1: ['x'], S2: ['x'], S3: ['x'], S4: ['x'], S5: [' '], S6: ['x'], S7: ['x'], launch: [' '] };
  const titles: Record<string, string> = { common: '재사용 공통 게이트 — 기능별 반복', launch: '출시 인수 시나리오' };
  const chunks: string[] = [];
  for (const id of ['common', 'S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'launch']) {
    chunks.push(`## ${titles[id] ?? `${id} — fixture`}`);
    for (const [index, state] of (overrides[id] ?? defaults[id]!).entries()) chunks.push(`- [${state}] ${id} item ${index} ([proof](../evidence/proof.md))`);
  }
  const checklist = chunks.join('\n'), expectedHashes = { checklist: sha(checklist), specification: sha(spec), executionMap: sha(map) };
  return { root, evidence, checklistPath: join(docs, 'INTEGRATION_CHECKLIST.md'), checklist, specification: spec, executionMap: map, expectedHashes };
}

test('keeps first milestone, efficiency proof, and extensions independent', async () => {
  const { buildReadiness } = await load();
  const input = fixture({ S0: [' '], S5: ['x'], S6: ['x'], S7: ['x'], launch: ['x'] });
  const report = buildReadiness(input);
  expect(report.milestones.firstMilestone.state).toBe('missing');
  expect(report.milestones.efficiencyProof).toMatchObject({ state: 'documented', claim: 'not-proven' });
  expect(report.milestones.extensions).toMatchObject({ componentState: 'documented', releaseState: 'not-release-qualified' });
  expect(report.release).toEqual({ state: 'not-ready', claim: 'all-product' });
});

test('missing or altered source and missing evidence cannot report qualified', async () => {
  const { buildReadiness } = await load();
  const complete = fixture({ S5: ['x'], launch: ['x'] });
  expect(buildReadiness(complete).release.state).toBe('not-ready');
  expect(buildReadiness(complete).qualification).toBe('not-assessed');
  expect(buildReadiness(complete).milestones.efficiencyProof.claim).toBe('not-proven');
  expect(() => buildReadiness({ ...complete, checklist: complete.checklist + '\n' })).toThrow('source_pin_mismatch:checklist');
  rmSync(join(complete.evidence, 'proof.md'));
  const unverified = buildReadiness(complete);
  expect(unverified.stages.S0.state).toBe('unverified');
  expect(unverified.release.state).toBe('not-ready');
});

test('a checked assertion without an evidence reference remains unverified', async () => {
  const { buildReadiness } = await load();
  const input = fixture({ S5: ['x'], launch: ['x'] });
  input.checklist = input.checklist.replace('S7 item 0 ([proof](../evidence/proof.md))', 'S7 checked only');
  input.expectedHashes.checklist = sha(input.checklist);
  const report = buildReadiness(input);
  expect(report.stages.S7.state).toBe('unverified');
  expect(report.milestones.extensions).toMatchObject({ componentState: 'unverified', releaseState: 'not-release-qualified' });
  expect(report.release.state).toBe('not-ready');
});

test('derives current counts from checklist items rather than a fixed remaining count', async () => {
  const { buildReadiness } = await load();
  const input = fixture({ S0: [' ', 'x', ' ', 'x', 'x'], S5: [' ', ' ', 'x'] });
  const report = buildReadiness(input);
  expect(report.stages.S0).toMatchObject({ checkedCount: 3, totalCount: 5 });
  expect(report.stages.S0.unchecked).toHaveLength(2);
  expect(report.stages.S5).toMatchObject({ checkedCount: 1, totalCount: 3 });
  expect(JSON.stringify(report)).not.toContain('42 broad');
});

test('renders readable self-contained HTML and escapes hostile checklist text', async () => {
  const { buildReadiness, renderReadinessHtml } = await load();
  const attack = '</li><script>alert(1)</script><img src="https://evil.invalid/x" onerror="alert(2)">';
  const input = fixture({ S0: [' '] }); input.checklist = input.checklist.replace('S0 item 0', attack); input.expectedHashes.checklist = sha(input.checklist);
  const html = renderReadinessHtml(buildReadiness(input)), dom = new JSDOM(html);
  try {
    const document = dom.window.document;
    expect(document.body.textContent).toContain(attack);
    expect(document.querySelectorAll('script,img,iframe,link,a,[src],[href],[onclick],[onerror]')).toHaveLength(0);
    expect(document.querySelector('table')).not.toBeNull();
    expect(document.querySelectorAll('h3')).toHaveLength(8);
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content')!;
    expect(csp).toContain("default-src 'none'"); expect(csp).toContain("script-src 'none'"); expect(csp).not.toContain('unsafe-inline');
    expect(html).toContain('All-product: NOT-READY'); expect(html).toContain('S5 optimizer: NOT-PROVEN');
  } finally { dom.window.close(); }
});

test('common and launch acceptance remain explicit release dependencies', async () => {
  const { buildReadiness } = await load();
  const input = fixture({ common: [' '], S5: ['x'], launch: [' '] });
  const report = buildReadiness(input);
  expect(report.dependencies).toEqual({ commonGate: 'missing', launchAcceptance: 'missing' });
  expect(report.milestones.firstMilestone.state).toBe('documented');
  expect(report.release.state).toBe('not-ready');
});


test('empty sections remain unverified and changed evidence or generator changes generation identity', async () => {
  const {buildReadiness,readinessGenerationId}=await load();
  const empty=fixture({S0:[]});expect(buildReadiness(empty).stages.S0.state).toBe('unverified');
  const input=fixture({S5:['x'],launch:['x']}), first=buildReadiness(input), generator=Buffer.from('generator-v1');
  writeFileSync(join(input.evidence,'proof.md'),'changed evidence');
  const changed=buildReadiness(input);
  expect(readinessGenerationId(first,generator)).not.toBe(readinessGenerationId(changed,generator));
  expect(readinessGenerationId(first,generator)).not.toBe(readinessGenerationId(first,Buffer.from('generator-v2')));
  expect(changed.release.state).toBe('not-ready');expect(changed.milestones.efficiencyProof.claim).toBe('not-proven');
});
