# S3 handoff/activity correction 2 evidence

Date: 2026-09-12
Attempt: 2 of 2 (final correction cap)
Status: specified counterexamples resolved; independent final review required

## Resolved counterexamples

- Migration 031 now requires a non-null durable attempt identity and stores every handoff artifact in an immutable relational manifest. Its insert and terminal triggers bind the handoff schema/version, attempt, receipt revision/outcome, identity, cleanup, and every nonempty artifact member. The public store recomputes canonical payload bytes and SHA-256 and revalidates both canonical bytes and the relational manifest before terminal acceptance and replay.
- The direct same-attempt SQLite insert with payload bytes `{}` and payload SHA-256 `444...` is rejected with `handoff exact lineage required`; the attempt remains unable to enter `completed`. Missing, duplicate, collision, changed-byte, and resolver-mismatch artifact cases are rejected.
- Generated child selection joins the exact parent handoff artifact manifest to the generated-output observation by source reference, digest, and byte length. A changed manifest member makes the verified-input resolver return unavailable.
- The generated default host declares explicit `isolated-generated-v1` typed activity and `session-handle-v1` durable execution capabilities. It records the active session handle as `session:<handle>` and checks the handle's exact run ownership before exposing completion.
- The default Codex candidate composition factory constructs the production Codex executor wrapper, declares explicit `host-codex-controller-v1` and `session-handle-v1` capabilities, forwards bounded heartbeat/output/tool/artifact/usage/terminal facts, pins tool identity to the canonical host candidate, and exposes the backend session handle as its durable reference. Driver/runtime logic examines only these explicit capabilities and fails closed when either is absent.
- Terminal validation and dependency readiness revalidate the durable session handle against the orchestration attempt after close/reopen. Missing or changed ownership blocks terminal authority.

## Preserved failure evidence and correction path

- The first correction-2 narrow run produced 16 failures because generic driver fixtures had no durable reference. The contract was kept; fixtures were changed to create an owned session handle and return its exact durable reference.
- A later five-file correction suite passed 69/69 tests.
- The first pre-031 standalone probe incorrectly replayed raw migration files and failed while reapplying a migration-007 trigger before the migration-016 code upgrade had created `orchestration_attempt`. The next hypothesis used a copied pre-031 deployed `openLedger` with only migration 031 disabled, then upgraded the file through the current deployed `openLedger`; that exact product path passed.
- A first result-reporting script finished its database checks but Windows denied immediate temporary-directory removal, hiding the results. Database handles were then explicitly closed and the probe rerun without allowing cleanup to mask verification.
- A root-directory build/typecheck invocation failed because the root package has no build script or TypeScript dependency. The commands were moved to the actual `daemon` package and passed; this was a command-location error, not a retained code change.

## Measured gates

- `daemon: npm run build`: PASS.
- `daemon: npx tsc -p tsconfig.json --noEmit`: PASS.
- Expanded non-native focused suite: 10/10 files, 120/120 tests PASS in 19.17 seconds.
- Targeted raw SQLite forged-payload/atomic terminal probe: 1/1 PASS. The `{}` plus `444...` insert and following completed transition are rejected.
- Targeted missing/duplicate/mismatched artifact probe: 1/1 PASS.
- Generated production path covers output, usage, unsupported tool, artifact, terminal, exact producer membership, changed-membership denial, and two immutable handoffs.
- Codex composition test calls `createDefaultCodexCandidate`, verifies the explicit capability interface, launches its actual executor wrapper, and observes its durable session reference without starting Codex.
- Fresh file database: migration marker exact, `foreign_keys=1`, close/reopen marker exact, and `foreign_key_check=[]` before and after reopen.
- Pre-031 file upgrade: legacy running attempt remains running, exactly one `legacy-handoff-unavailable` membership is projected, marker exact, and `foreign_key_check=[]` before upgrade, after upgrade, and after reopen.
- Migration source/deployed parity: PASS, SHA-256 `0e13b1b4d9e9483a807bfcc8d34bdd51c5434f6c2eb2734bedf7ef6bf6336233`. Migration re-list confirms 031 is still the highest migration.
- Scoped `git diff --check`: PASS; only existing line-ending warnings were reported for the two Codex source files.

## Critical file hashes

- `daemon/migrations/031_orchestration_handoff_activity.sql`: `0e13b1b4d9e9483a807bfcc8d34bdd51c5434f6c2eb2734bedf7ef6bf6336233`
- `daemon/src/orchestration/handoff-activity.ts`: `3568b6669e6431db9d7820be43d2b408ac6864d583a71044fb33f51f98066af9`
- `daemon/src/orchestration/store.ts`: `2cf70305c0ca17b963b34634c082f407d7eedb3238b4200c9a3b4561be12eff9`
- `daemon/src/integration-runtime.ts`: `8b801d499d40b21565eef6e8f99b504d0d9e6bcedcc26a0f89249d76e0f48594`
- `daemon/src/adapters/integration-executors.ts`: `bb92f752add89464bbafc58bce3733c4b15a31a30e34e991decd6229b091733f`
- `daemon/src/host-codex-controller.ts`: `499387243a1d00d20550252c6bca7788542f2d2ae41666b31abdfc3eac5ffbff`
- `daemon/src/host-codex-runtime.ts`: `22d2217b119f8762b165c8afd7b853f24370b9518e10b7565785ead85364ecaf`
- `daemon/src/selection/attempt-decision-store.ts`: `1d25c998cffed550ada10fd144c2bb35b7ab3c036b478d0496f22a82245255e9`
- `app/generated-json-host.mjs`: `6a60ae612536bc9f7872599c997fced50a09624133eaa0d040c3290e4d4dc45a`
- `app/orchestration-driver.mjs`: `ff796ac9ae556d46187b399fdbda177254f36e7c0f57a97d02e0f8ed3b23cf38`
- `daemon/test/integration-handoff-activity.test.ts`: `ba43339f6b2024341cc40d0f68d2f1b6fadb723ce4ff61dca41dfdc640453233`
- `daemon/test/integration-generated-json-host.test.ts`: `65873a3da93066780806489c6f0d08cba615c44aa01bcb0f9940d66aa7293aa8`
- `daemon/test/integration-executors.test.ts`: `87d083f515fe47d3c542402350fd3d27d5f753363225adbecfb6bcc7622e7071`

## Limits and final review request

No model, provider, network, Electron, AppContainer, native helper, or worktree execution occurred. The Codex and generated-host tests exercise production composition and storage seams with synthetic backends; they do not prove actual OS lifecycle behavior. SQLite has no built-in trusted SHA-256 function, so migration 031 enforces canonical payload structure and exact relational manifest membership while the trusted public store recomputes payload and artifact digests. Legacy pre-031 rows remain explicitly unavailable and gain no execution authority.

This evidence does not close either S3 checklist sentence. It requests independent final review of all original seven blockers, the correction-1 hostile set, the direct raw SQLite forged-payload probe, exact generated-child manifest consumption, default Codex composition, durable-reference reopen behavior, and migration upgrade/parity.
