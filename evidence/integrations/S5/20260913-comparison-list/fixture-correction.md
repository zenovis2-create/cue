# Root test-only pagination correction contract

The maker stopped after two failed focused passes. Product code is frozen for this correction; root owns only `daemon/test/integration-evaluation-comparisons-core.test.ts` and this receipt. Independent checker remains separate.

Hypothesis: after inserting 65 intentionally invalid snapshots, the 64-ID scan must return an empty incomplete first page. The IPC positive must continue from the already observed scan cursor, and the foreign-workspace case must follow its first incomplete page before expecting completion. Neither expectation justifies weakening the scan limit or workspace filter.

Done: both focused evaluation UI/Core suites pass, daemon build exits 0, then independent review passes against final hashes. Cap: two test correction passes; each runs the exact focused command. Further failure requires a new hypothesis, with original maker failures preserved.

Command from daemon: `npm exec vitest run -- test/integration-evaluation-ui.test.ts test/integration-evaluation-comparisons-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`.

Correction pass 1 PASS: tool `8873ac` exits 0, 2 files / 10 tests. Both changes only follow the previously observed cursor; no product code changed. Root final daemon build succeeded separately.

Final corrected Core test SHA-256: `1AC6EE2F42215B7D2CCE96A046D0184324E124C067A2419F9BABFABE9777F3D5`.
