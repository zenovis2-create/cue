# 네이티브 실행 신원 영속화·복구 관찰 계획

상태: 읽기 전용 설계. 구현·새 migration·실제 호출·기존 원장 보정 없음. 이미 소진한 새 gate의 Qwen 2회 한도를 늘리지 않는다.

## 문제와 현재 연결

- `process-launch.ts:103–106`의 session_handle은 launcher PID, host가 기록한 ISO start_time, handle, task/run/cwd를 저장한다. 이 start_time은 실제 Windows 프로세스 생성 시각이 아니다.
- `model-only-launch.ps1:410–412`는 guardian 준비를 기다린 뒤 guardian PID만 출력한다. `:454`에서 실제 profile 이름/SID/taskRoot/profilePath 및 control hashes를 출력한다. C# `Observe`는 `:178`에서 suspended client PID와 createdFileTime, AppContainer 상태를 출력하고, `:266–267`에서 resume 뒤 PID를 출력한다.
- `isolated-local-model.ts`와 `isolated-json-checker.ts`는 이 native frame들을 메모리에 모은다. 모델은 정확한 model_request를 받으면 broker를 시작하고, 검사는 정확한 checker_request를 받으면 authorize_check를 전송한다. 현재 둘 다 durable identity commit을 기다리지 않는다.
- `generated-model-output.ts`의 capture는 native result/completion 이후 생성된 답변과 lineage를 저장한다. 세 프로세스의 신원이나 profile을 보존하는 저장소가 아니다.
- `isolated-model-cleanup.ts`는 private WeakMap으로 소유 실행을 묶고 result에 있는 native frame과 원장 session을 검사한 뒤 OS 부재를 관찰한다. 최종 cleanup_observation 쓰기가 실패하면 이 신원도 durable row에 남지 않는다. 실제 실패에서 이 경로가 발생했다.

## 최소 구현 범위

실행 **신원 기록**과 **정리 관찰/실행 결과**를 별개 계약으로 둔다. 신원 기록은 cleanup, 성공, M/P 자격, provider 종료 또는 과금의 증거가 아니다.

1. native launcher가 이미 보유한 실제 Process 객체/handle에서 launcher 및 guardian의 PID와 Windows 생성 FileTime을 읽어 고정 구조의 `CUE_MODEL_GUARDIAN_IDENTITY` frame을 추가한다. 기존 guardian PID frame과 일치해야 한다. 현재 client 생성 FileTime 관찰을 재사용한다. PID로 추정한 프로세스 생성 시각이나 session.start_time을 사용하지 않는다.
2. 두 adapter에서 실제 세션과 네이티브 frame들을 모아 단 하나의 validated identity를 만든다. identity가 DB에 commit되기 전에는 model broker 요청을 실행하거나 checker authorize_check를 보내지 않는다. 기존 native client 자체는 이미 resume되었을 수 있으므로 모든 OS 부수 효과가 commit 이전에 차단된다고 주장하지 않는다. 부모의 서비스 호출/검사 허가가 commit 뒤라는 좁은 경계다.
3. final result와 독립적인 새 immutable store에 identity를 저장한다. 최종 cleanup 쓰기 실패나 host 종료 후에도 원래 실제 신원은 남는다. 기존 cleanup store의 result 필드나 unknown row를 신원 저장 용도로 재해석하지 않는다.
4. 정상 cleanup verifier는 같은 실행·세션에 묶인 identity ref를 사용하고, 메모리 frame과 불일치하면 unknown으로 처리한다. 재시작 시에는 별도의 **읽기 전용 복구 관찰 API**가 이 immutable identity를 읽어 정확한 대상의 상태를 조사한다. fake execution을 만들거나 WeakMap에 재등록하는 우회 경로를 추가하지 않는다.

## identity 계약

버전, attempt/run ID, candidate canonical ID, role, subjectDigest, launcher session handle 및 정확한 session 6필드, 실제 launcher/client/guardian의 PID+createdFileTime, profile 이름/SID/taskRoot/profilePath, clientKind, control bundle 및 launcher/client/guardian hashes, 관찰 시각과 schema digest를 포함한다. 모든 필드는 승인된 host context와 보호된 native frame에서 가져온다.

