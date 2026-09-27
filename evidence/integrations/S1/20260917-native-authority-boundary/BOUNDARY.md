# Native existing-file authority composer — current-bytes boundary

READ-ONLY survey. All quotes are from the current source at C:\Users\User\cue. No project code changed.
The "composer" is the unit that must BUILD the options object consumed by `createNativeImplementationHost`
(item 1). Everything below is the reality that object and its dependencies impose.

---

## 1. app/native-implementation-host.mjs + .d.mts (the CONSUMER = the composer's output contract)

Exported factory (only one):
```
export function createNativeImplementationHost(options)
```
Return type (`.d.mts`): `(OrchestrationHost & Readonly<{executionStagingSupport:'git-worktree-v1'}>) | Readonly<{available:false;reasons:readonly string[]}>`.

`options` is validated by descriptor inspection (no getters/proxies allowed). Every top-level property:

Required, hard-checked in the first guard (else returns `unavailable('native-implementation-missing-authority')`):
- `db` — must be truthy with `.open` (a `Ledger`).
- `now` — `function` returning a safe non-negative integer (wrapped; throws `native-implementation-clock` otherwise).
- `workflow` — plain object.
- `implementation` — plain object.
- `verifier` — plain object.
- `accounting` — plain object.
- `authority` — plain object.
- `runtime` — plain object.
- `engine` — plain object.
- `acceptance` — plain object.
- `authorizePublication` — `function`.

Optional (read via `value(...)`, may be undefined):
- `resolveRequirementChecker`, `verifyFinalBilling`, `requirementCheckers`, `policies`.

`workflow` (cloned, then validated; else `native-implementation-workflow-invalid`):
```
requirementId (id), requirementText (string, 1..4096), checkerId (id), checkerRevision (id),
parametersDigest (64-hex), targets (array 1..64 of {targetId(id), relativePath(rel, no ..),
maxBackupBytes(1..16MiB)}), launchTimeoutMs(1..120000), taskTimeoutMs(1..600000), pollMs(1..1000)
```
Target relativePaths must be case-insensitively unique. Each target is reduced to
`{taskId:'implement', targetId, relativePath, maxBackupBytes}`.

`accounting` (else `native-implementation-accounting-unqualified`):
```
currency(non-empty string), unit('minor'|'micro'), limitUnits(1..MAX_SAFE), unitsPerCost(1..MAX_SAFE),
source(non-empty string), observedAtMs(0..now()),
upperUnitsByRole:{implementation(1..MAX_SAFE), verifier(1..MAX_SAFE)}
```

`implementation` (else `native-implementation-candidates-unqualified`):
```
record:CatalogRecord (record.kind==='agent', record.canonicalId is id, must differ from verifier's),
currentSubject():MeasurementSubject (function),
evidenceReferences():unknown (function),
observeCandidate():SelectionCandidate (function),
installation?:ProviderInstallationDescriptor (optional; when present, bound via bindProviderInstallationCandidate with provider:'codex', executablePath:executor.binary),
executor: plain object = Parameters<typeof createDefaultCodexCandidate>[0]; executor.resolveBinding must be a function.
```
The host wraps `executor.resolveBinding` and FORCES:
`options.verificationMode:'approved-existing-file-change'` and
`approvedExistingTargets: targets.map({relativePath, maxBytes:maxBackupBytes})`.
Final candidate gets `stagedPublication:'attempt-owned-existing-files-v1'`.

`verifier` (discriminated union in .d.mts):
```
{record, currentSubject(), evidenceReferences(), observeCandidate()} AND EXACTLY ONE OF:
  {candidate:HostCandidate; executor?:never; installation?:never}         // pre-built candidate
  {candidate?:never; executor:...; installation?:ProviderInstallationDescriptor}  // codex verifier
```
Runtime check: exactly one of `verifier.candidate` / `verifier.executor` present
(`(verifierCandidateInput===undefined)===(verifier.executor===undefined)` must be false).
If `candidate` path: `candidate.supportedRoles` must include `'model'`.
If `installation` present without `executor` → `native-implementation-verifier-installation-unbound`.

`policies` — `Record<'efficiency'|'performance'|'value'|'speed',{policyId,revision,digest}>`. For every
one of the four MODES, `readSelectionPolicy(db, policyId, revision)` must exist with matching digest,
`policy.mode`, `currency===accounting.currency`, `pinnedCandidateId===null`, and both canonicalIds in
`allowedCandidateIds`; and `selectCandidate` must select each observed role. Else
`native-implementation-policy-<mode>`.

The built host object exposes: `executionStagingSupport:'git-worktree-v1'`, `now`, `catalog`, `acceptance`,
`resolveRequirementChecker`, `finalPublication` (= `createStagedExistingFilePublicationHost({db, authorizePublication})`),
`prepare(run)`, `verifyFinalBilling`, `authority`, `runtime` (wrapped: `resolveCandidate`, `authorizeRun`),
`engine` (wrapped: `observeCandidates`, `reservation`, `verifyBudgetMapping`), `stage(context, run)`.
`prepare(run)` requires `this.executionStaging` set (else `native-implementation-staging-unconfigured`) and
enforces `run.envelope.allowed_actions.includes('file_change')` and `run.envelope.egress.length===0`.

