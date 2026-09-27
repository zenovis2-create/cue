import { createHash } from 'node:crypto';
import { assertReport, compareReports, reportJson, sourceReport, type ReportIR } from './ir.js';
const sha = (text: string, encoding: 'hex' | 'base64' = 'hex') => createHash('sha256').update(text).digest(encoding);
function fail(): never { throw new TypeError('invalid_report_comparison'); }
function bounded(text: string, max: number): void { if (typeof text !== 'string' || Buffer.byteLength(text) > max) fail(); }
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const currentBases = new WeakSet<object>();
export interface CurrentSourceBasis {
  readonly reportDigest: string;
  readonly snapshotDigest: string;
  readonly baseCommit: string;
  readonly sourceStatusSha256: string;
  readonly sourceStatusEntries: number;
}

/** A current label is issued only after a host callback independently observes
 * the same bounded source digest. The basis still proves static bytes, not runtime use. */
export function bindCurrentSourceBasis(report: ReportIR, input: Omit<CurrentSourceBasis, 'reportDigest'>,
  observeCurrentDigest: () => string): CurrentSourceBasis {
  assertReport(report);
  if (report.kind !== 'source' || !input || typeof input !== 'object' ||
    input.snapshotDigest !== report.revision || !/^[a-f0-9]{40}$/.test(input.baseCommit) ||
    !/^[a-f0-9]{64}$/.test(input.sourceStatusSha256) || !Number.isSafeInteger(input.sourceStatusEntries) || input.sourceStatusEntries < 0 ||
    observeCurrentDigest() !== report.revision) fail();
  const value = Object.freeze({ reportDigest: report.digest, ...input });
  currentBases.add(value); return value;
}

/** Pins are host-supplied archive byte identities, not a signature or a proof of
 * source semantics. Original HTML is checked, never re-rendered with new code. */
