# Native recovery UI — prepared QA scenarios, not executed

Owner: independent QA executor. Product maker: reuse_transport. Two proof attempts maximum; runs require root review and an explicit source-freeze/run signal. No product edits, build, actual native helper, model/checker executor, AppContainer, provider/network calls, prior proof rerun or historical cleanup are included.

Done is a reviewed proof script plus actual Electron observations, direct PNG inspection, source pre/post hashes, isolated SQLite counts/unchanged ownership evidence and an owned-process/root cleanup receipt. A prepared plan or synthetic observation does not complete actual native recovery qualification.

## Known API boundary

The current preload method is `cue.nativeRecovery(command)` on the exact `cue:native-recovery` channel. Commands are `{operation:'list',runId}` and `{operation:'observe',runId,attemptId,identityRef}`. Core methods are `listNativeIdentities` and `observeNativeRecovery`; the protected test factory is `nativeRecoveryFactory`. The response is an available/value projection or bounded unavailable reason. Maker selectors and final DTO must be confirmed before writing the runnable proof.

Use the real shipped renderer/preload/IPC/core with an isolated owned SQLite database and a synthetic `nativeRecoveryFactory`. This factory returns fixture-labeled process/path states and never invokes `createNativeRecoveryObserver`. Keep a strict counter for list, observe, helper/executor/provider attempts. Create ordinary unexecuted prepared runs A and B only when needed for current-run UI context; those are explicitly fixture setup writes, not executions. Use no real identity/profiles from historical ledgers.

## Scenarios

1. Initial unavailable and empty state: no current run means no automatic observation. Preparing A may list that run's records, but observe count remains zero until an explicit click. Check selected-run identity/attempt labels and any truncation indication.
2. One explicit observation: choose A's synthetic identity and click once; assert exactly one observe request with the three bound identifiers. Render `matching-alive`, `matching-exited`, `pid-reused`, `absent`, `unknown`, `present`/`absent`/`unknown` paths and the recorded timestamp across bounded fixture responses. Fixture source and observation-only limitations stay visible; none imply cleanup acceptance or execution permission.
3. Observation time is immutable in the returned record: wait or refresh the list without clicking observe, and verify no new observation request or fabricated fresh timestamp. Timing fields omitted by IPC are not claimed as measured UI data.
4. Error/unavailable: a host rejection or bounded unavailable response clears stale observation content, leaves a readable error and makes no alternate native/helper call. Unknown remains unknown rather than absence.
5. A-to-B race: hold a real IPC delivery of A's fixture result, prepare B and select its record, deliver B, then release A. A must not appear under B or overwrite B's timestamp/status. Switching the task template while A is pending must likewise invalidate stale content if the maker's UI contract supports that reset.
6. Projection/escaping: inject sentinel raw PID, FileTime, host path, subject digest, timing and secret-like extras into the fixture host's full DTO. Verify that the real IPC projection exposes only its approved keys. Malformed identifiers are rejected, and markup-shaped state strings never become DOM elements. Long valid candidate/attempt IDs wrap or scroll without hiding the observe control.
7. Stop ownership regression: capture the real prepared run's ownership and SQLite counts before and after observations; they must be unchanged. For active-control display only, a clearly labeled host completion double may hold an existing synthetic run as unresolved. While observe is pending or returns unknown/reused/absent, its Stop control and captured run ID must remain available and no terminal ownership may be inferred. Mock Stop/execute responses are UI fixtures, never real execution. Final exact fixture contract awaits the maker.

## Evidence and finalization

Use a fresh Electron profile and isolated worktree under an owned temporary root. Launch with `windowsHide:false`, then use `showInactive`, two animation frames and CDP screenshots as in the successful retrospective/inventory proofs. Record available/unknown/error states in separate PNGs and inspect them directly. A fixture launcher is not the actual package startup proof.

Hash the selected core/host/IPC/preload/renderer and proof files before/after the run; no shared build during QA. Record zero actual sessions/orchestration attempts/provider/executor/helper calls, while separately reporting intentionally created prepared run/task counts. Save a consistent SQLite archive if required for the ownership proof. Preserve earlier failed attempts; exclusive attempt markers prevent overwriting. Close only the owned window/core, verify child exit, validate the exact owned root before removal, and preserve unknown state rather than deleting unrelated paths. Final evidence writes must survive individual cleanup/manifest failures and never claim PASS before finalization succeeds.

Current status: API pre-read and scenarios only. No proof execution, native query or screenshot has occurred in this unit.
