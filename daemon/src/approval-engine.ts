import { isAbsolute, relative, resolve } from 'node:path';
import type { Ledger } from './ledger.js';
import type { Envelope } from './envelope.js';
import { classifyPayload } from './payload.js';
import { buildPermissionsAccept, isConcreteContainedPath, type PermissionsAccept } from './permissions-response.js';

export type Decision = { decision: 'accept' } | { decision: 'decline'; reason: string } | { decision: 'cancel'; reason: 'credential_request' | 'outside_grant_root' | 'uninspectable_payload' } | PermissionsAccept;
export interface ApprovalIdentity { thread_id: string; item_id: string; approval_id: string | null; request_ordinal: number }
export interface ApprovalRequest extends ApprovalIdentity {
  method: string;
  cwd: string | null;
  command?: string | null;
  entries?: unknown;
  additionalPermissions?: unknown;
  grantRoot?: unknown;
  payloadBytes?: Uint8Array;
  opaque?: boolean;
  encrypted?: boolean;
}
export interface RunEnvelope { envelope: Envelope; envelope_hash: string; ended_at?: string }

const actionByMethod: Readonly<Record<string, string>> = Object.freeze({
  'permissions/request': 'permissions',
  'commandExecution/request': 'command',
  'fileChange/request': 'file_change',
  'writeStdin/request': 'write_stdin',
  'network/request': 'egress',
});

function contained(worktree: string, candidate: string): boolean {
  const rel = relative(worktree, resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function mandatoryChecks(request: ApprovalRequest, active: RunEnvelope, now: Date): Decision | undefined {
  if (active.ended_at || now.getTime() >= new Date(active.envelope.expires_at).getTime()) return { decision: 'decline', reason: 'inactive_envelope' };
  if (request.cwd === null || !contained(active.envelope.worktree_realpath, request.cwd)) return { decision: 'decline', reason: 'cwd_mismatch' };
  if (request.method === 'chatgptAuthTokens/refresh') return { decision: 'cancel', reason: 'credential_request' };
  if (request.method.startsWith('item/tool/') || request.method === 'mcpServer/elicitation/request') return { decision: 'decline', reason: 'forbidden_method' };
  if (request.grantRoot !== undefined && (typeof request.grantRoot !== 'string' || !contained(active.envelope.worktree_realpath, request.grantRoot))) return { decision: 'cancel', reason: 'outside_grant_root' };
  if (request.opaque || request.encrypted || (request.payloadBytes && classifyPayload(request.payloadBytes) === undefined)) return { decision: 'cancel', reason: 'uninspectable_payload' };
  const action = actionByMethod[request.method];
  if (action === undefined) return { decision: 'decline', reason: 'unknown_action' };
  if (!active.envelope.allowed_actions.includes(action)) return { decision: 'decline', reason: 'outside_envelope' };
  if (request.method === 'commandExecution/request' && request.command == null) return { decision: 'decline', reason: 'missing_command' };
  return undefined;
}

function inspectAdditional(worktree: string, value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(item => item && typeof item === 'object' && !('special' in item) && isConcreteContainedPath(worktree, (item as Record<string, unknown>).path));
}

function record(db: Ledger, active: RunEnvelope, request: ApprovalRequest, decision: Decision, now: Date): Decision {
  try {
    db.prepare('INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(active.envelope.run_id, active.envelope_hash, request.thread_id, request.item_id, request.approval_id, request.request_ordinal, decision.decision === 'accept' ? 'accept' : 'decline', now.toISOString());
    return decision;
  } catch (error) {
    if (!(error instanceof Error) || !/UNIQUE/.test(error.message)) throw error;
    const run = db.prepare('SELECT task_id FROM run WHERE id=?').get(active.envelope.run_id) as { task_id: string };
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run(run.task_id, active.envelope.run_id, 'replay_alert', JSON.stringify({ thread_id: request.thread_id, item_id: request.item_id, approval_id: request.approval_id, request_ordinal: request.request_ordinal }), now.toISOString());
    return { decision: 'decline', reason: 'replay' };
  }
}

export function decideApproval(db: Ledger, active: RunEnvelope, request: ApprovalRequest, now = new Date()): Decision {
  let decision = mandatoryChecks(request, active, now);
  if (!decision && !inspectAdditional(active.envelope.worktree_realpath, request.additionalPermissions)) decision = { decision: 'decline', reason: 'additional_permissions' };
  if (!decision && request.method === 'permissions/request') decision = buildPermissionsAccept(active.envelope.worktree_realpath, request.entries) ?? { decision: 'decline', reason: 'invalid_permissions' };
  if (!decision) decision = { decision: 'accept' };
  return record(db, active, request, decision, now);
}
