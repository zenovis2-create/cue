# Independent checker coverage plan

Done means the two checker-owned regression files prove:

- an otherwise valid real-worker/SQLite fixture reaches the existing succeeded outcome and records exactly one identity and cleanup row;
- valid captured diagnostics remain informational, while missing, malformed, duplicate, or foreign diagnostics become unknown without changing that successful authority result;
- valid diagnostics cannot promote bad exit, missing PID, bad cleanup, or control drift;
- UInt64 zero/max, exactly 64 events, exactly 4096 decoded App ID bytes, and the 512 KiB JSON / 1 MiB stdout rejection bounds are executable.

Attempt cap: 2.

Every pass runs from `daemon`:

`npm exec vitest run -- test/readonly-wfp-diagnostic.test.ts test/integration-readonly-wfp-bootstrap.test.ts test/readonly-wfp-diagnostic-boundaries.test.ts test/integration-readonly-wfp-diagnostic-authority.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

On failure, make one test-only correction based on a new concrete hypothesis. Product source and maker-owned tests remain frozen.
