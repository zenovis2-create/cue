# Remaining three CLI candidates — bounded identity discovery

2026-09-11. Source freeze 유지: 제품코드 수정없음. 기존 S0 command-discovery/inventory.json, embedded-versions.json 및 three-candidate-introspection/report.md를 먼저 읽었다. 범위3후보, 원인별 시도상한2. 완료기준 wrapper/product/entrypoint 근거와 안전한 introspection경로 판정, 현파일SHA, registry제약 기록. CLI실행0, auth/config/secret파일읽기0, 설치/업데이트/agent/model호출0. 외부접근은 공식source/doc 읽기만 수행했다.

## Hermes Agent

E:/AppData/Hermes/bin/hermes.exe는46,080byte uv trampoline이다. 내장zip __main__.py는 명시된venv Python에서 hermes_cli.main:main을 호출한다. 해당설치 source __init__.py의 **선언버전0.21.1**을 확인했다. 실제 CLI출력버전이나 upstream commit 동일성은 아니다.

로컬 main.py:51의 recover_if_needed 호출이 main.py:305 try_fast_version보다 먼저 실행된다. 따라서 --version도 무조건무부작용 경로로 간주하지 않았고 실행하지 않았다. --help도 imports/state bootstrap을 생략한다는 근거가 부족하다. 선언역할은 interactive agent/oneshot/gateway이며 하위tools/MCP/browser/terminal cleanup이 별도 책임이라는 코드가 있다. 모델 endpoint와 동급 등록하면 안 된다. [공식 고정 source](https://github.com/NousResearch/hermes-agent/blob/05d705dd695d1084388529124dc2ffe5ce919e89/hermes_cli/main.py).

## OpenClaw

npm/openclaw.cmd는 adjacent node.exe 우선/PATH node fallback으로 node_modules/openclaw/openclaw.mjs를 호출한다. .local/bin/openclaw.cmd는 C:/Program Files/nodejs/node.exe를 고정하고 APPDATA 기반의 같은이름 module을 참조한다. 이름은같아도 interpreter/환경결합은 다르므로 executableidentity를 합치지 않는다. wrapper 해시는기존inventory와 일치했다.

공식 pin의 launcher에는 --version fastpath와 cached help가 있지만 help는 조건에 따라runtime entry로넘어간다. 설치된module내용과 그pin의 동일성을 확인하지 않았으므로 실제version/help를 실행하지 않았다. 이번범위에서는 node_modules 파일을 열지 않았다. [고정 launcher source](https://github.com/openclaw/openclaw/blob/2128a6081516d44e82ecfb9bee059e8075596e0e/openclaw.mjs), [공식 CLI reference](https://docs.openclaw.ai/cli).

## Orca

설치 resources/bin/orca.cmd는 adjacent native orca.exe로 전달한다. wrapper는 orchestration send/reply를 cmd의 본문재해석 문제 때문에 명시거부한다. 따라서 향후 연결은 native executable을 고정하고 구조화된argv를 써야 한다. native SHA는기존inventory와 일치했고 설치버전/upstreamcommit 대응은 미확인이다.

공식제품은 agent/worktree/desktop/browser workflows를 관리하는 IDE/orchestrator다. 일반 LLM provider가 아니다. [고정 README](https://github.com/stablyai/orca/blob/2ecde717b4561cae1701a27615f704434232399a/README.md), [공식 CLI overview](https://www.onorca.dev/docs/cli/overview). 로컬 orca-cli SKILL.md는 discovery stub과 version-matched guide 규칙만읽었으며 skill은활성화하지 않았다. 이번목표는앱상태조작이 아니고 허용실행도 --help/--version으로제한되어 skills/status/IPC/open 명령을 실행하지 않았다. exactnative의 안전한help route 확인없이 실행하지 않는원칙을 지켰다.

## Registry에 반영할 수 있는 구분

| 후보 | 확인 수준 | 자동상속하면 안 되는 항목 |
|---|---|---|
| Hermes | installed trampoline + entrypoint + source선언버전 | 인증,실제version,modelcanonical목록,stream계약,완료·취소·하위프로세스정리,권한격리 |
| OpenClaw | installed wrapper/JS entrypoint선언 + 공식제품후보 | 설치moduleversion·서명,Node선택동일성,gateway귀속,auth/state접근,종료보장 |
| Orca | installed nativewrapper연결 + 공식orchestrator후보 | installed/upstream동일성,JSON schema/실제IPC계약,agentcompleted≠요구사항acceptance,worktree/sessionownership |

세 후보 모두 authenticated/streaming/cancel/usage/OSboundary/cleanup은 unknown이며 Cue지원·자격은 부여하지 않는다. 프로세스이름 발견과 제품연결 선언은 eligibility가 아니다. 기존라이선스연구를 변경하지 않았고 vendor CLI코드복사·재배포 없음. 정확한로컬경로/해시는 hashes.json, 구조화된등록후보는 inventory.json 참조.
