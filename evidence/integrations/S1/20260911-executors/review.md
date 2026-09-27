# S1 concrete executors — independent review

Date: 2026-09-11
Reviewer: native agent `transport_review`; implementation by `reuse_cli`.
Verdict: **PASS for the executor adapter components**. No blocking defect found within the host-owned contract. This is not real Codex execution, provider qualification, or complete orchestrator acceptance evidence.

## Independent verification

Working directory `C:/Users/User/cue/daemon`:

```text
npm run build
exit 0
npx vitest run test/integration-executors.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
7 pass, 1 file pass, exit 0
```

Codex delegation uses an injected backend fixture; local-model tests use an actual ephemeral loopback HTTP server serving controlled SSE. No paid or actual model calls were made by the reviewer.

| Inspected file | SHA-256 |
| --- | --- |
| `daemon/src/adapters/integration-executors.ts` | `DB7D391166403987F6B80E1EC3902A0B58B90CAE9ACE611A4649053D4F580A84` |
| `daemon/test/integration-executors.test.ts` | `869479EAD7B56310341EDD3C6BE23B23F883B150208541AC5C54D3AE5179AD52` |
| `daemon/src/adapters/local-model.ts` | `ADEC850A783E94708946E1570BC653F1992977F97EC869CBC413FECE3BEE6A8F` |

## Code-review findings

- Codex defaults to the existing `launchHostCodexRun` implementation, preserving its owner/envelope/options argument contract and ordered teardown through the original backend. Binary/model are pinned by the host factory. Owner/envelope run IDs and workspace must match the runtime context before launch.
- Backend `done`, raw result and owned control object remain available to trusted host cleanup/receipt observation. Adapter completion is succeeded only for completed status, no failure kind, passed goal verification and no cancellation. Partial-start exceptions propagate to the common runtime's unknown-cleanup handling.
- Abort and explicit cancellation latch the stop invocation, so repeated cancellation stops the backend only once. A stop call does not imply cleanup success; completion still follows backend result and host cleanup remains separate. Existing backend stop/teardown code was inspected and not changed by this adapter.
- The local executor is model-role-only and delegates to the existing text-only loopback transport. It snapshots request/binding, emits attempt/task/candidate/model lineage with increasing ordinals, and forwards frozen text/usage/terminal events.
- Event count, individual text size and callback wait time are bounded. Callback errors/timeouts, truncation and cancellation produce failed completion and abort the local stream. A successful textual terminal is not accepted as requirement completion.
- The local transport preserves `providerStopped:'unknown'`. Neither executor invents subject measurements, credentials, authorization, final billing or cleanup evidence. HostCandidate admission and current-subject validation are separate required integration steps.

## Limitations and integration obligations

The callbacks and binding resolvers are trusted host code. Fixture model/subject strings are not proof of eligibility or server identity. Actual canonical binary checks, current tool fingerprint, P13/model qualification, envelope authorization, budget reservation and cleanup observation must be supplied by the host before these functions are exposed as candidate launchers.

Callback timeout bounds how long the executor waits; JavaScript cannot stop arbitrary asynchronous callback side effects already started. The implementation now explicitly documents that host sinks must reject late writes using attempt identity/ordinal and lifecycle state. A timed-out callback must not subsequently promote a failed attempt or persist stale data as current output.

Cancellation proves only a requested backend/transport stop. Provider compute termination, filesystem/process residue, eventual billing and requirement acceptance need independent evidence. The raw Codex result can contain private diagnostics and remains host-only; it must not be forwarded to renderer/user logs without appropriate filtering.

No application source was edited by this reviewer; only this review artifact was written.
