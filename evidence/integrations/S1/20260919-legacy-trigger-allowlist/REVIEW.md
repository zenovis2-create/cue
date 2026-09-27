# Independent review: legacy trigger allowlist

Verdict: no actionable blocker found in the scoped change. This is a source and targeted-test review, not a build or full-suite result.

The replacement now constructs the full historical 039/050 trigger definition from each current migration, removing only the stage-envelope join and reverting only the lineage comparison. It compares that exact text to `sqlite_master.sql` before dropping either trigger. Comment markers, a weakened body, a missing trigger, and other same-name rewrites therefore remain in place for the existing definition/count checks to reject. The accepted historical 039 and 050 variants upgrade in place. `openLedger` encloses migration work in an outer immediate transaction, so a later definition failure rolls back an attempted replacement; the catch also closes the database handle. The current fixture's 039 changed-body replacement targets `WHEN NOT EXISTS(`, which is present in the current trigger and changes its behavior. The 050 changed-body fixture also changes its `SELECT CASE WHEN NOT EXISTS(` condition. Neither is a no-op fixture.

Independent command from `daemon`: `npx vitest run test/readonly-verifier-migration.test.ts test/integration-native-runtime-migration.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`. Result: exit 0, 2 files and 13 tests passed. This invokes Vitest directly and does not run the `pretest` build. No provider, model, or service call was made.

SHA-256 at review:

| Artifact | Hash |
| --- | --- |
| `daemon/src/ledger.ts` | `1647E661A9384D6B19E4394718FAF34CC3C246042ECAF7A15E42339CAAAF2F24` |
| `daemon/test/readonly-verifier-migration.test.ts` | `10B51E630655D34F6C60958B14550851BF27EAE99C45B5A231FDCCCC98816310` |
| `daemon/test/integration-native-runtime-migration.test.ts` | `DE804FECC604BD3E52D70F2F2FA850E2CC910DADB1E759B6248663B91D97214C` |
| `preimages/ledger.ts` | `6BCFD886C760F508BE307FF78F23406620D406859D5B72D1D306C924A85376D0` |
| `preimages/readonly-verifier-migration.test.ts` | `AB851CBB1D0C0FBB6A91CA4DC4AD3DDD95E7FF09B22D1BD3D5BB95C597D3292F` |
| `preimages/integration-native-runtime-migration.test.ts` | `5EB475AD2F0BFE1DFF3F5C5C1A9C9790C4E7FADBC4671DCB90666670A1CA6B2C` |

Scope limit: exact-text compatibility is proven for the saved historical definitions and tested variants. A deployed legacy trigger whose SQL differs only in formatting would be refused, which is consistent with the exact historical allowlist. Build and broader suite are pending with the root agent.
