# Native journal open unit contract

Done means the real Windows helper passes regular, absent, byte-limit, junction/reparse, hard-link, sparse, root-identity substitution, ancestor-swap, and same-handle stability tests; the TypeScript host passes fixed executable/hash, protocol, timeout, and output-bound tests; TypeScript typecheck and scoped diff whitespace checks pass.

Correction cap: 3 hypotheses. Every pass runs:

```powershell
& 'C:\Program Files\Go\bin\go.exe' test ./...
npx --no-install vitest run test/integration-change-records-native.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
git diff --check -- daemon/native/change-snapshot daemon/src/change-snapshot-host.ts daemon/test/integration-change-records-native.test.ts evidence/integrations/S4/20260912-native-journal-open
```

On failure, retry only with a new measured hypothesis. A worse gate is reverted; after three unsuccessful corrections, hand the concrete blocker to the root coordinator. This unit is read-only and disconnected: no restore, CAS, journal, build/copy-assets, provider, model, credential, profile, or system-setting changes.
