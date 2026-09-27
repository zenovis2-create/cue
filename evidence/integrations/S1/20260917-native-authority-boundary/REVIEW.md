# Independent adversarial review — native existing-file AcceptanceHost (increment 1, pass 1)

Reviewer: independent (did not author the unit). Adversarial goal: coerce a false `pass` or
show dead scaffolding. Windows 11 / PowerShell. All measurements below are reproduced tool
output, not narrative.

## Verdict summary

- Gates reproduced exactly as RESULTS.md claims.
- No caller-supplied authority seam found (questions a–h).
- Two required mutations detected by the owned test; a third (removal of the redundant
  post-observation manifest re-read) is NOT detected — judged a NON-BLOCKING defense-in-depth
  coverage gap, because the primary between-capture-and-collect threat is caught by an
  earlier load-bearing guard and mutations A/B prove that guard is sensitive.
- Not dead scaffolding: driven end to end through the real `createAcceptanceVerifier`.
- RESULTS.md honest; the skip / Windows-refusal claim verified.

Overall: REVIEW_PASS.

---

## STEP 1 — reproduced gates

### Owned SHA-256 pins (match RESULTS.md exactly)

    daemon/src/verification/native-existing-file-acceptance-host.ts
      176DF7744FA1AEFD7FFBF79BEF763E84C842915D7884B4CAB51EE81E5C6136B1   16674 bytes   MATCH
    daemon/test/integration-native-existing-file-acceptance-host.test.ts
      9D8A6A485C685692CA0A8A33890BBA352A280B058FAC1615DFC80B241163EF17   15992 bytes   MATCH

### Vitest (verbose, --fileParallelism=false --maxWorkers=1)

    Test Files  5 passed (5)
    Tests       46 passed | 1 skipped (47)
    exit 0

Owned suite alone: 11 tests, 10 passed + 1 skipped. The single skip is the `skipIf(win32)`
non-Windows path. On this Windows host every `runIf(win32)` positive/negative test ran and
passed (visible in verbose output, e.g. "real on-disk bytes ... accept with an independent
principal", "bytes that do not match ... fail", "an unprovable target refuses").

### tsc

    npx --no-install tsc -p tsconfig.json --noEmit
    EXITCODE=0   (no diagnostics)

### Secondary manifest-sensitivity gate (RESULTS.md claim)

    release-readiness / current-source-report / p12-source-manifest / reuse-manifest / release
    Test Files  5 passed (5)   Tests  35 passed (35)   exit 0

All reproduced counts match RESULTS.md.

---

## STEP 2 — authority-model attack (a–h)

The verdict is a DUAL gate in `acceptance.ts::collect`:
`verdict = policyResult==='fail'||checkerVerdict==='fail' ? 'fail' : policyResult==='pass' &&
checkerVerdict==='pass' ? 'pass' : 'unknown'`. Both the registered checker's `evaluate` AND
`evaluateEvidence(policy,...)` must independently return `pass`. This shapes every answer.

**a. Crafted construction-time `contract` → pass?  NO.**
`createNativeExistingFileAcceptanceHost` rebuilds the contract via
`createNativeExistingFileContract(host.contract.targets)` and throws `contract_integrity`
unless `parametersDigest`, `checkerId`, `checkerRevision` all match. More importantly, at
collect time `runData()` calls `requirements.read(context.runId)` — which decodes the persisted,
integrity-checked `requirement_contract_binding` row and re-validates it against the persisted
plan/policy — then filters `bound.requirements.contracts` for a check whose
`checkerId/revision/parametersDigest` equals the construction contract, and requires
`matching.length === 1` (else `contract_not_bound`). A contract not pinned by the persisted
immutable binding can never capture. Verified live by test "an approved contract that is not
pinned by the persisted requirement check cannot capture" (passes: evaluation never `pass`,
finalize `blocked`).

