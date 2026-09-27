# S5 measured-facts, cohort execution, promotion/rollback 설계

Date: 2026-09-12 (Asia/Seoul)

Status: read-only design; product/test/checklist evidence가 아님

Scope: 현재 `INTEGRATION_CHECKLIST.md` physical lines 200~205의 S5 잔여 여섯 문장을 닫기 위해 필요한 최소 후속 단위만 정의한다. 현재 line 206의 `integration-evaluation.test.ts`/승인 예산 실측은 별도 future live gate이며 이 여섯 문장에 추가한 체크 항목으로 세지 않는다.

## 결론

다음 세 단위를 순서대로 구현한다.

1. **host-verified measured-fact seal**: 기존 등록과 관측을 실제 실행 입력, 실행 주체 revision, 품질, 시간, 환경, 가격과 비용 근거에 결합한다. 불완전한 사실도 저장하되 trial로 만들지 않는다.
2. **sealed paired campaign + measured trial/comparison v2**: 실행 전에 수동 기준선과 한 모드의 evaluation/holdout 전체 membership을 동결하고, 실제 fact가 완전한 경우에만 versioned trial과 통계 자격 snapshot을 만든다. 네 모드는 네 개의 독립 campaign/snapshot으로 평가한다.
3. **observed-only policy release + append-only rollback**: 양 split에서 자격을 얻은 실제 snapshot만 다음 시작 시점의 정책 설정에 반영하고, 이전 설정을 새 immutable revision으로 복원한다.

현재 최고 migration은 source와 `daemon/dist/migrations` 모두 `031_orchestration_handoff_activity.sql`이다. 그러나 031은 최초 독립 검토가 **BLOCKED**였고 `correction1-contract.md` 이후 소스가 다시 바뀌는 중이다. S5 단위 1은 031의 최종 독립 PASS, source/dist parity, hostile lineage gate가 끝난 뒤에만 시작한다. 031의 존재나 현재 새 trigger만으로 handoff/tool/model/cost 사실을 신뢰하지 않는다.

```text
026 enrollment -> 027 historical observation -> 028 permanent null projection
                                                    |
029 manual baseline authority -> 030 descriptive insufficient snapshot

031 handoff/activity FINAL PASS
        -> Unit 1 measured fact seal
        -> Unit 2 sealed campaign + measured trial/comparison v2
        -> Unit 3 policy release / rollback
        -> 별도 future live evidence gate
```

## 현재 사실과 호환성 경계

- `enrollment.ts`는 승인/실행 전 dataset/case/split/arm/policy/metric/environment/account-limit 참조를 고정하지만 실행 입력 일치는 `claimed-not-verified`다. 일반 등록은 `manual-baseline`을 거부하고, 수동 기준선은 `baseline.ts`의 host verifier를 거쳐야 한다.
- `run-outcome.ts`와 `observations.ts`는 strict historical acceptance, 실패, 취소 요청, unknown, 불완전 billing을 손실 없이 보존한다. 이 계약의 `toolRevision`, `modelRevision`, `quality`, `elapsedMs`, 네 비용 구성요소는 의도적으로 null이다.
- `trials.ts`는 위 null을 보완하지 않는다. 현재 028 projection은 항상 `trial:null`이며 이 결과는 영구 historical format으로 유지해야 한다.
- `comparison.ts`는 fixture를 포함한 메모리 기술 통계를 낼 수 있지만 `promotionEligible:false`, `statisticalQualification:'not-performed'`다. `comparisons.ts`의 030 snapshot도 이 결과를 불변 저장할 뿐이다.
- 028과 030의 decoder는 현재 dependency로 canonical payload를 재구성한다. 기존 파일의 의미를 바꾸면 이미 저장된 row가 upgrade 후 손상으로 보일 수 있으므로 measured trial/comparison은 **새 v2 table과 새 decoder**를 사용한다. 026~030 row를 UPDATE, backfill, reinterpret하지 않는다.
- S3 031은 launch intent, identity, typed activity, artifact handoff를 제공하려 하지만 최초 review는 cross-attempt lineage, 실제 default path activity, raw legacy activity, empty handoff, artifact replay, durable identity, UI truth state를 blocker로 기록했다. correction의 최종 독립 결과 전에는 이 데이터를 observed evidence로 승격하지 않는다.
- offline fixture는 schema, canonicalization, ordering, rollback, 통계 계산 구조만 검증한다. `source:'fixture'`, `authority:'structural-test-only'`를 유지하며 품질·시간·가격·비용 개선 또는 promotion eligibility로 변환할 수 없다.

## 공통 migration preflight와 변경 규칙

각 단위 구현자는 **그 단위의 첫 product edit 직전** 다음을 다시 실행한다.

