# Laya post-attempt shadow seam — 2026-09-23

구현: `daemon/src/selection/laya-shadow.ts`, Core의 명시적 내부 read/compare API, 형식·경계 테스트, `docs/integration/LAYA_SHADOW.md`. Laya/모델 호출·checkpoint 다운로드·IPC·실행 라우팅·승격은 없다. 과거에 host가 검증해 기록한 금전 선택의 적격 후보만 비교하고 local fixed pair/pin/불충분 후보는 abstain한다. 합성 Laya 응답은 형식 fixture이며 실제 성능 증거가 아니다.

검증:
- daemon build 성공.
- `focused-final.log`: 선택/엔진/Core 관련 7파일 74테스트 통과. 실제 Core의 compiled import를 통한 positive read/compare와 없는 시도 거부 포함.
- `p11-isolated.log`: 전체 실행에서 실패했던 writer-lifecycle 단독 10테스트 통과.
- `whole-suite.log`: root `npm test`는 **1,200초 제한으로 종료되어 완주하지 못했다**. 종료 전 `p11-writer-lifecycle`의 normal-completion 사례가 `lifecycle timeout`/임시 경로 `EPERM`으로 실패했다. 이 로그를 통과로 취급하지 않는다. 소유한 잔여 npm 프로세스는 종료했으며 로그는 보존한다.
- 신규 Core positive fixture 처음 두 번은 보호 상태 경로와 worktree가 중첩되어 실패했다. 별도 sibling 임시 worktree로 분리한 최종 focused pass를 얻었다. 실패 원인과 교정은 테스트 fixture에만 해당하며 프로덕션 보호 경계는 완화하지 않았다.

현 상태: checklist **33/44**, 변경 없음. Laya inference/선택 개선/실사용 승인, 종속성·checkpoint 라이선스, Windows 운영·보안 및 전체 회귀 통과는 미확인이다. 실행 후보·승인·예산/Stop 권한은 바뀌지 않았다.
