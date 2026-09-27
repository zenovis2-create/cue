Done before edits: two document rows/backlog consistent with user selection, original URL alias +canonical redirected NLM repo/pins exact, inactive resolved-unqualified only. Runtime/source untouched. Cap2 doc corrections. Each pass checks owned rows/links/unresolved wording and source hashes. No CLI/install/auth/model calls.

## 사용자 선택 반영

2026-09-12 사용자가 명시적으로 선택한 제품: nlm mcp cli = jacob-bd/notebooklm-mcp-cli, hermesagent = NousResearch/hermes-agent. 이 확인은 제품 선택의 모호함만 해소한다. 두 행은 inactive / resolved-unqualified / user-selected이며 runtime 등록·인증·실행 자격 부여가 아니다.

- NLM: 사용자 원본 [URL](https://github.com/jacob-bd/notebooklm-mcp-cli)은 alias로 보존. 부모의 현재 웹 열람에서 canonical jacob-bd/gemini-notebook-mcp-cli로 redirect됨을 보고받았다. 이 worker는 [고정 README](https://github.com/jacob-bd/gemini-notebook-mcp-cli/blob/03f7812c243f4d6ff732e2a485e6b9d35540f660/README.md)를 raw primary 경로로 확인했다. package notebooklm-mcp-cli, CLI nlm, MCP notebooklm-mcp 선언 확인. [고정 LICENSE](https://github.com/jacob-bd/gemini-notebook-mcp-cli/blob/03f7812c243f4d6ff732e2a485e6b9d35540f660/LICENSE)는 MIT. tmc/nlm은 사용자 선택 대상이 아니다.
- Hermes: 사용자 선택 NousResearch/hermes-agent. [고정 README](https://github.com/NousResearch/hermes-agent/blob/2f21d29f4446134b51b7e6b1d2f515502bc0ae5e/README.md)를 raw primary 경로로 확인했다. 기존 통합검토 pin 유지. hermesagent/hermesforge-mcp는 선택 대상이 아니다.
- GitHub HTML tree 두 fetch가 restricted URL로 실패하여 동일 고정 revision의 raw.githubusercontent.com README로 검증했다. 이동하는 최신 버전이나 로컬 배포 파일과의 일치 여부는 주장하지 않는다. 원문 긴 발췌/코드 복사 없음.

수정: docs/reuse-decisions/CANDIDATE_INVENTORY.md의 두 행·후속 안내, docs/INTEGRATION_BACKLOG.md의 S0요약/두 행/남은 조건. spec/checklist/progress/LOOP는 다른 담당자 소유로 미수정. 과거 독립 보고서는 역사적으로 보존하고 후속 사용자 선택 증거를 링크했다.

검증: 두 문서 행의 repository/pin/alias/상태 일치, unresolved2 안내 제거, 대체후보 미선택 표시 확인. registry/catalog/generatedhost의 전후 SHA동일. 제품 source/runtime 및 credentials 조회·CLI실행·install·model호출0. doc-only이므로 테스트/빌드 없음. 교정0, 1차 문서 gate 통과. parent가 다른 문서와 조율할 기록이다.
