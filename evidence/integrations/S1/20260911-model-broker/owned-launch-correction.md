# Broker 실행 경계 회귀 수정

전체 회귀에서 발견된 p4/p45 위반을 수정했다. `isolated-local-model.ts`의 직접 child_process 호출을 제거하고, 기존 `process-launch.ts`의 `spawnOwned`를 사용하는 `spawnOwnedPiped(db, owner, command, args)`로 옮겼다. 검사 allowlist나 실패 기준은 변경하지 않았다.

호스트 설정에 실제 `Ledger`가 필수다. 고정 PowerShell 실행기는 기존 executable sealing을 거치며, task/run/cwd/PID/session handle이 기존 session_handle 테이블에 기록된다. adapter는 frozen SessionRecord를 반환한다. 이 세션은 호스트 실행기의 소유 기록이며 AppContainer 자식·guardian 정리 증거를 대체하지 않는다. 취소 및 guardian 동작은 보존했다.

## 검증

- 완료 기준: build, p4/p45, 실제 격리 broker 테스트. 수정 가설 최대 2회.
- 최초 구현 이후 추가 수정 없이 통과.
- `npm run build` (daemon): exit 0.
- `npx vitest run test/p4.test.ts test/p45.test.ts test/integration-isolated-local-model.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` (daemon): **22 PASS / 3 SKIP**, 2026-09-11 17:46:51, 25.23초.
- broker 테스트는 실제 ledger의 launcher 소유 정보 기록과 compiled adapter의 격리 왕복, overflow/EOF, 취소, identity 거절을 확인했다.
- 이번 수정에서 실제 Qwen 요청은 하지 않았다. 기존 실제 canary는 당시 source hash의 역사적 증거이며 이번 hash의 재실측으로 표기하지 않는다.

## SHA-256

- daemon/src/process-launch.ts: `596764E6666CA4A4A03C1988706579005A2C27DA4045276236BA67762157DC78`
- daemon/src/adapters/isolated-local-model.ts: `6A1BC1D5ABADFC016536A82ADB24DA094080CF8B5E9469F50A28C0BDA305008B`
- daemon/test/integration-isolated-local-model.test.ts: `89F1CD519D139A0268E3B1D199EF29A576905FDD659531F5B137D6DBAAB5FF5B`

## 독립 finding에 따른 추가 수정

reviewer가 승인 후 cwd가 사라질 때 `spawnOwned`가 no-PID 예외를 던진 뒤 비동기 ENOENT 이벤트를 처리하지 않아 daemon이 종료되는 경로를 재현했다. no-PID 분기에서 호출자에게 반환되지 않는 ChildProcess의 시작 오류 이벤트를 처리하도록 최소 수정했다. 별도 Node subprocess 회귀는 try/catch가 실패를 받고 uncaughtException이 없으며 session row가 생성되지 않음을 검증한다.

- 수정 후 build exit 0.
- 같은 p4/p45/broker 명령: **23 PASS / 3 SKIP**, 2026-09-11 17:50:31, 25.49초.
- 현재 process-launch.ts SHA-256: `EA5819B562F55ED4776A48EDDD13CE79F9E3A43EC52841BE0203C2E14F561990`
- 현재 integration-isolated-local-model.test.ts SHA-256: `A458907D2714EA950719318DB59A09BA7A11792F6E79C8D917038A9C46285068`
- adapter hash는 위 기록과 동일하다. 위 최초 hashes는 수정 전 이력을 나타낸다.

독립 검토는 broker_review가 별도로 기록한다.
