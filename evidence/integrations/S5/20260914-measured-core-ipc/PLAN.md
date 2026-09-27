# Measured Core IPC maker plan

- Done: `npm run build` exits 0, then the exact three-file Vitest gate exits 0 with Core 8, measured UI 8, UI 12 (28 total); raw logs, exit codes, complete modified-file preimage, hashes, and maker notes are retained.
- Attempt cap: 2.
- Every pass: run the daemon build, then `npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-ui.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`.
- Failure: retry once only with a new evidence-based hypothesis; after cap, stop source edits and hand off.
- Scope: only `daemon/test/integration-evaluation-measured-fact-evidence-core.test.ts` and this maker evidence directory. No product edits.

Original test SHA-256: `4A52C9085E96D6694AE1EF1A222D352EB7EDCFC50A2962734796469B38733D53`.