Note: `executionStaging` is NOT an option; it is set on the returned host later (by the deployment
staging factory — see item 10). The composer returns a host that is not launch-ready until wrapped.

---

## 2. daemon/src/native-account-observation.ts

Exported symbols:
- type `NativeAccountObservation`
- type `NativeServiceAuthentication`
- `async observeNativeProviderAccount(input)`
- `async observeNativeServiceAuthentication(input)`
- `readIssuedNativeServiceAuthentication(observation, input)`  ← the "service-auth reader"
- `readIssuedNativeAccountObservation(observation, input)`

The prior-record claim `{installation, currentSubject, authProfilePath, accountRef, nowMs, maxAgeMs}` is
CORRECT for the *reader* `readIssuedNativeServiceAuthentication`. Exact signature:
```
readIssuedNativeServiceAuthentication(observation:unknown, input:Readonly<{
  installation:ProviderInstallationDescriptor; currentSubject:MeasurementSubject;
  authProfilePath:string; accountRef:string; nowMs:number; maxAgeMs:number }>)
  :Readonly<{observation:NativeServiceAuthentication; sourceBytes():Uint8Array}>
```
Checks before returning (all must pass or throws):
- `observation` is a non-proxy object registered in the private `issuedService` WeakMap.
- `record.value===observation`, `record.installation===input.installation`,
  `record.authProfilePath===input.authProfilePath`, `record.accountRef===input.accountRef`
  (else `native_service_authentication_unissued`).
- re-measures subject via `measureNativeProviderSubject(input.installation)`;
  `subjectDigest(input.currentSubject)` must equal `measurement.subjectDigest`, `record.subjectDigest`,
  and `record.value.subjectDigest`.
- `measurement.manifest.installationDigest===record.value.installationDigest`.
- recomputed `profileRef` (`profile:<hash(canonical(profile))>` from the matching authProfile) must equal
  `record.authProfileRef` and `record.value.authProfileRef`.
- `record.value.issuer.revision===hash(readFileSync(this module file))` (issuer self-revision).
- time: `nowMs` safe int, `maxAgeMs>=1`, `observedAtMs<=nowMs<=validUntilMs`, `nowMs-observedAtMs<=maxAgeMs`.
- `hash(record.source)===record.value.sourceDigest` and sourceDigest is 64-hex.
- else `native_service_authentication_stale`.

Returns `{observation:record.value, sourceBytes:()=>Uint8Array.from(record.source)}`. It refuses anything
not produced by `observeNativeServiceAuthentication` in this process (WeakMap-gated — private ownership is
lost on restart), any subject/installation/profile/time/digest drift.

`observeNativeServiceAuthentication(input)` input:
```
Readonly<{db:Ledger; owner:SessionOwner; installation:ProviderInstallationDescriptor;
  currentSubject:MeasurementSubject; authProfilePath:string; temporaryParent:string;
  nowMs:number; maxAgeMs:number; requestTimeoutMs?:number}>
```
It spawns the pinned vendor codex `app-server`, calls `account/read`, `account/usage/read`, `account/read`
again, requires `requiresOpenaiAuth===true` and stable non-null identity across both reads, re-measures the
native subject, then issues `NativeServiceAuthentication` with `serviceAccepted:true`, `scope:'account-usage-read'`,
`authentication:'service-accepted'`, and `modelEntitlement/capability/billing:'unknown'`. `createCleanCodexHome`
from `authProfilePath`; process is terminated + verified absent (`cleanup:'verified-absent'`).

`observeNativeProviderAccount` input adds `observeRateLimits?:boolean` (no `accountRef`); returns
`NativeAccountObservation` (`accountPresence:'present'|'absent'`, all of authentication/entitlement/capability
`'unknown'`). It refuses on any account-updated notification, frame/size errors, subject change.

---

## 3. daemon/src/native-provider-measurement-subject.ts

Exported symbols:
- const `NATIVE_PROVIDER_SUBJECT_VERSION='cue-native-provider-subject-v1'`
- const `NATIVE_PROVIDER_SUBJECT_PATHS` (frozen ADAPTER+ENFORCEMENT+POLICY+PROBES path list)
- interface `NativeProviderSubjectMeasurement`
- `measureNativeProviderSubject(installation:ProviderInstallationDescriptor):NativeProviderSubjectMeasurement`

Output:
```
{ subject:MeasurementSubject; subjectDigest:string;
  manifest:{version; provider:'codex'; installationDigest; artifacts:{id,sha256}[]};
  limitations:string[] }
```
Measures: hashes the provider binary + a fixed closure of adapter/enforcement/policy/probe source+dist
artifacts (each verified as a real non-symlink file at exact realpath), verifies binary sha256 matches
`installation.executable.sha256`, reads the Windows build via powershell registry query. Refuses:
`native_provider_subject_provider` (non-codex), `native_provider_subject_executable_drift`,
`native_provider_subject_artifact`/`_path` (missing/symlink/outside), `native_provider_subject_os`
(non-win32 or bad OS build), `native_provider_subject_group`, `native_provider_subject_root`.
`limitations` explicitly include `measurement-only-no-qualification`,
`authentication-and-account-evidence-excluded`, `provider-service-outside-client-boundary`.

