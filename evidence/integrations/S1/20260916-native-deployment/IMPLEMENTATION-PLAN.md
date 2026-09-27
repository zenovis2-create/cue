# Protected native startup implementation plan

## Conclusion

A complete bounded native workflow is implementable with current execution and ledger primitives. It does not require final provider billing: each attempt can settle with a source-bound `unknown`, non-final budget receipt, so the conservative reservation remains committed. It does require one external fact that code cannot derive: a current, source-bound authentication/entitlement observation for each exact provider account and measured subject. Missing that fact keeps startup unavailable.

Do not add a setup schema or startup branch first. The first unit is a complete fixed native authority implementation for the already supported approved-existing-file workflow. Only after that unit passes end to end should a protected setup snapshot name its inputs and startup compose it.

## Unit 1: complete native authority set

Add `app/native-existing-file-authorities.mjs` and its declaration. Export one constructor, `createNativeExistingFileAuthorities(input)`, which returns either the full option fragments required by `createNativeImplementationHost` or `{available:false,reasons}`. It accepts the real ledger, clock, two already measured candidate descriptions, exact approved target/checker contract, exact policy/accounting references, and fixed host installation roots. It accepts no authority callbacks.

The module implements these authorities in fixed code:

### Plan, claim, stage, and launch

- `authorizePlan` accepts only the exact two-task plan produced by `createNativeImplementationHost`, its exact policy digest, one implementation followed by one verifier, and the configured target scope.
- `authorizeClaim` re-reads the persisted plan, task, attempt, envelope, account identity, policy and target contracts from the same ledger and checks their exact lineage. It authorizes only the configured candidate for that task role.
- `authorizeStage` accepts implementation `file_change` only inside the attempt staging worktree and verifier with no actions; both require empty egress, the exact parent envelope, configured candidate, and current subject digest.
- `runtime.authorizeRun` repeats the persisted attempt/account/stage checks immediately before launch. The implementation role must have the durable staging authorization already created by the driver; the verifier role must be read-only.
- `engine.authorizeExecution` uses the same exact attempt lineage and refuses cancelled, expired, terminal, cleaned or mismatched attempts.

These callbacks grant no broad discretion and do not return true merely because the caller supplied matching strings. Each decision joins existing persisted rows written by the orchestration driver and staging coordinator.

### Outcome and cleanup receipts

Use a closure-local map keyed by attempt ID to bind the exact `CodexExecution` returned by `createDefaultCodexCandidate` or `createCodexVerifierCandidate`. Wrap candidate launch once, record the immutable execution object and durable session reference, and refuse replacement.

Implement `verifyReceipt` by awaiting/reading the bound `HostCodexRuntimeResult` and comparing the receipt to the persisted claim and candidate:

- success requires runtime status completed, no `failureKind`, and `goalVerification.passed === true` for implementation or `reason === 'read_only_result_received'` for verifier;
- failure is accepted only when the runtime result is terminal and agrees with the engine outcome;
- the receipt evidence reference is a digest-bound host receipt persisted by a new narrow store, `daemon/src/orchestration/native-runtime-receipts.ts`, containing attempt/run/task/candidate/subject/session, terminal status, goal-verification fields, and the exact runtime result digest;
- no provider prose or self-reported cleanup proves the outcome.

Implement `runtime.verifyCleanup` with a fixed observer in `daemon/src/native-process-cleanup.ts`. It receives the session/process identities captured by the existing host runtime, queries current Windows process creation identities through the existing protected process-query helpers, verifies every owned process is absent, and verifies the per-attempt credential home and controller resources are absent after ordered teardown. It persists the exact observation through `createCleanupObservationStore`. PID absence without matching creation identity is not enough; query failure returns `unknown`. `verifyReceipt.cleanupVerified` is true only for the persisted, lineage-matched `verified-clean` observation. This composes the existing runtime result/session boundary, cleanup store and process identity machinery; it does not reuse the model-only recovery observer or treat a cancel acknowledgement as cleanup.

### Accounting

`engine.reservation` returns the configured source-bound conservative upper bound for the exact task role. `verifyBudgetMapping` checks policy currency, budget currency/unit/limit and setup source identity. `engine.receipts` always emits a terminal budget receipt for every outcome:

- when a trusted provider billing observation exists and binds the exact account, subject, attempt and source bytes, forward its actual/estimated/finality values;
- otherwise emit `kind:'unknown'`, `units:null`, `providerFinal:false` with a source reference/digest derived from the exact runtime receipt and account identity.

`verifyFinalBilling` delegates only to the existing trusted provider-billing observation verifier. With no such observation it returns false. Unknown/non-final receipts do not invoke it, release zero, preserve the conservative reservation, and still allow orchestration to terminate. This is the complete safe offline behavior; no price, free tier, subscription equivalence, quota or currency conversion is invented.

### Acceptance, checker, and publication

Add a fixed checker in `daemon/src/verification/native-existing-file-checker.ts`. It is restricted to the existing approved target contract. Its manifest collector opens each canonical target without following reparses, checks root identity, bounds bytes, and records SHA-256 plus file identity. The checker requires:

- at least one approved target differs from the pre-stage receipt captured by the staging coordinator;
- every changed path is in the approved target set and matches the staged publication receipt;
- the implementation attempt has a verified successful runtime receipt and clean cleanup;
- the independent verifier attempt has a verified successful read-only receipt and clean cleanup;
- the manifest is current at finalization.

It does not claim semantic correctness beyond this explicit checker contract. The configured requirement text must state this mechanical contract. A future semantic checker is a different registered revision.

