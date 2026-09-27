# Native boundary regression done contract

Done means `change-snapshot-host.ts` has no direct child-process import and preserves its fixed helper, timeout, input, output, hash, and read-only protocol through the approved sealed synchronous launcher; the guarded-entry synthetic installation contains exact source and compiled native helper assets required by the current identity closure; and focused architecture, native snapshot, journal, and guarded-entry tests pass.

Correction cap: 2 diagnosed corrections. Each pass runs the focused tests, TypeScript/build, and scoped diff check. A failed pass requires a new hypothesis; a regression is reverted unless the measured gate improves.

```powershell
npx --no-install vitest run test/p4.test.ts test/p45.test.ts test/integration-change-records-native.test.ts test/integration-native-journal-wiring-review.test.ts test/integration-guarded-entry.test.ts test/integration-installation-identity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npm run build
git diff --check -- src/change-snapshot-host.ts test/integration-guarded-entry.test.ts ../evidence/integrations/S4/20260912-regression-native-boundary
```

No provider/model calls, downloads, or production native executor sandbox calls are permitted. The focused native snapshot test may execute only the reviewed read-only helper against owned temporary directories.
