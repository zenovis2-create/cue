# Independent S3 main-process driver/core review

Reviewer /root/contracts_review, 2026-09-11. Verdict PASS for the optional host-configured driver/core integration after parent corrections. No remaining blocking finding in this reviewed scope; no whole-goal completion or default live candidate qualification is claimed.

Done gate: current build/type checks, focused real SQLite/core assertions, scope/ownership review and exact source hashes. Artifact write cap 1 followed by readback/hash. Reviewer made no implementation edits, broad suite runs or live model/CLI calls.

Commands (cwd daemon):

- `npm run build`: exit 0.
- `npx --no-install vitest run test/integration-driver.test.ts test/integration-driver-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, 9 passed (8 driver + 1 core), duration 1.08 s.
- After the final declaration-only correction: `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- Scoped git diff --check: exit 0.

## Findings resolved by parent

1. Scope lookup originally selected the first cached workflow by plan.digest. Identical plan digests do not bind actual per-workflow grants, so a second workflow could borrow another workflow's scopes. New stage binders capture the exact workflow entry; the shared read-only binder cannot grant scopes. The two-workflow/same-digest/different-worktree regression now passes.
2. A fully rolled-back outer preparation left a cached entry that correctly rejected activation but also prevented clean close despite no execution. The driver now discards only unactivated/requestless/promiseless entries with no persisted plan or attempt. Rollback still rejects activation/launch and close now resolves. Entries that could own execution remain quarantined.
3. Core prepared-run map publication originally occurred before outer transaction commit. It now occurs only after the transaction returns successfully.
4. The declaration claimed approval stages included all PlanTask fields, although the DTO intentionally omits ownerId. It now exposes the exact six returned fields through Pick; final type check passes.

## Integration behavior verified

Policy snapshot, DAG and explicit budget are persisted before user approval, and the immutable summary exposes policy/plan identity and stage structure. Accepted parent approval is required before activation. Activation does not acquire the legacy parent writer lease; stage claims own their leases.

The actual engine, budget/store/runtime managers and stage binder execute in the driver fixture. Stage binding supplies a real child run/envelope/SessionOwner to candidate resolution. The driver starts stages serially and does not advance to verifier until the store reports completed from its host receipt checks. All graph tasks completed still blocks with acceptance_unverified; it never invents final requirement acceptance.

Repeated start shares the owned Promise and does not relaunch finished stages. Stop is synchronous at the API boundary, uses engine replay to cancel a pending start, and retains late execution ownership. Unknown cleanup prevents the next stage, preserves writer lease/reservation and makes close reject. No cancellation ACK or missing handle releases ownership.

Core optionally routes prepare/approve/execute/stop/close through the driver when runtime.orchestration is supplied. The core test uses missing capability evidence: the actual runtime denies launch, neither a concrete executor nor legacy Codex fallback is called, funds remain reserved and rejected close retains the ledger. Core caches close completion and does not release the daemon after driver cleanup failure.

## Limits and remaining goal work

Host configuration is trusted main-process input, not renderer/model-provided authority. Tests inject synthetic adapters and explicitly labeled fixture evidence; no default eligibility, real tool admission or production host configuration is established. Catalog observation is not capability proof. Actual process enforcement/cleanup remains in trusted runtime adapters and host receipt verifiers.

The driver is serial, has no retry/replan policy or final independent acceptance integration yet, and does not reconstruct its in-memory prepared/ownership state after process restart. Existing durable uncertainty must be reconciled separately without automatically resuming writes. This review does not cover renderer visual QA, full UI completion, live multi-model effectiveness, or all S0-S7 checklist gates. Old Codex pin investigation remained deferred as requested.

## Reviewed SHA-256

| Path | SHA-256 |
|---|---|
| app/core.mjs | 95EA6B4FFF1BDF3A0F1437D288BD52759CB5D112B2E4AED5F52ACE859A2921A8 |
| app/core.d.mts | B1BEED1F103243A13C521E6F59214A7B13527E500760B8243E387C935027612D |
| app/orchestration-driver.mjs | EBC42CE487A6087AFEDDC92FE9DF4F8F660B4E18AD5C7197535173FBD19A3244 |
| app/orchestration-driver.d.mts | 4660D31FA92478675226F8864A66E5037B2CCB5FD4A77201C7E132B5EE2419C2 |
| daemon/test/integration-driver.test.ts | 3006FC5BC863CE8A9B5E7B3950257735CB62EACB078A07DC6A89F6F1C37EA73D |
| daemon/test/integration-driver-core.test.ts | C9D78DEC30EED63184436E9D8E70AA5C01D4ACC1C1AE5E03FE248A80E3AFAA61 |

