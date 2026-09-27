import { createHash } from 'node:crypto';
import type { Ledger } from '../ledger.js';
import { readOrchestrationSnapshot } from '../ui/orchestration.js';
import type { TerminalIntegrityResult } from '../orchestration/handoff-activity.js';
import { readRunOutcome } from '../evaluation/run-outcome.js';
import { assertRunMeasuredEvidenceSummary } from './measured-evidence.js';

export interface ReportNode { readonly id: string; readonly label: string; readonly state: string; readonly provenance: 'observed' | 'source-declared-unverified' }
export interface ReportEdge { readonly id: string; readonly from: string; readonly to: string; readonly provenance: 'planned' | 'source-declared-unverified' }
export interface ReportIR {
  readonly schemaVersion: 1;
  readonly kind: 'run' | 'source';
  readonly identity: string;
  readonly revision: string;
  readonly nodes: readonly ReportNode[];
  readonly edges: readonly ReportEdge[];
  readonly details: unknown;
  readonly digest: string;
}
const reports = new WeakSet<object>();
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const order = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v);
function fail(): never { throw new TypeError('invalid_report'); }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function finish(value: Omit<ReportIR, 'digest'>): ReportIR {
  if (!id(value.identity) || value.nodes.length > 256 || value.edges.length > 4096) fail();
  const ids = new Set(value.nodes.map(n => n.id));
  if (ids.size !== value.nodes.length || value.nodes.some(n => !id(n.id)) ||
    new Set(value.edges.map(e => e.id)).size !== value.edges.length || value.edges.some(e => !ids.has(e.from) || !ids.has(e.to))) fail();
  const body = { ...value, nodes: [...value.nodes].sort(order), edges: [...value.edges].sort(order) };
  const report = freeze({ ...body, digest: hash(JSON.stringify(body)) });
  reports.add(report); return report;
}
export function assertReport(value: ReportIR): void { if (!reports.has(value)) fail(); }
export function reportJson(value: ReportIR): string { assertReport(value); return JSON.stringify(value); }

/** One SQLite read transaction, with plan topology explicitly separate from observed
 * stage state. Historical acceptance is not a claim about current output bytes. */
export function readRunReport(db: Ledger, runId: string, integrityReader?: (attemptId: string) => TerminalIntegrityResult): ReportIR | null {
  if (!id(runId)) fail();
  return db.transaction(() => {
    const observed = readOrchestrationSnapshot(db, runId, integrityReader);
    if (!observed) return null;
    const row = db.prepare('SELECT CASE WHEN length(payload)<=1048576 THEN payload ELSE NULL END payload FROM orchestration_plan WHERE run_id=?').get(runId) as { payload: string | null };
    if (!row.payload || !observed.planDigest || observed.stagesTruncated) fail();
    const plan = JSON.parse(row.payload);
    if (!Array.isArray(plan.tasks) || plan.tasks.length > 256) fail();
    const edges: ReportEdge[] = [];
    for (const task of plan.tasks) {
      if (!task || !id(task.id) || !Array.isArray(task.dependencyIds) || task.dependencyIds.length > 256) fail();
      for (const dependency of task.dependencyIds) {
        if (!id(dependency)) fail();
        edges.push({ id: JSON.stringify([dependency, task.id]), from: dependency, to: task.id, provenance: 'planned' });
      }
    }
    if (plan.tasks.length !== observed.stages.length || new Set(plan.tasks.map((t: { id: string }) => t.id)).size !== plan.tasks.length ||
      plan.tasks.some((t: { id: string }) => !observed.stages.some(s => s.taskId === t.id))) fail();
    return finish({ schemaVersion: 1, kind: 'run', identity: runId, revision: observed.planDigest,
      nodes: observed.stages.map(s => ({ id: s.taskId!, label: `${s.taskId} · ${s.role ?? 'unknown'}`, state: s.state, provenance: 'observed' })),
      edges, details: { provenance: 'ledger-observation', acceptanceIsHistorical: true, observation: observed } });
  })();
}

/** Explicit report export only: two independent read snapshots, never a combined
 * acceptance decision. Preserve the original report and its digest. */
