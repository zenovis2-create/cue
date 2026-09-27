# P12 Electron proof API 계약 회귀 수정

2026-09-11. 변경은 `scripts/p11-electron-proof.mjs`의 기대 preload API 배열 한 줄이다. 실제 `app/preload.cjs`의 명시적 공개 API 두 개 `selectionPreferences`, `setSelectionPreference`를 추가했다. 기타 API 허용, cleanup failure 주입, `passed:true` 발행 순서 검사는 바꾸지 않았다.

기존 전체 회귀는 오래된 4개 API 배열 비교에서 먼저 실패하여 forced cleanup failure 단계에 도달하지 못했다. 현재 6개 API를 정확히 비교하므로 넓은 와일드카드/검사 생략으로 우회하지 않는다.

daemon에서 `npx --no-install vitest run test/p12-electron-proof-result.test.ts --fileParallelism=false --maxWorkers=1`: **exit 0, 1/1 PASS, 12.55s**. 이 테스트는 실제 Electron proof를 실행하고 UI 검사가 통과한 뒤 강제 cleanup failure에서 종료값이 비정상이며 성공 결과 파일이 없고 실패 기록에 `passed:false`와 해당 정리 오류가 남는 것을 검증한다. 이미 실제 proof를 포함하므로 추가 동일 실행은 하지 않았다.

명령 출력은 `p12-proof-contract.log`, 현재 proof/test hash와 종료 코드는 `p12-proof-contract.json`에 보존한다. 가설 수정 1회. 모델 호출·의존성 설치·제품 코드 변경 없음. 다른 전체 회귀 실패의 해결을 이 결과로 주장하지 않는다.
