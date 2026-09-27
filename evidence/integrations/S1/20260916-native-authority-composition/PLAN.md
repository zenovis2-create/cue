# Native existing-file authority composition maker plan

## Scope and owned files

- `app/native-existing-file-authorities.mjs` (new)
- `app/native-existing-file-authorities.d.mts` (new)
- `daemon/test/integration-native-existing-file-authorities.test.ts` (new)
- this evidence directory

No existing production module, migration, build asset, shared documentation, provider, model, or network endpoint is changed or invoked.

## Done definition

The production constructor must return a complete option set for `createNativeImplementationHost` only when all of these facts agree exactly: the current provider/account binding, fixed current measurement subject, privately issued current service-accepted authentication observation, fresh live capability evidence for that subject, the expected digest of this authority implementation, the current authentication issuer revision, immutable policy references, approved expected-artifact contract, conservative accounting bounds, and persisted orchestration/staging/runtime/cleanup lineage. The independent checker principal is the fixed host checker implementation and its current authority-code digest, and it is usable only with an exact successful read-only verifier runtime receipt. Candidate IDs or role prefixes do not establish independence. It must fail closed for missing, copied, stale, cross-account, cross-subject, cross-attempt, or non-final facts.

The focused test must drive the returned options through the real `createNativeImplementationHost`, Core, deployment staging, the real orchestration ledger, and fixed mocked process/provider seams. It must cover positive implementation+verifier completion and publication plus negative copied service auth, subject drift, cross-attempt runtime receipt, unknown cleanup, and unknown billing retaining the reservation. Test fixtures may simulate the privately owned service transport, but the composition API may not accept an authentication boolean, generic transport, authorization callback, checker callback, cleanup callback, or caller-issued success receipt.

After the root-owned coordinated build, done commands from `daemon/` are:

```text
npx --no-install vitest run test/integration-native-existing-file-authorities.test.ts test/integration-native-implementation-host.test.ts test/integration-native-existing-file-runtime.test.ts test/integration-native-runtime-receipts.test.ts test/integration-native-process-cleanup.test.ts test/integration-native-existing-file-checker.test.ts
npx --no-install tsc -p tsconfig.json --noEmit
```

Record SHA-256 pins for all owned files and raw gate output. Independent checker approval is required. This unit does not claim general natural-language goal verification, real external authentication, real model entitlement, actual billing, or setup/startup integration.

## Attempt contract

- Maximum two passes per hypothesis.
- Every pass runs the complete focused Vitest command and TypeScript command above.
- A failure requires a new written hypothesis before another pass. Do not weaken production checks or substitute fixture authority.
- Keep a change only when the measured gate improves. Otherwise restore the exact preimage. If two distinct hypotheses fail, stop and report the exact blocker.

## Hypotheses

1. Existing ledger, staging, issued runtime receipt, cleanup observation, capability admission, fixed subject measurement, and branded service-auth readers can be composed without a new persistence schema or caller authority callback.
2. Exact SQL lineage checks at plan, claim, stage, launch, receipt, acceptance, and publication boundaries are sufficient to reject swapped facts while preserving replay.
3. Unknown provider billing can terminate safely through an unknown non-final receipt that releases zero and retains the conservative reservation.

## Pass history

Hypothesis 1 draft was rejected before any build or test and removed exactly. It represented independence only through role/candidate strings and had an unavailable acceptance placeholder. The measured gate was worse than the done definition, so none of that draft was retained. Hypothesis 2 uses a fixed host mechanical-checker principal bound to the expected current authority-code digest and requires an exact successful read-only verifier runtime receipt before that checker principal exists. It uses a real native snapshot/checker adapter and never treats the model role alias as an independent principal.

## Preimages

All three owned source/test paths are absent at plan time. `PREIMAGES.tsv` records absence plus SHA-256 pins for the existing dependencies used to design the composition. New files can therefore be removed exactly if the hypothesis fails.