```powershell
Get-ChildItem daemon/migrations -File | Sort-Object Name | Select-Object -ExpandProperty Name
Get-ChildItem daemon/dist/migrations -File | Sort-Object Name | Select-Object -ExpandProperty Name
git status --short -- daemon/migrations daemon/src/ledger.ts daemon/scripts/copy-assets.mjs
```

이 설계에서 단위 1/2/3의 임시 번호는 032/033/034다. 다른 작업이 번호를 차지했으면 기존 파일을 수정하거나 덮어쓰지 말고 그 시점 최고 번호 `H` 다음의 `H+1`로 해당 단위 전체를 renumber한다. source migration, `ledger.ts` 적용 순서, `copy-assets.mjs`, dist copy 이름은 한 번호로 일치해야 한다. 각 migration은 fresh DB와 직전 migration까지 적용된 file-backed DB 양쪽에서 close/reopen, `PRAGMA foreign_key_check`, source/dist SHA-256 parity를 통과해야 한다.

각 단위의 correction cap은 **2회**다. 매 pass마다 그 단위의 전체 focused tests, typecheck, build, migration parity, reopen/tamper probe, owned-file whitespace 검사를 반복한다. 실패하면 동일 명령 반복 대신 새 counterexample/hypothesis를 기록한다. 두 번 뒤에도 실패하면 row나 fixture를 완화하지 않고 blocker를 보존한다.

## Unit 1 — host-verified measured-fact seal (임시 migration 032)

### 시작 조건과 exact ownership

시작 조건은 S3 031 correction의 최종 독립 PASS다. 특히 same-attempt receipt/identity/handoff, 실제 default model/checker activity, artifact bytes 재검증, non-empty required output, durable identity ref가 통과하지 않으면 Unit 1은 시작하지 않는다.

구현자는 아래 파일만 소유한다.

- `daemon/migrations/032_evaluation_measured_fact.sql` (구현 직전 번호 재확인 후 필요 시 전체 renumber)
- `daemon/src/ledger.ts` (해당 migration 등록 줄만)
- `daemon/scripts/copy-assets.mjs` (해당 migration copy 줄만)
- `daemon/src/evaluation/measurement-contracts.ts` (신규: metric/environment/account/price authoritative registry)
- `daemon/src/evaluation/measured-facts.ts` (신규)
- `app/core.mjs` (host-only store 구성, workspace guard, 명시 capture/read API만)
- `app/core.d.mts` (위 API type만)
- `daemon/test/integration-evaluation-measured-facts.test.ts` (신규)
- `daemon/test/integration-evaluation-measurement-contracts.test.ts` (신규)
- `daemon/test/integration-evaluation-observations-core.test.ts` (새 Core 경계 회귀만)
- `daemon/test/integration-handoff-activity.test.ts` (S3 accepted contract 소비 회귀만; 031이 최종 PASS된 뒤 소유 인계)

`run-outcome.ts`, `observations.ts`, `trials.ts`, `comparison.ts`, `comparisons.ts`, driver, renderer, provider adapter를 이 단위에서 바꾸지 않는다.

### Durable schema

같은 migration에 `evaluation_metric_contract`, `evaluation_environment_snapshot`, `evaluation_account_limits_snapshot`, `evaluation_price_snapshot`을 먼저 만든다. 각각 host authority가 canonical definition/observation bytes에서 digest를 다시 계산해 넣는 immutable registry다. 모든 row는 `authority_class(host-observed|offline-fixture)`, source revision/digest, observed/registered time, bounded canonical payload를 가지며 UPDATE/DELETE/REPLACE를 거부한다. metric은 score domain과 평가 algorithm revision, environment/account snapshot은 비교에 필요한 field schema와 completeness, price는 provider/currency/unit/effective time을 명시한다. 단순 `{id,revision,digest}`나 digest 자기일치만으로 authority를 만들 수 없다.

`evaluation_measured_fact`는 observation마다 최대 한 개의 immutable fact seal을 저장한다.

```text
fact_id PK
enrollment_id FK -> evaluation_enrollment
observation_id UNIQUE FK -> evaluation_observation
run_id, dataset_digest, case_id, arm, policy_digest
producer_class CHECK(host-observed | offline-fixture)
producer_revision, producer_digest
recorded_at_ms
payload_digest, payload (<= 1 MiB)
UNIQUE(enrollment_id, observation_id)
```

UPDATE/DELETE/REPLACE를 trigger로 거부한다. scalar columns, canonical payload, dependency digests를 read마다 재구성한다. exact `factId` replay는 같은 enrollment/observation과 같은 producer result일 때만 원본을 반환한다. late billing/cleanup/quality settlement는 기존 fact를 바꾸지 않고 새 observation revision과 새 fact를 요구한다.

