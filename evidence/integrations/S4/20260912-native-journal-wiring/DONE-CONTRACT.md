# Native journal wiring done contract

Done means migration 038 is append-only and registered; trusted host preapproval persists the native root identity and exact targets; production capture and observation use only the reviewed native snapshot host; the real orchestration driver captures inside the prelaunch transaction and observes before terminal advancement; and focused tests prove rollback, replay, replacement, legacy, no-fallback, successful ordering, and unknown-observation blocking.

Correction cap: 3 diagnosed corrections. Each failed pass must produce a new hypothesis before another edit. A regression is reverted unless the measured gate improves.

Every pass runs:

```powershell
npx --no-install vitest run test/integration-change-records-native.test.ts test/integration-change-records.test.ts test/integration-driver.test.ts test/integration-held-recovery.test.ts test/integration-verification.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npm run build
git diff --check -- migrations/038_s4_native_change_journal.sql src/change-snapshot-host.ts src/change-records.ts scripts/copy-assets.mjs ../app/orchestration-driver.mjs test/integration-change-records-native.test.ts test/integration-change-records.test.ts test/integration-driver.test.ts
```

The final evidence records command outputs, changed-file SHA-256 hashes, and known limits. Restore/CAS and direct SQL verification `pass` remain disabled. No paid/model/provider/native executor sandbox calls are permitted; read-only helper calls against temporary directories are allowed.