---

## 4. native-runtime-receipts.ts + migration 050

Store factory: `createNativeRuntimeReceiptStore(db:Ledger)` → frozen `{recordIssued, read}`.
```
recordIssued(result:HostCodexRuntimeResult, binding:NativeRuntimeEvidenceBinding, observedAtMs:number)
  → {ref:'cue-native-runtime-receipt:'+digest, receipt:NativeRuntimeReceipt}
read(ref:string) → NativeRuntimeReceipt | null
```
`recordIssued` calls `readIssuedNativeRuntimeEvidence(result, binding)` (from host-codex-runtime) — the
composer CANNOT hand-forge evidence; it must come from a real host runtime result. Throws
`native_runtime_receipt_outer_transaction` if already in a transaction.

Receipt shape (`NativeRuntimeReceipt = IssuedNativeRuntimeEvidence & {receiptId; outcome; observedAtMs}`):
```
version:'cue-issued-native-runtime-evidence-v1', runId, taskId, attemptId, candidateId,
subjectDigest(64hex), sessionHandle, role:'implementation'|'model',
verificationMode:'workspace-change'|'read-only-result'|'approved-existing-file-change',
outcomeInputs:{status, failureKind:null|'crash'|'cleanup'|'termination'|'enforcement',
  goalVerification:{passed, reason, changedPaths[]}},
controller:{pid,createdFileTime}, workers:[{pid,createdFileTime}],
resources:[{path, ownership:'ephemeral-owned'|'retained-authorized', cleanup:'absent'|'retained'|'unknown'}],
receiptId, outcome:'succeeded'|'failed', observedAtMs
```
Resource rule: `retained-authorized` ⟹ `cleanup==='retained'`; `ephemeral-owned` ⟹ `cleanup!=='retained'`.

`outcome()` distinguishes model vs implementation:
```
implementation = role==='implementation' && verificationMode∈{'workspace-change','approved-existing-file-change'}
               && goalVerification.passed===true
verifier(model) = role==='model' && verificationMode==='read-only-result'
               && goalVerification.passed===false && goalVerification.reason==='read_only_result_received'
succeeded ⟺ status==='completed' && failureKind===null && (implementation || verifier)
```
So a role='model' read-only-result receipt is 'succeeded' ONLY when the goal verification says
passed:false, reason:'read_only_result_received'. An implementation receipt is 'succeeded' only when
passed:true. Any other combination → 'failed'.

Table `native_runtime_receipt` columns:
`receipt_id PK, run_id, task_id, attempt_id UNIQUE, candidate_id, subject_digest(64hex),
session_handle UNIQUE, outcome CHECK IN('succeeded','failed'), payload_digest UNIQUE(64hex),
payload BLOB(1..65536)`. FKs → `orchestration_attempt(attempt_id)`, `session_handle(handle)`.
Triggers: `_insert_guard` (cue_sha256 match, cue_canonical_json match, lineage join
attempt↔step↔session_handle where h.run_id=attempt_id AND h.task_id=task_id), `_no_update`,
`_no_delete`, `_no_replace` (immutable). Migration singleton table also immutable.

---

## 5. native-existing-file-checker.ts + AcceptanceChecker/AcceptanceHost

`native-existing-file-checker.ts` exports:
- const `NATIVE_EXISTING_FILE_CHECKER_ID='cue-native-existing-file-artifacts'`
- const `NATIVE_EXISTING_FILE_CHECKER_REVISION='v1'`
- type `NativeExpectedArtifact = {targetId, relativePath, maxBytes, expectedSha256, expectedByteLength, originalSha256}`
- type `NativeObservedArtifact = {targetId, relativePath, sha256, byteLength, sourceRef}`
- `createNativeExistingFileContract(input)` → `{version:'approved-existing-file-artifacts-v1', checkerId, checkerRevision, parametersDigest, targets}`
- `verifyNativeExistingFileArtifacts(contract, observed)` → `{verdict:'pass'|'fail'|'unknown', reasons}`

Contract rejects `expectedSha256===originalSha256` (unchanged is hostile), duplicate paths/ids, expectedByteLength>maxBytes.
`verifyNativeExistingFileArtifacts` returns `fail` for set-size/artifact mismatch, `pass` only when every
target's observed `{relativePath, sha256===expectedSha256, byteLength===expectedByteLength, byteLength<=maxBytes}`.
This is a PURE function — it is NOT the AcceptanceChecker seam.

