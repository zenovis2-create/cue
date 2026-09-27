# Unit 2 verification

Result: offline production authenticity seam implemented. This evidence does not claim a provider/account observation or close S4-05.

The deployment-supplied verifier is the semantic authority. A SHA-256 digest only proves that the bytes returned by that verifier match the authenticated verdict; the digest does not authenticate an external provider by itself.

Implemented checks:

- exact persisted v1 intent payload and columns validated before observer invocation and revalidated inside the final transaction after callbacks;
- strict copied callback snapshots reject proxies, accessors, cycles/shared references, malformed values, oversized detail payloads, stale/future timestamps, and non-final results; traversal-wide node and byte budgets apply before recursive allocation;
- observer and verifier callbacks each have a five-second bound;
- verifier verdict must echo the complete intent, observer identity/revision, status, time, account/resource, evidence reference/digest, provider revision, and finality;
- verifier evidence is rejected when proxied, shared, empty, oversized, or digest-mismatched, and is copied before use;
- canonical v2 observation persists the full intent and authenticated evidence/observer/verifier binding;
- historical unknown/conflicting observations still block reconciliation, while legacy v1 decisive observations cannot create a transition;
- cleanup, terminal handoff, local change-set, CAS, and no-auto-resume gates remain required.

No migration was added. The existing immutable observation payload BLOB and digest contain the v2 binding. The original top-level identity fields remain in v2 for compatibility with the existing SQLite identity trigger.

Verification from `daemon/`:

```text
npx --no-install vitest run test/integration-held-recovery.test.ts test/integration-native-recovery-host.test.ts test/integration-recovery-handoff.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Final pass after adding explicit observer/verifier timeout and compact shared-DAG cases: 3 files, 25 tests, duration 64.78 seconds.

```text
npx --no-install tsc --noEmit --pretty false --incremental false
```

Passed with exit code 0.

`git diff --check` over the owned production, test, and evidence paths passed with exit code 0.

Preimage and final SHA-256:

```text
daemon/src/held-recovery.ts
  1636C03619D8FDA330102D2394F720976E0FF93E33AD8A55A52B2420038EE58C
  0D141E47135A5F9700F5C5C5EA1C85D0DCE3B199AD73231435342DA1932E8D6A
app/native-recovery-host.mjs
  6E93147740A181536348678074C95BFC0C073F2705F1BF1175525960CDF1E831
  1FC933C35E5BB23EB0B89800AFF1C8948F41B6B7CCF915B6491492674B70CA37
app/native-recovery-host.d.mts
  6D50174E4A3D71735EFA68DFAFD2D61ACB51D6A797466F4EE903C15E76E6489A
  1D442A20FC2CC609DDFE8C65B39077158B695882A5EEB670B95855A89DFFFB9B
daemon/test/integration-held-recovery.test.ts
  350875C1F1B59C6CA4C1A382377F22301E90767D5A763D20DF2D01F05B60875C
  40B47424D6B07389B5AD53D27F73177FDE4AE3D2D38C0C29B383C73E6C28BC23
daemon/test/integration-native-recovery-host.test.ts
  160B60A75FC4F5E39B66389F7A217DCC438F883B8FD4064DDE5859F9686D72CA
  160B60A75FC4F5E39B66389F7A217DCC438F883B8FD4064DDE5859F9686D72CA
daemon/test/integration-recovery-handoff.test.ts
  EE946B490C36470B10345C0A1DD12E5C45B24B7D6902BE6C44EF2B5A4D2820EF
  87C51A0441E52CA489B406D8E9C4E24ED77B45812B04CA24CCB7B09849935B01
```
