# Generated host checker-policy contract receipt

Date: 2026-09-12

## Diagnosis and correction

The generated acceptance checker exposed its executable checker implementation without the evidence-policy array required by the strict requirement snapshot. The driver therefore rejected `runs shared-ledger` with `invalid_requirements:array` before execution.

The generated host now supplies a frozen checker descriptor in each prepared configuration. Its single policy is derived from the exact requirement, producer task, input SHA-256, target, parameters digest, and pin-derived checker revision. The driver uses that configuration's bounded descriptor set only while validating and atomically binding that run. It retains the existing registered-checker fallback for other hosts.

Acceptance collection independently rebuilds the policy from the persisted generated-output target and compares every normalized field. A caller policy string cannot substitute for the stored input/target/pin lineage. Requirement validation, independent checker identity, `pass_disabled`, quarantine, and acceptance verdict behavior remain strict.

## Gates

- Initial reproduction: `runs shared-ledger` failed with `invalid_requirements:array`.
- Original test plus two-run isolation/reopen test: 2/2 PASS.
- Full `integration-generated-json-host.test.ts`: 16/16 PASS.
- `integration-generated-acceptance-host.test.ts`, `integration-requirements.test.ts`, and `integration-driver.test.ts`: 53/53 PASS.
- Final post-schema-bound check, full generated host plus driver: 52/52 PASS.
- `npm --prefix daemon run build`: PASS, including TypeScript compilation.
- Scoped `git diff --check`: PASS.

The two-run test uses distinct input bytes, verifies different parameters/source revisions, verifies each persisted checker contains only its own policy, and closes/reopens the file-backed ledger before reading the first binding again.

## SHA-256 freeze

```text
36B0621E489BD89EA8EF666D2A488B624A5A18F631ACD3D3243C276E4A091D31  app/generated-json-host.mjs
592306B40369E8386C0493A4BC25906B0DC208B94BDE92A53C2390A13B8CAE0C  app/orchestration-driver.mjs
827D295C1D7D876D9673689151762B8D0F6796B5B5F8A5190A61405A323FB53D  app/orchestration-driver.d.mts
C7FDD3F509630C5CD39ACA7A0D1CA31C5AB072A866506E14EDB87CD36CE11BFC  daemon/src/verification/generated-acceptance-host.ts
940EEC7CF4AE33ED31FA882A2F8FE405E931ACE778063E81E8E638964BD38A64  daemon/test/integration-generated-json-host.test.ts
D6988F399DCF3CD8C943524C56B95C2A27D4FACDAF3F8FAA1627D8DD3526C542  daemon/test/integration-generated-acceptance-host.test.ts
```
