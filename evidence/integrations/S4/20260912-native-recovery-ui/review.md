# Recovery observation UI — independent review

Reviewer `/root/broker_review`, 2026-09-12 KST. PASS for source, IPC and DOM contracts; actual Electron visual QA remains separate. No product edits, build, helper/native/model invocation or proof-script execution by reviewer.

## Independent gate

```text
# cwd daemon
npx vitest run test/integration-native-recovery-ui.test.ts test/p11-electron-surface.test.ts test/p10c-renderer.test.ts test/integration-execution-ownership-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx tsc --noEmit
```

Exit 0: four files, 12 PASS; start 00:59:47 KST, duration 4.23 seconds. Typecheck exit 0. This reviewer selection checks the new six IPC/DOM cases, exact preload/channel surface, polling/Stop regression and retained execution ownership. Maker's different related-suite 16 PASS result is not being presented as an independently repeated gate.

## Verified scope

- One additive `cue:native-recovery` channel accepts exact list/observe own-data commands, bounded IDs/references and no extra arguments. The actual Electron registration continues to require the trusted-mainframe sender predicate. Accessors/proxies and mutation operations are rejected before backend use. Preload exposes the one fixed method; exact allowlist tests and the existing P11 proof expectation were updated.
- Responses are projected through explicit state/identity allowlists. PID, absolute path, raw FileTime, subject digest and arbitrary backend fields are omitted; backend failures become generic unavailability. Run/attempt/reference must match the request. Native versus fixture and observation-only authority remain visible.
- The renderer requests recovery data only after explicit clicks. It lists records for the currently prepared/displayed run and observes one selected record. Text is inserted inertly. States distinguish matching alive/exited, PID reuse, absence, unknown, path residue and provenance; timestamps are displayed with the warning that later state can change.
- Run changes clear old output and increment a generation. Old list/observe responses and record buttons cannot overwrite or act on a new run. Busy state belongs to this panel and does not alter execution state, ownership or Stop identity. Existing polling failure/Stop behavior and retained unresolved ownership tests pass.
- Empty lists, unavailable service and errors are explicit. The UI provides no cleanup approval, ownership release, restart, termination or acceptance action. There is no automatic recovery query.

No unresolved blocker found. This UI currently targets the prepared/displayed run; it does not implement a persistent historical-run picker or complete restart selection flow. JSDOM/IPC doubles are not evidence of actual Electron rendering or real OS observation. Narrow-window readability and actual Electron interactions remain the separately owned QA gate.

## Source binding

All eight entries in adjacent `hashes.json` independently matched after the test gate. Principal SHA-256 values:

| File | SHA-256 |
| --- | --- |
| app/ipc.mjs | FAE0A3BB60D6860CC918F3B959FF0741186365D43826A04335D9ED3E5A1A0947 |
| app/preload.cjs | AE7F785FCB07C3F848F1F2EC3FDFF4C18091A1AE02F6B097BE95CD4EA4CB6908 |
| app/renderer/renderer.js | 17273431B7588D47E65BB77738DE3347BCE518749C0C7D7986A61C99CBDE37FE |
| app/renderer/index.html | 0568E82816B79BFD692CB936689A11AC38671B24974994D10F9F9689322322D8 |
| daemon/test/integration-native-recovery-ui.test.ts | FA91C2281D9F090A08C2AF8D1A47469E59B61C6CA9CA2AFCB492504A196BC094 |

The earlier broad IPC/renderer checks and actual native observer proof retain their own snapshots and limits. No historical failed ledger or exhausted model allowance was reused.