**b. `producerPrincipalForAttempt` abused to become checker principal / satisfy independence?
NO.** The checker principal is `'native-existing-file-checker:' + sha({checkerId, checkerRevision,
codeDigest: ownCodeDigest(), parametersDigest})` — derived from module code bytes, never from
the resolver. `principalForAttempt(stage)` only delegates to the resolver when
`stage.taskId === host.producerTaskId`; for any other task it returns the fixed `principal`.
Independence is enforced twice: (1) `acceptance.ts::reviewer` requires the verifier principal
`!principals.includes(principal)` over all maker stages; (2) `evaluateEvidence` pushes
`independent-checker-required` when `checkerPrincipal === producerAttemptPrincipal`, forcing a
non-pass. If the resolver returns the checker principal → collapse is rejected (verified live by
"a producer principal equal to the checker principal cannot be accepted"). If it returns null /
empty / throws: `reviewer` sees `!validRef(p)` or the flatMap throws and is caught upstream
(`Missing host identity fails closed`), yielding `independent_principal_missing` → `unknown`.
No path lets the resolver forge or weaken the checker identity.

**c. Full option set — any auth flag / transport / authorization / checker / verdict /
receipt / authorizePublication?  NONE.** The constructor parameter object is exactly:
`{ db, now, contract, producerTaskId, producerPrincipalForAttempt, timeoutMs?, maxObservationAgeMs? }`.
Enumerated from source: no `authorizePublication`, no authentication boolean, no transport, no
`resolveBinding`, no authorization callback, no checker callback, no injected
`AcceptanceChecker.evaluate`, no caller verdict/receipt, no `verifyFinalBilling`, no cleanup
callback. `producerPrincipalForAttempt` resolves ONLY the producer task principal (same
delegation the generated host uses). This is the exact seam set the PLAN.md "seam traps"
section demanded be absent.

**d. `evaluate` induced to pass for an observation the host did not issue?  NO.**
`evaluate` keys `issued` by `context.digest` and returns `unknown` when no proof exists; when a
proof exists it additionally requires `observation.contextDigest===context.digest &&
observation.principalId===principal && observation.origin==='host-observation' &&
proof.hash===sha(observation.bytes)`. The proof hash is over the full observation bytes issued
inside `collect`. A forged observation cannot match. Verified live by "an observation this host
did not issue evaluates to unknown". Mutation A (making the fallback `pass`) is DETECTED
(below), confirming the guard is load-bearing.

**e. `collect`/`measure` return pass on unavailable/unknown/absent?  NO.**
`measure` throws `root_<reason>` if `identifyChangeSnapshotRoot` is not `ok`, `snapshot_<reason>`
if `snapshotRelativeNative().state !== 'ok'`, `snapshot_root_drift` on volume/file-id drift, and
`snapshot_target` if the per-target result is not `ok` / missing sha256 / bad byteLength /
missing identity. There is no substitution branch — an unavailable/unknown/absent target throws,
which `acceptance.ts` catches into `unknown`, never `pass`. Verified live by "an unprovable
target refuses" and (off-Windows) the `skipIf(win32)` refusal test.

**f. Post-observation manifest re-read load-bearing?  PARTIALLY (defense-in-depth).**
Two guards exist: (1) the earlier `captured.get(context.manifestDigest) !== stable(current.manifest)`
binds collect-time bytes to capture-time bytes — this catches any change BETWEEN captureManifest
and collect (the real threat); (2) the post-observation `stable(manifestFor(context).manifest) !==
stable(current.manifest)` catches a change occurring WITHIN collect between two remeasures
(microseconds). Guard (1) is load-bearing and is proven sensitive by mutations A/B and by the
live "a manifest change between capture and collect is never accepted" + "isManifestCurrent
reports false once the approved bytes change" tests. Guard (2) is redundant belt-and-suspenders;
finalize additionally re-checks via `isManifestCurrent` under the write lease. Removing guard (2)
is NOT detected by the owned test (mutation C, below) — recorded as a non-blocking coverage gap.

