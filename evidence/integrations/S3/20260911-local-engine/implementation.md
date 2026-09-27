# Local engine 통합 진행 기록

대상: `daemon/src/orchestration/engine.ts`의 명시적 local engine와 기존 engine의 공통 소유권/취소/reconcile lifecycle, 새 `integration-local-engine.test.ts`. 금전 engine API/SelectionDecision/정책 digest는 유지한다. Local 경로는 021 count와 022 fixed candidate policy를 읽으며 estimates/ranking/금전 receipt를 만들지 않는다. Claim→1회 count 예약→동기 stage 준비→activity가 동일 IMMEDIATE transaction에 있고 runtime은 commit 이후 시작한다.

진단 상한 2회. 첫 build에서 공통 helper의 `acceptance` 리터럴 추론 오류를 `as const`로 수정했다. 다음 build에서 새 fixture가 기존 ExecutionOutcome에 없는 `cancelled`를 사용한 것을 `unknown`으로 수정했다. 이후 build exit 0.

첫 연결 gate(2026-09-11 21:21:40): 기존 engine/retry/runtime 37 PASS, 신규 local 11 FAIL. 모두 requirements fixture 초기화 단계의 `invalid_requirements:policy-plan-mismatch`다. 실제 `verification/requirements.ts`가 `readRunSelectionPolicy`만 읽어 local 정책 바인딩을 인식하지 않는 연결 공백이다. 가짜 monetary binding은 추가하지 않았다. 두 수정 가설 상한 뒤 부모에게 별도 exact policy identity resolver 범위 재계획을 보고했으며, 이 실패는 성공으로 재분류하지 않는다.

최종 완료 판정은 연결 공백 해소 후 focused gate/typecheck 및 독립 review가 필요하다. 모델 호출 0회.

## 승인된 policy identity 연결 unit

부모가 requirements 및 작은 공통 resolver, 필요한 stage 연결을 승인했다. `readRunPolicyIdentity`는 기존 snapshot reader들의 immutable digest 검증을 그대로 사용하여 monetary/local-invocation을 구별한다. 양쪽 binding 동시 존재나 어느 쪽의 손상도 fallback으로 숨기지 않는다. Genuine 022 이전 ledger는 local table 부재를 읽기 전용으로 확인한다. 반환값은 역사적 승인 identity이며 현재 자격/권한/가격을 뜻하지 않는다.

Requirements는 동일한 policy ref/digest를 검증한다. Stage는 monetary candidate allowlist를 그대로 유지하고, local에서는 model-producer→고정 producer / verifier→고정 checker만 허용한다. Acceptance와 retry는 기존 requirements/stage reader를 통해 이 identity를 소비하므로 acceptance core를 수정하지 않았다.

이 별도 unit에서도 상한 2회를 적용했다. 첫 연결 gate는 98 PASS/1 FAIL이었으며 신규 fixture가 존재하지 않는 public `cleanupVerified` 필드를 기대한 문제였다. 실제 `orchestration_attempt.cleanup_verified`를 조회하도록 수정했다. 이후 추가 stage fixture의 resolveScope 반환 타입을 기존 필수 StageScopeGrant 계약에 맞게(호출되면 실패하는 fixture 함수) 수정했다. 추가 실행에서 기본 가상 `C:/fixture`가 normalizeEnvelope의 실제 realpath 검사에 실패했다. 부모가 별도 fixture-only 재계획을 승인하여 기본 worktree를 실제 mkdtemp root로 변경했고, production 안전 검사는 완화하지 않았다.

최종 연결 gate: 2026-09-11 21:29:19, **8 files / 101 PASS**, 11.01s. local engine 13개에는 실제 readonly child envelope, 잘못 교환된 고정 후보 거절, 정책 충돌/손상, 원자적 count/claim rollback, exact replay, explicit clean retry, unknown cleanup 및 금전 receipt 거절이 포함된다. 기존 engine/retry/runtime 37개와 requirements/stage/acceptance/history도 통과했다. 이 실행 직전 공유 build는 동시 driver 타입 변경의 `integration-driver.test.ts:371 limitUnits` 오류에 걸렸으며, 이 unit production source는 그 이전 build exit 0 이후 그대로다. 최종 공유 build 및 독립 review 결과는 별도 review artifact에 기록한다.
