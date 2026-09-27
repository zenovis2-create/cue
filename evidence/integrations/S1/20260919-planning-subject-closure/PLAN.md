# Planning subject closure plan

Exact pre-edit copies of both subject sources and both dedicated tests are in this directory as `*.pre.ts`; SHA256 values are recorded in PREIMAGE.sha256 below. Preserve these copies unchanged.

Done gate: root-owned `npm run build` exits 0 and targeted `npx vitest run test/native-provider-measurement-subject.test.ts test/integration-model-measurement-subject.test.ts --reporter=dot --maxWorkers=1` exits 0. Missing required production planning artifact must reject measurement, and change in an included planning authority artifact must change subject digest and reject old capability evidence. Attempt cap: 2. Each pass checks concrete file existence, test output, and build status. On failure, diagnose a different concrete cause for a second attempt, then hand to root. Root builds; this worker never launches providers, Qwen, accounts, or network calls.

Fixed list will follow import-map confirmation with native composition and Claude contract workers. Model subject already hashes all source, compiled, migrations, and app trees, but explicit required paths may need additions for fail-closed absence. Native subject uses a fixed list and needs explicit direct planning authority modules. Do not claim recursive transitive closure.