- candidate ID는 기존 integration-catalog 계약을 따른다. run/session/attempt 계약을 무차별 확장하지 않는다.
- 세 PID는 양의 정수이고 서로 달라야 한다. client AppContainer SID는 boundary SID와 같아야 하며 pinned control bundle/recipe와 맞아야 한다.
- 실제 taskRoot와 profilePath는 host가 가진 known-folder base 및 native가 보고한 정확한 profile 이름과 일치해야 한다. 임의 경로·환경·credential·prompt·response text·원시 command line은 저장하지 않는다.
- launcher/guardian FileTime이 누락되거나 조회 실패하면 완전한 identity receipt를 발급하지 않는다. PID-only 기록을 정확한 재시작 소유권으로 승격하지 않는다.
- 기존 PID 단독 frame은 호환성·교차검사용으로 유지한다. 중복/충돌/잘못된 순서/frame 초과/unknown kind를 거부한다.

## 저장소와 migration

새 `daemon/src/native-execution-identity-store.ts`와 현재 미사용 migration 번호의 `native_execution_identity` 테이블을 제안한다. 현재 관찰한 마지막 번호는 023이지만 적용 직전 다른 담당자의 migration과 조율한다.

필수 인덱스 열: identity hash PK, attempt/run FK, session_handle FK, candidate ID, subject digest. payload는 bounded canonical UTF-8 BLOB으로 보관한다. 실제 attempt 하나와 session 하나에 정확히 한 identity만 허용한다. 동일 bytes 재전송은 idempotent이고 상이한 identity는 immutable conflict다. UPDATE/DELETE/REPLACE/IGNORE 충돌을 trigger로 차단한다.

store.persist는 외부 transaction 안이면 거부하고 자체 IMMEDIATE transaction의 commit 이후에만 opaque ref를 반환한다. 쓰기 전 원장 run/task/session의 정확한 연결을 검사한다. read는 canonical bytes/hash/indexed identity를 다시 검사한다. schema와 직렬화 안전 검사는 기존 cleanup/capability store 방식을 좁게 재사용하되 문자열 이름만 닮은 별도 권한 판정을 만들지 않는다.

신원은 기존 실제 session의 생성 사실에 연결하며 모든 호출에 orchestration_attempt FK를 강제하지 않는다. qualification legs에도 run/session은 있지만 orchestration_attempt는 없기 때문이다. workflow의 경우에는 host context가 가진 parent run/stage lineage를 추가 검증한다. qualification과 workflow를 구분해 기록하며 신원 자체는 어느 쪽도 자격을 부여하지 않는다.

## 순서와 실패 처리

`claim/stage commit → launcher session 기록 → native identity frame 수신·검증 → identity 단독 commit → broker 요청 또는 checker 허가 → 결과 capture → 독립 OS cleanup 관찰 → cleanup 영수증 → orchestration finish`.

- adapter launch는 caller DB가 외부 transaction 상태면 OS process를 시작하기 전에 거부한다.
- native identity 저장 실패/충돌/늦은 abort 시 broker 요청과 checker 허가는 0회여야 한다. 원래 실행의 bounded cancel/guardian 정리를 요청하고 완료를 기다리되 durable identity가 없으면 복구 신원은 unknown으로 남긴다.
- identity commit 뒤 final cleanup store 쓰기 실패는 identity를 삭제하거나 덮어쓰지 않는다. 원장 실행은 완료 처리하지 않는다.
- identity frame이 완성되기 전 launcher가 죽는 경우까지 완전한 신원 보존을 보장하지 않는다. 초기에 존재하는 일부 사실을 기록하는 append-only partial journal은 별도 확장이다. 이번 최소 단위는 실제 실패처럼 완전한 frames가 이미 수신된 경우의 손실을 차단한다.
- stdout 처리에서 async 저장으로 인한 순서 역전이 없도록, 동기 SQLite commit을 끝낸 뒤 정확히 한 번 허가한다. receipt promise와 result promise가 서로 기다리는 순환을 만들지 않는다.

## 재시작 복구 관찰의 한계와 연결

