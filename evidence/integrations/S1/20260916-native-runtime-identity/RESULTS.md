# Native runtime identity results

## Outcome

Host Codex runtime results now carry privately issued, exact-object evidence available only through `readIssuedNativeRuntimeEvidence(result, binding)`. The evidence binds workflow run, task, attempt, candidate, subject, session handle, role, verification mode, terminal inputs, exact controller/worker Windows FILETIME identities, and resource ownership/cleanup classification.

Controller and worker identities are captured while their launch trees remain owned. Native FILETIME observations of both launch root and target bracket the process-tree membership observation; changed/recycled/foreign identities fail closed. Session `start_time` and stdio text are never substituted for native identity.

The configured Codex home is explicitly classified. `retained-authorized` homes are retained and never passed to cleanup. Ephemeral worker runtime homes are recorded as owned and must be absent or remain unknown.

`codexExecutor` persists migration-050 receipts for `approved-existing-file-change` and `read-only-result` before completion can succeed. The binding is reconstructed from the ledger and exact execution/session context. Persistence failure yields failed completion. Generic legacy `workspace-change` execution returns no native receipt and retains its existing behavior.

## Final gates

- Coordinated `build-consumer`: exit 0.
- TypeScript no-emit from `daemon`: exit 0.
- Focused identity/receipt/executor/native runtime: 4 files, 20 tests passed, exit 0, 55.76s. See `focused-final.raw.log`.
- Native verifier/default controller/runtime regression: 5 files, 35 tests passed, exit 0, 138.77s. See `regression-final.raw.log`.
- No provider, model, or network calls were made.

The first focused final run exposed a receipt fixture missing real SQL lineage and one old options-shape expectation. The fixture now separates actual issued-result/consumer persistence from the migration's independently tested lineage trigger. The first regression run exposed two caller-minted verifier results that previously claimed success; both now correctly fail closed, while a real read-only launcher through the executor persists a successful authentic receipt.

## Scope and remaining limits

- Native evidence is available only for runtime launches with durable orchestration lineage and successful native identity observation.
- Existing-file implementation and read-only verifier modes require authentic receipt persistence for executor success.
- New-file creation remains unavailable.
- Provider-specific terminal confirmation, billing truth, and default protected startup authority remain separate gates.
- A retained authorized Codex profile is not cleanup proof and is never represented as an owned ephemeral resource.

Exact final hashes are recorded in `PINS.txt`.