payload v1은 다음을 보존한다.

- `executedInput`: dataset input digest와 실제 dispatch input bytes를 host가 다시 hash한 digest, evidence ref/digest, match 여부. mismatch는 저장 가능한 불충분 사실이지만 trial 전환은 금지한다.
- `executionSubjects[]`: 모든 attempt의 role/state/retry lineage, canonical candidate digest, 031 launch intent/identity/handoff digest, host catalog의 exact tool ID/revision, explicit model ID/revision 또는 null. candidate 이름에서 model/tool을 추론하지 않는다.
- `activityCutoff`: attempt별 terminal cutoff ordinal과 그때까지의 모든 typed activity `eventId/ordinal/kind/canonical-payload-digest` ordered manifest 및 manifest digest. ordinal gap, terminal 뒤 accepted activity, 누락 usage/tool/output/terminal support는 completeness를 막는다.
- `quality`: 사전 등록된 metric id/revision/digest와 동일한 독립 verifier가 artifact bytes에 대해 만든 score 또는 null, evidence digest, evaluated artifact digests. acceptance pass를 임의의 연속 점수로 바꾸지 않는다.
- `timing`: host-observed start/end, clock id/revision/digest, elapsed 또는 null, queue/cleanup 포함 범위. claim time이나 observation time 차이를 실행 latency로 대체하지 않는다.
- `environment`와 `accountLimits`: enrollment ref와 일치하는 host snapshot digest, 관측 시각, 비교에 필요한 부하/용량 필드의 completeness. raw env/secrets는 저장하지 않는다.
- `accounting`: `monetary | local-invocation | unknown` discriminant. monetary item은 receipt revision/digest, provider-final actual units, currency/unit, price source digest/vintage, 그리고 상호 배타적인 `base|retry|handoff|verification` class를 가진다. 모든 cost-bearing item coverage가 확인돼야 총비용이 완전하다. local은 committed dispatch-intent count와 역할/재시도 분류를 저장하되 화폐나 실제 provider-call 수로 바꾸지 않는다.
- `uncertaintyReasons`: 누락/불일치/미종결 항목의 bounded 정렬 목록. outcome은 027 observation에서만 온다.

### API와 trusted producer boundary

공개 write 입력은 `{ factId, enrollmentId, observationId }` 세 식별자뿐이다.

```text
createEvaluationMeasuredFactStore(db, host).capture(ids)
  -> host clock supplies recordedAtMs
  -> host re-reads input/artifact/catalog/clock/environment/billing sources
  -> store re-reads 026 enrollment + 027 observation + accepted 031 lineage
  -> immutable complete-or-partial fact
```

`host`는 main-process construction에서 주입한 synchronous verifier/reader 집합이다. renderer, model output, report JSON, plugin manifest, caller score/cost/timestamp는 producer가 될 수 없다. fact recording time도 host clock에서만 온다. host callback 결과도 그대로 믿지 않고 authoritative registry의 canonical bytes/digest/registration time, enrollment reference, 031 same-attempt lineage와 typed activity cutoff, receipt/provider-final rules, observed time ordering과 artifact bytes digest를 store가 대조한다. callback 부재/throw/Promise/unknown revision은 fail closed 또는 explicit unavailable이며 observed 값을 만들지 않는다.

테스트용 producer는 별도 factory로 `producerClass:'offline-fixture'`가 강제된다. 객체에 `host-observed` 문자열이나 digest를 넣어도 privilege를 얻지 못한다. 저장된 `producer_class='offline-fixture'`는 이후 모든 comparison/promotion에서 영구 거부된다.

### Hostile tests

- proxy/accessor/custom prototype/extra key/oversize array·payload·identifier·unsafe integer를 getter/SQL 0으로 거부한다.
- 다른 enrollment/run/observation, 오래된 observation, policy/dataset/case/arm mismatch, cross-attempt receipt/identity/handoff, legacy 031 row를 거부한다.
- input digest mismatch, missing artifact, artifact changed after prepare, candidate alias로 tool/model substitution, `unknown` revision을 문자열 revision으로 위장한 입력은 fact를 incomplete로 남기거나 거부하며 trial-ready가 되지 않는다.
- success만 골라 capture해도 campaign coverage가 채워지지 않음을 보인다. fail/cancelled/unknown observation도 같은 denominator 권한으로 저장된다.
- quality verifier와 producer가 같거나 metric revision이 다르거나 acceptance를 score로 제출하면 quality unavailable이다.
- caller가 만든 metric/environment/account/price digest, registry보다 이른 enrollment를 사후 등록한 contract, registry payload/digest 변조를 거부한다.
- activity ordinal gap, 다른 attempt event, terminal cutoff 누락/변조, cutoff 뒤 usage를 앞선 fact에 끼워 넣기, supported activity 누락을 incomplete 또는 integrity failure로 남긴다.
- end-before-start, claim/observation timestamp를 elapsed로 사용, environment/account drift, stale/future price, non-final/estimated receipt, receipt 중복, 통화/단위 혼합을 거부 또는 explicit unknown으로 남긴다.
- retry link 없는 retry 비용, handoff에 별도 billed item/evidence 없는 임의 handoff 비용, verification 역할과 맞지 않는 cost class, 한 receipt의 중복 class 배정을 거부한다. 증거 있는 authoritative zero만 0이고 누락은 null이다.
- close/reopen, 두 SQLite connection 충돌, exact replay, changed replay, trigger 제거 뒤 scalar/payload/dependency digest 변조를 검증한다.
- offline fixture가 구조상 완전한 숫자를 반환해도 `host-observed`나 promotion-ready로 승격되지 않는다.

