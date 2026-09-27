# Minimal production coding verifier plan

## Finding

The current native paths cannot safely implement the verifier directly. `launchAppContainerWorker` requires `command` and zero egress, seals the executable, owns the process tree, and cleans its profile, but `appcontainer-launch.ps1` grants the worker SID `(OI)(CI)M` on the worktree. A verifier launched there can modify evidence before reporting success. Omitting `file_change` from the stage envelope does not alter that ACL. The fixed JSON checker uses the stricter model-only supervisor and a private bounded carrier; it has no read view of a project and cannot execute an arbitrary project test. Copying an unbounded project into that carrier would create a second, incomplete workspace and would not verify the approved worktree.

The exact prerequisite is a read-only AppContainer worker mode. It must grant the worktree read/execute access only, keep its own runtime/profile/temp roots writable, deny network, seal the executable and every executable/script/config path used by the command, and prove ACL/profile/process cleanup. Until that primitive exists, a production code checker must remain unavailable.

## Unit A — read-only native command boundary

Owned production files:

- `daemon/src/worker-enforcement.ts`: add a distinct `read_only_verify` launch contract. Do not infer it from a missing `file_change` string. Require a verifier stage envelope containing `command`, empty egress, and no `file_change`; bind exact canonical cwd and inspected inputs.
- `daemon/src/appcontainer-launch.ps1`: accept a protected launcher-authored access mode and grant `(OI)(CI)RX` to the worktree for verification. Keep the existing modify grant byte-for-behavior for writer workers. Create a separate writable runtime directory outside the worktree, grant only that directory modify access, and remove both ACEs plus the profile on every terminal path.
- `daemon/src/worker-enforcement.ts` and `daemon/src/native-execution-identity-store.ts`: record a verifier boundary kind and exact session/PID/FileTime lineage without widening the current model identity role by assertion. A new versioned verifier identity shape is preferable to making the model-only schema ambiguous.
- Focused tests: `daemon/test/integration-readonly-worker.test.ts`; retain existing worker enforcement/profile cleanup tests.

Hostile gates: attempts to create, replace, delete, rename, chmod, or ACL-change a worktree file fail; loopback and external network fail; executable/script/config outside the sealed approved set fails; symlink/reparse/root replacement fails; timeout, abort, launcher failure, PID reuse, cleanup failure, and ledger-close-before-cleanup never yield a clean receipt. Existing writer behavior must remain unchanged. Tests use injected process/ACL fixtures; an optional Windows owned-temp real gate may run a fixed helper that reads one file, attempts one denied write and one denied socket, exits, then proves unchanged bytes/identity, zero residue, and exact cleanup. It runs no repository command, Codex, model, provider, Electron, or user credential path.

## Unit B — exact code acceptance checker

Add `daemon/src/verification/code-acceptance-host.ts` after Unit A passes. Its public preparation input is plain immutable data bounded before approval:

- requirement ID, implementation task ID, verifier task ID, target IDs and approved relative paths;
- canonical executable identity plus exact argv, cwd relative to the approved worktree, fixed environment key/value digest, timeout, expected exit code, and required hostile-check IDs;
- checker ID and revision derived from the hash-verified checker host module, read-only launcher/helper, and command executable/script/config pins;
- source revision derived from the approved plan/policy, root contract, target declarations, command parameters digest, and producer handoff digest.

The application host, not renderer/model/settings prose, creates this descriptor before approval. Configuration may reference a predefined command contract, but cannot provide `authenticated`, `eligible`, `passed`, cleanup, identity, or observation booleans. Avoid a generic command DSL: support one exact argv vector and exact environment map per registered checker contract, with bounded counts and bytes.

Before verifier launch, rederive from the same DB: selected plan revision; exact implementation attempt; verified terminal handoff and latest clean receipt; stage envelope; registered `change_root_contract`; declared target paths; current native root identity; and post-implementation target snapshots. The verifier receives read-only access. After execution, take a second native snapshot and require the target manifest and root identity to match the pre-verifier snapshot. A nonzero/timeout/violation, any target/root drift, unknown cleanup, missing native identity, or stale plan yields `unknown` or `fail` according to the registered policy, never pass.

The checker emits a `kind:'code'` `EvidenceObservation` only after exact result, identity, cleanup, handoff, target and policy revalidation. Its principal is the pinned native verifier identity and must differ from the implementation principal. `collect` never launches; the normal verifier stage owns the one launch and stores the protected result. `evaluate` accepts only an owned observation byte digest. Final acceptance reruns all durable integrity checks through existing `createAcceptanceVerifier` finalization.

Expected related files are `daemon/src/verification/evidence-policy.ts` only if a missing bounded field is proven, a new versioned code-target/command store plus migration, `app/default-code-checker-bootstrap.mjs` and declarations, and focused backend/host tests. Do not connect Core or the Codex bootstrap until the checker can construct a complete startable host.

Offline completion commands, refined to actual test names during implementation:

```text
cd daemon
npx --no-install vitest run test/integration-readonly-worker.test.ts test/worker-enforcement.test.ts test/integration-code-acceptance-host.test.ts test/integration-acceptance.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
npm run build
cd ..
git diff --check -- daemon/src daemon/test app
```

Required negative matrix: accessor/proxy/extra-key/oversize inputs; argv/env/order mutation; executable, helper or checker pin drift; missing/unapproved targets; root replacement/reparse; target mutation before/during/after the check; wrong run/task/attempt/revision/policy/handoff/receipt/session/candidate; same maker and verifier principal; fixture evidence; old result replay; close/reopen tamper; cleanup unknown/residual; command exit mismatch. Each produces acceptance zero, and pre-launch failures produce launch zero.

An optional real gate is limited to an owned temporary worktree and an owned deterministic fixture executable or script whose bytes are pinned in the gate. It exercises one verifier launch, read success, denied mutation/network attempts, target snapshots, native identity, exact cleanup, close/reopen acceptance, and residue zero. It is evidence for the boundary and checker composition only; it does not qualify Codex, a project test suite, P13, provider termination, billing, or arbitrary code correctness.

## Known blockers and later bridge

The source tree has no production generic code checker today; existing `kind:'code'` checkers are fixtures. The existing change journal snapshots only pre-approved writer targets, so the product must define which files constitute each coding requirement and which exact verification command is approved before execution. Many project test tools write caches or temp files under the project; such commands will fail in the read-only boundary unless configured to place all outputs in the verifier runtime root. That is a command-contract limitation, not a reason to grant worktree modify access.

After Units A and B pass, the protected Codex bootstrap can register `createDefaultCodexCandidate`, the new checker candidate, and a fixed implementation-to-verifier plan. Missing current binary/model/auth/P13 evidence or checker availability keeps that host unavailable. Local JSON startup and the legacy Core launcher remain unchanged until explicit per-run host routing is independently designed and tested.