**g. `nativeExistingFileEvidencePolicy` accepted by `validateEvidencePolicy` for `code`, and
can a caller widen it?  ACCEPTED; NOT WIDENABLE.** The descriptor sets `kind:'code'`, frozen
empty `hostileCheckIds/requiredSectionIds/claimIds`, `requiresRender:false`, `producerTaskIds`
frozen to the single `producerTaskId`, `targetIds` derived+sorted from the contract, and
checker/parametersDigest from the contract. `validateEvidencePolicy` accepts it (code kind
forbids claims/sections/remote — all satisfied). The result is `Object.freeze`d and the caller
supplies no policy — it is constructed internally from the pinned contract, and
`contract_integrity` is re-checked inside the factory. `collect` further asserts
`policyIdentity(context.evidencePolicy) === policyIdentity(expectedPolicy)`, so a widened policy
injected via the requirement store would not match and yields `observation_mismatch`. Verified
live by "the evidence policy fixes code-kind requirements and cannot be widened by a caller"
(sections/claims/hostile all `[]`, requiresRender false, frozen).

**h. `ownCodeDigest()` via `import.meta.url` — dist vs vitest divergence.  DESIGN CONCERN,
non-blocking for this increment.** `ownCodeDigest` hashes the module's own file at its resolved
path. Under vitest the resolved file is the `.ts` source (transformed in memory but read from
disk as raw bytes for the hash); under a compiled `dist` build it would be the emitted `.js`,
producing a DIFFERENT `codeDigest` and therefore a different `principal`. Consequences:
(i) the principal string differs between test and production builds — acceptable in principle
because the principal is only required to be stable+independent within a single deployment and
distinct from the producer, and persisted receipts embed the principal that was actually issued;
(ii) it does NOT create a false-pass seam — a mismatched digest only changes the principal value,
and independence/verification still hold. The author did not test the dist path. This is a real
untested design assumption (source-vs-dist principal identity and receipt portability across a
rebuild) that the NEXT increment / integration must cover before any live S4-01 claim. Recorded
as an OPEN, NON-BLOCKING finding for increment 1 (which explicitly does not claim wiring/build).

---

## STEP 3 — mutation sensitivity (performed, restored)

Each mutation applied to `native-existing-file-acceptance-host.ts` one at a time; only
`test/integration-native-existing-file-acceptance-host.test.ts` run.

**Mutation A — `evaluate` returns `proof?.verdict ?? 'pass'` (both no-proof and mismatch → pass):**
DETECTED. `Tests 1 failed | 10 passed | 1 skipped`, EXITCODE=1.
Failing test: "an observation this host did not issue evaluates to unknown"
(`AssertionError: expected 'pass' to be 'unknown'`). GOOD.

**Mutation B — `collect` ignores `verifyNativeExistingFileArtifacts`, forces verdict `pass`:**
DETECTED. `Tests 1 failed | 10 passed | 1 skipped`, EXITCODE=1.
Failing test: "bytes that do not match the approved contract fail and are never accepted"
(`AssertionError: expected 'pass' to be 'fail'`). GOOD.

**Mutation C — remove the post-observation manifest re-read
(`if (stable(manifestFor(context).manifest) !== stable(current.manifest)) fail('manifest_changed');`):**
NOT DETECTED. `Tests 11 passed | 1 skipped`, EXITCODE=0.
Judgement: the redundant within-collect TOCTOU guard is untested. NON-BLOCKING because the
between-capture-and-collect threat (the exploitable one) is caught by the earlier `captured`
guard, proven sensitive by mutations A/B and by two passing live tests, and finalize re-checks
via `isManifestCurrent` under the write lease. Recorded as an open coverage observation, not a
false-pass hole.

### Restoration proof

- `git status --porcelain`: the file is UNTRACKED (`daemon/src/verification/` shown under `??`,
  the whole new increment dir), so no `M` entry appears for the owned files — consistent with an
  unmerged pass-1 increment. Definitive proof is the hash below.
- SHA-256 after restoration: `176DF7744FA1AEFD7FFBF79BEF763E84C842915D7884B4CAB51EE81E5C6136B1`
  == RESULTS.md pin. Byte-for-byte restored.
