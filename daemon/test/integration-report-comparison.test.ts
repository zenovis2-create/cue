import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { sourceReport, reportJson } from '../src/reports/ir.js';
import { renderReportHtml } from '../src/reports/html.js';
import { bindCurrentSourceBasis, buildSourceComparison, renderCurrentSourceComparison, renderSourceComparison, restoreArchivedSource } from '../src/reports/comparison.js';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const input = () => ({ identity: 'cue', revision: 'a'.repeat(64), files: [{ path: 'src/a.ts', sha256: 'a'.repeat(64) }], nodes: [{ id: 'a', label: 'A' }], edges: [] as { id: string; from: string; to: string }[] });
test('restores only pinned archive bytes with matching original IR and HTML receipt', () => {
  const source = JSON.stringify(input()), report = sourceReport(source), artifact = renderReportHtml(report);
  const result = JSON.stringify({ snapshotDigest: report.revision, fileCount: 1, edgeCount: 0, receipt: artifact });
  expect(restoreArchivedSource(source, result, artifact.html, sha(source), sha(result)).digest).toBe(report.digest);
  for (const [s, r, h] of [[source + ' ', result, artifact.html], [source, result + ' ', artifact.html], [source, result, artifact.html + 'x']]) expect(() => restoreArchivedSource(s, r, h, sha(source), sha(result))).toThrow();
  const bad = JSON.stringify({ snapshotDigest: report.revision, fileCount: 2, edgeCount: 0, receipt: artifact });
  expect(() => restoreArchivedSource(source, bad, artifact.html, sha(source), sha(bad))).toThrow();
  expect(artifact.specificationSha256).toBe(sha(reportJson(report)));
});
test('unchanged snapshots have no node edge or file changes; forged and unrelated inputs reject', () => {
  const report = sourceReport(JSON.stringify(input())); const same = buildSourceComparison(report, report);
  expect(same).toMatchObject({ nodes: [], edges: [], files: [], metadataChanged: false });
  expect(() => buildSourceComparison({ ...report }, report)).toThrow();
  expect(() => buildSourceComparison(report, sourceReport(JSON.stringify({ ...input(), identity: 'other' })))).toThrow();
});
test('same path content changes are visible even when stable node and edge sets are unchanged', () => {
  const before = input(), after = input(); after.files[0].sha256 = 'b'.repeat(64);
  const delta = buildSourceComparison(sourceReport(JSON.stringify(before)), sourceReport(JSON.stringify(after)));
  expect(delta.nodes).toEqual([]); expect(delta.edges).toEqual([]);
  expect(delta.files).toEqual([{ path: 'src/a.ts', status: 'changed', beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64) }]);
});
test('stable IDs show additions removals and endpoint changes with all inventory retained', () => {
  const before = input(); before.nodes.push({ id: 'b', label: 'B' }); before.edges.push({ id: 'e', from: 'a', to: 'b' });
  const after = input(); after.nodes.push({ id: 'c', label: 'C' }); after.edges.push({ id: 'e', from: 'c', to: 'a' });
  const delta = buildSourceComparison(sourceReport(JSON.stringify(before)), sourceReport(JSON.stringify(after)));
  expect(delta.nodes).toEqual([{ id: 'b', status: 'removed' }, { id: 'c', status: 'added' }]); expect(delta.edges).toEqual([{ id: 'e', status: 'changed' }]);
});
test('comparison HTML escapes hostile labels, preserves provenance and uses script-free hashed CSP', () => {
  const source = input(); source.nodes[0].label = '</li><img src=x onerror=alert(1)><script>bad</script>';
  const report = sourceReport(JSON.stringify(source)), artifact = renderSourceComparison(report, report), dom = new JSDOM(artifact.html);
  try { const doc = dom.window.document;
    expect(doc.querySelectorAll('script,img,a,[src],[href],[onerror]').length).toBe(0);
    expect(doc.body.textContent).toContain(source.nodes[0].label); expect(doc.body.textContent).toContain('historical-source-declared-unverified');
    const styleHash = createHash('sha256').update(doc.querySelector('style')!.textContent!).digest('base64');
    expect(doc.querySelector('meta[http-equiv]')!.getAttribute('content')).toContain(`style-src 'sha256-${styleHash}'`);
    expect(artifact.artifactSha256).toBe(sha(artifact.html)); expect(artifact.artifactBytes).toBe(Buffer.byteLength(artifact.html));
  } finally { dom.window.close(); }
});
test('current comparison wording requires a basis bound to an independently observed matching digest', () => {
  const before = sourceReport(JSON.stringify(input())), next = input(); next.revision = 'b'.repeat(64);
  const after = sourceReport(JSON.stringify(next));
  expect(() => bindCurrentSourceBasis(after, { snapshotDigest: after.revision, baseCommit: 'c'.repeat(40), sourceStatusSha256: 'd'.repeat(64), sourceStatusEntries: 2 }, () => 'e'.repeat(64))).toThrow();
  const basis = bindCurrentSourceBasis(after, { snapshotDigest: after.revision, baseCommit: 'c'.repeat(40), sourceStatusSha256: 'd'.repeat(64), sourceStatusEntries: 2 }, () => after.revision);
  const artifact = renderCurrentSourceComparison(before, after, basis);
  expect(artifact.html).toContain('현재 제한된 정적 소스 snapshot');
  expect(artifact.html).toContain('current-static-source-declared-unverified');
  expect(artifact.html).toContain(after.revision); expect(artifact.html).toContain('c'.repeat(40));
  expect(artifact.html).toContain('실행 관계·영향·안전·성능 또는 깨끗한 Git 커밋의 증거가 아닙니다');
  expect(artifact.specificationSha256).toBe(sha(JSON.stringify(artifact.comparison)));
  expect(artifact.specificationBytes).toBe(Buffer.byteLength(JSON.stringify(artifact.comparison)));
  expect(artifact.artifactSha256).toBe(sha(artifact.html));
  expect(() => renderCurrentSourceComparison(before, before, basis)).toThrow();
});
