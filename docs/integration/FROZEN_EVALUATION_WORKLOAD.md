# Frozen existing-file evaluation workload

## Scope

`daemon/evaluation/existing-files-v1.json` is an authored **exact-edit mini-workload** for checking the S5 evaluation pipeline before paid measurements. It has four evaluation cases and four holdout cases, nine initial files total. It is not a representative coding benchmark, a secret/blind holdout, or proof of statistical independence/performance improvement. Prompts intentionally specify exact edits, and acceptance checks exact artifact bytes rather than arbitrary semantic correctness.

| Split | Cases |
| --- | --- |
| evaluation | nullish defaults (two files), empty sum, stable deduplication, extension normalization |
| holdout | empty average, exclusive range, numeric sort, clamp composition |

Declared families and exact inputs cannot overlap across splits. This does not detect all semantic overlap or model contamination. The exact-artifact pass/fail metric has a quality ceiling and cannot by itself demonstrate the spec's high-performance quality improvement objective. A representative reviewed workload and approved measurements are still required for S5 closure.

## Freeze and integrity

- Release ID/revision: `cue-existing-files` / `v1`.
- Raw release SHA-256: `2a3e6ff012ddc1a08dae3422bf8412ab8cf0b9137de98698f301ffcf79d660bb`.
- Canonical suite digest: `c6ae325d6d07f4c5cfdff7796f42f6ca14ee709b9431961e5999127e102a94cb`.
- Existing evaluation dataset digest: `bbb2b5a9629ba98ab7284876d1a277a96584eb5b2792e31fc9529884572c3d36`.

The build verifies and packages the exact release bytes. The runtime loader accepts only this fixed release and rejects even whitespace drift. Revision changes require explicit source/pin review; never rewrite a frozen cohort to fit results.

Each input digest binds the goal, initial file bytes, paths and native checker expectations/limits. ID/family/split labels are excluded from that digest so relabeling the same task cannot disguise a duplicate. Changing the expected output changes the input identity too. The canonical suite also binds metadata and reference content. Arrays are copied/frozen and checked for accessors, proxies, sparse/extra entries, limits and portable path collisions.

## Commands (PowerShell, repository root)

```powershell
# Build and list IDs/splits/digests. Does not create workspaces or call models.
npm run evaluation:workload -- list

# Explicit split is mandatory. Parent must already exist and be host-owned.
npm run evaluation:workload -- prepare --case eval-nullish-defaults --split evaluation --parent "$env:TEMP"

# Holdout is never selected implicitly.
npm run evaluation:workload -- prepare --case holdout-numeric-sort --split holdout --parent "$env:TEMP"
```

For clean JSON stdout after building, invoke `node daemon/scripts/evaluation-workload.mjs ...` directly; npm itself prints build/log headers.

Preparation creates a new `cue-eval-*` child directory on every call and writes only the selected initial files. It does not overwrite an existing workspace, copy full reference outputs, create a Git repository, approve a run, select an account/model, call a provider or write trials. The host-only receipt includes the goal and expected hashes/lengths needed to build the existing native artifact contract; reference plaintext remains outside the generated workspace. This is not OS containment by itself.

The receipt returns `executionAuthorized:false` and `baselineConfigured:false`. Inventory reports `measurements:"not-collected"`; it does not infer a global zero count from an unread ledger. Reparse-point parents, invalid/missing splits, unknown cases and unsafe/overlapping paths fail. If a write fails after creating a folder, the command exits nonzero and reports `retainedWorktreePath`; inspect that owned partial folder explicitly. The command never performs broad cleanup. The supplied parent must remain under exclusive host control during preparation; this is not an atomic defense against an adversarial concurrent filesystem writer.

## Verify prepared inputs (before Git initialization)

```powershell
npm --prefix daemon run build
$receipt = node daemon/scripts/evaluation-workload.mjs prepare --case eval-empty-sum --split evaluation --parent "$env:TEMP" | ConvertFrom-Json
node daemon/scripts/evaluation-workload.mjs verify --case $receipt.caseId --split $receipt.split --worktree $receipt.worktreePath --goal $receipt.goal
$receipt | ConvertTo-Json -Depth 20
```

