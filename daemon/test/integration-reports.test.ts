import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { openLedger, type Ledger } from '../src/ledger.js';
import { compareReports, readRunReport, reportJson, sourceReport } from '../src/reports/ir.js';
import { renderReportHtml } from '../src/reports/html.js';
const handles: Ledger[] = [];
afterEach(() => handles.splice(0).forEach(db => db.close()));
const declared = () => ({ identity: 'cue', revision: 'a'.repeat(40), files: [{ path: 'src/a.ts', sha256: 'b'.repeat(64) }],
  nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ id: 'edge', from: 'a', to: 'b' }] });
function fixture() {
  const db = openLedger(); handles.push(db);
  db.prepare("INSERT INTO task VALUES('task','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES('envelope','C:/private/secret','[]','now')").run();
  db.prepare("INSERT INTO run VALUES('run','task','envelope',0,'now')").run();
  db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('run', 'envelope', 'a'.repeat(64), JSON.stringify({ revision: 'v1', tasks: [
    { id: 'maker', role: 'model-producer', dependencyIds: [] }, { id: 'verify', role: 'verifier', dependencyIds: ['maker'] }], secret: 'SECRET' }));
  db.prepare("INSERT INTO orchestration_step VALUES('run','maker','completed')").run();
  db.prepare("INSERT INTO orchestration_step VALUES('run','verify','pending')").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('old','run','maker','candidate','failed','{}','C:/private/secret',NULL,1)").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('current','run','maker','candidate','completed','{}','C:/private/secret',NULL,1)").run();
  return db;
}
test('ledger report preserves observed states, planned dependencies and failed history without invented acceptance or costs', () => {
  const db = fixture(); const report = readRunReport(db, 'run')!;
  expect(readRunReport(db, 'missing')).toBeNull();
  expect(report.nodes.find(n => n.id === 'verify')).toMatchObject({ state: 'pending', provenance: 'observed' });
  expect(report.edges).toEqual([{ id: '["maker","verify"]', from: 'maker', to: 'verify', provenance: 'planned' }]);
  expect(report.details).toMatchObject({ acceptanceIsHistorical: true, observation: { acceptance: 'unverified', attemptCount: 2, budget: { costStatus: 'unknown', actualUnits: null } } });
  const json = reportJson(report); expect(json).toContain('failed'); expect(json).not.toContain('SECRET'); expect(json).not.toContain('C:/private');
  db.prepare("UPDATE orchestration_step SET state='running' WHERE task_id='verify'").run();
  const current = readRunReport(db, 'run')!;
  expect(current.digest).not.toBe(report.digest);
  expect(report.nodes.find(n => n.id === 'verify')!.state).toBe('pending');
  expect(compareReports(report, current).nodes).toEqual([{ id: 'verify', status: 'changed' }]);
});
test('declarations are canonical immutable and explicitly unverified', () => {
  const input = declared(), first = sourceReport(JSON.stringify(input));
  input.nodes.reverse(); expect(sourceReport(JSON.stringify(input)).digest).toBe(first.digest);
  expect(first.nodes.every(n => n.provenance === 'source-declared-unverified')).toBe(true);
  expect(Object.isFrozen(first.nodes[0])).toBe(true);
  expect(() => renderReportHtml({ ...first })).toThrow('invalid_report');
});
test('declaration bounds, source path traversal, duplicate IDs and dangling edges are rejected', () => {
  for (const change of [
    { files: [{ path: '../secret', sha256: 'b'.repeat(64) }] },
    { files: [{ path: 'src/a.ts', sha256: ['b'.repeat(64)] }] },
    { nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'again' }] },
    { edges: [{ id: 'edge', from: 'a', to: 'missing' }] },
    { revision: 'a'.repeat(41) }, { nodes: Array.from({ length: 257 }, (_, i) => ({ id: `n${i}`, label: 'N' })) },
    { verified: true },
  ]) expect(() => sourceReport(JSON.stringify({ ...declared(), ...change }))).toThrow();
});
test('HTML parser sees hostile labels as literal text with no scripts, attributes or external requests', () => {
  const input = declared(); const attack = '</td><script>alert(1)</script><img src="https://evil" onerror="alert(2)">&';
  input.nodes[0].label = attack;
  const report = sourceReport(JSON.stringify(input)), artifact = renderReportHtml(report);
  const dom = new JSDOM(artifact.html);
  try {
    const doc = dom.window.document;
    expect(doc.querySelector('tbody tr td:nth-child(2)')!.textContent).toBe(attack);
    expect(doc.querySelectorAll('script,img,iframe,a,[onclick],[onerror],[src],[href]').length).toBe(0);
    const style = doc.querySelector('style')!.textContent!;
    const styleHash = createHash('sha256').update(style).digest('base64');
    const csp = doc.querySelector('meta[http-equiv]')!.getAttribute('content');
    expect(csp).toContain("script-src 'none'"); expect(csp).toContain(`style-src 'sha256-${styleHash}'`);
    expect(csp).not.toContain('unsafe-inline');
    expect(artifact.artifactSha256).toBe(createHash('sha256').update(artifact.html).digest('hex'));
    expect(artifact.specificationSha256).toBe(createHash('sha256').update(reportJson(report)).digest('hex'));
    expect(artifact.artifactBytes).toBe(Buffer.byteLength(artifact.html));
    expect(artifact).toMatchObject({ delivery: 'not-written', browserEvidence: 'not-run', upstreamValidation: 'not-run' });
  } finally { dom.window.close(); }
});
test('stable ID comparisons report exact declaration changes and refuse unrelated identities', () => {
  const first = sourceReport(JSON.stringify(declared())); const input = declared(); input.nodes[0].label = 'changed';
  const diff = compareReports(first, sourceReport(JSON.stringify(input)));
  expect(diff.nodes).toEqual([{ id: 'a', status: 'changed' }]); expect(diff.edges).toEqual([]);
  expect(diff).toMatchObject({ impactAssessment: 'not-performed', securityAssessment: 'not-performed' });
  expect(() => compareReports(first, sourceReport(JSON.stringify({ ...input, identity: 'other' })))).toThrow();
  expect(() => compareReports(first, readRunReport(fixture(), 'run')!)).toThrow();
});

