# 실행 응답 상실·소유권 잠금 — 수정 후 독립 실제 QA

판정: **해당 source의 복구 UI 범위 PASS**. 앞선 `race-qa-review.md` 및 보이지 않는 중지 버튼 PNG/실패 증거는 그대로 보존한다. 그 역사적 실패를 덮어쓰지 않으며 이번 교정의 별도 증거다.

완료 기준: 초기 execute IPC 거부 후 Stop의 ancestor hidden/computed visibility/실제 box 및 PNG를 확인하고, blocked 상태에서 소유권 미등록·unknown·unresolved·다른 run released를 순차 수신해 잠금 유지, 원래 run 중지·task polling, 마지막 일치 released에서만 해제되는지 확인한다. 실제 모델0, 제품 수정0, 최대2회.

`node scripts/reuse/setup-race-recovery-electron-proof.mjs --explicit-ownership-fixtures` **PASS**,exit0(tool452e00). 첫 시험에서는 실제 core.completion의 합법적인 released(실제 executor가 없기 때문)를 합성 missing fixture가 잘못 상속해 polling 종료를 맞았다. `race-fixed-failure-attempt1.json` 보존. base fixture에서 ownership을 명시적으로 제거한 뒤 둘째 실행이 통과했다. 이는 제품이 실제 released를 올바르게 처리한 것이며 제품 결함으로 분류하지 않는다.

## 실제로 확인한 동작

- 실제 core 준비·승인, shipped preload와 trusted main-frame IPC를 사용했다. execute/status/stop은 main QA wrapper가 교체했다. 실행 거부 뒤 최초 status를 보류한 상태에서 `실행 상태 미확인` 카드와 Stop이 표시된다.
- Stop 검사: hidden ancestor없음, display inline-block, visibility visible, client rect1,267.23×49.5 CSS px,enabled=true. `race-fixed-visible-stop.png`를 직접 열어 빨간 실행 중단 버튼과 설명이 실제로 보임을 확인했다.
- 상태 blocked + ownership undefined / unknown / unresolved, 그리고 다른 runId의 released를 순차적으로 실제 IPC polling 응답에 제공했다. 각 상태마다 설정저장·새준비·템플릿이 비활성이고 Stop 가시성/활성이 유지되며 다음 polling 요청이 발생했다.
- 매 상태에서 submit/change 이벤트를 직접 시도했지만 추가 prepare/configure가 발생하지 않았다. 전체 prepare1/configure0.
- 다른 run released 응답 이후 실제 렌더된 Stop을 클릭하여 최초 runId로 요청됨을 확인했다. 모든 status 요청은 최초 taskId다.
- Stop 후 이전 poll generation에 전달한 일치 released는 잠금을 해제하지 않는다. 현재 generation의 unresolved는 Stop/잠금을 유지한다. `race-fixed-unresolved.png`를 직접 열어 확인했다.
- 현재 generation에서 원래 taskId/runId의 blocked+executionOwnership.status released가 도착한 뒤에만 설정/준비/템플릿이 활성화되고 Stop이 숨겨진다. released 이전 missing/unknown을 성공·정리완료로 추측하지 않는다.

## 범위와 고정 hash

`race-fixed-result.json`에 실제 관측·요청 ID·row 수·PNG와 소스 hash를 기록했다. session_handle/capability_evidence/local_host_settings_snapshot/orchestration_attempt 모두0이다. 원장 status와 released는 QA가 제공한 합성 DTO이며 **실제 실행 정리나 모델 자격 증거가 아니다**. UI의 수신 규칙과 가시성만 검증했다. 실제 cleanup 발행 경로는 별도 host 검증 범위다.

- renderer.js: `1f3f258461ae1470154983f9d3f1caf24d6713b57d511d9fff8b9c5466f758d1`
- core.mjs: `bd7f47d4c9fa4f54fa40325b48b49d2d9bf00835ac49c6a785709c51860948ab`
- ipc.mjs: `92ec78603bece540cd0cf8cd9ccddf9f16185454725972809da9c26bf90547e7`
- preload.cjs: `7a0b150870ff053ccfb8f978b038b0432924ef7f4fd7bf657948dff59c1889e2`
- index.html: `003062d523733614f55fc47b935a33037c9caecc190ce05f066209992f7b9bba`

동시 진행되는 qualification/retrospective 파일을 새로 측정하지 않았다. 전체 소스 집합의 최신성·자격·실측 모델 경로를 주장하지 않고 위 소스에 한정한다.
