# 회고 IPC/UI 독립 검토

판정: 보류 — IPC/DOM 집중 게이트는 PASS이나 실제 P11 proof allowlist가 새 preload API와 불일치한다. Maker /root/reuse_cli, checker /root/contracts_review. 제품 소스 수정 0, 모델 호출 0. 실제 Electron QA는 별도이며 본 기록으로 대체하지 않는다.

완료 기준: 정확한 IPC 입력/발신자 경계, 명시적 생성과 고정 ID 재시도, 역사 조회 및 늦은 응답 폐기, textContent 출력, 기존 Stop 소유권 회귀, 집중 테스트와 noEmit 타입 검사 및 소스 해시. 수정 가설 상한 2 중 0 사용. source/build 동결을 준수하여 빌드 재작성하지 않았다.

## 결과

- app/ipc.mjs:4–11은 create/read별 정확한 own data key 집합과 제한된 ID를 검사한다. proxy/getter/상속/추가 symbol/추가 인자를 거부한다. 실제 IPC handler는 기존 trusted sender 검사 뒤에만 실행된다. preload의 retrospective 함수는 고정 채널만 호출하고 실행 코드/경로를 허용하지 않는다.
- renderer.js:81–106은 run 선택 시 UUID를 생성하고 같은 ID로 재시도한다. 별도 새 스냅샷 버튼만 ID를 회전시키며 버튼 자체는 저장하지 않는다. 시작 시 자동 회고 호출은 없다. run 없이도 ID 조회가 가능하다.
- 생성 응답은 draft/run 일치, 조회 응답은 draft 일치 및 reference-only/not-assessed 버전을 검사한다. 세대가 바뀐 응답은 폐기하며 현재 요청만 busy 상태를 해제한다. 템플릿/준비 변경은 이전 회고 출력과 문맥을 지운다.
- summary와 projection JSON은 textContent로만 표시한다. UI는 고정된 과거 상태, 로컬 참고용, 인수 평가 아님을 명시한다. 조회 자체로 현재 completion/cleanup 권한을 만들지 않는다.
- 기존 activeExecution 해제는 여전히 matching taskId/runId + terminal + executionOwnership.status=released에만 한정된다. setup/JSON/mode/P10C 회귀를 포함하여 deferred execute 응답과 Stop 유지 경로가 통과했다.

게이트 결함: scripts/p11-electron-proof.mjs:96의 exact renderer.api 목록에 retrospective가 없다. 현재 preload로 이 proof를 실행하면 assertion이 실패하므로 목록을 좁게 갱신해야 한다. source freeze를 존중해 제품 수정 없이 부모와 maker에 통보했다. IPC/DOM 제품 경계에서는 추가 차단 결함을 찾지 못했다. JS DOM fixture의 restart 조회 테스트는 새 UI 문맥에서의 ID 조회이고, 실제 DB reopen은 함께 실행한 store/core 테스트가 별도로 입증한다. 전체 앱/모델 실행 또는 현재 자원 정리의 증거가 아니다.

## 독립 게이트

cwd C:/Users/User/cue/daemon

```text
npx --no-install vitest run test/integration-retrospective-ui.test.ts test/p11-electron-surface.test.ts test/integration-local-json-setup-ui.test.ts test/integration-json-template-ui.test.ts test/integration-approval-plan.test.ts test/integration-retrospective-core.test.ts test/integration-retrospective.test.ts test/p10c-renderer.test.ts test/integration-selection-preference-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-11 22:45:02 KST: 9 files / 36 PASS / exit 0 / 12.55s
npx --no-install tsc -p tsconfig.json --noEmit
exit 0
```

읽기 경로 정정: 첫 검색에 존재하지 않는 scripts/prove-p11.mjs를 지정했다. 파일 검색 후 실제 scripts/p11-electron-proof.mjs의 allowlist를 확인했다. 제품/테스트 실패가 아니며 native proof를 실행하지 않았다.

## 현재 SHA-256

| 파일 | SHA-256 |
|---|---|
| app/ipc.mjs | 0AABF41F082B6BC0F1B898D3D0254BC239679BD3733738318E3FF58380710AA9 |
| app/ipc.d.mts | 6AD6DD7C3D367E3C8E1840573345BCA95A2D185669AA3869382580492C646F47 |
| app/preload.cjs | FC5D0658AB333413B07B6F72BDE64DAC80BC96D75CCB03C27BE8A87DC385CA6F |
| app/renderer/index.html | 70592CF519061890D2CD17EB895813103C8B999F9684EAABC47F6187AD7FA3F8 |
| app/renderer/renderer.js | 95B26ED42217C3A220C35E2BE936F2FDA64E14F0AB2A9EF5CB56C4440089B671 |
| daemon/test/integration-retrospective-ui.test.ts | F38D76F59F6C19C163C3BC831BB371B473D6CFC7E9D4180770D3A90BD59D91D3 |
| daemon/test/p11-electron-surface.test.ts | 7E86563FE85FE88FB1D9E2076B10456852AC5AE9A932A83DB6849C4BDAE751CC |
| scripts/p11-electron-proof.mjs | 5EA82A2AB7C54A74F133F3A4FA526DF8EBD1F762F91DFD0C597D2C388D6DD3C0 |
| daemon/test/integration-local-json-setup-ui.test.ts | DE3DD26B22CC887B3A17D39CC060DC4905295301FCEC190DF85505161ADCB6B9 |

## 최종 교정 확인 — PASS

부모 승인 후 maker가 scripts/p11-electron-proof.mjs:96 expected API 배열에 retrospective 한 항목을 추가했다. 이전 보류와 당시 해시는 위에 보존한다. 현재 proof SHA-256: 894629DF11EC20D315721CA373E8E12CF5E65C09478C7485C203488CC4DBAF99.

독립 정적 실행: 실제 app/preload.cjs를 Node VM에서 Electron contextBridge/ipcRenderer만 대체하여 평가하고, 실제 proof의 expected 배열을 추출했다. Object.keys(exposed).sort()와 assert.deepEqual 일치 PASS, exit 0. Electron/native proof 자체를 실행한 것은 아니다. renderer SHA95B26ED42217C3A220C35E2BE936F2FDA64E14F0AB2A9EF5CB56C4440089B671은 기존 36 PASS의 소스와 그대로 일치한다. 제품 소스 수정이 없어 기존 집중 36 PASS/typecheck0를 보존하고 반복 실행하지 않았다.

최종 판정: 제한된 IPC/DOM 및 proof 목록 일치 계약 PASS, 남은 차단 finding 없음. 실제 Electron 화면 QA는 별도 담당 증거이며 전체 제품 완료/실행 자원 정리/모델 적격성을 뜻하지 않는다. 독립 reviewer 제품 수정과 모델 호출 0, maker 좁은 교정 1회.