The actual acceptance seams are in `daemon/src/verification/acceptance.ts`:
```
interface AcceptanceChecker extends RegisteredRequirementChecker {
  collect(context:CheckerContext, signal:AbortSignal):Promise<RawCheckerObservation>;
  evaluate(context:CheckerContext, observation:Readonly<RawCheckerObservation>):AcceptanceVerdict;
}
interface AcceptanceHost {
  now():number; readonly timeoutMs:number; readonly maxObservationAgeMs:number;
  resolveChecker(id, revision):AcceptanceChecker|undefined;
  principalForAttempt(binding:StageEnvelopeBinding):string|null;
  captureManifest(context:AcceptanceContext, signal:AbortSignal):Promise<AcceptanceManifest>;
  isManifestCurrent(context:AcceptanceContext, manifest:AcceptanceManifest):boolean;
}
```
`RawCheckerObservation` required evidence fields:
```
{contextDigest, principalId, sourceRefs:string[], observedAt, origin:'host-observation'|'model-report',
 bytes:Uint8Array, evidence?:EvidenceObservation}
```
`CheckerContext` (built by the verifier, given TO the checker): AcceptanceContext plus
`requirement, check, verifierAttemptId, stageEnvelopeHash, reviewerPrincipal, manifestDigest,
targets:AcceptanceArtifact[], digest, producerPrincipals:string[], evidencePolicy:EvidencePolicyDescriptor`.
`AcceptanceArtifact` = `{targetId, digest, sizeBytes, sourceRef, kind:'filesystem'|'retrieved-source'|'remote-state'|'generated-output'}`.
`createAcceptanceVerifier(db, host:AcceptanceHost)` cross-checks a registered `evidencePolicy` AND the
checker verdict; `evaluate` returning 'pass' is not enough — the evidence policy must also pass.

Reference implementation of an AcceptanceHost: `daemon/src/verification/generated-acceptance-host.ts`
`createGeneratedAcceptanceHost({db, now, controlBundle, producerPrincipalForAttempt, launch, timeoutMs?, maxObservationAgeMs?})`
returns `{acceptance:AcceptanceHost, requirementChecker(target), launchVerifier(context)}`. Its checker
`collect` NEVER launches a process (launch is separate `launchVerifier`); it reads owned results and
produces a `host-observation` with a fully-formed `EvidenceObservation`. This is the model to imitate: a
FIXED host checker whose principal is `'native-json-checker:'+pins.sha256` (code/revision derived, not
caller-supplied). NOTE: there is NO existing generic "existing-file AcceptanceHost" that wraps
`verifyNativeExistingFileArtifacts` — that wrapper does not exist and would be new code.

---

## 6. native-process-cleanup.ts

`createNativeProcessCleanup(db:Ledger, fixture?)` → frozen `{observe(receipt:NativeRuntimeReceipt)}`.
`observe` returns `{runId:receipt.attemptId, subjectDigest, result:'verified-clean'|'residual'|'unknown', evidenceRef}`.
To be accepted as `verified-clean`: every expected process (controller + workers) queried via
`native-process-observation.ps1` must be `exited`/`absent` (or PID-reused = clean); no `alive`; no `unknown`.
For every `receipt.resources`: `retained-authorized` must have `cleanup==='retained'`; otherwise
`cleanup==='absent'` AND `pathAbsent(path)` true. Any residual owned process/resource → `residual`; any
`unknown` liveness / observation-unavailable / count/shape mismatch (caught) → `unknown`
(`reason='observation-unavailable'`). Requires a matching `session_handle` row keyed on
`receipt.sessionHandle` (else throws `native_cleanup_session`). It persists via `createCleanupObservationStore`.
Role in the observation is derived: `receipt.taskId==='implement' ? 'implementation' : 'model'`.

---

## 7. capability-admission.ts + capability-store.ts

`createCapabilityAdmission(policy:HostEvidencePolicy)` where
`HostEvidencePolicy = {resolveEvidence(ref:{id,sha256}):Uint8Array|undefined; now():number; maxAgeMs:number}`.
Returns `(subject, references) => Admission` where `Admission = {implementationEligible, modelOnlyEligible, reasons:Denial[]}`.
Probes: WRITE_PROBES `['P1'..'P5','B1'..'B5','B5.normal','B5.stop','B5.crash']`, MODEL_PROBES `['M1','M2','M3']`.
For each probe it requires a reference `{id,sha256}`, resolves bytes via HOST `resolveEvidence`, verifies
`sha256(bytes)===ref.sha256`, parses JSON evidence with EXACT keys
`['probe','subjectDigest','measuredAt','kind','status']`, requires `probe` match, `subjectDigest===digest(subject)`,
`kind==='live'` (fixture denied), `status==='pass'`, and age `0<=now-measuredAt<maxAgeMs`.

`createCapabilityEvidenceStore(db, now)` → frozen `{record(measurement:HostMeasurement):{id,sha256},
resolveEvidence(ref):Uint8Array|undefined, referencesFor(subjectDigest):Partial<Record<Probe,{id,sha256}>>}`.
`record` requires `{probe, subjectDigest, measuredAt, kind, status, observation:Uint8Array}` (measuredAt<=now).
"Fresh capability evidence" concretely = a `capability_evidence` row whose payload is the LATEST
`measured_at` for that `(subject_digest, probe)`, with no conflicting variant at that timestamp
(`resolveEvidence` returns undefined if a newer or tie-broken measurement exists), AND whose age at the
admission clock is `< maxAgeMs`, AND `kind==='live'`, AND `status==='pass'`. The store is host-owned and
"must never be exposed as a model tool or plugin permission". There is no "capability launch"; the composer
must re-run `referencesFor(subjectDigest)` and re-admit against `now()` both at admission AND immediately
before launch (two separate admission calls with a fresh clock).

