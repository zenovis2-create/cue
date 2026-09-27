# Laya 선택 shadow 경계 (2026-09-23)

Cue의 실제 선택은 `selection/policy.ts`와 오케스트레이션 엔진의 호스트 관측·승인 정책·예산 예약·writer lease에 남는다. 이 구현은 **이미 기록된 시도**의 `attempt_selection`을 검증해 읽은 다음, 그때 적격이었던 금전 후보 2–8개에 대한 Laya `choice` 질문을 만들고 응답을 기준 선택과 비교한다. 기존 선택, 계획, 실행 후보, 승인, 예산, Stop, ledger 행은 바꾸지 않는다. 고정 로컬 producer/checker 조합, pinned 선택, 단일 적격 후보, 레거시 미기록 시도는 비교하지 않는다.

`createLayaShadowAdapter(db).prepare({attemptId, taskSummary, options})`는 `Agent.system_one(state, questions)`에 넘길 `{state, questions}`를 반환한다. `options`는 **기록된 적격 후보 ID의 정렬된 정확한 집합**이어야 한다. 설명과 작업 요약은 호출자가 로컬 추론에 공개해도 되는 내용만 넣어야 한다. private estimate/source, 원문 goal, 자격 증명, 경로를 자동 복사하지 않는다. 호출자는 이 반환값을 실행 권한으로 해석하면 안 된다. `compare(input, response)`는 기록을 다시 검증해 Laya의 `choice` 응답 형식을 검사하고 `agree/disagree/invalid-response/unavailable`만 돌려준다. 응답 출처는 `unverified-response`; confidence·action probability는 자격이나 품질 점수가 아니다. 둘 다 `authority:'none'`, `promotionEligible:false`다.

앱 내부의 `core.prepareLayaShadowSelection`과 `core.compareLayaShadowSelection`은 현재 worktree의 실제 시도만 허용한다. renderer/IPC, 자동 관측, 외부 HTTP 연결, 모델 프로세스 실행, checkpoint 다운로드, 저장/승격 경로는 없다. 따라서 현재 앱은 Laya를 자동 호출하거나 선택을 개선했다고 주장하지 않는다. 이 경계는 나중에 **별도 승인된** 로컬 런타임과 평가 생산자를 붙일 때 사용하는 비실행 계약이다. Laya 공개 HEAD `010bace`의 `Agent.system_one` 출력 형식에 맞추었으나 체크포인트, 종속성 라이선스, Windows 동작, 정확도는 검증되지 않았다. Laya 서버의 기본 `0.0.0.0`/선택적 bearer 설정은 사용하지 않는다.

위협 모델: 모델/fixture 응답이 허위 ID나 형식, 확률, 추가 필드를 제출할 수 있고 작업 설명에는 prompt injection이나 비밀이 섞일 수 있다. 응답은 후보 집합을 확대할 수 없으며 실행 경로에서 읽지 않는다. 설명 공개 판단은 호스트 책임이고, 이 모듈 자체는 네트워크를 쓰지 않는다. SQLite digest는 원장 내부 결합이지 외부 서명이 아니다. 실제 Laya 사용 시 로컬 파일 체크포인트의 출처·라이선스·무네트워크 로딩, 입출력 제한, 실행 시간/메모리 제한, 취소, 개인정보 검토를 별도로 증명해야 한다.

## 오프라인 cohort 집계

`core.evaluateLayaShadowCohort({source:'offline-fixture',cases:[...]})`는 현재 worktree의 역사 선택을 다시 읽는다. 케이스마다 고유 case/attempt ID, `evaluation` 또는 `holdout`, 위 shadow 입력, 응답 또는 명시적 `null`, 선택적인 fixture 라벨 ID를 제출한다. 양쪽 split에 최소 1개, split별 최대64개다. 없는/다른 worktree 시도, 비교 불가능한 선택, 응답 누락·형식 오류·일치·불일치를 모두 **원래 split의 total**에 포함한다. 잘못된 옵션이나 **비교 가능한 케이스에서** 적격 집합 밖 라벨은 전체 요청을 거부한다. 불가용 케이스에 붙은 라벨은 검증할 수 없어 `labelAvailable:false`로 집계한다. 손상된 역사 기록도 누락으로 조용히 바꾸지 않는다.

결과는 전체 분모, 가용·누락·무효·불가용 건수와 fixture 라벨 일치 건수만 표시한다. 응답이 없는 경우 shadow label match를 성공/실패로 단정하지 않는다. 라벨은 사용자 제출 fixture이지 독립 평가자 증거가 아니며, 후보 간 실제 반사실적 실행 결과도 아니다. `qualityClaim:'withheld-fixture-only'`, `improvementProven:false`, `promotionEligible:false`; 품질·비용·시간 개선율을 산출하지 않는다. 입력 원문/응답은 결과에 포함하지 않고 저장하지 않는다. 자동 추론·IPC·라우팅은 여전히 없다.

다음 단계: 승인된 범위에서 로컬 inference를 호출하고 응답 출처/실패/시간·자원 사용을 계측한다. 실제 Cue 사례의 적격 집합과 독립 라벨을 사전 고정하고 같은 분모로 비교한다. 실패·취소·unknown을 빼지 않고 품질·총 비용·queue-through-cleanup 지연을 검증하기 전에는 라우팅 권한을 주지 않는다. 이번 fixture 테스트는 실제 Laya 추론이나 개선 증거가 아니다.