### Done commands

`daemon/`에서 실행한다.

```text
npm run build
npx --no-install vitest run test/integration-evaluation-measurement-contracts.test.ts test/integration-evaluation-measured-facts.test.ts test/integration-evaluation-observations.test.ts test/integration-evaluation-observations-core.test.ts test/integration-evaluation-outcome.test.ts test/integration-handoff-activity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
```

그 뒤 fresh/pre-032 file-backed reopen + foreign-key check, source/dist migration hash parity, owned-file `git diff --check`를 실행한다. 이 offline 완료는 ingestion 구조만 통과시키며 체크리스트 lines 200/201/204를 닫지 않는다.

## Unit 2 — sealed paired campaign과 measured comparison v2 (임시 migration 033)

### 의존성과 exact ownership

Unit 1 독립 PASS 뒤 시작한다. 기존 028/030 row는 그대로 읽혀야 한다.

구현자는 아래 파일만 소유한다.

- `daemon/migrations/033_evaluation_campaign_v2.sql` (구현 직전 번호 재확인 후 필요 시 전체 renumber)
- `daemon/src/ledger.ts` (해당 migration 등록 줄만)
- `daemon/scripts/copy-assets.mjs` (해당 migration copy 줄만)
- `daemon/src/evaluation/campaign.ts` (신규: membership/phase/cutoff)
- `daemon/src/evaluation/measured-trials.ts` (신규 v2 projection)
- `daemon/src/evaluation/qualified-comparisons.ts` (신규 v2 comparison/statistical qualification)
- `app/core.mjs` (workspace-scoped seal/phase/project/compare API만)
- `app/core.d.mts` (위 API type만)
- `daemon/test/integration-evaluation-campaign.test.ts` (신규)
- `daemon/test/integration-evaluation-measured-trials.test.ts` (신규)
- `daemon/test/integration-evaluation-qualified-comparisons.test.ts` (신규)
- `daemon/test/integration-evaluation-comparisons-core.test.ts` (Core/version coexistence 회귀만)
- `daemon/test/integration-evaluation.test.ts` (기존 v1 산술 회귀만)

기존 `trials.ts`, `comparison.ts`, `comparisons.ts`, migrations 026~030을 수정하지 않는다.

### Campaign schema와 실행 계보

한 campaign은 한 mode와 `manual-baseline`을 비교한다. 네 모드를 입증하려면 서로 다른 네 campaign이 필요하며 한 mode의 결과를 다른 mode로 재사용하지 않는다.

- `evaluation_campaign_v2`: dataset digest, mode, baseline/candidate policy refs, authoritative metric/environment/account contracts, predeclared constraints, statistical method revision, membership digest, created/sealed time, host authority digest, 그리고 ledger 밖 trusted custodian이 보관하는 `holdoutManifestRef/digest`를 저장한다. 원장에는 holdout input bytes가 들어가지 않는다. immutable.
- `evaluation_campaign_member_v2`: dataset의 모든 case마다 정확히 `manual-baseline`과 해당 mode 두 arm의 **planned slot**을 seal한다. slot은 case/input digest/split/arm/policy만 가지며 run/enrollment를 아직 요구하지 않는다. `case × arm`은 unique이고 complete cartesian membership이어야 한다.
- `evaluation_campaign_execution_binding_v2`: seal 뒤 slot마다 정확히 하나의 enrollment/run을 append-only 결합한다. evaluation slot은 seal 이후, holdout slot은 `holdout-released` 이후 생성된 run만 허용한다. host가 custodian bytes를 release 후에 normal goal input으로 materialize하고 hash해 slot input digest와 대조한 뒤, 기존 enrollment/baseline API가 승인/attempt 전에 만든 exact enrollment를 결합한다. run/enrollment는 campaign 전체에서 unique다.
- `evaluation_campaign_phase_v2`: append-only `sealed -> evaluation-cutoff -> holdout-released -> closed`. evaluation cutoff는 evaluation split의 binding/fact IDs를 고정한다. holdout release는 candidate policy/constraints가 이미 sealed되고 holdout input bytes가 아직 어떤 task/run에도 materialize되지 않았음을 custodian authority가 증명할 때 기록한다. timeout이나 missing authority가 release를 합성하지 않는다.
- `evaluation_measured_trial_projection_v2`: campaign/member/enrollment/observation/measured-fact digests를 결합한다. 사실이 불완전하면 `trial:null`과 이유를 보존한다. v1 028 row를 upgrade하지 않는다.
- `evaluation_qualified_comparison_snapshot_v2`: evaluation/holdout별 exact paired membership, fact/trial cutoffs, outcome denominator, objective, `n/mean/sampleVariance`, confidence interval, quality/success/unknown/price/environment/cost checks, result digests를 불변 저장한다.