---

## 8. Read-only verifier receipt path (039 + control/worker/identity-store)

`readonly-verifier-control.ts`: `measureReadonlyVerifierControl({executable,launcher})` →
`ReadonlyVerifierControlBundle{version:'cue-readonly-verifier-control-v1', executable, executableSha256,
launcher, launcherSha256, sha256}`; `snapshotReadonlyVerifierControl`, `verifyReadonlyVerifierControl(input):boolean`.

`readonly-verifier-worker.ts`: `createReadonlyVerifierWorker({db, control, runtimeRootBase, resolveBinding})`
→ `{async launch(attemptId, signal):Promise<ReadonlyVerifierResult>}`.
`ReadonlyVerifierResult = {outcome:'succeeded'|'failed', exitCode, stdoutSha256, stderrSha256,
identityRef:string|null, cleanupRef:string|null, wfpDiagnostic}`.
A run is `'succeeded'` ONLY when `exitCode===0 && identityRef && cleanupRef`. On success it writes both an
identity record and a cleanup record.

`readonly-verifier-identity-store.ts`: `createReadonlyVerifierIdentityStore(db)` → `{record(identity), cleanup(cleanup)}`.
`record` returns `'cue-readonly-identity:'+sha256`; `cleanup` returns `'cue-readonly-cleanup:'+sha256`.
`ReadonlyVerifierIdentity` includes `subjectDigest, controlDigest, commandDigest, environmentDigest, rootIdentity, session, worker, observedAt`.
`ReadonlyVerifierCleanup` requires `result:'verified-clean', aclRestored:true, profileAbsent:true, runtimeAbsent:true, processesDead:true`.

Migration 039 tables: `readonly_verifier_identity(sha256 PK, attempt_id UNIQUE FK orchestration_attempt,
session_handle UNIQUE FK session_handle, subject_digest, payload)` and
`readonly_verifier_cleanup(sha256 PK, attempt_id UNIQUE FK readonly_verifier_identity, identity_sha256 FK
readonly_verifier_identity(sha256), payload)`. Triggers enforce: cue_sha256(payload)=sha256; payload shape;
LINEAGE — identity requires the attempt's plan task `role='verifier'` and
`orchestration_launch_intent.expected_subject_digest = subject_digest` and matching session_handle
run_id/task_id; cleanup requires matching identity + rootIdentity. All immutable (no update/delete).

How a caller proves an independent principal exists: read the `readonly_verifier_identity` (and its
`readonly_verifier_cleanup`) row for the attempt — its existence is gated by the immutable 039 lineage
triggers (verifier role + expected_subject_digest + session lineage) and can only be inserted by a
SUCCESSFUL worker run (which yields both identityRef and cleanupRef). NOTE: migration 050 (native runtime
receipt) is a DIFFERENT table from 039; the task text "read-only verifier 050 receipt" conflates them —
the read-only verifier receipt lives in migration 039 (`readonly_verifier_identity`/`_cleanup`), while 050
is `native_runtime_receipt`. Marked so the next maker does not look in the wrong table. UNKNOWN: no single
"readonly verifier receipt reader" export was found; a caller queries the 039 tables directly (as the
staging/acceptance lineage triggers do).

---

## 9. SQL lineage (table → key run/attempt binding columns; [IMM]=has immutability triggers)

- plan → `orchestration_plan(run_id PK, envelope_hash, digest, payload)` [IMM no_update/no_replace/no_delete].
  Revisions: `orchestration_plan_revision(run_id, revision, plan_digest, ...)` (migrations 036/037).
- claim → `orchestration_attempt(attempt_id PK, run_id, task_id, candidate_id, state, claim_payload,
  worktree_realpath, lease_acquired_at, cleanup_verified)`, UNIQUE(run_id,task_id), FK→orchestration_step.
- step → `orchestration_step(run_id, task_id, state)` PK(run_id,task_id).
- stage(envelope) → `orchestration_stage_envelope(attempt_id PK, workflow_run_id, plan_task_id,
  stage_task_id UNIQUE, stage_run_id UNIQUE, parent_envelope_hash, stage_envelope_hash UNIQUE,
  plan_digest, policy_digest, ...json)` [IMM].
- execution → `orchestration_attempt` (state='running') + `attempt_staging_authority(attempt_id PK,
  stage_envelope_hash UNIQUE, execution_worktree_realpath UNIQUE, execution_volume_serial, execution_file_id,
  ...)` [IMM insert_guard/no_update/no_delete/no_replace] (migration 047).
- runtime receipt → `native_runtime_receipt(attempt_id UNIQUE, session_handle UNIQUE, ...)` [IMM] (050).
- cleanup observation → `cleanup_observation(sha256 PK, run_id, subject_digest, session_handle, payload)`
  [IMM] (018); attempt-staging cleanup → `attempt_staging_cleanup(attempt_id PK, result, evidence_sha256, ...)`
  [IMM] (047); readonly cleanup → `readonly_verifier_cleanup` [IMM] (039).