export function readRunOutcomeReport(db: Ledger, runId: string, integrityReader?: (attemptId: string) => TerminalIntegrityResult): ReportIR | null {
  if (!db.open || db.inTransaction) throw Error('outcome_report_boundary');
  const original = readRunReport(db, runId, integrityReader);
  if (!original) return null;
  let runOutcome: ReturnType<typeof readRunOutcome>;
  try { runOutcome = readRunOutcome(db, { runId }); }
  catch { runOutcome = Object.freeze({ status: 'unavailable', runId, authority: 'evaluation-input-only', reason: 'stored-evidence-unavailable' }); }
  return finish({ schemaVersion: original.schemaVersion, kind: original.kind, identity: original.identity,
    revision: original.revision, nodes: original.nodes, edges: original.edges,
    details: { ...(original.details as Record<string, unknown>), baseReportDigest: original.digest,
      outcomeSnapshotRelation: 'separate-read-transaction',
      outcomeNotice: '평가 입력 자료이며 품질·시간 또는 현재 실행 자격을 입증하지 않습니다. 단계 관측과 별도 읽기 시점입니다.', runOutcome } });
}

export function appendRunMeasuredEvidence(report: ReportIR, measuredEvidence: unknown): ReportIR {
  assertReport(report);
  assertRunMeasuredEvidenceSummary(measuredEvidence);
  return finish({ schemaVersion: report.schemaVersion, kind: report.kind, identity: report.identity,
    revision: report.revision, nodes: report.nodes, edges: report.edges,
    details: { ...(report.details as Record<string, unknown>), measuredEvidenceBaseReportDigest: report.digest,
      measuredEvidenceSnapshotRelation: 'separate-read-snapshot',
      measuredEvidenceNotice: '저장된 측정 사실을 별도 읽기 시점에 다시 검증한 제한된 요약이며 측정 정확성·현재 실행 자격을 입증하지 않습니다.',
      measuredEvidence } });
}

/** Bounded JSON declaration only. Does not read source files or authenticate the
 * supplied revision/hash; every relationship remains source-declared-unverified. */
export function sourceReport(json: string): ReportIR {
  if (typeof json !== 'string' || Buffer.byteLength(json) > 1048576) fail();
  const data = JSON.parse(json);
  const fields = (o: unknown, keys: string[]): o is Record<string, any> => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
  if (!fields(data, ['identity', 'revision', 'files', 'nodes', 'edges']) || !id(data.identity) || typeof data.revision !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(data.revision) ||
    !Array.isArray(data.files) || data.files.length > 256 || !Array.isArray(data.nodes) || data.nodes.length > 256 || !Array.isArray(data.edges) || data.edges.length > 4096) fail();
  const files = data.files.map((f: unknown) => {
    if (!fields(f, ['path', 'sha256']) || typeof f.path !== 'string' || f.path.length > 512 || !/^[A-Za-z0-9._/-]+$/.test(f.path) ||
      f.path.startsWith('/') || f.path.split('/').some((part: string) => !part || part === '.' || part === '..') || typeof f.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(f.sha256)) fail();
    return { path: f.path as string, sha256: f.sha256 as string };
  }).sort((a: { path: string }, b: { path: string }) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (new Set(files.map((f: { path: string }) => f.path)).size !== files.length) fail();
  const nodes = data.nodes.map((n: unknown) => {
    if (!fields(n, ['id', 'label']) || !id(n.id) || typeof n.label !== 'string' || !n.label.length || n.label.length > 2048) fail();
    return { id: n.id, label: n.label, state: 'unverified', provenance: 'source-declared-unverified' as const };
  });
  const edges = data.edges.map((e: unknown) => {
    if (!fields(e, ['id', 'from', 'to']) || !id(e.id) || !id(e.from) || !id(e.to)) fail();
    return { id: e.id, from: e.from, to: e.to, provenance: 'source-declared-unverified' as const };
  });
  return finish({ schemaVersion: 1, kind: 'source', identity: data.identity, revision: data.revision,
    nodes, edges, details: { provenance: 'source-declared-unverified', files } });
}

export function compareReports(before: ReportIR, after: ReportIR) {
  assertReport(before); assertReport(after);
  if (before.kind !== after.kind || before.identity !== after.identity) fail();
  const changes = <T extends { id: string }>(a: readonly T[], b: readonly T[]) => {
    const left = new Map(a.map(n => [n.id, n])), right = new Map(b.map(n => [n.id, n]));
    return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap(id => {
      const status = !left.has(id) ? 'added' : !right.has(id) ? 'removed' : JSON.stringify(left.get(id)) !== JSON.stringify(right.get(id)) ? 'changed' : null;
      return status ? [{ id, status }] : [];
    });
  };
  return freeze({ beforeDigest: before.digest, afterDigest: after.digest, nodes: changes(before.nodes, after.nodes), edges: changes(before.edges, after.edges),
    metadataChanged: before.revision !== after.revision || JSON.stringify(before.details) !== JSON.stringify(after.details),
    impactAssessment: 'not-performed', securityAssessment: 'not-performed' });
}