실제 실행은 기존 승인/driver 경로만 사용한다. campaign API는 모델/provider를 호출하거나 approval을 쓰지 않는다. holdout bytes의 보관·release는 main-process의 trusted custodian 또는 독립적으로 감사된 외부 custodian만 맡는다. renderer/campaign caller는 bytes/ref를 resolve할 수 없다. release 뒤 생성된 run이 어떤 case/arm에 속했고 실제 dispatch input이 dataset digest와 일치했는지를 Unit 1 fact로 증명한다. 이 연결이 없으면 member는 영구 incomplete다.

### Trial v2와 네 모드 결정 규칙

trial v2는 하나의 임의 `toolId/modelId`로 다단계 실행을 축약하지 않는다. 모든 attempt subject revision과 role/retry/handoff digest를 ordered `executionSubjects[]`로 보존하고 별도 `executionProfileDigest`로 그룹화한다. `taskKind`는 dataset case에서만 온다. outcome은 observation에서만, 나머지 측정값은 Unit 1 fact에서만 온다.

모든 mode의 공통 gate는 다음과 같다.

- evaluation과 holdout 모두 complete paired coverage, predeclared minimum sample, 모든 enrollment outcome 포함, 같은 metric revision을 요구한다.
- non-success는 success denominator에서 빠지지 않고 quality contribution 0 규칙을 명시한다. unknown rate 한도와 모든 required-field uncertainty를 보존한다.
- 각 pair의 environment/account condition이 일치하거나 사전 선언된 stratification에 속해야 한다. 사후에 불리한 pair를 제거하지 않는다.
- `source='host-observed'` fact만 실측 후보다. fixture가 산술상 개선이어도 `structural-only`, promotion evidence false다.
- paired delta의 `n`, mean, sample variance와 preregistered `paired-bootstrap-lcb-v1`(고정 resample 수와 campaign digest seed)을 저장한다. 양 split에서 lower confidence bound가 predeclared minimum improvement를 넘어야 `qualified`; 통계 계산만으로 인과나 외부 일반화를 주장하지 않는다.

모드별 추가 gate는 다음과 같다.

| mode | 목적 | 반드시 필요한 근거 |
|---|---|---|
| efficiency | `cost/costBasis + elapsed/timeBasis` 감소 | final actual monetary total, price vintage/source, 전체 네 cost class coverage, elapsed, 품질 하한/비회귀 |
| performance | 검증 품질 증가 | 동일 metric의 quality, success/unknown gate, 모든 trial의 predeclared 실제 budget cap. local-invocation은 명시 invocation cap은 검사할 수 있지만 화폐 budget 개선으로 표현하지 않음 |
| value | 품질 유지 + 총 화폐비용 감소 | final actual monetary 비용, currency/unit 호환, price vintage, 품질 하한/비회귀. local count나 USD=0은 가성비 근거가 아님 |
| speed | 품질 유지 + end-to-end elapsed 감소 | 동일 clock/scope의 elapsed, 품질 하한/비회귀. 비용이 unknown이면 speed-only 결과에 그 불확실성을 남기며 비용 개선은 주장하지 않음 |

양 split이 모두 `qualified`여도 snapshot의 `promotionEvidenceEligible`은 measured completeness를 나타낼 뿐 실제 정책 쓰기 권한은 아니다.

### Hostile tests

