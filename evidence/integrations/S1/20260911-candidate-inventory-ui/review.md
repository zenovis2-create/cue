# 후보 목록 IPC/UI 독립 검토

현재 판정: 보류 (교정 대기). Reviewer /root/contracts_review. 제품 수정/모델 호출 0. 독립 focused gate는 maker 교정 stable 후 실행한다. 기존 maker44PASS는 독립 최종 PASS로 간주하지 않는다.

완료 기준: sanitized read-only projection, exact IPC/preload/actual P11 proof API lists, auth/eligibility unknown, 실제 정책과 맞는 모드 설명, late reply와 기존 Stop ownership 회귀, 집중 테스트/typecheck 및 소스 해시. 최대2회 진단 교정, 현재 finding1.

## Finding 1 — V2 설정만으로 동일 조합을 주장함

app/core.mjs:433의 modeComparison은 V2 설정 존재만으로 fixed-pair-unmeasured다. renderer.js:76–77은 네 모드가 같은 생성기/검사기를 사용한다고 표시한다. 그러나 local-host-settings.ts:86–96은 각 policy의 mode/digest/limits만 확인하며 서로 다른 producerCandidateId/checkerCandidateId를 금지하지 않는다. 따라서 보호된 일반 V2 저장 API로 다른 조합을 저장하면 unavailable host에서도 잘못 표시된다.

필요 교정: 실제 네 readLocalSelectionPolicy 결과의 pair 동등성을 확인하거나 unknown으로 표시한다. 서로 다른 pair V2 fixture를 추가하고 canonical setup은 same-pair 표현을 유지하는지 검증한다. Root와 maker 및 actual QA 담당에 통지했고 QA는 stable 소스를 기다린다.

사전 읽기 확인: exact read IPC는 proxy/getter/추가 key/추가 args와 비허가 sender를 거부한다. projection은 aliases/model binding/endpoint/authReference/sourceVersion을 제외하고 authentication/capabilityEligibility를 unknown으로 유지한다. candidate refresh 세대는 Stop의 activeExecution/pollGeneration과 분리돼 있다. actual P11 proof에는 candidateInventory가 포함돼 있다. 추가 제품 경계 blocker는 현재까지 찾지 못했다.

관측 source preimage core SHA82D7100A4810646A9FCBB82EA43F360F4EB3CA03DD816D7AB0F7844AD86FE706. 세부 maker 해시는 source-hashes.json에 있다. 본 문서는 최종 source-bound gate 영수증이 아니다.

## 최종 교정 및 독립 판정: PASS

Finding1 해결: 현재 core는 정확한 네 readLocalSelectionPolicy 결과를 읽고 저장된 참조 digest를 대조한 뒤 producerCandidateId/checkerCandidateId 튜플 전체가 같을 때만 fixed-pair-unmeasured를 반환한다. 실제 일반 V2 저장 API로 speed pair를 바꾼 회귀에서 unknown을 확인한다. canonical setup의 동일 pair 표시는 유지된다. 기존 보류 기록은 위에 보존한다.

독립 확인: sanitized projection은 authReference/aliases/endpoint/model binding/sourceVersion을 노출하지 않고 auth 및 capability eligibility를 unknown으로 표시한다. 사용 가능한 catalog라는 표현은 실행 자격이 아니다. selection/configuration도 별도이며 setup 재시작 필요 상태를 보존한다. 재조회는 읽은 시각만 바꾸고 과거 observedAt을 갱신하지 않는다. core reader 경로는 SELECT 기반이며 runtime prepare/실행/검증 callback 호출이 없다. 실제 core fixture는 task/session/approval 행0과 금지 callback 미호출을 확인했다.

IPC exact read/신뢰 sender 검증, preload 고정 채널과 actual P11 proof API 목록이 일치한다. 독립 Node VM에서 실제 preload를 평가하여 expose된 키와 proof expected 배열을 exact 비교 PASS; actual Electron proof 자체를 실행한 것은 아니다. DOM은 textContent, refresh 전 삭제, 독립 candidateGeneration로 늦은 응답을 폐기한다. 기존 setup 실행실패/Stop 소유권 및 P10C 회귀도 통과했다.

```text
cwd C:/Users/User/cue/daemon
npx --no-install vitest run test/integration-candidate-inventory-ui.test.ts test/p11-electron-surface.test.ts test/integration-catalog.test.ts test/integration-selection.test.ts test/integration-local-json-setup-ui.test.ts test/integration-retrospective-ui.test.ts test/integration-approval-plan.test.ts test/p10c-renderer.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-11 23:38:54 KST: 8 files / 46 PASS / exit0 /10.45s
npx --no-install tsc -p tsconfig.json --noEmit
exit0
```

교정1회, reviewer 제품 소스 수정/모델 호출0. 실제 Electron 시각 QA는 admission_impl의 별도 증거이며, 이번 PASS가 자격/인증/전체 모델 도구 지원을 뜻하지 않는다. 후보 목록은 보호된 기존 catalog 관측의 투영으로, 새 설치 탐색/자격 갱신/순위 측정은 하지 않는다.

## 최종 소스 SHA-256

| 파일 | SHA-256 |
|---|---|
| app/core.mjs | 68CFD656899DCB032614775109F967AAD7F83CABD2A67B7AC7597362FF0BBF53 |
| app/core.d.mts | 961D68174B6D10D116DA5F3D59D97B95E1EEF5FC01D5CC4753C2BD0D91D8FB33 |
| app/ipc.mjs | 6F0A5665F77D1B095463CD6A9E8F50D1E382D300E01B1E22F82B870BB5D06F16 |
| app/ipc.d.mts | FAFB01F6B0619E816FEBD0BBE92BD341A5FFB0BBA28ABC9486A2D4134467C363 |
| app/preload.cjs | 00B4A325D36C853B0EC46A5CB52709E14A689F09E7D43696931E00DEFA0202B0 |
| app/renderer/renderer.js | 7903A288B2B07B36D33496DD8602F692EB6FC1A99729FD5155DA2C9032D8719C |
| app/renderer/index.html | 791A6DDE9B0F16DB751082A5316C7AA1C49C28071AC2C7AB46C40812EA513423 |
| app/renderer/styles.css | F7C16EF85B5E675B13190839253DF1C546E7D9ACE7EB8430D0904C92E68038C3 |
| daemon/test/integration-candidate-inventory-ui.test.ts | FAED76DA9650BC269BF6EC37C5D640CE790931065022895D396B271F046EDEBD |
| daemon/test/p11-electron-surface.test.ts | 7044D358D75405E2A316FE58465FB3FB995AA725A41488A1876A54329B9B5FDA |
| scripts/p11-electron-proof.mjs | 6F509CD9031647F7FEEB5E18190B9E1ACD87652AC0415CE7DD608F7E444C90E7 |
