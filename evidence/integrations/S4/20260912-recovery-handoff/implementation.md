# S4 recovery handoff implementation receipt

Date: 2026-09-12

## Result

- Extracted the generated JSON handoff resolver into a ledger-only authority shared by the normal generated JSON host and the protected native recovery host.
- Preserved exact-attempt semantics for `generated-output` and exact `verify-json` producer lineage for `verified-input`; artifact bytes still pass through `generatedOutputs.read` integrity validation.
- Recovery checks `readTerminalIntegrity` before reconciliation and again inside the final transaction callback.
- A verified handoff does not authorize disposition. With no exhaustive external-effect authority, reconciliation remains held and reports `external-effect-authority-unavailable`.
- Exceptions or final-CAS drift do not receive a false handoff-integrity reason. No automatic resume, restore, disposition, or lease release was added.

## Frozen gates

`npm --prefix daemon run build`

- PASS, exit 0. Runs `tsc -p tsconfig.json` and asset copy.

`npx --no-install vitest run test/integration-recovery-handoff.test.ts test/integration-held-recovery.test.ts test/integration-native-recovery-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1 --testTimeout=90000`

- PASS: 3 files, 17 tests, 79.12 s.

`npx --no-install vitest run test/integration-generated-output.test.ts test/integration-handoff-integrity.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

- PASS: 2 files, 12 tests, 4.06 s.
- Includes persisted generated-output resolution, close/reopen, wrong-attempt, tampered-byte, missing, unauthorized, and corrupt-hash cases.

Scoped `git diff --check` over the owned production, test, and evidence files:

- PASS, exit 0. Git emitted only its existing LF-to-CRLF warning for `app/main.mjs`.

## Preserved unresolved regression

The `integration-generated-json-host.test.ts` case `runs shared-ledger` fails before the new resolver assertions with `invalid_requirements:array` in requirement-contract validation. Rebuilding does not change that result. The failure appears to arise from the acceptance fixture's checker requirements, but no pre-change baseline run established that attribution. This bounded change does not weaken, remove, or claim a pass for that test.

## Scope limit

The positive persisted generated-output test proves the extracted offline resolver. Historical generated JSON stages are read-only and have no native writer journal, so this does not claim native journal recovery eligibility. Protected-host tests remain held because fixture observations cannot establish native authority and exhaustive external-effect coverage is unavailable.

## SHA-256 freeze

```text
F8AA5B0A41D9A3CA2AE28C00F84F08D970432E6857D0C2756FB28E83135462E7  app/generated-json-handoff-authority.mjs
935F9CABA9EA903BE5F7B75152B8DDDE4CD74F22D10E8EC2743614401525E6AF  app/generated-json-handoff-authority.d.mts
5D0FE7308636B7D806859538E0F36E3FA769AF8941A1A44B23EE97C260612958  app/generated-json-host.mjs
2AA8F4A2321C73AA97A66F499C8F589A1959F05B1893F295F4766FD8F5DF7FFF  app/main.mjs
6E93147740A181536348678074C95BFC0C073F2705F1BF1175525960CDF1E831  app/native-recovery-host.mjs
6D50174E4A3D71735EFA68DFAFD2D61ACB51D6A797466F4EE903C15E76E6489A  app/native-recovery-host.d.mts
2DC47F5387432907714504EC3E9653CCC31D905BFF75A2F37E14AFE462D9F2E2  daemon/src/held-recovery.ts
EE946B490C36470B10345C0A1DD12E5C45B24B7D6902BE6C44EF2B5A4D2820EF  daemon/test/integration-recovery-handoff.test.ts
160B60A75FC4F5E39B66389F7A217DCC438F883B8FD4064DDE5859F9686D72CA  daemon/test/integration-native-recovery-host.test.ts
051B90EB415896B275B83252199C5DCF3913F894889FD8A8AC87E9747E09ED9C  daemon/test/integration-generated-output.test.ts
```
