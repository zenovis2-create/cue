# Claude Code 로컬 CLI 선언 확인

2026-09-11 · 실행자 `/root/reuse_pure` · 범위: 지정된 바이너리의 `--version`, `--help`만 실행. 제품 소스 변경 없음.

실행 경로: `C:/Users/User/.local/bin/claude.exe`

| 진단 | 결과 | 소요 시간 | 증거 |
| --- | --- | --- | --- |
| `--version` | exit 0, `2.1.267 (Claude Code)` | 54 ms | `version.json`, `version.stdout.txt`, `version.stderr.txt` |
| `--help` | exit 0, 일반 도움말 출력 | 178 ms | `help.json`, `help.stdout.txt`, `help.stderr.txt` |

각 명령은 `ProcessStartInfo`의 `UseShellExecute=false`, `CreateNoWindow=true`, `WindowStyle=Hidden`으로 실행했다. 직접 소유한 PID의 종료를 최대 10초 기다리고, 초과 시 해당 프로세스 트리를 종료하도록 제한했다. 두 명령 모두 제한 내에 종료했으며 stderr는 비어 있다. 프롬프트, 인증, 설치, 업데이트 또는 다른 CLI 명령은 실행하지 않았다. 계정 초기화나 로그인 입력을 요구하는 흐름으로 진입하지 않았다.

실행 전후 바이너리 SHA-256은 네 번 모두 동일하다:

`23dde2a47cf1d7d9c4a2d96d21fa80ea9bfc872dfde0ee06e9982d2908603350`

기존 PE 메타데이터 `2.1.267.0`과 실제 version 출력 `2.1.267`은 구분해 기록한다. `../20260911-command-discovery/embedded-versions.json`의 발견 해시와 일치한다.

## 실제 도움말에 표시된 선언

아래는 저장된 `help.stdout.txt`에 있는 옵션 설명을 요약한 것이다. 실행·격리·정리 능력 검증 결과가 아니다.

| 영역 | 선언된 옵션과 의미 |
| --- | --- |
| 비대화형 실행 | `-p`, `--print`: 응답 출력 후 종료. 기본 실행은 대화형 |
| 입력 프로토콜 | `--input-format text\|stream-json`: print 모드의 입력 형식 |
| 출력 프로토콜 | `--output-format text\|json\|stream-json`; `--include-partial-messages`, `--forward-subagent-text`, `--replay-user-messages`가 스트림 관련 옵션으로 표시됨 |
| 구조화 출력 | `--json-schema`: 구조화 출력 검사용 JSON Schema 입력 |
| 도구 설정 | `--tools`에 빈 문자열을 주면 기본 제공 도구를 비활성화한다고 설명. `--allowedTools`/`--allowed-tools`, `--disallowedTools`/`--disallowed-tools`도 표시됨 |
| 권한 응답 | `--permission-mode`와 `--permission-prompts host\|none`. 후자의 `none`은 질문이 필요한 요청을 자동 거절한다고 설명하며, 나머지 판단은 권한 모드가 수행한다고 명시 |
| 최소 구성 | `--bare`: hooks·LSP·plugin sync·메모리/CLAUDE.md 자동 탐색 등 일부 초기화 생략을 설명. 인증 방식 제한도 도움말에 적혀 있으나 인증 설정은 읽거나 시험하지 않음 |
| 사용자 구성 차단 | `--safe-mode`: 여러 사용자 정의 기능 비활성화를 설명하지만, 관리 정책과 기본 도구·권한 기능은 유지된다고 명시 |
| 제한 모드 | `--restricted`: 명령 실행 도구 등의 제한과 설정 소스 무시를 설명. 명시적인 `--tools`로 일부 도구가 다시 포함될 수 있고, 관리 설정은 적용된다고 명시 |
| hooks | `--include-hook-events`: stream-json 출력에 hook lifecycle 이벤트 포함. `--bare`, `--safe-mode` 설명에도 hook 처리가 등장 |
| 설정·MCP | `--setting-sources`, `--settings`, `--mcp-config`, `--strict-mcp-config` |
| 디렉터리 | `--add-dir`: 추가 도구 접근 디렉터리. `-w`, `--worktree`: 새 git worktree 생성. 도움말의 공개 옵션 목록에 `--cwd`는 없음 |
| 모델·비용 | `--model`, `--fallback-model`, `--effort`, `--max-budget-usd`가 표시됨. 모델 예시는 가용성 확인 결과가 아님 |
| 세션 | `--no-session-persistence`, `--session-id`, resume/continue/fork 옵션과 background 관련 명령이 표시됨 |

`--print` 설명에는 비대화형 실행에서 작업 폴더 신뢰 대화상자를 생략하고, 유효하지 않은 설정 파일을 조용히 무시한다는 내용도 있다. 따라서 향후 Cue 연결에서는 이 옵션들의 존재를 설정 검증이나 권한 강제의 증거로 대신 사용할 수 없다.

이번 진단은 프롬프트·네트워크 요청을 직접 실행하는 명령을 사용하지 않았다. 실행 파일 내부의 네트워크 동작을 추적한 검사는 아니다. 스트림 파싱, 실모델 호출, 파일/환경/네트워크 격리, 취소·부모 종료·잔여물 정리와 P/B/M 자격은 모두 이번 범위 밖이다.

## 출력 해시

- `version.stdout.txt`: `8af323716e94a684dd2faf7e0720ec75ad20db3791997bd6a6fb7eac59c0a5da`
- `help.stdout.txt`: `ae85d661e9c086f05637ebcd868f5702b477ff6e55e2e65b8ada7807cd51a4b6`
- 두 빈 stderr 파일: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
