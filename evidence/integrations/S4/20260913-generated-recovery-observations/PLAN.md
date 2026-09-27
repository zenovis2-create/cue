# Generated recovery observations Unit A plan

Done means the focused generated-host, isolated-local-model, and handoff-activity tests pass against SQLite, `npm run build` exits 0, and source hashes plus limitations are recorded in `maker.md`.

Attempt cap: 2 implementation/test passes.

Every pass runs:

`npm exec vitest run -- test/integration-handoff-activity.test.ts test/integration-generated-json-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Correction before execution: the initially listed `integration-isolated-local-model.test.ts` is a real native-launch suite and is excluded from this offline unit. No native diagnostic suite was run.

Then run `npm run build` after the focused gate passes.

On failure, retry once with a new evidence-based hypothesis. If the second pass fails, stop and hand the exact failure to the human. Keep a change only when the measured gate improves; the independent checker remains separate.
