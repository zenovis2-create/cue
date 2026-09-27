# Independent S5 manual evaluation baseline review — BLOCKED

Scope reviewed: `daemon/src/evaluation/baseline.ts`, the `manual-baseline` branch in `daemon/src/evaluation/enrollment.ts`, migration 029 and its ledger/build-copy registration, Core/API types, and the focused baseline/enrollment/trial/Core tests. Product and documentation edits by this checker: 0.

## Checker completion contract

Done required direct source review against every requested invariant, one focused gate pass, TypeScript no-emit, daemon build, Core syntax, source/dist migration parity, live trigger/index/query-plan inspection, scoped whitespace checking, and hostile probes for untested trust boundaries. The checker attempt cap was two passes. A material authority or integrity defect makes the result **BLOCKED** and is handed to the maker; changes are retained only if a later measured gate removes the defect.

## Blocking findings

### 🔴 Blocker — stored authorization accepts injected authority fields

`daemon/src/evaluation/baseline.ts:68-71` parses `authorization_payload`, but it never exact-validates the authorization object's own field set. `JSON.stringify(authorization) === saved.authorization_payload` only proves that the stored JSON is canonical; it does not prove the required two-field shape. The code then checks only `verified === true` and equality of `authorityRef`.

An independent probe declared a legitimate baseline, dropped the UPDATE trigger to use the same hostile-storage model as the focused tamper test, and replaced the stored authorization with canonical JSON containing `approvalAuthority:true` and `promotionAuthority:true`. `store.read('baseline')` accepted and returned both injected fields:

```json
{"accepted":true,"authorization":{"verified":true,"authorityRef":{"id":"user-decision","revision":"v1","digest":"8f76fd501bb68ef71f4e276bc28f29bce1003b0c2c9d9478de81b5bfc0cde1e9"},"approvalAuthority":true,"promotionAuthority":true}}
```

This breaks fail-closed tamper handling and the rule that baseline authorization carries no approval, execution, policy, promotion, trial, or comparable authority. The decoder should exact-validate `['verified','authorityRef']`, strictly validate the nested ref, reconstruct the expected authorization from the canonical request, and require byte-for-byte equality with that expected value. A regression should cover canonical extra-field injection.

### 🔴 Blocker — direct manual enrollment trusts an unverified table row

`daemon/src/evaluation/enrollment.ts:91-96` authorizes `manual-baseline` enrollment when any baseline row matches selected scalar columns. It does not validate `request_payload`, `request_digest`, `authorization_payload`, authority identity, candidate identity, or the pinned candidate before granting the branch.

An independent clean-ledger probe inserted a forged baseline row with `request_payload='{}'` and `authorization_payload='{"verified":false}'`, then called the public enrollment store directly. The direct enrollment succeeded:

```json
{"accepted":true,"arm":"manual-baseline"}
```

This breaks the requirement that direct manual enrollment remain denied without a verified declaration. A table row cannot serve as the verification capability. The implementation needs an internal declaration-only enrollment path or shared strict declaration validation that proves canonical verified authorization and the complete candidate/policy/authority lineage. A regression should insert a forged or corrupt declaration row, call the direct enrollment API, and assert zero enrollment/dataset writes.

## Behavior confirmed in the current implementation

The declaration input uses exactly the 12 requested own enumerable data fields. Top-level and nested records/arrays reject proxies and accessors without invoking getters; the verifier receives a deeply frozen canonical request. A missing verifier defaults closed, and false, throwing, async/non-`true`, malformed, and unpinned inputs do not create baseline/enrollment rows. Core takes the verifier only from its host runtime, rejects a verifier supplied in the declaration input, exposes no renderer/IPC baseline path, and checks run/workspace binding.

The normal declaration path checks the immutable stored run-policy identity and exact policy reference, requires `snapshot.policy.pinnedCandidateId === candidate.id`, and performs declaration plus enrollment in one SQLite transaction. It rejects caller-owned outer transactions. Exact replay returns the stored result without another verifier call or new write, while rebinding conflicts. The normal path checks queued/awaiting-approval state and zero approval, execution, and orchestration-attempt rows. Static review found no baseline path that writes approval, execution, policy, promotion, comparison, or trial state.

The baseline reader uses an explicit fixed column list, a forced primary-key index, bounded request and authorization payload reads, canonical request reconstruction, scalar-column lineage checks, and enrollment linkage. Reopen, request tamper, scalar tamper, oversized request payload, outer transaction, late execution, and exact replay are covered by focused tests. Migration 029 declares unique baseline/enrollment/run indexes and too-late, UPDATE, DELETE, and conflicting INSERT/REPLACE triggers. Live `EXPLAIN QUERY PLAN` used `sqlite_autoindex_evaluation_baseline_declaration_1 (baseline_id=?)`, and all four triggers were present.

