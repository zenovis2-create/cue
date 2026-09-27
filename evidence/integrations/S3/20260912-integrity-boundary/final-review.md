# S3 additive handoff integrity boundary — final independent review

Date: 2026-09-12 KST  
Verdict: **PASS — bounded local integrity and connected read path**

No blocking correctness, data-preservation, or regression defect was found in the frozen scope. The historical migration-031 correction-2 verdict remains **FINAL BLOCKED** at 2/2; this pass applies only to the new additive migration-033 mechanism and its connected reader path.

## Reviewed identity

Repository HEAD was `8e2afa6366e3af62f7115b2c67be799130f8dfdf`; the reviewed worktree is intentionally uncommitted and shared, so the following byte hashes are the operative revision:

- migration 031 source/dist: `0e13b1b4d9e9483a807bfcc8d34bdd51c5434f6c2eb2734bedf7ef6bf6336233`
- migration 032 source/dist: `d33b6ecb9498e4264de4fe35408634c871e224550786392d93bdf7667faefb67`
- migration 033 source/dist: `d2ada29d74c3c50e310002db7938d86c6c68163817513ab19571d24fc3e4e9b2`
- `daemon/src/ledger.ts`: `5a230186909c56d0f6109dbfd9a3ca84ac809f152f68dd27854624ae9a74d12a`
- `daemon/src/orchestration/handoff-activity.ts`: `57ea4f01e46e1880917bbf8f66cff386c1f5cc46eaf92e923479ff7b48036079`
- `daemon/src/orchestration/store.ts`: `48ecdbbc4b796b3893ce924a5375c81b9df6f31261ba8cd307108d24937df182`
- `daemon/src/ui/orchestration.ts`: `8e7f1ed7059f26f63258379d5c0de27fcc2f578bc55227a90831a3cc8153e593`
- `daemon/src/reports/ir.ts`: `b329acfc9c6a9a928c8503d7fe4f7d0427fff8c620fb2485679717aaa1228bd1`
- `app/orchestration-driver.mjs`: `999024b5bb9f6a74cccf5e93080c26a3a0f630ecc3fc75178d3fc501a9632022`
- `app/orchestration-driver.d.mts`: `7da4400c68949bd0b11a17a4b19f2e88e11c3cb86ac12cecbbc4da431f49d820`
- `app/core.mjs`: `1219c123df6304c251da81512866af15c3f1290d4b00e4e8d82f07829d4b7094`
- `app/core.d.mts`: `355222ece202595633c416b2e0f8da68b4bad6fdc2b3fe3fd764accfdbbcd65b`

The decisive test inputs were independently pinned as handoff activity `846aee58...a30af7`, handoff integrity `ec5be3e0...0e2e8`, driver `b119e1c2...3b14d`, driver/Core `6ff7f43b...8599d`, reports `6e61dc1d...ea50`, and report app `0e4819a2...5392`.

## Source findings

Migration 033 is ordered after unchanged 031/032 and is additive. On first application it copies every existing attempt into the immutable legacy fence before inserting the singleton marker. Reopen skips the already-installed migration transaction, preserving the closed membership set and avoiding needless writer contention. Existing attempt, handoff, artifact, state, and cleanup rows are retained. Current intent, identity, and handoff inserts require `cue_sha256`; a plain SQLite connection without the registered functions cannot create current authority.

The correction-1 implementation removes both defects recorded in the preliminary review: there is no global symbol slot and no exported tuple armer. `openLedger` starts with a deny-only terminal predicate. `commitTerminalState` requires an active transaction, rejects nested commits through private module state, runs the full host-backed validator, installs an exact one-shot callback only around the synchronous terminal update, and restores deny in `finally`. Validation failure, SQL update failure, a denied second store, and a reentrant second store cannot leave or borrow terminal authority. A later legitimate store on the same connection still completes normally.

Caller-owned structured inputs are descriptor checked and bounded before persistence. Artifact claims are deduplicated by canonical `sourceRef`, and host authorization plus resolved bytes, digest, and length are rechecked at preparation, commit, terminal transition, replay, and later reads. Receipt, identity, intent, session ownership, typed columns, canonical payloads, and complete ordered artifact membership are revalidated rather than inferred from row presence or a raw digest.

The connected read path is singular and fail closed:

```text
host resolver/authorizer
  -> validateTerminalOrThrow / readTerminalIntegrity
  -> orchestration finish + states/readiness
  -> driver snapshot.terminalIntegrity / readTerminalIntegrity
  -> Core completion and exportRunReport
  -> UI snapshot and report IR
```

Core supplies the active driver's reader to both UI and report reads. Direct UI/report callers without that reader project terminal records as blocked/integrity-unavailable with unknown cleanup. Persisted terminal state remains separately visible as audit truth. Driver snapshots expose the same per-attempt verdict and readiness uses it before advancing dependencies.

## Independent verification

From `daemon` on the frozen bytes:

- `npm run build`: PASS.
- Six decisive selectors covering callback reset/nesting/two-store behavior, positive public completion/replay/reopen, missing functions, wrong/hash-only artifacts, legacy upgrade, and clean connected driver completion: **6/6 PASS**.
- Combined handoff/integrity/orchestration/runtime/provider/driver/Core/UI/report regression: **12 files, 127/127 PASS**.
- `npx --no-install tsc -p tsconfig.json --noEmit --pretty false --incremental false`: exit 0.
- Standalone `independent connections atomically claim exactly once`: **1/1 PASS**.
- Scoped `git diff --check`: exit 0; only Git's existing LF-to-CRLF working-copy notices were emitted.
- Migration 031/032/033 source and deployed bytes match their pinned hashes.

The positive path used product public stores/driver APIs with local synthetic artifact bytes. It verified finish, exact replay, close/reopen with an equivalent trusted resolver, readiness, driver snapshot, UI, and report projection. The negative paths verified zero terminal authority for missing SQL primitives, a wrong payload hash, a hash-correct but unarmed artifact, host denial, callback failure, and legacy/corrupt upgrade. Upgrade checks retained row counts across two reopens and returned `PRAGMA integrity_check = ok` with an empty `foreign_key_check`.

## Evidence boundary

This pass verifies the bounded local database/application integrity contract and the source-to-reader integration on synthetic local fixtures. It does not claim whole-project completion, real provider/model behavior, native process identity, OS/database replacement resistance, Electron rendering, network behavior, billing cessation, or a live provider gate. No model, provider, native helper, Electron, network, paid, or external-system call was made during this review.