export function restoreArchivedSource(source: string, result: string, html: string, sourceSha256: string, resultSha256: string): ReportIR {
  bounded(source, 1048576); bounded(result, 4194304); bounded(html, 33554432);
  if (sha(source) !== sourceSha256 || sha(result) !== resultSha256) fail();
  const report = sourceReport(source), saved = JSON.parse(result), canonical = reportJson(report);
  if (!saved || saved.snapshotDigest !== report.revision || saved.fileCount !== report.nodes.length || saved.edgeCount !== report.edges.length ||
    saved.receipt?.specificationSha256 !== sha(canonical) || saved.receipt?.specificationBytes !== Buffer.byteLength(canonical) ||
    saved.receipt?.artifactSha256 !== sha(html) || saved.receipt?.artifactBytes !== Buffer.byteLength(html)) fail();
  return report;
}
type Change = Readonly<{ id: string; status: string }>;
export function buildSourceComparison(before: ReportIR, after: ReportIR) {
  assertReport(before); assertReport(after);
  if (before.kind !== 'source' || after.kind !== 'source') fail();
  const delta = compareReports(before, after);
  const files = (report: ReportIR) => (report.details as { files: readonly { path: string; sha256: string }[] }).files;
  const left = new Map(files(before).map(file => [file.path, file.sha256])), right = new Map(files(after).map(file => [file.path, file.sha256]));
  const fileChanges = [...new Set([...left.keys(), ...right.keys()])].sort().flatMap(path => {
    const status = !left.has(path) ? 'added' : !right.has(path) ? 'removed' : left.get(path) !== right.get(path) ? 'changed' : null;
    return status ? [Object.freeze({ path, status, beforeSha256: left.get(path) ?? null, afterSha256: right.get(path) ?? null })] : [];
  });
  return Object.freeze({ identity: before.identity, beforeRevision: before.revision, afterRevision: after.revision,
    ...delta, files: Object.freeze(fileChanges), provenance: 'historical-source-declared-unverified',
    beforeCounts: Object.freeze({ files: left.size, nodes: before.nodes.length, edges: before.edges.length }),
    afterCounts: Object.freeze({ files: right.size, nodes: after.nodes.length, edges: after.edges.length }) });
}
const style = 'body{font:16px system-ui,sans-serif;color:#172033;background:#f7f8fc;margin:2rem auto;padding:0 1rem;max-width:1100px}h1,p,td,li{overflow-wrap:anywhere}.counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.counts article,details{background:white;border:1px solid #ccd2df;border-radius:10px;padding:1rem;margin:1rem 0}strong{font-size:1.3rem}summary{font-weight:600;cursor:pointer}table{border-collapse:collapse;width:100%;margin-top:1rem}td,th{padding:.6rem;border-bottom:1px solid #ccd2df;text-align:left;vertical-align:top}code{font-size:.8rem;overflow-wrap:anywhere}li{margin:.5rem 0}@media(max-width:650px){.counts{grid-template-columns:1fr;gap:0}.counts article{margin:.3rem 0}}';
export function renderSourceComparison(before: ReportIR, after: ReportIR) {
  const comparison = buildSourceComparison(before, after), specification = JSON.stringify(comparison);
  const label = (status: string) => status === 'added' ? '추가' : status === 'removed' ? '삭제' : '변경';
  const counts = (items: readonly { status: string }[]) => ['added', 'removed', 'changed'].map(status => `${label(status)} ${items.filter(i => i.status === status).length}`).join(' · ');
  const changes = (title: string, items: readonly Change[]) => `<details><summary>${title} · ${items.length}개</summary><table><thead><tr><th>ID</th><th>차이</th></tr></thead><tbody>${items.map(item => `<tr><td>${escape(item.id)}</td><td>${label(item.status)}</td></tr>`).join('')}</tbody></table></details>`;
  const fileTable = `<details><summary>전체 파일 바이트 변경 · ${comparison.files.length}개</summary><table><thead><tr><th>경로 · 차이</th><th>이전 → 이후 SHA-256</th></tr></thead><tbody>${comparison.files.map(file => `<tr><td>${escape(file.path)} · ${label(file.status)}</td><td><code>${escape(file.beforeSha256 ?? '없음')}<br>→ ${escape(file.afterSha256 ?? '없음')}</code></td></tr>`).join('')}</tbody></table></details>`;
  const inventory = (side: string, report: ReportIR) => `<details><summary>${side} 전체 노드/관계 목록 · ${report.nodes.length}/${report.edges.length}</summary><ul>${report.nodes.map(n => `<li>${escape(n.id)} · ${escape(n.label)}</li>`).join('')}</ul><ul>${report.edges.map(e => `<li>${escape(e.id)}: ${escape(e.from)} → ${escape(e.to)}</li>`).join('')}</ul></details>`;
  const csp = `default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; style-src 'sha256-${sha(style, 'base64')}'`;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escape(csp)}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cue 역사 소스 비교</title><style>${style}</style></head><body><h1>Cue 역사 소스 비교</h1><p>${escape(comparison.identity)} · ${comparison.provenance}</p><p>보존된 두 선언 snapshot의 차이입니다. 현재 소스·깨끗한 Git 커밋·실행 영향·안전·성능을 검증한 결과가 아닙니다. 바이트 무결성과 의미의 진실성은 별개입니다.</p><details><summary>비교 기준과 IR 지문</summary><p>이전 ${comparison.beforeRevision}<br>IR ${comparison.beforeDigest}</p><p>이후 ${comparison.afterRevision}<br>IR ${comparison.afterDigest}</p></details><section class="counts"><article><h2>파일 바이트</h2><strong>${comparison.beforeCounts.files} → ${comparison.afterCounts.files}</strong><p>${counts(comparison.files)}</p></article><article><h2>노드</h2><strong>${comparison.beforeCounts.nodes} → ${comparison.afterCounts.nodes}</strong><p>${counts(comparison.nodes)}</p></article><article><h2>관계</h2><strong>${comparison.beforeCounts.edges} → ${comparison.afterCounts.edges}</strong><p>${counts(comparison.edges)}</p></article></section><h2>주요 파일 변경 · 경로순 최대 12개</h2><ul>${comparison.files.slice(0, 12).map(file => `<li>${label(file.status)} · ${escape(file.path)}</li>`).join('') || '<li>파일 바이트 변경 없음</li>'}</ul>${comparison.files.length > 12 ? '<p>나머지는 전체 파일 바이트 변경 목록에 있습니다.</p>' : ''}${fileTable}${changes('전체 노드 변경', comparison.nodes)}${changes('전체 관계 변경', comparison.edges)}${inventory('이전', before)}${inventory('이후', after)}</body></html>`;
  return Object.freeze({ html, comparison, specificationSha256: sha(specification), specificationBytes: Buffer.byteLength(specification), artifactSha256: sha(html), artifactBytes: Buffer.byteLength(html), browserEvidence: 'not-run', visualReview: 'not-run', upstreamValidation: 'not-run' });
}

export function renderCurrentSourceComparison(before: ReportIR, after: ReportIR, basis: CurrentSourceBasis) {
  if (!currentBases.has(basis) || basis.reportDigest !== after.digest || basis.snapshotDigest !== after.revision) fail();
  const rendered = renderSourceComparison(before, after);
  const historical = '<title>Cue 역사 소스 비교</title>';
  const historicalHeading = '<h1>Cue 역사 소스 비교</h1>';
  const historicalNotice = '<p>보존된 두 선언 snapshot의 차이입니다. 현재 소스·깨끗한 Git 커밋·실행 영향·안전·성능을 검증한 결과가 아닙니다. 바이트 무결성과 의미의 진실성은 별개입니다.</p>';
  const currentNotice = `<p>보존된 선언 snapshot과 현재 제한된 정적 소스 snapshot의 차이입니다. 현재 content digest ${escape(basis.snapshotDigest)} · Git base ${escape(basis.baseCommit)} · source status ${escape(basis.sourceStatusSha256)} (${basis.sourceStatusEntries} entries). 실행 관계·영향·안전·성능 또는 깨끗한 Git 커밋의 증거가 아닙니다.</p>`;
  const html = rendered.html.replace(historical, '<title>Cue 현재 정적 소스 비교</title>')
    .replace(historicalHeading, '<h1>Cue 현재 정적 소스 비교</h1>')
    .replace('historical-source-declared-unverified', 'current-static-source-declared-unverified')
    .replace(historicalNotice, currentNotice);
  const comparison = Object.freeze({ ...rendered.comparison, provenance: 'current-static-source-declared-unverified' });
  const specification = JSON.stringify(comparison);
  return Object.freeze({ ...rendered, html, comparison, specificationSha256: sha(specification), specificationBytes: Buffer.byteLength(specification),
    artifactSha256: sha(html), artifactBytes: Buffer.byteLength(html) });
}
