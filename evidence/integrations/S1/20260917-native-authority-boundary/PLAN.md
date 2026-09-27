# Native existing-file authority — third attempt plan (increment 1 only)

Status: PLAN ONLY. No production source was written under this unit. The two owned
paths in `PREIMAGES.tsv` are absent.

## Why the previous two attempts failed, and what changed

Both prior attempts ([composition](../20260916-native-authority-composition/RESULTS.md),
[implementation](../20260916-native-authority-implementation/RESULTS.md)) were rejected at
source review, not at test time. Their plan was written against dependency bytes that have
since moved. Measured drift against
[`20260916-native-authority-composition/PREIMAGES.tsv`](../20260916-native-authority-composition/PREIMAGES.tsv):

| dependency | plan-time pin | today |
|---|---|---|
| `daemon/src/native-provider-measurement-subject.ts` | `92bae062…` | `0e0b30d5…` CHANGED |
| `daemon/src/native-account-observation.ts` | `4a687cc7…` | `529783e2…` CHANGED |

The other five pinned dependencies are unchanged, and all three previously owned paths are
still absent, so the earlier rollback was exact.

`BOUNDARY.md` in this directory re-derives every relevant contract from current bytes.

## Scope of increment 1

Owned paths:

- `daemon/src/verification/native-existing-file-acceptance-host.ts` (new)
- `daemon/test/integration-native-existing-file-acceptance-host.test.ts` (new)

Nothing else is created, edited, or invoked. No migration, no build asset, no provider, no
model, no network endpoint, no `app/` wiring.

## Why this increment is not dead scaffolding

Of the nine capabilities the full composer needs, `BOUNDARY.md` finds exactly one with no
existing seam: bridging real filesystem snapshots into the acceptance dual-verdict contract.
Everything else is either a ready API (`authProfilePath` reader, subject remeasure, capability
admission/evidence, full SQL lineage with immutable triggers, unknown non-final budget
receipt) or thin glue.

`daemon/src/verification/acceptance.ts` is a complete, already-tested consumer. A host that
satisfies `AcceptanceHost` can therefore be driven end to end on its own through
`createAcceptanceVerifier(db, host).collect(...).finalize(...)` over lineage the driver
already builds. It is reachable and provable alone — it is not a declaration half waiting for
an admission half, which is precisely what was rejected twice.

## What increment 1 must do

Mirror `createGeneratedAcceptanceHost` in shape, but for `kind: 'code'` filesystem targets:

1. Fixed principal derived from this module's own current code digest. Not a role name, not a
   candidate ID, not an account.
2. `captureManifest` / `isManifestCurrent` reading real bytes through
   `snapshotRelativeNative({ root, expectedRoot, targets, maxBytes })` from
   `change-snapshot-host.ts`. Artifacts are emitted with `kind: 'filesystem'`.
3. `resolveChecker` returning an `AcceptanceChecker` whose `collect` builds a
   `RawCheckerObservation` with `origin: 'host-observation'` and a full `EvidenceObservation`,
   and whose `evaluate` returns the verdict it privately issued for that exact context digest
   — never a verdict parsed from model output.
4. Verdict computed by `verifyNativeExistingFileArtifacts` against the approved contract from
   `createNativeExistingFileContract`. Any shape it cannot prove yields `unknown`.
5. Every field cross-checked against stage envelope hash, attempt identity, requirement and
   check identity, plan/policy/requirements digests, and the evidence policy identity, exactly
   as the generated host does. Ownership drift throws.

## Seam traps to refuse (both prior attempts died here)

`BOUNDARY.md` Q3 names the concrete temptations. Increment 1 must not accept, and must not
internally construct as a pass-through:

- `authorizePublication` as `() => true` — the single most dangerous one
- an authentication boolean anywhere in the option set
- a generic transport, or `executor.resolveBinding` re-exposed
- an authorization callback, a checker callback, or an injected `AcceptanceChecker.evaluate`
- a caller-issued success receipt, including `verifyFinalBilling`
- an injected cleanup callback replacing the PowerShell-backed `native-process-cleanup`

If a required fact is unavailable the host returns `unknown` or throws. It never substitutes
a caller assertion for a measurement.

## Done definition for increment 1

From `daemon/`:

```text
npx --no-install vitest run test/integration-native-existing-file-acceptance-host.test.ts test/integration-native-existing-file-runtime.test.ts test/integration-native-existing-file-checker.test.ts test/integration-acceptance.test.ts test/integration-evidence-policy.test.ts
npx --no-install tsc -p tsconfig.json --noEmit
```

Required coverage in the owned test, on a real SQLite ledger with the real acceptance
verifier:

- positive: real on-disk bytes matching the approved contract produce a `pass` receipt with an
  independent principal distinct from the producer principal
- negative: byte mismatch → `fail`
- negative: snapshot helper `unavailable`/`unknown` → `unknown`, never `pass`
- negative: contract tampered after capture → `unknown` via `contract-integrity`
- negative: manifest changed between capture and collect → refusal
- negative: cross-attempt or drifted stage envelope hash → refusal
- negative: an observation whose bytes were not the ones this host issued → `unknown`

`snapshotRelativeNative` returns `unavailable` off Windows, so the positive path is
`skipIf(process.platform !== 'win32')` and the unavailable path is asserted on all platforms.

## Attempt contract

- Maximum two passes for this hypothesis. Every pass runs the complete command set above.
- A failure requires a new written hypothesis before another pass.
- Do not weaken any production check and do not substitute fixture authority to pass.
- Keep a change only when the measured gate improves; otherwise restore the exact preimage.
- Independent review is required before this increment is called complete.

## Explicitly not claimed by increment 1

Real external authentication, model entitlement, actual billing, general natural-language
goal verification, setup/startup wiring, and S4-01 itself. S4-01 additionally requires a
coordinated current-source live workflow per supported matrix cell with checker > 0, terminal
acceptance and clean ownership, which is `live-required` and outside this increment.
