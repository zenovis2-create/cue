# S3 handoff/activity final correction contract

Date: 2026-09-12
Attempt: correction 2 of 2 (final cap)

## Exact remaining counterexamples

- Fresh migration 031 accepts a same-attempt handoff row whose relational columns appear valid while `payload` is `{}` and `payload_sha256` is an arbitrary 64-hex value. A later terminal transition/readiness check can treat row existence as authority without database-verifiable canonical payload or artifact membership.
- Generated checker selection accepts the latest generated observation when any producer handoff exists. It does not require the observation source reference, digest, and byte length to be the exact artifact member of that handoff, so missing, changed, duplicate, or colliding membership can feed the child.
- `createCodexExecutor` has zero production callers. Existing controller/runtime event code and tests do not prove the main/runtime/driver composition supplies the bounded durable sink for output/tool/usage/artifact/heartbeat/terminal and explicit unknown facts.
- Driver attempt identity hard-codes `durableRef:null`. It does not bind the active isolated session/native identity to the attempt/run/candidate, so restart or cross-attempt substitution cannot be excluded from handoff/completion/dependency authority.

## Final completion and stop gate

- Attempt cap is correction 2 of 2. There is no third mutation pass.
- Every kept pass must improve a direct hostile counterexample and then pass build, TypeScript, the expanded non-native focused suite, raw SQLite forged-payload rejection, generated child exact artifact-membership checks, production Codex composition/caller checks, durable-reference close/reopen and cross-attempt checks, migration source/dist byte parity, fresh/pre-031 close/reopen with empty `foreign_key_check`, and scoped whitespace/diff review.
- Preserve all original seven blockers and correction-1 hostile tests. Never replace relational or byte verification with row-existence checks, submitted labels, or inferred identifiers.
- On any unresolved final-cap failure, preserve the raw failure in `correction2.md`, leave both checklist sentences open, and request reviewer disposition. Do not claim actual OS lifecycle behavior.
- No real model, provider, native helper, Electron, network, or worktree execution is authorized.