- incomplete cartesian slots, 결과를 본 뒤 slot 추가, duplicate run/case/arm, wrong split/policy/mode, holdout input overlap, seal 뒤 slot 변경을 거부한다.
- candidate policy/constraints 동결 전 holdout release, release 전 holdout run/input materialization, custodian ref/digest mismatch, evaluation cutoff 없는 release, reverse/duplicate/conflicting phase event를 거부한다.
- observation만 있고 fact 없음, fixture fact, input mismatch, mixed producer/metric/policy revisions, cross-campaign projection, latest-success로 실패 대체를 모두 non-convertible로 유지한다.
- 다중 tool/model 실행을 단일 revision으로 축약하지 않고 missing revision 한 개만 있어도 관련 stratification/qualification을 open으로 둔다.
- sample n 부족, high variance/LCB 실패, quality regression, unknown rate 초과, unmatched environment/account, stale/future price, estimated/non-final cost, retry/handoff/verification 누락을 split별 reason으로 보존한다.
- 네 mode 각각 positive/negative/insufficient 구조 fixture를 테스트하되 모두 structural-only다. value/efficiency에 local count나 mixed currency를 주면 numeric monetary improvement를 만들지 않는다.
- v1 028/030 fixture를 pre-033 DB에서 만든 뒤 upgrade하고 byte-identical read를 확인한다. v2 row update/delete/replace, payload/reason/statistical digest tamper, exact replay conflict, two-connection race, 4096 이전 bound-before-read를 검증한다.

### Done commands

`daemon/`에서 실행한다.

```text
npm run build
npx --no-install vitest run test/integration-evaluation-campaign.test.ts test/integration-evaluation-measured-facts.test.ts test/integration-evaluation-measured-trials.test.ts test/integration-evaluation-qualified-comparisons.test.ts test/integration-evaluation-comparisons.test.ts test/integration-evaluation-comparisons-core.test.ts test/integration-evaluation-trials.test.ts test/integration-evaluation-baseline.test.ts test/integration-evaluation-enrollment.test.ts test/integration-evaluation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
node --check ../app/core.mjs
```

그 뒤 fresh/pre-033 upgrade reopen, v1 hash/read parity, foreign-key check, migration source/dist hash parity, owned-file `git diff --check`를 실행한다. offline completion은 campaign/통계 구조만 검증하며 실제 holdout 독립성이나 네 모드 개선을 입증하지 않는다.

## Unit 3 — observed-only policy release와 rollback (임시 migration 034)

### 의존성과 exact ownership

Unit 2 독립 PASS 뒤 시작한다. release는 v2 snapshot만 소비한다.

구현자는 아래 파일만 소유한다.

- `daemon/migrations/034_evaluation_policy_release.sql` (구현 직전 번호 재확인 후 필요 시 전체 renumber)
- `daemon/src/ledger.ts` (해당 migration 등록 줄만)
- `daemon/scripts/copy-assets.mjs` (해당 migration copy 줄만)
- `daemon/src/evaluation/promotion.ts` (신규: release/rollback event와 qualification 재검증)
- `daemon/src/selection/local-host-settings.ts` (같은 transaction에서 exact settings revision을 쓰는 internal capability만; public direct promotion 금지)
- `app/core.mjs` (host-authorized promote/rollback/read API와 `setupRestartRequired` 전환만)
- `app/core.d.mts` (위 API type만)
- `daemon/test/integration-evaluation-promotion.test.ts` (신규)
- `daemon/test/integration-local-host-settings.test.ts` (settings CAS/immutability 회귀만)
- `daemon/test/integration-default-generated-json-bootstrap.test.ts` (restart 뒤 실제 latest settings 소비 회귀만)

renderer/IPC, `selection/preferences.ts`, 이미 bound된 run, policy snapshot 내용을 바꾸지 않는다.

### Durable release/rollback contract

`evaluation_policy_release_event`는 mode별 append-only chain이다.

```text
event_id PK, mode, ordinal, action(promote|rollback)
previous_event_id, previous_settings_id/revision/digest
target_policy_id/revision/digest
qualified_comparison_snapshot_id/digest (promote 필수, rollback은 원 promotion ref 필수)
authority_id/revision/digest
recorded_at_ms, payload_digest, payload
UNIQUE(mode, ordinal)
```

promotion은 store가 v2 snapshot과 모든 dependency를 다시 읽어 다음을 모두 확인한 뒤에만 허용한다: exact candidate policy/mode, evaluation+holdout `qualified`, host-observed only, complete facts, statistical LCB/quality/success/unknown/environment/account/price/cost gates, `promotionEvidenceEligible:true`, trusted release authority. caller가 `eligible:true`나 통계/score를 제출할 수 없다.

현재 default bootstrap은 네 mode가 같은 producer/checker pair를 사용한다고 요구한다. 이 최소 단위는 target local policy의 pair가 현재 네 settings ref의 공통 pair와 정확히 같을 때만 promotion을 허용한다. pair를 바꾸는 후보는 `unsupported-active-host-profile`로 open 유지한다. `app/default-generated-json-bootstrap.mjs`를 바꾸지 않고 mode별 서로 다른 candidate pair 지원을 암시하지 않는다.

