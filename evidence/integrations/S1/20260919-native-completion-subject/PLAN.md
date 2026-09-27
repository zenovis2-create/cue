# Native completion subject plan

Before-edit SHA256:
- daemon/src/native-provider-measurement-subject.ts: F2433430593A6A599013C19C55489A493D454F1D7D44FDADBBF08066341FA0B5
- daemon/test/native-provider-measurement-subject.test.ts: CD37DC1E0509F5A4C572944078CE1F192320D64FDD2410E409D7B4F9D05B733A

Done gate: targeted `npx vitest run test/native-provider-measurement-subject.test.ts --reporter=dot --maxWorkers=1` exits 0 after root `npm run build` exits 0; every fixed completion artifact is required and representative simulated content drift changes subject digest. Attempt cap: 2. Each pass checks targeted test output and fixed path existence. On failure, identify a new cause and retry once; then hand the failure to root. No live source/compiled artifact bytes are mutated by tests.

Closure: native-existing-file-authorities calls process cleanup and stage binder; native-implementation-host calls native acceptance/checker; orchestration-driver calls stage binder, acceptance history, final publication. Include their direct completion record stores and four relevant ledger schemas. This is a fixed production path, not arbitrary repository discovery.