- Post-restoration owned suite: `Tests 11 passed | 1 skipped`, EXITCODE=0.

---

## STEP 4 — dead scaffolding judgement

NOT scaffolding. The consumer is the pre-existing, independently tested
`createAcceptanceVerifier(db, host)` in `daemon/src/verification/acceptance.ts` (its own suite:
`integration-acceptance.test.ts`, 30+ tests). The owned test drives it directly, not a stub:

    const host = createNativeExistingFileAcceptanceHost({ db, now, contract, producerTaskId: 'make',
      producerPrincipalForAttempt: stage => `producer:${stage.attemptId}` });
    ... verifier: createAcceptanceVerifier(db, host.acceptance)
    // positive test:
    const evaluation = await f.verifier.collect('run');
    expect(evaluation.verdict).toBe('pass');
    const finalization = f.verifier.finalize(evaluation);
    expect(finalization.status).toBe('accepted');
    const stored = f.db.prepare('SELECT bytes FROM acceptance_blob').all() ...
    expect(text).toContain(f.host.principal);

`collect` walks real persisted requirement contracts, computes real reviewer/producer principals,
invokes `host.acceptance.resolveChecker().collect/evaluate`, runs the real
`evaluateEvidence` policy validator, dual-gates the verdict, and persists an `acceptance_blob`
carrying this module's own code-derived principal, then `finalize` commits a real
`acceptance_final` receipt. It is reachable and provable alone — not a "declaration half waiting
for an admission half." This directly answers the two prior rejection modes (caller authority
seam / unreachable acceptance): the acceptance path is reached and asserted end to end here.

---

## STEP 5 — RESULTS.md honesty

Checked each claim against measurement:

- "5 passed / 46 passed | 1 skipped / exit 0" — TRUE (reproduced).
- "tsc exit 0" — TRUE.
- Owned pins + byte counts — TRUE (both match).
- "The single skip is the non-Windows-only assertion (`skipIf(win32)`) ... the equivalent
  Windows refusal path is asserted separately by the unprovable-target test" — TRUE. The skipped
  test is `test.skipIf(win32)('without the Windows snapshot helper the host refuses instead of
  reporting pass')`. The Windows refusal is asserted by `test.runIf(win32)('an unprovable target
  refuses instead of reporting pass')`, which removes `target.txt`, asserts evaluation not `pass`,
  finalize `blocked`, and `isManifestCurrent(...)===false`. Both observed in the verbose run.
- Secondary manifest gate "5 passed / 35 passed / exit 0" — TRUE (reproduced).
- "no authentication flag, no transport, no authorization callback, no checker callback, no
  injected verdict, no caller-issued success receipt, no authorizePublication" — TRUE (option
  set enumerated from source, question c).
- "independence is enforced by the evidence policy rather than asserted" — TRUE, and additionally
  enforced by `acceptance.ts::reviewer` (double enforcement; RESULTS.md understates by
  attributing it only to the policy, which is a conservative claim, not an overclaim).

No overclaim found. One thing RESULTS.md does not mention (and should, for the next pass): the
`ownCodeDigest`/`import.meta.url` source-vs-dist principal divergence (question h) and the
untested redundant post-observation re-read (mutation C). Neither is a false-pass path; both are
open design/coverage notes.

---

## Open findings

1. NON-BLOCKING (coverage): the within-collect post-observation manifest re-read is not covered
   by the owned test (mutation C survives). Redundant with the load-bearing `captured` guard and
   finalize's `isManifestCurrent`. Suggest a direct unit assertion in a later pass.
2. NON-BLOCKING (design, untested): `ownCodeDigest()` yields a different principal under a
   compiled `dist` build vs vitest source. No false-pass consequence, but principal stability
   and receipt portability across a rebuild are unverified and must be covered before S4-01 /
   real wiring.

No blocking findings: no authority seam, no unrestored mutation, no detected coverage hole that
opens a false `pass`, no overclaim.

REVIEW_PASS
