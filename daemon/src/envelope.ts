import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';

export type AutonomyLevel = 'supervised' | 'bounded';

export interface Envelope {
  run_id: string;
  worktree_realpath: string;
  egress: string[];
  expires_at: string;
  autonomy_level: AutonomyLevel;
  allowed_actions: string[];
}

export function normalizeEnvelope(value: Envelope): Envelope {
  return {
    allowed_actions: [...new Set(value.allowed_actions)].sort(),
    autonomy_level: value.autonomy_level,
    egress: [...new Set(value.egress)].sort(),
    expires_at: new Date(value.expires_at).toISOString(),
    run_id: value.run_id,
    worktree_realpath: realpathSync.native(value.worktree_realpath),
  };
}

export function envelopeHash(value: Envelope): string {
  return createHash('sha256').update(JSON.stringify(normalizeEnvelope(value))).digest('hex');
}