- budget reservation → `integration_budget_reservation(run_id, request_id, attempt_id, upper_units, payload)`
  PK(run_id,request_id) UNIQUE(run_id,attempt_id) FK→integration_budget; settlement →
  `integration_budget_receipt(run_id, receipt_id, request_id, revision, kind IN('actual','estimated','unknown'),
  units, provider_final, payload)` UNIQUE(run_id,request_id,revision). Policy table `integration_budget(run_id PK)` [IMM] (008).
- publication → `change_publication_intent(publication_id PK, change_set_id, run_id, task_id, attempt_id,
  stage_envelope_hash, parent_envelope_hash, plan_digest, worktree_realpath, ...)` and
  `change_publication_result(publication_id PK, state IN('committed','contention','unknown'), ...)`
  [IMM insert_guard/no_update/no_delete/no_replace] (046).

Immutability triggers present on: orchestration_plan, orchestration_step (via attempt FKs), orchestration_attempt
receipts/activity (`orchestration_receipt`, `orchestration_activity`), orchestration_stage_envelope,
attempt_staging_* (all), change_publication_* (all), native_runtime_receipt, readonly_verifier_* , cleanup_observation,
integration_budget (policy). `orchestration_attempt`/`orchestration_step` state columns are mutable (state machine).

---

## 10. app/deployment-staging-host.mjs + app/staged-existing-file-publication-host.mjs

