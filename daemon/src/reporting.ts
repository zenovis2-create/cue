import type { Ledger } from './ledger.js';
import { completionApprovalLabel } from './execution-accounting.js';

export type DecisionPath = { readonly verdict: string; readonly route: string; readonly reason: string };

function pathLine(path: DecisionPath): string {
  if (!path.verdict.trim() || !path.route.trim() || !path.reason.trim()) throw new Error('decision path required');
  return `판정 경로: ${path.verdict} → ${path.route} (${path.reason})`;
}

export function renderCompletionReport(db: Ledger, taskId: string, summary: string, path: DecisionPath): string {
  return `완료: ${summary}\n${pathLine(path)}\n${completionApprovalLabel(db,taskId)}`;
}

export function renderBlockedReport(summary: string, path: DecisionPath): string {
  return `막힘: ${summary}\n${pathLine(path)}`;
}