새 보호된 read-only 함수는 store가 검증한 opaque ref로만 동작한다. 기록된 세션과 설치/known-folder provenance를 확인한 뒤 OS를 재관찰한다. PID가 있으면 실제 생성 FileTime과 비교하고 불일치는 PID 재사용/unknown으로 표시한다. ESRCH만 부재, 접근 오류는 unknown이다. 경로는 native에서 기록한 정확한 경로와 host base를 다시 대조하고 ENOENT만 부재로 취급한다.

이 API는 kill, 디렉터리 삭제, ACL 변경, 자동 작업 재개, acceptance 생성 또는 이전 task 상태 수정을 수행하지 않는다. 모든 대상의 부재가 확인돼도 그것은 새 시점의 OS 부재 관찰이며 과거 실행 성공이나 원래 cleanup 영수증을 대신하지 않는다. 새 복구 관찰을 기존 cleanup store에 기록하려면 원본 identity ref와 관찰 시각을 명시하고 기존 결과와 구분해야 한다. runtime의 durable ownership 해소 정책은 별도 검토 대상이다.

현재 실패 원장에는 저장되지 않은 신원을 추측해 추가하지 않는다. 프로필 이름 검색, 임의 PID 목록, 예전 canary 신원을 이용한 보정은 금지한다.

## 소유권 제안

| 단위 | 파일 소유 | 검증 |
|---|---|---|
| Store | 신규 native-execution-identity-store.ts, 신규 migration, focused store test | idempotency/불변성/rollback/reopen/인덱스·hash 변조 |
| Native 및 parser | model-only-launch.ps1, isolated-local-model.ts, isolated-json-checker.ts, 해당 adapter tests | 실제 PID 생성시각 관찰, duplicate/conflict, commit 전 요청 0 |
| Composition·복구 관찰 | isolated-model-cleanup.ts, generated-json-host.mjs, 신규 readonly recovery helper/test | final write 실패에도 identity 보존, live/result 지연 독립, weak-map 우회 없음 |
| Root 등록 | ledger.ts/copy-assets 등록, 설치/qualification 고정 목록 확인 | 새 source/build hash와 이전 자격 불일치 시 거부 |
| 독립 검토 | 제품 편집 없는 reviewer | 신원 출처·트랜잭션 순서·오류 경로 확인 |

app core/UI는 다른 담당자가 작업 중이므로 이 단위에서 변경하지 않는다.

## 모델 호출 없는 완료 gate

1. 스키마/store fixture: 실제 임시 SQLite, 동일/충돌 신원, dotted canonical candidate, session 불일치, 외부 transaction 거부, trigger rollback 시 ref 없음, 재개방 후 hash 검증.
2. parser fixture: 분할/합쳐진 frames, missing/duplicate/conflict, 잘못된 SID/프로필/생성시각/control hashes, aborted-before-commit. 모델 transport와 checker 허가는 commit 실패 시 0.
3. 실제 Windows native boundary + fixed transport/checker fixture: 정확한 세 PID 생성시각과 identity 저장을 확인한다. 이 테스트는 실제 OS 경계 관찰이지만 live model 자격 측정이 아니다.
4. 지연 fixture: client/result가 아직 pending인 동안 identity row가 이미 존재해야 한다. 이후 cleanup store를 의도적으로 실패시키고 identity가 변하지 않은 채 보존됨을 확인한다.
5. 재시작 읽기 관찰 fixture: 정확한 생성시각, PID 재사용, process 접근 실패, residual path, ENOENT, 변조된 ref와 다른 설치를 구분한다. DB/프로세스/파일/ACL에 복구 쓰기가 없음을 확인한다.
6. 집중 tests + build/typecheck 및 독립 검토. 실제 원본 실패 원장/프로필을 읽기 외 용도로 사용하지 않는다. 성공해도 새 실제 Qwen 실행은 별도 권한 없이는 수행하지 않는다.

구현 착수 전 재확인: native identity frame을 broker/checker request보다 먼저 전달하는 현재 출력 순서, 추가 frame으로 인한 total byte bound, diagnostic qualification parser의 호환성, 새 migration 번호와 file ownership. 전체 S4 복구 기능 완성으로 확대해 주장하지 않는다.
