# Unit A implementation receipt

## Result

The read-only verifier boundary source, migration, packaging, and focused fixture contracts are implemented. The single authorized native probe is **BLOCKED**: it failed at the host ACL preflight before the launcher ran. Accordingly, there is no actual Windows proof of worktree RX, runtime M, sibling or loopback denial, ACL restoration, profile cleanup, process closure, or durable identity/cleanup persistence. Unit A is not eligible for production registration from this evidence.

## Measured source and fixture gates

- Focused daemon migration, control, worker, and direct-process policy tests: 22 passed, 3 conditionally skipped.
- Probe contract tests: `node --test scripts/reuse/readonly-verifier-boundary-probe.test.mjs` — 5/5 passed.
- Probe runner and client syntax checks: exit 0.
- TypeScript: `npx --no-install tsc -p tsconfig.json --noEmit --pretty false` — exit 0.
- Root-coordinated current build receipt: `a29e77`, passed.
- Packaged migration and launcher bytes match their source SHA-256 values exactly.

These checks cover source and deterministic fixtures only. They do not substitute for the failed native probe and do not establish Core, bootstrap, code-acceptance, P13, model/provider, entitlement, or ordinary writer behavior.

## Frozen implementation hashes

| File | SHA-256 |
| --- | --- |
| `daemon/src/readonly-verifier-launch.ps1` | `16813F36A1DCBED9EAF4014A324EDCF72289693F5C8FC92A8F27512038A13774` |
| `daemon/src/readonly-verifier-worker.ts` | `36FA48C505211EE5D4CFFD1EF492A516C236C9DA57B9DB3F7560CCAF5982C86C` |
| `daemon/src/readonly-verifier-control.ts` | `A48E67966249A7CF26B242ECD3C524F46671133628EFD1E16A4C941DF3F680BA` |
| `daemon/src/readonly-verifier-identity-store.ts` | `B4DC8A2A490B7967744424101534A48C2CD4F011929E4A02C8C14D657F9ABFD9` |
| `daemon/migrations/039_readonly_verifier_identity.sql` | `7D95ADBF45FC1C1BFD4FB883B6A6685D37397C3701D90CBA1504EFD33A64D06B` |
| `daemon/src/ledger.ts` | `6C8A63E1095FB9DA88D4EA516B100442268B2FA9538C8018E71372069D02C895` |
| `daemon/scripts/copy-assets.mjs` | `6977FC447F9BA2B1399338488FF5AEE19DCF25E98455BDF37FD36A52BA342804` |
| `daemon/test/readonly-verifier-migration.test.ts` | `845239458E481B08E7D5403C4B81837C42F285034A2BA27D26465EECC5795023` |
| `daemon/test/readonly-verifier-control.test.ts` | `A8845106ADD026EAAC26F3DDB038FBE86D27B3A1174C006780EA0974CB281D0B` |
| `daemon/test/readonly-verifier-worker.test.ts` | `69A9ABB300A936B68741215088E511F3CC75243120728A8C4004F3197CFA0B43` |

Packaged parity:

- `daemon/dist/migrations/039_readonly_verifier_identity.sql`: `7D95ADBF45FC1C1BFD4FB883B6A6685D37397C3701D90CBA1504EFD33A64D06B`
- `daemon/dist/src/readonly-verifier-launch.ps1`: `16813F36A1DCBED9EAF4014A324EDCF72289693F5C8FC92A8F27512038A13774`

## Actual attempt

Attempt 1 is consumed and must not be retried. It retained `passed:false`, `error:"acl preflight failed"`, and diagnostic directories. Frozen control flow places the failure before the loopback listener, launcher payload, AppContainer creation, or worker start. The raw ACL child status and streams were not retained, so the ACL-preflight cause is unknown.

The independent review is `actual-review.md`, SHA-256 `61FDCA1360CDC1C659549FA3377AEF2F692F5030F825D0379E7BB2C116FFFDB1`. Its verdict and limits are authoritative for the actual probe.
