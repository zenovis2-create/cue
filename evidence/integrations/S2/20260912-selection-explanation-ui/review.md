# 선택 설명 renderer 독립 검토 — 교정 대기

Reviewer /root/contracts_review, 제품 소스 수정/model/native/build0. 완료 기준: status4종의 근거 일치, historical/local-not-ranked 표기, 50개/전체/생략, enum/textContent/privacy, same-run expansion 및 Stop/poll 보존, 집중 DOM/회귀와 typecheck. cap2 중 finding1. Maker stable 교정과 별도 compiled-import 타입 교정 이후 최종 gate를 수행한다.

Finding1: app/renderer/renderer.js:441은 !selection && hasAttempt를 legacy-not-recorded로 반환한다. Backend는 sealed legacy membership으로만 이를 반환하며 신규 누락은 invalid다. 따라서 전달 DTO 누락/구버전 compiled 응답을 역사 기록으로 추론하면 안 된다. Missing/null+attempt는 invalid 또는 별도 unknown, explicit legacy status만 과거 기록으로 표시하도록 요청했다. integration-selection-explanation-ui.test.ts의 undefined→과거기록 기대도 교정 대상이다.

다른 사전검토: enum label/textContent, score 비노출, pathlike ID 비공개, key에 runId를 포함한 details open 보존은 요구 방향에 맞다. 실제 backend의 legacy 분류를 재실행하거나 자격/승인에 사용하는 코드는 추가되지 않았다. 최종 독립 PASS는 아직 아니다.

## 최종 독립 판정: PASS

Finding1 해결: renderer:441은 missing/null selection + existing attempt를 invalid로 표시한다. legacy는 explicit authority/status가 있을 때만 유지한다. null/undefined 회귀, no-attempt/not-started 및 explicit legacy 구분을 확인했다. 이전 잠정 finding은 위에 보존한다.

기록은 historical-explanation-only이며 현재 자격/실제 품질/인수 승인을 증명하지 않는다고 표시한다. local은 순위 평가 없음/고정 조합, monetary는 저장 정책 비교 결과로 구분하고 숫자 score는 표시하지 않는다. mode/reason/exclusion은 enum label로 제한하고 식별자와 마크업은 textContent/opaque ID 검사로 처리한다. 후보 최대50개와 전체 수/생략 표시, 같은 run의 펼침 유지 및 다른 run 초기화가 통과한다. 별도 IPC/실행 권한 경로를 추가하지 않았다.

```text
cwd C:/Users/User/cue/daemon
npx --no-install vitest run test/integration-selection-explanation-ui.test.ts test/integration-native-recovery-ui.test.ts test/integration-local-json-setup-ui.test.ts test/p10c-renderer.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-12 01:17:40 KST: 4 files/18 PASS/exit0/8.33s
npx --no-install tsc --noEmit -p tsconfig.json
exit0
```

이전 compiled followup 테스트 TS7016 교정도 좁게 확인했다: integration-local-driver.test.ts:13–14는 동일 dist 경로를 dynamic import하고 typeof source로 type shape만 선언한다. 런타임 경로나 assertion 의미를 바꾸지 않았고 제품/tsconfig 변경이 없다. compiled-typing-followup.md의 maker6PASS는 독립18에 합산하지 않는다.

Reviewer 제품 수정/build/native/model0, 교정 finding1회. 본 검토는 DOM/source gate이며 실제 Electron 시각 QA는 별도다. 최종 모델 workflow/cleanup/acceptance 완료 증거가 아니다.

## 최종 현재 해시

| 파일 | SHA-256 |
|---|---|
| app/renderer/renderer.js | 6CF8ECB27B7C73205B927B66DC645CBEDC9470298A885C196374FFAD6B137472 |
| daemon/test/integration-selection-explanation-ui.test.ts | 1AFA46D3814A135923C8637CAB66E87DB2CEE2A7E89DAD714DEE3103F02458E0 |
| daemon/test/integration-local-driver.test.ts | 3F7A22FF637759A19FE3331CA24911D4BDE1CABA47C2D7DA962CCC094528FB6F |
