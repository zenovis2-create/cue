# 동결 평가 작업셋의 실행 직전 staging 검사

2026-09-23 / batches98–99.

## 범위

기본 native existing-file 구현 후보의 `runtime.authorizeRun`에서 **동결 작업셋에 등록된 구현 attempt만** 검사한다. 실행을 승인하지도, 모델을 호출하지도 않는다. 기존 보호된 runtime 권한/계정/시도 binding을 통과한 뒤 실행 시작 직전에 추가되는 파일 읽기 검사다. batch99는 성공 시 불변 관측을 원장에 기록한다.

- 해당 run에 enrollment가 없으면 기존 권한 경로를 그대로 사용한다. 동결 작업셋과 다른 dataset ID는 이 전용 게이트의 대상이 아니며, 입력이 검증됐다고 보고하지 않는다.
- 같은 동결 dataset ID에 다른 revision/digest를 제출했거나 등록 케이스의 split/inputDigest가 패키지와 다르면 거부한다. `readExistingFileWorkload()`가 검토된 패키지 SHA와 전체 작업셋을 다시 확인한다.
- 원장의 goal artifact가 정확히 하나이며 선택한 케이스의 goal과 같아야 한다. native 호스트에 고정된 checker 계약의 전체 정규화 필드와 `parametersDigest`가 패키지 케이스와 같아야 한다.
- active stage/setup/launch intent의 run/task/attempt, plan과 parent/stage envelope, 실행 worktree 경로와 파일 시스템 root identity를 대조한다. 이미 정리된 staging, running 아닌 attempt, 쓰기 허용이 없는 구현 stage는 거부한다.
- 리뷰된 Windows change-snapshot helper로 stage 내 **모든 선언 초기 파일**을 root identity 하에 읽고 바이트·SHA·길이를 직접 비교한다. 누락, 단일 바이트 변경, 다른 root, helper unavailable/unknown은 거부한다. 외부 transaction과 검사 중 원장 epoch 변경도 거부한다.
- 검증 요청에 임의 경로/파일/목표/정책/모델·영수증을 받지 않는다. 별도 renderer IPC 또는 UI 버튼을 만들지 않았다. 평범한 준비 폴더 `verify` 호출을 runtime 증거로 재사용하지 않는다.

## 명확한 한계

이 검사는 **point-in-time-staged-seed-check-only**이며 `executedInputVerified:false`, `executionAuthorized:false`, `promotionEligible:false`다. `authorizeRun`이 전체 권한 검사를 통과하는 데 보조될 뿐, 이 결과 객체 자체가 실행 허가를 발급하지 않는다. 검사 뒤 실제 프로세스가 시작·소비하기 전 파일이 바뀔 수 있고, 초기 파일 외의 모든 repository 콘텐츠/지시문·프로세스 입력 스트림까지 검사하지 않는다. 따라서 최종 measured-fact `executedInput.matches:true`의 근거로 자동 연결하지 않는다. 검사를 거부해도 이전 attempt의 cleanup 또는 최종 청구가 정리됐다고 추론하지 않는다.

batch99부터 성공 검사 결과는 별도 불변 prelaunch observation으로 남지만 기본 앱의 전체 `measuredFactHost`는 없다. 실제 consumed-input/quality/time/account/price/final-cost 근거와 host composition, 실물 Electron 사용자 인수, 독립 검토, 대표 paired holdout은 다음 작업이다. 다른 dataset ID의 등록은 보호된 기존 실행 흐름을 그대로 따르므로 그것이 동결 작업셋 입력 자격을 얻는 우회가 아니다.

## batch99: 불변 시점별 관측

기본 native 호스트는 실제 snapshot 성공 뒤, `runtime.authorizeRun` 반환 전에 **해당 모듈이 일회성 발급한 검사 객체**를 소비해 migration052의 `evaluation_staged_input_observation`에 `cue-staged-input-observation-v1`을 기록한다. enrollment/run/task/attempt, dataset/case/input, goal/checker, stage envelope/plan/policy, root identity와 seed manifest의 digest, 파일 수와 시각을 묶는다. 새 테이블에는 원문 파일 바이트나 경로가 없다. 검사 또는 기록 실패 시 native runtime 허가는 false다. 미등록/다른 dataset에는 관측을 만들지 않는다.

helper는 writer lock 밖에서 실행되고, 그 뒤 DB epoch와 active stage·launch·enrollment 연결을 IMMEDIATE write 안에서 재확인한다. 같은 attempt의 새 정상 검사는 최초 기록 시각을 재사용하고 다른 내용의 replay는 거부한다. 역사적 `readFrozenStagedInputObservation`은 패키지/저장 원천과 정규 payload를 검사하지만 filesystem을 다시 읽지 않아 **현재 파일 상태를 주장하지 않는다**. 직접 SQL 쓰기는 관측 발급 경로가 아니다. check 객체의 모듈 전용 발급과 migration guard가 애플리케이션 권한 경계다.

snapshot→DB 기록→프로세스 소비 간 간격은 남는다. 이 기록의 authority는 `point-in-time-staged-seed-observation-only`이고 `executedInputVerified:false`, `executionAuthorized:false`, `promotionEligible:false`다. measured-fact `matches:true` 또는 품질·비용 근거로 자동 연결하지 않는다.

2026-09-24 후속: host Codex JSON-RPC의 `thread/start`·`turn/start`에 대해 실제 직렬화된 요청 바이트의 digest/길이와 유효한 app-server 응답 ID를 `host-rpc-app-server-ack-only` 활동으로 구분해 남긴다. 이는 로컬 프로토콜 응답 관측이며 자식이 파일을 읽었거나 공급자 모델이 해당 내용을 소비했다는 증명이 아니다. 이 관측도 `executedInputVerified:false`이고 기본 앱의 `measuredFactHost`를 구성하지 않는다. [Opus 조언 검토와 범위](../../evidence/integrations/planning/20260924-opus-bottleneck/REVIEW.md).

## 검증

[batch98 결과](../../evidence/integrations/S5/20260922-staged-input-guard/RESULTS.md): build0,41파일344pass,실패/skip0. [batch99 결과](../../evidence/integrations/S5/20260923-staged-input-observation/RESULTS.md)는 별도 기록. 실제 Windows helper와 임시 stage 파일을 사용하지만 테스트용 launch/staging 원장 행은 합성이다. 공급자·계정·모델 호출은 없다.