test('source diagram groups all files and distinct relations deterministically without rewriting IR or dropping inventories', () => {
  const nodes = Array.from({ length: 12 }, (_, i) => ({ id: `src/group${i}/file.ts`, label: `file ${i}` }));
  const edges = nodes.slice(1).map((node,i) => ({ id: `e${i}`, from: nodes[0]!.id, to: node.id }));
  edges.push({ id: 'parallel-declaration', from: nodes[0]!.id, to: nodes[1]!.id });
  const input = { ...declared(), nodes, edges }, report = sourceReport(JSON.stringify(input));
  const before = reportJson(report), artifact = renderReportHtml(report), dom = new JSDOM(artifact.html);
  try {
    const doc = dom.window.document, groups = [...doc.querySelectorAll('.architecture-groups li')];
    expect(groups).toHaveLength(8); expect(groups.reduce((total,li) => total+Number(li.getAttribute('data-count')),0)).toBe(12);
    expect(doc.querySelector('.architecture-total')!.textContent).toContain('12개 IR 관계 · 11개 고유 파일 쌍');
    expect(doc.querySelector('.architecture-overflow')!.textContent).toContain('나머지 5개');
    expect(doc.querySelectorAll('.source-inventory')[0]!.querySelectorAll('tbody tr')).toHaveLength(12);
    expect(doc.querySelectorAll('.source-inventory')[1]!.querySelectorAll('li')).toHaveLength(12);
    expect([...doc.querySelectorAll('.source-inventory')].every(d => !d.hasAttribute('open'))).toBe(true);
    const svg = doc.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img'); expect(svg.querySelector('title')).not.toBeNull(); expect(svg.querySelector('desc')).not.toBeNull();
    expect(svg.querySelectorAll('rect')).toHaveLength(64); expect(doc.querySelector('.architecture-alternative')!.textContent).toContain('11');
    expect(reportJson(report)).toBe(before); expect(artifact.specificationSha256).toBe(createHash('sha256').update(before).digest('hex'));
    expect(renderReportHtml(sourceReport(JSON.stringify({ ...input, nodes: [...nodes].reverse(), edges: [...edges].reverse() }))).html).toBe(artifact.html);
  } finally { dom.window.close(); }
});

test('run reports retain direct observed/planned inventory and receive no source diagram or collapsed stage table', () => {
  const report = readRunReport(fixture(),'run')!, dom = new JSDOM(renderReportHtml(report).html);
  try {
    const doc = dom.window.document;
    expect(doc.querySelector('svg,.architecture,.source-inventory')).toBeNull();
    expect(doc.querySelector('table')!.closest('details')).toBeNull();
    expect(doc.querySelector('tbody')!.textContent).toContain('observed');
    expect(doc.querySelector('ul')!.textContent).toContain('planned');
  } finally { dom.window.close(); }
});
