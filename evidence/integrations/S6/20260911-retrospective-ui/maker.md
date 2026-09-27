# 회고 UI maker 검증

- 완료 조건: build 0, exact IPC DTO, 생성/재시도 ID/새 스냅샷, 재시작 ID 조회, 낡은 응답/불일치 차단, escaping 및 기존 설정·경합·승인 회귀 통과. 교정 상한 2.
- 제품 변경: cue:retrospective create/read, preload 얇은 함수, 독립 회고 패널. 현재 실행 선택 시 UUID 한 번, 실패 재시도 ID 유지, 명시 새 스냅샷만 ID 교체. 조회 입력 변경/새 준비는 오래된 응답을 무효화한다. textContent 및 고정 출처 details, local-only/reference-only/인수 평가하지 않음 표시. 실행 또는 모델 호출 없음.
- core, 실행 소유권 전환, 기존 polling/stop 로직 변경 없음. 카드/준비 완료에 회고 현재 run 선택 hook만 추가.
- 최초 gate 22 PASS / 2 FAIL; fixture 비동기 preference 준비를 기다리지 않음. 첫 microtask 대기 교정으로 37 PASS / 동일 2 FAIL. 두 번째 교정은 불필요한 selectionPreferences fixture를 제거하여 기본 호스트 경로 사용; 신규 4 PASS. 제품 수정으로 실패를 우회하지 않았다.
- 최종 npm run build exit 0. 아래 gate 9 files / 39 PASS (10.74 s), 실제 Electron QA/독립 review는 별도. 이것은 maker 검증 기록이다.

```powershell
cd daemon
npx vitest run test/integration-retrospective-ui.test.ts test/p11-electron-surface.test.ts test/integration-local-json-setup-ui.test.ts test/integration-json-template-ui.test.ts test/integration-approval-plan.test.ts test/integration-retrospective-core.test.ts test/integration-retrospective.test.ts test/integration-local-json-setup.test.ts test/integration-local-json-setup-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

## Actual proof API allowlist follow-up

- Independent review 36 PASS/typecheck 0 receipt remains unchanged. Finding: scripts/p11-electron-proof.mjs:96 omitted retrospective from the exact API list.
- Parent assigned this script only for one bounded correction. Added retrospective to that list; no product source changes.
- Executed actual preload in VM and compared its sorted keys to the exact proof assertion literal: PASS. P11 electron-surface 2 PASS; related P12 live-harness static contracts 6 PASS. No live Electron/model run claimed in this follow-up.
- SHA256 scripts/p11-electron-proof.mjs: 894629DF11EC20D315721CA373E8E12CF5E65C09478C7485C203488CC4DBAF99.