promotion event와 `local_host_settings_snapshot`의 새 revision은 한 immediate transaction에서 commit한다. settings의 해당 mode policy ref만 target으로 바뀌고 나머지 mode, enabled/accounting/limits/output bounds는 이전 bytes를 유지한다. 이미 준비·승인·실행 중인 run의 immutable binding은 바뀌지 않는다. Core는 성공 뒤 `setupRestartRequired=true`로 새 goal 준비를 막고, 다음 protected startup의 `default-generated-json-bootstrap.mjs`가 latest settings를 읽을 때만 새 정책이 효력을 얻는다.

rollback은 성능 증명을 요구하지 않는다. 운영자가 신뢰된 rollback authority로 특정 promotion event를 지정하면 그 event가 기록한 **직전 settings의 exact policy map**을 새 immutable settings revision으로 복원한다. row 삭제, policy revision 감소, 기존 run rebind는 없다. 동일 event replay만 idempotent하고 다른 target/reason은 conflict다. settings CAS나 chain head가 바뀌면 event와 settings 모두 0 write다.

### Hostile tests

- v1 030 snapshot, fixture/insufficient/no-improvement/한 split만 qualified/stale price/high variance/missing cost class/wrong mode/wrong candidate snapshot의 promotion을 거부한다.
- forged `promotionEvidenceEligible`, caller score/authority, proxy/accessor, canonical SQL row tamper, dependency digest drift를 거부한다.
- qualification read와 settings write 사이 경쟁, 두 connection 동시 promotion, stale expected settings/event revision은 정확히 한 winner 또는 0 write다.
- 실제 observed fact가 없는 offline gate에서는 product promotion/rollback 성공 row를 만들지 않는다. fixture/SQL로 `host-observed`를 위조하지 않고 모든 promotion 요청의 write count 0을 확인한다.
- 별도 pure transaction planner와 rollback fault harness는 `authority:'simulation-only'` plan만 반환하고 product tables/settings에 쓰지 않는다. 이를 사용해 event/settings atomic statement ordering, predecessor map 보존, CAS conflict, rollback의 rollback/duplicate/out-of-order/missing predecessor를 구조 검증한다.
- already-bound/prepared run 불변, restart-required, promoted/ref restored consumption의 **성공 경로**는 future live gate에서만 검증한다. offline bootstrap test는 기존 settings read 회귀와 simulated plan이 bootstrap 입력이 될 수 없음을 확인한다.

### Done commands

`daemon/`에서 실행한다.

```text
npm run build
npx --no-install vitest run test/integration-evaluation-promotion.test.ts test/integration-evaluation-qualified-comparisons.test.ts test/integration-local-host-settings.test.ts test/integration-default-generated-json-bootstrap.test.ts test/integration-policy-store.test.ts test/integration-selection-preference-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
node --check ../app/core.mjs
```

그 뒤 fresh/pre-034 reopen, foreign-key check, negative product-write probes, write-free simulation plan/fault probes, migration source/dist hash parity, owned-file `git diff --check`를 실행한다. offline gate는 성공한 product promotion/rollback row를 요구하지 않으며 실제 positive path는 future live evidence 전까지 open이다.

## 별도 future live evidence gate

세 offline 구현 단위의 done command에는 provider/model/Qwen/native/Electron 호출을 넣지 않는다. 현재 해당 예산/attempt가 소진된 상태이므로 재실행도 요구하지 않는다. live gate는 새 승인 예산과 새 attempt 계약이 생긴 뒤 별도 작업으로만 연다.

필요한 live gate는 다음과 같다.

1. 승인된 실제 dataset과 숨겨진 holdout, 네 mode별 campaign, complete manual-baseline pair를 사전 봉인한다. case input bytes/hash, policy/metric/environment/account/price 계약을 실행 전에 보존한다.
2. 기존 실제 host 경로로 실행하고 provider/model/native 식별, artifact, clock, final billing, retry/verification/handoff 근거를 수집한다. 성공뿐 아니라 fail/cancelled/unknown과 미실행 enrollment를 모두 denominator에 남긴다.
3. 각 mode의 evaluation 결과를 고정한 뒤 holdout release authority를 기록하고 holdout을 실행한다. holdout을 본 뒤 policy/threshold/member를 바꾸면 campaign을 폐기한다.
4. 독립 checker가 원본 fact/source hash와 metric 결과를 재검증하고 네 v2 comparison을 만든다. 품질 floor, sample variance/LCB, 환경/가격/비용 조건 하나라도 부족하면 `insufficient`다.
5. 실제 observed snapshot으로 promotion을 한 번 수행하고 새 startup에서 새 policy ref가 선택되는지 확인한다. 이어 rollback event를 기록하고 다시 시작해 이전 ref가 복원되는지 확인한다. 기존 prepared run이 바뀌지 않았고 재실행 0임을 확인한다.
6. source revision, 명령/exit, 입력/출력 hashes, 환경, 가격 vintage, 실제/추정/미측정 표기, 예산 receipt, 독립 리뷰를 새 `evidence/integrations/S5/<run-id>/`에 보존한다.