`verify` reads the selected root without writing or cleaning anything. It requires the exact goal and all original seed bytes, and refuses missing/extra paths (including `.git` and `AGENTS.md`), links/junctions, multiply linked files, oversized files and observed changes during reading. Run it **before** creating Git metadata or additional files. It exits nonzero on mismatch. The host must exclusively control the supplied directory; this is not an atomic OS snapshot or an executed-input attestation. The result keeps `executedInputVerified:false` and `executionAuthorized:false`. Subsequent edits can invalidate the check.

## Desktop import and registration

The evaluation panel now accepts up to **64 cases**, rather than forcing a two-case replacement of the frozen dataset.

1. Paste the direct CLI `list` JSON, preparation receipt JSON, or the plain `{id, revision, cases}` manifest into **전체 데이터셋 manifest 또는 작업 준비/목록 JSON**. Do not include npm's build headers.
2. Click **전체 작업셋 가져오기**. It displays evaluation/holdout counts and labelled case options; it does not create or run a task.
3. Prepare the intended run normally, then explicitly choose its case. A new run clears the selected case; holdout is never implicitly chosen. Fill the existing policy/metric/environment/account-limit references using real approved definitions, not arbitrary sample digests.
4. Click **현재 실행 등록** before approval. The full dataset crosses validated IPC into the existing Core/SQLite enrollment store, not a reduced two-case manifest. A retry reuses its original host enrollment timestamp; changed bindings are still rejected.
5. Use **수동 2케이스 입력으로 전환** to return to the existing form. Manual values are preserved. Invalid import clears the old imported selection; approval and completed enrollment lock the controls.

Only manifest data is imported from receipts. Paths, goals, authorization flags and alleged results are not execution instructions. Import does not validate current on-disk input, pick the correct case for a goal, configure a baseline or create measurements. The UI still reports `claimed-not-verified`, and its manual-baseline limitation remains visible. The separate `verify` command is a point-in-time preparation check; it does not change that durable enrollment authority.

## Connecting to existing evaluation APIs

Use the prepared `dataset` (the three-field enrollment manifest), `caseId`, and a real pre-approval run's existing policy reference with `createEvaluationEnrollmentStore`. The four mode arms still have to match that policy. For the manual baseline, use the existing `createEvaluationBaselineStore` and an explicit verified user baseline declaration with a pinned candidate; this workload never chooses or authorizes one automatically.

The receipt's `expectedArtifacts` is compatible with `createNativeExistingFileContract` and the protected native workflow's explicit expected-artifact contract. An authorized host still needs to prepare Git/staging, qualify candidates, bind the actual run goal/seed files/contract and obtain normal approval. The current enrollment remains `inputBinding:'claimed-not-verified'`: the new explicit full-manifest UI/IPC path does not upgrade that stored authority, bind actual executed inputs automatically, or grant task acceptance from the mini-workload's reference bytes.

The integration test registers 40 **offline fixture** slots (8 cases × manual baseline plus 4 modes) in real SQLite and reopens them. It uses explicitly synthetic policy/metric/environment/account references and a test-only baseline verifier. No real baseline, execution, timing, quality trial, price or billing measurement follows from that test.

## Before claiming optimization

1. Independently review representative tasks, split construction, metric and freeze.
2. Obtain the user's actual baseline choice, current candidate/account qualifications and new approved live-call budget.
3. Bind and verify actual executed inputs, Git/staging and final acceptance for every arm/case.
4. Retain failures/cancellations/unknowns and complete retry/verification/handoff costs and environment/price timestamps.
5. Measure both splits, assess all four objectives and quality floors, and only then evaluate promotion/release gates.

Qwen remains OFF and the old subscription allowance remains exhausted. This command does not reopen it. [Batch88 verification](../../evidence/integrations/S5/20260922-frozen-workload/RESULTS.md) records implementation tests separately from these unfinished measurement gates.
