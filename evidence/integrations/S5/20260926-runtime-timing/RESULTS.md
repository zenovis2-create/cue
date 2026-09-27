# Host-local runtime timing — 2026-09-26

## Scope

Continue the remaining measurement work offline with a narrowly bounded timing producer. No provider/model requests, inference, checkpoint downloads, credential-account access, commit or publication. Native fixtures use copied Node executables and synthetic credential placeholders, not real provider credentials.

## Changes

- `daemon/src/host-codex-runtime.ts`: monotonic entry → execution/verification → local teardown settlement observation. Failed cleanup retains duration and `localTeardownStatus:errors`; successful teardown procedure does not assert independently verified cleanup.
- Private WeakMap issuance and matching run/session binding; copies, proxies, wrong bindings and caller timing properties cannot produce observations.
- `daemon/src/adapters/integration-executors.ts`: project only issued observations into the existing progress activity sink; retain existing bounded asynchronous activity draining and failure behavior.
- Native fixture tests cover accepted/rejected timing sinks, immutable observation, positive phase arithmetic, cleanup failure, privacy and forged observation refusal.
- Contract: `docs/integration/HOST_RUNTIME_TIMING.md`.

Preexisting dirty files were copied to `preimages/` before edits. `change.patch` is relative to those preimages, not the repository base. Earlier unrelated lifecycle/containment changes are preserved.

## Validation

- `build.log`: initial build exit 0.
- `focused.log`: initial 6 files / 34 tests passed.
- `build-final.log`: final build exit 0.
- `focused-final.log`: final **8 files / 65 tests passed**, exit 0, 128.37 seconds. Includes Windows native synthetic app-server runs, runtime receipts, common runtime contract, handoff activity and controller tests.
- Targeted `git diff --check`: exit 0 (Git printed CRLF normalization warnings).

The rejected-sink native case retains the raw successful runtime result/receipt but correctly returns failed adapter completion. The cleanup-failure case preserves the unsafe credential fixture and reports timing with teardown errors; the observation does not turn cleanup failure into success.

## Limits / open gates

- This is runtime-entry through **local teardown procedure settlement**, not queue-through-final-cleanup completion time. It excludes post-teardown evidence issuance and activity persistence as well as queue time, remote cleanup and final billing.
- `queueIncluded:false`, `remoteCleanupVerified:false`, `endToEndVerified:false` are unconditional. Missing observations are unknown, not zero. Synchronous prelaunch failures and host process death do not produce settled observations.
- No new measured fact/trial or default `measuredFactHost`; no quality/improvement, actual model input consumption or provider qualification claims.
- Projection uses the established activity path. Native timing tests capture that sink; they do not claim a new independent, durable timing-receipt protocol or full default-app acceptance test.
- No current-source full root regression was run in this slice. Earlier historical passes and the later timeout/lifecycle failure remain distinct from these focused passes.
- No live-provider, user-acceptance or original checklist gate is closed by these local fixtures.
