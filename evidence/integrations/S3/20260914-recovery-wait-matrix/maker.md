# Recovery wait matrix maker record

## Outcome

The existing public recovery wait-response integration test is now table-driven across explicit `retry`, `switch`, and `replan` recovery. Each case proves the run transitions from blocked to running, the failed attempt remains clean, the replacement has a distinct persisted identity and durable reference, and only that replacement receives the exact response bytes once. Replay and a recreated driver observe the prior delivery without resending, and the failed identity cannot register a wait request.

The switch case pins `agent-b`. The replan case pins revision 1 and proves both the staged replacement and persisted plan revision use the recovery result's plan digest. The original `time + 1000` deadline remains unchanged.

## Revisions and executions

- Implementation revisions: 2 of 2 allowed.
- Revision 1: converted the existing retry-only test into retry/switch/replan cases.
- Revision 1 build: exit 0.
- Revision 1 Vitest: three observed matrix failures at initial delivery; the tool session detached at its 30-second boundary before terminal output, so the preserved first-call log has `exit_code: RUNNING` and no defensible final total. No terminal receipt was recoverable after the cell ended.
- Revision 2 hypothesis: `running` persisted before the active runtime handle was published. Restored the original one-event-loop readiness yield after asserting blocked to running.
- Revision 2 build: exit 0.
- Revision 2 Vitest: exit 0; 4 files passed, 78 tests passed.
- Gate executions: 2 build invocations and 2 four-file Vitest invocations. No targeted diagnostic test executions.

## Scope

- Changed production files: none.
- Changed test files: `daemon/test/integration-driver.test.ts` only.
- Test diff against the captured content preimage: 20 additions, 15 deletions.
- Excluded: queued-old carry-over, live process reconnect, model/server/network/native/live Electron, commits, and pushes.

## Evidence limitation

The preimage artifact contains the complete source text but is LF-normalized by `apply_patch`; its artifact hash therefore differs from the original working-tree byte hash. The original pre-edit byte hash and the normalized artifact hash are both pinned in `final-pins.json`.
