# Phase 3B 판정

최종 판정은 **FAIL**이다. `npm test`는 기존 42개 테스트를 모두 보존했지만, 신규 강제층의 필수 우회 검증 2개가 실패했다. 전체 결과는 60개 중 58개 통과, 2개 실패이며 원문은 `p3b_test_output.log`에 보존했다.

| 항목 | 판정 | 근거 |
|---|---|---|
| P3-9 | FAIL | canonical realpath와 junction 차단은 통과했으나, Base64로 런타임 계산한 worktree 밖 경로를 PowerShell이 실제로 썼다. 테스트 정리 단계에서 임시 파일을 제거했다. |
| P3-11 | PASS | 봉투 밖 요청을 decline한 뒤 SQLite의 task 상태가 running으로 유지됐다. |
| P3-12 | PASS | 동일 digest 2회, 승인 후 정지, 정확한 3지선다, 기본 포커스, 재질문 억제를 상태 모델 테스트로 확인했다. |
| P3-15 | FAIL | 원장 쿼리 기반 문자열 함수는 통과했지만 실제 완료 카드 호출 경로가 없다. |
| P3-16 | FAIL | Node fetch/로컬 소켓 allowlist는 동작했지만, egress가 빈 봉투에서 PowerShell의 실제 TCP 연결을 막지 못했다. |
| P3-17 | FAIL | 원장 스키마와 경보 단위 테스트는 통과했지만 실제 워커 실행 수명주기에 기록 함수가 연결되지 않았다. |

## 강제 방식과 한계

P3-9 구현은 존재하는 가장 가까운 조상부터 `fs.realpathSync.native`로 canonical 경로를 만든 뒤 `path.relative`의 경로 구성요소로 경계를 판정하고, 명령 인수에서 보이는 절대경로를 사전 차단한다. 문자열 prefix 비교는 쓰지 않는다. 그러나 이것은 파일시스템 syscall 감시가 아니어서 런타임 계산 경로와 TOCTOU를 막지 못한다. P3-16 구현은 Node 워커에 `NODE_OPTIONS=--require`로 가드를 선주입해 `net`/`tls`/`http`/`https`/`fetch`의 호스트를 봉투 allowlist와 대조한다. 그러나 OS 수준 강제가 아니므로 비-Node 워커와 자식 프로세스를 막지 못한다. 따라서 두 방식 모두 Cue의 일반 워커 강제층이라는 완료 조건을 충족하지 않는다.

## 독립 검토

별도 read-only checker는 실제 `spawnVendorCodex` 호출 경로에 강제·위반 기록·완료 차단·실행 회계가 연결되지 않았음을 확인하고 `BLOCK / REQUEST_CHANGES`를 판정했다. 이 결과를 반영해 초기 58/58 헬퍼 테스트 통과를 완료 증거로 사용하지 않았다.
