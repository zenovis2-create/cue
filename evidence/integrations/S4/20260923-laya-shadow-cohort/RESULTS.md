# Laya shadow cohort — 2026-09-23

`daemon/src/selection/laya-shadow-cohort.ts`에 transient fixture-only 집계를 추가하고 Core의 현재-worktree read/compare 경로로 연결했다. 양 split의 전체 분모에 없는 시도, unavailable, 응답 누락, 무효 응답, 일치/불일치를 포함한다. 라벨은 caller fixture만 허용하며 실제 품질 또는 반사실적 실행 결과로 해석하지 않는다. 응답·작업 원문 저장, Laya 호출, 라우팅/승격은 없다.

검증: daemon build 성공. 최종 `focused-final.log`의 선택/엔진/Core 회귀 8파일 77테스트 통과(`focused.log`는 중간 통과 로그로 보존). 합성 reader로 누락/무효/불가용 분모, 중복·적격 외 라벨·접근자 거부, 준비/비교 사이 lineage 변경 거부를 시험했다. 실제 compiled Core 경로에서 기록된 선택 1건과 없는 시도 1건을 두 split으로 집계했다. fixture 응답만 사용했다.

이전 `../20260923-laya-shadow/whole-suite.log`의 root 1,200초 timeout 및 writer-lifecycle 실패는 해결됐다고 주장하지 않는다(해당 테스트 단독 재실행은 통과). 이번 변경 뒤 전체 root suite는 실행하지 않았다. 체크리스트 33/44 유지. 실제 Laya checkpoint/의존성/Windows 격리, 모델 호출, 독립 라벨·비용·품질·queue-through-cleanup 증거와 사용자 승인은 미확인이다.