`deployment-staging-host.mjs` exports:
- `parseDeploymentStagingConfiguration(raw)` → `{enabled, configured, storageRoot?, gitExecutable?}`.
- `async createDeploymentStagingOrchestrationFactory(options)` where
  `options = {configuration, createOrchestrationFactory(), createStagingHost?}`. Returns a factory
  `context => readiness`. When enabled it requires the base readiness to have
  `executionStagingSupport==='git-worktree-v1'` (i.e. the native host from item 1), rejects worktree/storage
  overlap, then attaches `executionStaging = createGitStagingHost({storageRoot, gitExecutable?})` onto the
  readiness (this is where the host's `executionStaging` gets set). The driver later reads
  `host.executionStaging.{inspectCleanRoot, factory}` (see orchestration-driver line 128).

`staged-existing-file-publication-host.mjs` exports:
- `createStagedExistingFilePublicationHost(options)` where `options = {db, authorizePublication}` (exact 2 keys;
  `authorizePublication` must be a function). Returns frozen
  `{authorize:(authority)=>authorizePublication(authority)===true, openStagedAttempt(contract),
  readStagedReplacement(input), execute:compareWriteExistingNative}`.
  The driver validates a `finalPublication` host has `authorize/openStagedAttempt/readStagedReplacement`
  functions and optional `execute` (orchestration-driver lines 129-132). `contract` must be
  `{version:'cue-staged-existing-files-v1', contractId, runId, taskId, attemptId, changeSetId,
  worktreeRealpath, stagingOnly:true, targets:[{relativePath,maxBytes}]}`; contractId must equal
  `stagedPublicationContractId(attemptId, changeSetId)`; it is bound to attempt_staging_setup/authority +
  change_set + change_target_contract rows via SQL.

---

## 11. Existing test coverage (do NOT re-test these)

- `daemon/test/integration-native-implementation-host.test.ts` — createNativeImplementationHost refusal
  before provider composition; Core prepares+approves the staged existing-file plan + independent verifier
  WITHOUT launching providers (uses deployment-staging factory, real Core).
- `daemon/test/integration-native-account-observation.test.ts` — account observation + service auth +
  both readers; sanitized (no email), issuer-revision drift, rate-limit-under-policy, cleanup.
- `daemon/test/native-provider-measurement-subject.test.ts` — subject measurement / drift refusals.
- `daemon/test/integration-native-runtime-receipts.test.ts` — receipt persistence, model≠implementation
  success, round-trip, failed-insert retry, SQL tamper detection.
- `daemon/test/integration-native-runtime-migration.test.ts` — 050 migration/triggers.
- `daemon/test/integration-native-existing-file-checker.test.ts` — contract + verify pass/fail/unknown,
  hostile inputs.
- `daemon/test/integration-native-process-cleanup.test.ts` — verified-clean/residual/unknown observation.
- `daemon/test/capability-admission.test.ts` + `daemon/test/integration-capability-store.test.ts` —
  admission eligibility and evidence store freshness/conflict.
- `daemon/test/readonly-verifier-control.test.ts`, `readonly-verifier-migration.test.ts`,
  `readonly-verifier-worker.test.ts`, `integration-readonly-verifier-{acl,bootstrap,launch-lifecycle,ledger}.test.ts`,
  `integration-readonly-{created-identity,observation-lease,terminal-wait,wfp-*}.test.ts` — the full
  read-only verifier receipt/identity/cleanup path and 039 lineage.
- `daemon/test/integration-deployment-staging-host.test.ts` — config parse + factory attach.
- `daemon/test/integration-staged-existing-file-publication-host.test.ts` +
  `integration-staged-existing-file-publication-driver.test.ts` — publication host + real driver publish/reconcile.
- `daemon/test/integration-provider-installation-binding.test.ts` — installation binding used by item 1.
- `daemon/test/integration-driver*.test.ts`, `integration-native-verifier.test.ts`,
  `integration-native-existing-file-runtime.test.ts`, `integration-release-acceptance.test.ts` — driver/verifier/runtime paths.

---

## 12. Wiring in app/core.mjs

There is NO reference to `createNativeImplementationHost`, `createDeploymentStagingOrchestrationFactory`,
`native-implementation`, or `executionStaging` anywhere in `app/core.mjs` (grep returned 0 matches). The
ONLY seam is the generic orchestration-host injection in `createCueCore`'s constructor:
```
418:  let orchestrationHost, orchestration, generatedParent, unavailableReasons;
419:  let setupRestartRequired = false;
420:  try {
421:    nativeRecovery = runtime.nativeRecoveryFactory?.(Object.freeze({ db, config, worktree }));
422:    if (runtime.orchestration && runtime.orchestrationFactory) throw Error('ambiguous_orchestration_host');
423:    orchestrationHost = runtime.orchestrationFactory
424:      ? runtime.orchestrationFactory(Object.freeze({ db, config, worktree })) : runtime.orchestration;
425:    if (runtime.orchestrationFactory && !orchestrationHost) throw Error('orchestration_host_unavailable');
426:    if (runtime.orchestrationFactory) {
427:      if (typeof orchestrationHost !== 'object' || types.isProxy(orchestrationHost) || ![Object.prototype, null].includes(Object.getPrototypeOf(orchestrationHost))) throw Error('invalid_orchestration_readiness');
...
445:    if (orchestrationHost?.parentTemplate !== undefined && orchestrationHost.parentTemplate !== 'generated-json-v1') throw Error('unsupported_parent_template');
446:    generatedParent = orchestrationHost?.parentTemplate === 'generated-json-v1';
447:    orchestration = orchestrationHost ? createOrchestrationDriver({ db, host: orchestrationHost }) : null;
448:  } catch (error) {
```
So a native implementation host is injected today ONLY through `runtime.orchestrationFactory` (or
`runtime.orchestration`), which receives `{db, config, worktree}` and must return either a readiness
`{available:false, reasons}` or an OrchestrationHost. `createOrchestrationDriver({db, host})` then consumes
it. The native-implementation-host test drives exactly this path via
`createDeploymentStagingOrchestrationFactory({configuration, createOrchestrationFactory:()=>createNativeImplementationHost(options)})`.

"Protected setup/startup wiring" = the `createCueCore` try-block above (lines 421-448) plus the protected
path guards (worktree vs ledgerPath/sourceHome/homeRoot, lines ~331-336) and the `engine` object built at
lines ~312-327 (binary/sha/home). A native implementation host arriving via `runtime.orchestrationFactory`
touches none of these except being wrapped by `createOrchestrationDriver`. A SEAM ALREADY EXISTS
(`runtime.orchestrationFactory`); no core edit is required to inject the composer's output — the composer
must produce something `createDeploymentStagingOrchestrationFactory` can wrap into that factory.

---

# Design answers

## Q1 — Which of the nine capabilities have a ready-made API vs need new code

- (a) bind composer SHA-256 + independently recomputed issuer revision — PARTIAL/READY-ish. Issuer
  self-revision hashing already exists inside native-account-observation and readonly-verifier-control
  (`hash(readFileSync(import.meta.url))`, control `sha256`). Binding an *expected composer* sha256 is NOT
  provided by any single API — the composer must recompute its own module hash and compare. NEW glue,
  existing primitives.
- (b) pass exact selected authProfilePath to branded service-auth reader — READY.
  `readIssuedNativeServiceAuthentication(observation, {installation, currentSubject, authProfilePath,
  accountRef, nowMs, maxAgeMs})` and `observeNativeServiceAuthentication` both take `authProfilePath`
  directly and validate the profile is in `installation.authProfiles`.
- (c) fresh per-attempt clean Codex home, ephemeral-owned, never delete retained profile — READY primitives.
  `createCleanCodexHome(temporaryParent, authProfilePath)` + `safeCleanupCodexHome` (tool-home.js);
  receipt `resources[].ownership:'ephemeral-owned'|'retained-authorized'` + cleanup rules enforce the
  retained-profile invariant. NEW glue to mark ownership in the receipt resources.
- (d) remeasure fixed native subject + fresh capability evidence at admission AND before launch — READY.
  `measureNativeProviderSubject` + `createCapabilityAdmission` + `createCapabilityEvidenceStore.referencesFor`.
  Must be CALLED twice with a fresh `now()`; no API forces the double-call — that is the composer's job.
- (e) plan/claim/stage/execution/receipt/cleanup/budget/publication SQL lineage — READY. All tables and
  immutability triggers exist (item 9); the driver + item-1 host already emit plan/stage/attempt/staging;
  receipts via createNativeRuntimeReceiptStore; publication via staged host. Composer wires, does not create.
- (f) collect real staging files via protected snapshot helper + adapt expected-artifact contract into
  AcceptanceChecker/AcceptanceHost evidence — NEW CODE. `snapshotRelativeNative`/`compareWriteExistingNative`
  (change-snapshot-host) and `verifyNativeExistingFileArtifacts` exist, but there is NO AcceptanceHost that
  bridges native existing-file snapshots into `RawCheckerObservation`+`EvidenceObservation`. Only
  `createGeneratedAcceptanceHost` exists (for JSON documents). A native-existing-file AcceptanceHost must be written.
- (g) independent principal = fixed host checker code/revision, exposed only after a successful read-only
  verifier 039 receipt — PARTIAL. The read-only verifier worker/identity-store/039 lineage exist and prove
  an independent principal; a fixed-code principal pattern exists in generated-acceptance-host
  (`'native-json-checker:'+pins.sha256`). But GATING principal exposure on the 039 identity row is NEW glue.
- (h) unknown, non-final billing that retains full reservation — READY. `integration_budget_receipt` with
  `kind:'unknown'` (requires `units:null, providerFinal:false`); accounting projection treats non-final as
  `committed += reservation upper` (retains the reservation). Composer emits an unknown receipt; no new API.
- (i) drive real Core + deployment staging in an owned focused test — READY. Exact pattern already exists in
  `integration-native-implementation-host.test.ts`. Composer reuses it.

Summary: NEW CODE required = (f) native-existing-file AcceptanceHost, and glue for (a) expected-sha binding,
(c) ownership marking, (g) principal-gating. READY = (b),(d),(e),(h),(i).

## Q2 — Single hardest capability

(f). It is the only one with NO existing seam: there is no AcceptanceHost that turns native existing-file
snapshots into the `RawCheckerObservation` + `EvidenceObservation` shape that `createAcceptanceVerifier`
demands. `createGeneratedAcceptanceHost` is document/JSON-specific and cannot be reused. The new host must
satisfy a large, strict contract simultaneously: fixed-code `principalForAttempt`, `captureManifest`
producing `filesystem`-kind `AcceptanceArtifact`s bound to the exact targets, `isManifestCurrent`, a
`resolveChecker` whose `collect` reads real bytes via the protected snapshot helper (not a caller payload)
and whose `evaluate` re-derives the verdict from an owned proof — while feeding a matching
`EvidencePolicyDescriptor` so the verifier's dual policy+checker verdict passes. Every field is cross-checked
by acceptance.ts, so partial/approximate evidence yields `unknown` and blocks finalization.

## Q3 — Where the obvious implementation accidentally creates a caller-supplied authority seam

The tempting seams (all would be rejected as they were in both prior attempts):
- `authorizePublication` (option to createNativeImplementationHost / createStagedExistingFilePublicationHost):
  it is a `function`. Passing a `()=>true` (or a caller-issued boolean) makes publication a caller-granted
  authority. It must instead be a HOST predicate that verifies an independently-recorded authority object.
- `AcceptanceHost.principalForAttempt` / `resolveChecker` and `AcceptanceChecker.evaluate`: returning a
  principal string or a 'pass' verdict from a caller-controlled closure is a checker callback / caller-issued
  success. The principal MUST be derived from fixed checker code sha (like `'native-json-checker:'+pins.sha256`)
  and gated on the 039 read-only-verifier identity row; `evaluate` must re-derive from owned proof, never echo input.
- `verifyFinalBilling` (option) and `authorizePublication`: a `()=>true` here is a caller-issued success receipt.
- `executor.resolveBinding` (implementation/verifier executor): returning arbitrary options is a generic
  transport; the host already clamps `verificationMode`/`approvedExistingTargets`, but a maker adding its own
  transport/env passthrough re-opens it.
- `runtime.authorizeRun` / `engine.reservation` / `engine.verifyBudgetMapping`: these are host predicates the
  item-1 host wraps; supplying permissive versions is an auth boolean seam.
- A `cleanup` callback: `createNativeProcessCleanup.observe` is host-driven; introducing a caller cleanup
  callback (instead of the ps1-backed query) would be a cleanup-callback seam.
Most dangerous single temptation: `authorizePublication` as a boolean — it is the one required `function`
option and the shortest path to "just return true".

## Q4 — Smallest first increment that is independently testable and not dead scaffolding

Build the native-existing-file AcceptanceHost (capability (f)) as a standalone module
`createNativeExistingFileAcceptanceHost({db, now, control/pins, snapshot helper})` returning
`{acceptance:AcceptanceHost, requirementChecker(...)}`, mirroring `createGeneratedAcceptanceHost` but for
`kind:'code'`/`filesystem` targets using `snapshotRelativeNative` + `verifyNativeExistingFileArtifacts`.
It is independently testable by driving `createAcceptanceVerifier(db, host.acceptance).collect(...).finalize(...)`
against a fixture attempt+stage+staging lineage (the exact lineage the driver already builds in
`integration-native-existing-file-runtime.test.ts`), asserting a real `pass` acceptance receipt and an
independent principal. It is reachable/provable on its own because acceptance.ts is a complete consumer — it
does not require the admission/launch half of the composer to exist. This unblocks Q2's hardest piece first
and gives the eventual `createNativeImplementationHost` a real `acceptance` option instead of a stub, and it
is exactly the piece with no existing seam, so it cannot be dead scaffolding.