These confirmed properties do not clear the two authority/integrity bypasses above.

## Independent gate evidence

- Focused Vitest: `4` files, `14` tests passed; exit 0.
- `npx --no-install tsc --noEmit -p tsconfig.json`: exit 0.
- `npm run build`: exit 0.
- `node --check app/core.mjs`: exit 0.
- Migration source/dist SHA-256 parity: both `5A91BA416FA62724A72A5358EE662E53ACF883A57B0E7E890523CA664994F0A7`.
- Migration 029 was present in freshly built `daemon/dist/src/ledger.js` and registered by `daemon/scripts/copy-assets.mjs`.
- Scoped tracked `git diff --check`: exit 0.

Reviewed source hashes:

```text
B8C6E8E8D7A5915368D6C77B836E5E2FB2657FE8D41B3AF64CE8F182942E7677  daemon/src/evaluation/baseline.ts
F42727CFD17C245A687A048C33C07A0BCD323E8208AFAD8E727B657014DBB1C6  daemon/src/evaluation/enrollment.ts
5A91BA416FA62724A72A5358EE662E53ACF883A57B0E7E890523CA664994F0A7  daemon/migrations/029_evaluation_baseline.sql
BB8E92EA68748DE4D3BF256A1FA0D8CEF075D97B84F495A1250B53CE98C72657  daemon/src/ledger.ts
26939E76087BBB364CE6AB78ABFF62E4799AC9A5842567C2B6B01CEE88BA9A6B  daemon/scripts/copy-assets.mjs
8CF126F494DF325C90B843A22A78BED6A5463B1926E491FBCEE88654DB7D5CF4  app/core.mjs
01D78EB095CFC207B77CD30A2229A893BA2D494FF3D17F10B9C58FF50DEA65D7  app/core.d.mts
11D62979F8F8340E1079F67B9516C5B43D31BC264DA5727329478F25F61AB7B5  daemon/test/integration-evaluation-baseline.test.ts
5BFE8FBE2495313E8DCB6372058BCEC5CA878C63324928D341839EDBA7B7061D  daemon/test/integration-evaluation-baseline-core.test.ts
```

## Limits

This review did not run Electron, external authority infrastructure, a provider/model, native helpers, real measurements, comparison, policy promotion, or full S5 qualification. Passing focused tests demonstrate the normal path but miss both hostile authority cases above. The verdict remains **BLOCKED** until both probes fail closed with zero writes and the focused/type/build/parity gates remain green.

---

## Correction pass 1/2 — still BLOCKED

The initial findings above are preserved as the record of the first review. The first maker correction adds `daemon/src/evaluation/baseline-contract.ts` and materially improves persisted-data validation: authorization is now exactly the two own data fields `verified` and `authorityRef`; the authority ref is validated as exact `id`/`revision`/`digest`; verified must be literal `true`; canonical request bytes, request digest, all 19 projected columns, candidate and authority refs, and canonical authorization bytes are checked. `baseline.ts` and the direct manual branch in `enrollment.ts` both call this validator. The direct branch also rechecks that the actual stored policy pins the declaration candidate.

The original extra-authorization hostile probe now fails closed on baseline read. The new tests also reject empty request bytes, `verified:false`, and an extra authorization field with zero enrollment writes. These repairs resolve the first initial blocker and its malformed variants.

### 🔴 Remaining blocker — a canonical forged row still grants manual enrollment

The shared validator proves internal consistency of persisted public values; it does not prove that `verifyExplicitUserBaselineAuthority` ever approved them. A caller with ledger SQL access can construct every canonical byte and digest because the persisted authorization has no unforgeable marker. `daemon/src/evaluation/enrollment.ts:92-100` still treats such a row as sufficient authority.

The correction test named `forged declaration rows cannot authorize direct manual enrollment` covers only `request_payload='{}'`, `verified:false`, and an extra authorization field. It omits a fully canonical request with the exact two-field `verified:true` authorization requested by the correction review.

An independent fresh-ledger probe inserted a row with the exact canonical 12-field request, correct request digest, matching dataset/policy/candidate/metric/environment/account-limit/authority columns, and exact authorization `{"verified":true,"authorityRef":...}` without creating or invoking a baseline verifier. It then called the public enrollment store directly. The result was:

```json
{"accepted":true,"before":0,"after":1,"arm":"manual-baseline"}
```

