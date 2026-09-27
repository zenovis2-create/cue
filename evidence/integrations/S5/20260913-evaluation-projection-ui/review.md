# Independent evaluation projection bridge review

Done: independently verify the bounded stored-observation to comparison-record path across real SQLite Core, IPC projection, and renderer behavior; pass only if exact input, current-workspace lineage, immutable replay, `trial: null`, fixed descriptive UI language, hostile DTO rejection, stale/error clearing, and no policy/runtime/approval writes are evidenced. Attempt cap: 2. Every pass runs the focused three-file gate and verifies the eight final hashes; no duplicate build after the root-owned final build remains pinned and successful.

## Verdict

PASS. No blocking or advisory findings in the reviewed scope.

## Evidence

- Independent focused gate: `npx vitest run test/integration-evaluation-ui.test.ts test/integration-evaluation-projection-core.test.ts test/integration-evaluation-trials.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` from `daemon/` exited 0: 3 files, 16/16 tests, no unhandled errors.
- Root-owned final daemon build exited 0 (`25a5f0` receipt). It was not duplicated because the final source hashes remained unchanged.
- All eight entries in `final-pins.json` match the current files exactly.
- Scoped preimage comparison contains only the intended path: Core +10 lines; Core declaration +1; IPC +11/-1; IPC declaration +1/-1; HTML +2; renderer +16/-4; UI test +16/-4; one new Core test.

## Findings checked

- Core accepts exactly `{enrollmentId, observationId}`, rejects caller projection/cost/quality/trial fields, checks open/no outer transaction before preparing, binds enrollment and observation to the current workspace run, derives a stable SHA-256 host ID, and delegates the single write to the existing immutable projection store.
- Real SQLite coverage proves one row after replay and reopen, foreign-workspace denial through both Core and IPC, missing observation denial, pre-write rejection after stored observation tamper, and unchanged approval, policy-snapshot, and run row counts.
- IPC retains the prepared-run and current-enrollment match, validates exact commands without invoking accessors/proxies, bounds the reasons array to the fixed 12-value vocabulary, requires `trial === null`, and emits a reduced frozen DTO without run ID, digests, workspace path, cost, quality, or measurement fields.
- Renderer exposes an explicit manual button only after a stored observation. It clears projection output for a new enrollment, new observation, new run, stale reply, and error; keeps the control disabled while busy; maps every reason to fixed Korean text; and labels the result as a derived comparison record, a non-measurement, and ineligible for policy promotion.
- No schema, evaluation-store, comparison, measurement, metric, runtime, network, model, native, approval, or policy implementation changed in this unit.

## Final pins

```text
1B159C6C1F98327674994B8463D7D970742597534C52AB572F045F61D0F99865  app/core.mjs
FEDF29DFC94560DC4A93B0822026AE98C64240AABE715303343D89224435632A  app/core.d.mts
5887DA5E9E0F2D32380A4A77F643E40218EF8A5B4FFC4D904841051A01FACDE9  app/ipc.mjs
743E4A3C487D87462F9DE47D6F796B8D208C1BA010868F748C51C480D0EA42AE  app/ipc.d.mts
558B36C020D4D2E59221BA19625F51B5F06E6B06D3CB766A6BE3731DDFC4EFEF  app/renderer/index.html
284AC295481D21360B260D07C324141BC73A9BE145A0D5B064F576B96952081C  app/renderer/renderer.js
D64347440DA4F47F29909564A3B2A6B6B219F652340207CB525205F9AE0D4A57  daemon/test/integration-evaluation-ui.test.ts
C3F3F724F5AF9859DFEB9A758A3E8B3BACCBD61CCFA7B89559DAE6E334C07DE8  daemon/test/integration-evaluation-projection-core.test.ts
```
