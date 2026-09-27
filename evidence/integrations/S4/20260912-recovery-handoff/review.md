# Independent review: recovery handoff authority

Date: 2026-09-12 KST  
Verdict: **PASS for the bounded offline handoff resolver and protected recovery wiring**

## Reviewed boundary

The generated JSON artifact resolver is factored into `generated-json-handoff-authority.mjs` and is shared by the normal generated JSON host and the protected native recovery host. It reconstructs bytes only from the existing ledger. It imports no qualification, settings, executor, network, or provider path.

For `generated-output`, the stored observation must belong to the exact artifact-owning attempt. For `verified-input`, the requested attempt must be the exact `verify-json` attempt and the source producer observation must be linked through its integrity-bound handoff member in the same run. Both paths retain `generatedOutputs.read(...)` as the canonical payload and byte-integrity check. The existing `readTerminalIntegrity(exactAttemptId)` then validates receipt, launch intent, durable identity, handoff payload and complete artifact manifest through that resolver.

The protected host constructs the terminal reader with the same extracted authorize/resolve authority. It checks terminal integrity before reconciliation and supplies the same check to the final transaction callback after asynchronous observation work. Missing authority, missing/corrupt/changed/wrong-attempt artifacts, or final drift remains held.

Handoff validity alone cannot advance the case. The protected host registers no external-effect observers or exhaustive external-effect authority, so reconciliation stays held and returns the finite `external-effect-authority-unavailable` reason. Exceptions and final-CAS drift use the generic reconciliation-unavailable path rather than being mislabeled as verified handoff corruption. No lease release, automatic disposition, resume, restore, cleanup, acceptance, process action, or execution was added.

## Runtime evidence versus source inspection

Runtime tests exercise the actual extracted resolver over a persisted `formatted-json` observation: exact-attempt bytes resolve, close/reopen remains valid, a wrong attempt fails, and tampered bytes fail closed. The generic terminal-integrity reader separately exercises a valid exact-attempt handoff plus missing, changed, unauthorized, wrong-attempt, and corrupt artifact cases across reopen.

The protected recovery-host registration and its pre/final-CAS `readTerminalIntegrity` calls are verified by source inspection and the existing protected-host held-only suite. There is no positive native-journal/generated-handoff production scenario: historical generated JSON stages are read-only and have no writer journal, fixture observations cannot establish native authority, and exhaustive external-effect coverage is unavailable. This review therefore makes no recovery-eligibility claim.

## Verification

- Independent targeted resolver/reader run: **2 files, 12/12 PASS**, 3.87 seconds.
- Maker protected recovery held-only matrix: **3 files, 17/17 PASS**, 79.12 seconds.
- Independent `npx --no-install tsc --noEmit`: PASS.
- Maker build: PASS.
- Scoped diff check: PASS; only the existing `app/main.mjs` LF-to-CRLF warning was emitted.

No model, provider, native executor, native process observation, kill, profile cleanup, credential, network, paid call, restore, or direct-SQL pass was used.

## Preserved limitation

The `integration-generated-json-host.test.ts` `runs shared-ledger` case fails before resolver assertions with `invalid_requirements:array`. The suspected location is its checker-requirements fixture, and rebuild does not change the result, but no before-change baseline was established. It remains an unresolved regression. This bounded PASS does not claim the broader generated-host integration regression is green or attribute that failure to earlier code.

## Frozen hashes

| File | SHA-256 |
|---|---|
| `app/generated-json-handoff-authority.mjs` | `F8AA5B0A41D9A3CA2AE28C00F84F08D970432E6857D0C2756FB28E83135462E7` |
| `app/generated-json-handoff-authority.d.mts` | `935F9CABA9EA903BE5F7B75152B8DDDE4CD74F22D10E8EC2743614401525E6AF` |
| `app/generated-json-host.mjs` | `5D0FE7308636B7D806859538E0F36E3FA769AF8941A1A44B23EE97C260612958` |
| `app/main.mjs` | `2AA8F4A2321C73AA97A66F499C8F589A1959F05B1893F295F4766FD8F5DF7FFF` |
| `app/native-recovery-host.mjs` | `6E93147740A181536348678074C95BFC0C073F2705F1BF1175525960CDF1E831` |
| `app/native-recovery-host.d.mts` | `6D50174E4A3D71735EFA68DFAFD2D61ACB51D6A797466F4EE903C15E76E6489A` |
| `daemon/src/held-recovery.ts` | `2DC47F5387432907714504EC3E9653CCC31D905BFF75A2F37E14AFE462D9F2E2` |
| `daemon/test/integration-recovery-handoff.test.ts` | `EE946B490C36470B10345C0A1DD12E5C45B24B7D6902BE6C44EF2B5A4D2820EF` |
| `daemon/test/integration-native-recovery-host.test.ts` | `160B60A75FC4F5E39B66389F7A217DCC438F883B8FD4064DDE5859F9686D72CA` |
| `daemon/test/integration-generated-output.test.ts` | `051B90EB415896B275B83252199C5DCF3913F894889FD8A8AC87E9747E09ED9C` |

This PASS does not prove exhaustive external-effect registration, disposition eligibility, native journal recovery for generated stages, a real provider/native executor, automatic recovery, or whole S4/S0-S7 completion.
