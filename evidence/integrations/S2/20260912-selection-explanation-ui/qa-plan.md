# Selection explanation: actual Electron proof preparation

Status: Concrete `electron-proof.mjs`, `scenarios.mjs` and `stored-fixture.mjs` prepared; syntax checks pass. No invocation authorized or performed. This is a separate unit from the completed recovery UI proof. Product maker: reuse_transport. QA ownership: this evidence directory only.

Done: one explicitly authorized frozen-source run of the forthcoming `electron-proof.mjs --run`, actual visible Electron PNGs directly inspected, exact source/compiled/proof/Node hashes before and after, real SQLite decision-to-core-to-renderer assertions, consistent SQLite backup/integrity/hash, runner exit 0 and exact owned process/profile cleanup. Maximum two proof attempts; exclusive attempt markers, no automatic retry. Each pass runs `node --check` before a separately reviewed actual run. A failed run preserves receipts and requires a new diagnosed hypothesis and root signal. Maker and independent checker remain separate.

## Primary path: stored historical decisions

Reuse the bounded denied-runtime fixture in `daemon/test/integration-selection-explanation.test.ts`, using compiled engine/store/policy/budget APIs over `core.daemon.db`. Start from real `core.prepareGoal` records in an isolated workspace. Bind immutable local policy before attempts, install a validated two-stage plan, initialize the local count budget, then call the compiled local engine directly with a synthetic host. Its runtime `start` returns `{ok:false, reason:'fixture-denied'}` without invoking an adapter. This persists one real historical selection and leaves the dependent verifier not started. There is no fabricated admission proof, external approval, actual executor, model or helper.

Obtain the result using actual `core.completion(taskId)`, which imports the compiled orchestration projection. Render the exact response obtained through real preload/IPC completion. Assert the stored decision reference/digest, selected producer, local kind and `ranking:'not-performed'` agree with the displayed explanation; dependent verifier says not started. Repeated completion reads and renderer refreshes must leave SQLite total_changes and decision bytes unchanged. Acceptance remains unverified and unknown cleanup is not upgraded.

A second real prepared run uses the existing monetary fixture with explicitly synthetic `TEST` currency and estimates. The compiled engine persists a ranked choice and an excluded unknown-estimate candidate while the synthetic runtime again denies start. Display the stored reason and exclusion, not invented actual quality/performance. No prices or quality claims are inferred from these fixture estimates.

## UI observations

- `.selection-explanation` inside `#orchestration-stages` and `#orchestration-attempts`: open local details, capture visible fixed-pair/no-ranking explanation and historical-only disclaimer.
- Poll the same real completion again: open details remain expanded; stored stage and attempt records agree.
- Render monetary completion: historical policy comparison and unknown-estimate exclusion appear; raw estimate/source/path sentinels do not.
- Separate explicitly labeled renderer fixtures cover legacy-not-recorded, invalid, and more than 50 assessments with truncation disclosure. These are not represented as persisted engine results. Hostile IDs/reasons remain absent or generic text; no DOM images or executable markup.
- A labeled completion display double may establish Stop ownership UI state. Rendering selection details must preserve pending run/task identity, Stop visibility/enabled state, and original database ownership. No approve/execute/Stop IPC invocation is permitted. This is display ownership coverage, not a live stop test.
- Legacy card with no orchestration hides the panel. Preparation of another run and later old rendering will only be tested through an actual supported asynchronous boundary; do not invent a stale-run guarantee from directly calling `renderCard`.

## Isolation and evidence

Before Electron readiness bind both userData and sessionData using `app/electron-profile.mjs`; assert exact owned paths afterward. Use a visible `showInactive` BrowserWindow, actual preload and strict main-frame IPC sender predicate, two animation frames and CDP capture. Scrub NODE_OPTIONS/ELECTRON_RUN_AS_NODE case-insensitively. Deny non-file network and replace fetch with a throwing counter. No native recovery factory/default helper, actual adapter or provider is instantiated. The only runtime calls are counted synthetic denials.

Selected manifest includes core/IPC/preload/profile helper/renderer, engine and lifecycle, orchestration store/plan, local and monetary policy and budget, decision store, projection, ledger and their compiled counterparts, migration025, proof and Node executable. It proves only selected bytes remained stable, not complete installed-generation provenance or absence of write/revert.

Save original immutable decision rows, sanitized completion DTOs, DOM assertion receipt, screenshots and hashes, call counters, database row counts and before/after total_changes. Clearly label intentional prepared task/run/plan/budget/attempt/selection writes separately from zero native session/identity/provider/helper calls. Back up the database with VACUUM INTO before close, verify integrity and hash independently in the parent, then remove only the verified owned temporary root after child close. Persist aggregate final verdict combining child result, process exit, backup, manifests and actual ENOENT absence. Catch finalization steps independently; unknown state preserves the owned root.

Next: obtain final maker selector contract, write proof, run syntax-only check, submit proof hash for root preflight, then await explicit source/build freeze and execution signal. No package startup, old proof rerun, build, model or native call is part of preparation.