The direct API therefore still creates a manual enrollment without verified authority. Once that enrollment exists, the baseline reader also has no provenance by which to distinguish the forged canonical declaration from a verifier-created declaration. Hashes over attacker-controlled public fields cannot establish this provenance.

The correction needs an unforgeable declaration-only path. One viable structure is for the public enrollment method to reject `manual-baseline` unconditionally, while the baseline store invokes a private enrollment primitive through a closure-held identity/capability that is unavailable to direct callers. Persisted row validation can remain as the read-integrity layer. The required regression must insert a fully canonical, exact-authorization declaration row, call the public enrollment API, and observe enrollment and dataset writes remain zero.

### Correction gate evidence

- Focused Vitest: `4` files, `16` tests passed; exit 0.
- `npm exec -- tsc --noEmit -p tsconfig.json`: exit 0.
- Build-equivalent `npm exec -- tsc -p tsconfig.json` followed by `node scripts/copy-assets.mjs`: exit 0. An earlier build attempt failed on transient concurrent `integration-resources.test.ts` union narrowing errors; the subsequent independent no-emit and emit checks passed after that shared-worktree change settled.
- `node --check app/core.mjs`: exit 0.
- Migration source/dist SHA-256 parity remained `5A91BA416FA62724A72A5358EE662E53ACF883A57B0E7E890523CA664994F0A7`.
- Scoped `git diff --check`: exit 0.

Correction source/build hashes:

```text
016A80BD2F952A63307BF6264C9EEEA0F9BBA644F56BC8684F7B7F6AF5C40E35  daemon/src/evaluation/baseline-contract.ts
8B9BDDD7F3A5A31EE3147CEF1B30367CE95762946AD4503A911C691C8D0F51FE  daemon/src/evaluation/baseline.ts
A655ED7F797C38690BAB13B2A140580E9029D1913AB79301E9C9A85212C016FC  daemon/src/evaluation/enrollment.ts
4A9A550C7843E153E0B17BFE562043A9CE80A8254196A9DDB770FFE62E101B9A  daemon/test/integration-evaluation-baseline.test.ts
A3B2EDC5A15EB0B61A20BD606DEDB78D903C37C64D5E05EFA625A1CCF024CB2E  daemon/dist/src/evaluation/baseline-contract.js
F808162DB3D9A2B32C35BFE28212FCBFDFF3C1DD4B2987E20AC2E842C0987D79  daemon/dist/src/evaluation/baseline.js
5B003049BF6519FC416FB297F2F6FBD6A10C22667DED06FAD634047DFC26DD29  daemon/dist/src/evaluation/enrollment.js
```

Correction pass 1/2 verdict: **BLOCKED**. The exact canonical-forgery probe must fail closed with zero writes before this review can pass.

---

## Correction pass 2/2 — final PASS

The two prior BLOCKED sections remain above as the audit history. The final correction removes persisted declaration rows as authority for the public enrollment API. `createEvaluationEnrollmentStore(db).enroll()` now rejects every new `manual-baseline` input unconditionally at `daemon/src/evaluation/enrollment.ts:91`, regardless of whether an attacker has inserted a malformed, partially valid, or fully canonical declaration row. The baseline store is the only code path that creates a manual enrollment: after canonical input validation and a literal synchronous verifier result of `true`, it checks exact stored policy identity, the policy's pinned candidate, dataset case membership, pre-start state, and absence of every approval, execution, and orchestration-attempt row, then inserts declaration, dataset, and enrollment within one SQLite transaction.

The common persisted-data validator from correction pass 1 remains in use for baseline reads. It strictly checks the two-field authorization, authority/candidate references, canonical request and authorization bytes, request digest, bounds, and every projected declaration column. The public enrollment API no longer imports or treats that validator as an authorization mechanism.

### Independent hostile-probe results

- A fresh fully canonical forged declaration with correct request bytes/digest, all matching columns, and exact `{"verified":true,"authorityRef":...}` was inserted without calling a verifier. Direct public manual enrollment failed with `evaluation_enrollment_manual_baseline_unsupported`; dataset and enrollment counts remained `0`. The preinserted forged declaration remained one row, as expected.
- Canonical authorization with injected `approvalAuthority` was rejected by baseline read with `evaluation_baseline_integrity`.
- Missing, false, throwing, and async verifiers each failed closed; baseline, dataset, and enrollment counts remained `0`.
- A valid synchronous verifier was called once. Initial declaration changed baseline/dataset/enrollment counts from `0/0/0` to `1/1/1`; exact replay returned the same value, did not reverify, and left counts at `1/1/1`.
- Wrong stored-policy digest and an unpinned candidate failed with zero declaration/enrollment writes.
- Completed state, a declined approval event, an execution event, and an orchestration attempt each failed with zero declaration/enrollment writes. The approval check therefore rejects any prior approval event, not only accepted approval.
- A conflicting preexisting dataset revision caused `evaluation_baseline_dataset_conflict`; the transaction rolled back its declaration and enrollment writes. Only the deliberately preexisting dataset row remained.
- A Core call for a run bound to a different real workspace failed as `evaluation_unavailable`, did not invoke the host verifier, and left declaration/enrollment counts at `0`.

