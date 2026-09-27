# Cue 세션 이름 변경 — 2026-09-24

현재 프로젝트의 보관 전 Cue 세션에 한해 이전 제목 일치 조건으로 이름을 변경하는 메타데이터 경로를 연결했다: 저장소 → 제한된 `cue:user-sessions` IPC → 세션 상세 화면. 기존 자동 제목은 유지하고, 명시적으로 정한 제목은 후속 run 연결 시 자동 덮어쓰지 않는다. 권한·실행 봉투·run 링크·provider 세션에는 영향이 없다.

최종 `build-final.log`: daemon build exit 0. 최종 `focused-final.log`: workspace 관리/화면, Electron 표면, 기본 시작 4파일 22테스트 통과. 선행 로그도 보존한다. 임시 SQLite 재열기·교차 프로젝트/보관/오래된 제목/악성 입력/위조 응답 거부와 JSDOM 화면 textContent를 검사했다. 실제 사용자·스크린리더 인수 및 공급자 재연결은 아니다.

원본 체크리스트 33/44 유지. 이전 Laya cohort의 전체 root 회귀 미완주 및 writer-lifecycle 실패 기록도 해결됐다고 주장하지 않는다. 라이브 모델·계정·평가 호출은 하지 않았다.
