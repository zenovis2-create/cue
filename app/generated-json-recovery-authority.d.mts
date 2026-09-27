import type { Ledger } from '../daemon/src/ledger.js';
import type { RecoveryPolicyHost } from '../daemon/src/orchestration/recovery-policy.js';

export function createGeneratedJsonRecoveryAuthority(input: { db: Ledger; now(): number }):
  Readonly<Pick<RecoveryPolicyHost, 'observeFailure' | 'readObservation' | 'observeCandidate'>>;