`principalForAttempt` returns the persisted exact account/subject principal only after the above receipt lineage exists. `captureManifest` uses the fixed collector. `resolveRequirementChecker` recognizes only the built-in checker ID/revision/digest.

`authorizePublication` accepts only the driver-created `FinalPublicationAuthority` whose run/task/attempt/change-set/root/target identities match the persisted staging contract, whose runtime receipt is verified successful, and whose cleanup is verified clean. Publication remains confined to `createStagedExistingFilePublicationHost` and its compare-write receipt. It grants no new path or command authority.

### Candidate admission

Candidate assembly uses existing implementations:

- `identifyProviderInstallation`, `assertCurrentProviderInstallation`, and `bindProviderInstallationCandidate` for current executable, signature, version, manifest and auth-profile identity;
- a fixed `daemon/src/native-provider-measurement-subject.ts` collector over provider descriptor plus pinned controller/runtime/tool bytes;
- `createCapabilityEvidenceStore` and `createCapabilityAdmission` for exact fresh live capability evidence;
- `readSelectionPolicy` and `selectCandidate` for all four policies;
- `createDefaultCodexCandidate`, `createCodexVerifierCandidate`, `launchHostCodexRun`, and structured approved-existing-file mode for execution;
- the new fixed authority set above for decisions, receipts, cleanup, accounting, acceptance and publication.

Admission additionally requires an existing trusted authentication/entitlement observation bound to account reference, provider installation digest, current subject digest, source bytes and validity interval. Installation/profile presence is never relabeled authenticated. Fixture, missing, stale, conflicting or differently bound observations deny before `createNativeImplementationHost`.

### Unit 1 tests and gate

Add `daemon/test/integration-native-existing-file-authorities.test.ts` and focused store/checker tests. Use a real temporary ledger, real orchestration/staging rows and fixed process/filesystem test seams. Required cases:

- exact implementation and verifier receipts authorize; swapped attempt/candidate/subject/session/result digests refuse;
- failed, cancelled, launch-failed and unknown outcomes terminate conservatively without omitted or duplicate receipts;
- verified-clean requires exact creation identities and absent owned resources; reused PID, residual path and query error refuse cleanup;
- missing provider billing emits unknown/non-final and retains the full reservation; exact trusted billing can finalize; unrelated billing cannot;
- checker refuses unchanged, extra-path, stale, reparse, oversized, dirty-cleanup and missing-verifier cases;
- publication accepts only the exact successful staged change set;
- no test supplies `authorize* = () => true`, a fake final bill, or a caller-provided authority callback.

Then extend `integration-native-implementation-host.test.ts` with the authority constructor and run through `createCueCore` to approved preparation, both executions, acceptance and publication using offline fake process/controller seams. The production constructors and ledger paths are real; only OS/provider transport is substituted. No network or provider process starts.

Done gate from `daemon/` after the coordinated build:

```text
npx --no-install vitest run test/integration-native-runtime-receipts.test.ts test/integration-native-process-cleanup.test.ts test/integration-native-existing-file-checker.test.ts test/integration-native-existing-file-authorities.test.ts test/integration-native-implementation-host.test.ts
npx --no-install tsc -p tsconfig.json --noEmit
```

Maximum two passes per hypothesis. Record exact changed-file hashes. A failed pass requires a new hypothesis. An independent checker must verify that the positive flow uses persisted facts at every authorization boundary and that all missing/unknown facts fail closed.

## Unit 2: setup persistence and protected startup

Begin this only after Unit 1 passes. Add:

- `daemon/migrations/050_native_deployment_setup.sql`;
- `daemon/src/selection/native-deployment-setup.ts`;
- guarded `app/native-setup-start.mjs` and `app/native-setup-application.mjs`;
- `app/native-deployment-bootstrap.mjs`;
- the native branch in `app/protected-installation.mjs`;
- migration asset/bootstrap updates.

The immutable CAS snapshot stores only declarative inputs needed by Unit 1: exact candidates and installation expectations, account/authentication observation references, current subject/evidence references, four policy references, conservative accounting bounds and sources, approved targets, built-in checker revision, and fixed authority-set revision. It stores no JavaScript, module path, SQL, command, endpoint or permission callback.

At startup the bootstrap reads the same ledger, remeasures both installations and subjects, resolves fresh live evidence and authentication facts, resolves policies/accounting inputs, constructs `createNativeExistingFileAuthorities`, and only then calls `createNativeImplementationHost`. The enabled native branch bypasses local generated-JSON settings and health fetch and remains wrapped by `createDeploymentStagingOrchestrationFactory`. Unknown authority revisions or any missing/drifted fact return a stable unavailable reason without launch.

Unit 2 tests cover schema integrity/CAS, guarded bounded setup input, restart reconstruction, same-ledger and generation binding, native/local branch separation, and a complete offline setup-to-host-to-core flow. Fixture evidence must remain unavailable through the unmodified production resolver; a separate explicit test authority may seed synthetic rows but cannot change their authority class.

## External delivery prerequisites

The following must be supplied by a protected qualification/setup operation before a real deployment becomes available; they are facts, not implementation choices or requests for approval:

- two exact installed provider/account identities and current authentication/entitlement observations;
- current live capability evidence for each newly measured subject;
- four deployed policies that admit the exact pair;
- source-bound conservative monetary bounds, currency and unit;
- approved existing-file targets and acceptance of the mechanical checker contract;
- deployment staging configuration.

Actual provider billing may remain unavailable: the system records unknown/non-final and retains the reservation. No real provider/model/network call is needed to implement or test either unit. There is no material user design choice blocking Unit 1; real availability remains correctly blocked until the external facts exist.