## 어떤 증거가 없으면 계속 open인가

| 요구 사실 | open으로 유지해야 하는 최소 결손 |
|---|---|
| 작업 유형/도구/모델/revision | dataset case kind, 실제 input match, 모든 attempt의 accepted 031 launch intent/identity/handoff, canonical tool/model revision 중 하나라도 없음 |
| 품질 하한 | 사전 등록 metric revision, 평가 대상 artifact digests, 독립 verifier evidence, 모든 pair의 score/outcome 중 하나라도 없음. acceptance pass만 있음 |
| 불확실성/분모 | sealed cohort 전체 enrollment, fail/cancelled/unknown/unavailable, missing execution을 모두 센 cutoff가 없음; required uncertainty가 threshold 안인지 증명되지 않음 |
| 표본 수/분산 | 양 split complete pairs, predeclared minimum n, paired deltas, sample variance, preregistered confidence 결과 중 하나라도 없음 |
| 환경/account limits | pair별 host-observed environment/account digest와 부하·용량 snapshot이 없거나 drift를 사전 stratification으로 처리하지 않음 |
| 가격 시각 | usage보다 늦지 않은 provider price observation, source digest, currency/unit, max-age, actual usage 결합 중 하나라도 없음. 현재 가격을 과거 run에 소급 적용함 |
| retry 비용 | 모든 retry link/attempt와 final receipt의 1:1 cost item/class coverage가 없음; 마지막 성공만 보고 이전 실패 비용을 제외함 |
| handoff 비용 | 031 최종 PASS handoff lineage와 별도 billed item/authoritative zero가 없음. artifact 전달 자체를 임의 금액이나 0으로 환산함 |
| 수동 기준선/holdout | host-authorized baseline, complete `case × arm`, 시작 전 seal, actual input match, evaluation cutoff 뒤 holdout release가 없음 |
| 네 모드 비교 | 해당 mode의 별도 양-split observed snapshot과 모드별 objective/quality/budget gate가 없음. 한 mode/fixture 결과를 재사용함 |
| promotion | v2 observed-only qualified snapshot, exact target policy, release authority, settings CAS/restart consumption 중 하나라도 없음 |
| rollback | promotion event의 predecessor settings, trusted rollback authority, append-only restore revision, restart 뒤 이전 policy 소비 증거 중 하나라도 없음 |

## 체크리스트 physical lines 200~205 현재 판정

지금 닫을 수 있는 항목은 **없다**.

| 번호 | 현재 상태 | 이유 |
|---:|---|---|
| 200 | open | “작업 유형/도구/모델/revision별 성과와 불확실성”에 필요한 실제 tool/model revision, quality/time/environment/price fact가 없음 |
| 201 | open | “실패·취소·unknown 및 인계/재시도 비용”의 outcome 분모는 보존되지만 retry/handoff/verification 비용의 신뢰 가능한 breakdown이 없음 |
| 202 | open | “동결 평가셋/별도 holdout/수동 기준선”의 dataset shape와 baseline authority는 있으나 complete paired cohort, verified input execution, 독립 holdout 실행이 없음 |
| 203 | open | “네 모드 품질 하한과 개선 목적”은 fixture 산술만 있고 실제 양-split improvement가 없음 |
| 204 | open | “표본 수·분산·환경·가격 시각”의 실제 cohort evidence가 없음 |
| 205 | open | “미확인 정책 비승격과 이전 정책 복구”의 promotion은 항상 false이고 effective release/rollback 및 실제 복원 증거가 없음 |

현재 line 206의 통합 테스트와 승인 예산 내 실측도 open이지만, 이는 본 요청의 six-line mapping 밖 future live gate로만 기록한다.

## 설계 검증 계약

- 완료: 이 문서가 현재 null/insufficient 이유, 031 in-progress 의존성, 세 단위의 exact ownership/schema/API/trust/hostile tests/done commands/cap2, future live gate, open evidence matrix와 physical lines 200~205 판정을 포함한다.
- 검증: 필수 문구 검색, owned-file `git diff --check`, SHA-256 계산을 매 pass 실행한다.
- 보정 한도: 2회. 실패 시 새 source/evidence counterexample에 근거한 보정만 허용한다.
- 이 문서의 SHA-256은 문서 밖 최종 handoff에서 보고한다. 자기 hash를 본문에 넣어 hash를 다시 바꾸지 않는다.