Static mutation review confirms the baseline path writes only `evaluation_baseline_declaration`, `evaluation_dataset`, and `evaluation_enrollment`. Successful and denied probes left approval, execution, orchestration-attempt, and selection-policy counts unchanged. No renderer or IPC baseline API exists, and a declaration input cannot supply the verifier. The returned authority remains `explicit-user-baseline-authority-only`; neither declaration nor enrollment creates approval, execution, policy mutation, comparison, promotion, trial, provider/model, native-helper, or network authority.

### Final gates

- Focused Vitest: `4` files, `16` tests passed; exit 0.
- `npm exec -- tsc -p tsconfig.json --noEmit`: exit 0.
- `npm --prefix daemon run build`: exit 0.
- `node --check app/core.mjs`: exit 0.
- Migration source/dist SHA-256: both `5A91BA416FA62724A72A5358EE662E53ACF883A57B0E7E890523CA664994F0A7`.
- Fresh `daemon/dist/src/ledger.js` registers migration 029, and `daemon/scripts/copy-assets.mjs` copies it.
- Scoped `git diff --check`: exit 0.

Final source/build hashes:

```text
016A80BD2F952A63307BF6264C9EEEA0F9BBA644F56BC8684F7B7F6AF5C40E35  daemon/src/evaluation/baseline-contract.ts
3CEBAB0802F38731CC6F8EB7C2BC8B582F4B9E5FC38452EB4A7D85C2EEF9E88A  daemon/src/evaluation/baseline.ts
A218D5C91A85F400A3F03D644C3C26C6EAA76896537EAACF5497ED52B1B463A8  daemon/src/evaluation/enrollment.ts
5A91BA416FA62724A72A5358EE662E53ACF883A57B0E7E890523CA664994F0A7  daemon/migrations/029_evaluation_baseline.sql
BB8E92EA68748DE4D3BF256A1FA0D8CEF075D97B84F495A1250B53CE98C72657  daemon/src/ledger.ts
26939E76087BBB364CE6AB78ABFF62E4799AC9A5842567C2B6B01CEE88BA9A6B  daemon/scripts/copy-assets.mjs
8CF126F494DF325C90B843A22A78BED6A5463B1926E491FBCEE88654DB7D5CF4  app/core.mjs
01D78EB095CFC207B77CD30A2229A893BA2D494FF3D17F10B9C58FF50DEA65D7  app/core.d.mts
ADBB1A9CFE6FA54874423243AC8A39F3B3739F719980B8790D499F75AC6CFFDB  daemon/test/integration-evaluation-baseline.test.ts
914FE3E2A58C974F5F3E05846968F96D8633F140F0CD233FD4BE0053E97410DE  daemon/test/integration-evaluation-enrollment.test.ts
73321D4D97C91E152C50767B30DF74E07DA1A1E9EB561A9EAF741C097BF00CA1  daemon/test/integration-evaluation-trials.test.ts
5BFE8FBE2495313E8DCB6372058BCEC5CA878C63324928D341839EDBA7B7061D  daemon/test/integration-evaluation-baseline-core.test.ts
A3B2EDC5A15EB0B61A20BD606DEDB78D903C37C64D5E05EFA625A1CCF024CB2E  daemon/dist/src/evaluation/baseline-contract.js
3AD88B2CA198F9C96748E10C0AA97518C90C50F63732E8B451C5A6437A2822E8  daemon/dist/src/evaluation/baseline.js
88F28EC1968722C6D07CE0708BA015C2222FB4A5E391658178DA871E9A73281E  daemon/dist/src/evaluation/enrollment.js
```

### Final limits

This PASS establishes the requested local API, persistence, transaction, replay, tamper, and Core workspace boundaries. The synchronous host callback remains the external authority trust root; this review does not establish the existence or authenticity of its external user-decision record. It did not run Electron, a provider/model, native helpers, real measurements, comparison, policy promotion, or whole-S5 qualification. It grants no claim that any run is comparable or that any policy improved.

Final correction pass 2/2 verdict: **PASS**. No blocker remains in the reviewed baseline scope.
