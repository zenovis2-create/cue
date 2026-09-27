# S0 candidate identity — group B

조사 시각: 2026-09-12 (Asia/Seoul). 범위는 공개된 공식 GitHub 저장소, 저장소 내 문서, 공식 릴리스의 읽기 조사뿐이다. clone/install/실행/인증/모델 호출은 하지 않았다. 아래 `HEAD`는 조사 순간의 관측값이며 설치된 로컬 artifact와 동일하다는 뜻이 아니다.

## 판정 요약

| 요청 이름 | 외부 identity 판정 | Cue 상태 | 가장 좁은 연결 경계 |
|---|---|---|---|
| `hermesagent` | **ambiguous**. `NousResearch/hermes-agent`와 정확한 계정명 `hermesagent`가 서로 다른 제품군을 가리킨다. 요청 이름만으로 선택 불가 | **inactive-unresolved** | 제품 URL/owner를 먼저 확정. Nous 제품이라면 ACP stdio가 우선 후보 |
| `openclaw` | **resolved externally**: `openclaw/openclaw`, npm package/CLI `openclaw` | **inactive-unqualified** | Gateway WebSocket JSON protocol client; Gateway가 session/runtime owner |
| `paseo` | **resolved externally**: `getpaseo/paseo`, npm CLI `@getpaseo/cli`의 command `paseo` | **inactive-unqualified** | `@getpaseo/client` 또는 daemon WebSocket; Paseo가 child agent/workspace owner |

`resolved externally`는 공개 identity만 뜻한다. 로컬 설치본의 version/SHA, credential 상태, 실제 protocol, cancel/cleanup은 이 조사로 자격을 얻지 않는다.

## `hermesagent` — inactive-unresolved

### 충돌하는 공식 후보

1. **Nous Research Hermes Agent** — 공식 저장소 [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)는 자신을 Nous Research의 self-improving agent로 설명하고, 배포 package 이름을 `hermes-agent`, console entry를 `hermes`, `hermes-agent`, `hermes-acp`로 선언한다. 근거: [README @ `20816c1`](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/README.md), [pyproject.toml @ `20816c1`](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/pyproject.toml). 공식 이름이나 entrypoint 중 정확히 `hermesagent`인 것은 없다.
2. **GitHub account `hermesagent`** — [정확한 계정명](https://github.com/hermesagent)은 자신을 VPS에서 동작하며 website-analysis API를 만드는 autonomous agent라고 소개한다. 이 계정의 공개 `hermesforge-mcp`는 Hermesforge screenshot/chart API용 MCP server이며 Nous CLI와 다른 역할이다: [README @ `913035a`](https://github.com/hermesagent/hermesforge-mcp/blob/913035a6d19cb7d2b0356fcbbff1fa493d61cf43/README.md), [commit `913035a`, 2026-04-29](https://github.com/hermesagent/hermesforge-mcp/commit/913035a6d19cb7d2b0356fcbbff1fa493d61cf43).

따라서 bare token `hermesagent`를 Nous 제품으로 자동 정규화하지 않는다. owner/repository/product URL이 주어질 때까지 registry row는 `inactive-unresolved`이고 executable, auth, protocol을 연결하지 않는다. 아래 기술 평가는 **후보 1이 의도였을 경우의 조건부 조사**다.

### 후보 1 관측 pin과 유지보수 신호

- 조사한 `main` HEAD: [`20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c`, 2026-09-12T02:14:24Z](https://github.com/NousResearch/hermes-agent/commit/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c).
- 최신 공개 릴리스: [`v2026.9.11` / Hermes Agent v0.21.2, published 2026-09-11](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.9.11), tag commit [`939e45c`](https://github.com/NousResearch/hermes-agent/tree/939e45c91d751fadd94dcd1b873ac3cb44846213).
- 릴리스 노트는 v0.21.0/0.21.1의 SQLite `state.db` writer/lock/corruption 계열 회귀를 고친 patch라고 명시한다. 최근 release/commit 활동은 유지보수 신호지만, 이전 두 버전의 session-store 회귀와 대규모 변경량은 pin과 회귀 검증 없이 latest를 상속하면 안 된다는 신호이기도 하다.

### License / redistribution

- First-party code는 [MIT License @ `20816c1`](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/LICENSE)이고 project metadata도 MIT를 선언한다. 복사/재배포 시 copyright와 permission notice를 포함해야 한다.
- 이번 경계는 vendor code를 Cue에 복사하지 않고 외부 process/protocol로 연결하는 방식이다. 실제 bundle/installer 재배포를 택하면 dependency별 license inventory는 별도로 필요하다.

### 역할, capability, control surface, auth

- 역할은 model endpoint가 아니라 stateful agent runtime이다. memory/skill 학습, cron, subagent, terminal/browser, messaging gateway를 포함한다: [README](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/README.md).
- 가장 좁은 structured control 후보는 **ACP server over stdio**다. `hermes acp`/`hermes-acp`가 stdout을 ACP JSON-RPC 전용으로 사용하고 approval/tool/session 표현을 제공한다: [ACP host integration](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/user-guide/features/acp.md). ACP extra와 별도 browser bootstrap이 필요하다.
- 다른 surface로 OpenAI-compatible HTTP API가 있다. 기본 예시는 `127.0.0.1:8642`, `/v1/chat/completions`와 `/v1/responses`, SSE streaming, Bearer `API_SERVER_KEY`를 기술한다. tool call은 Hermes가 server-side로 실행하며 일부 Hermes custom SSE event가 있다: [API server](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/user-guide/features/api-server.md). 이 surface는 Cue가 child tool execution을 직접 소유하는 경계가 아니다.
- provider/API key/OAuth, model, tool backend, sessions는 Hermes home 아래 config/env/auth/state에 결합한다: [configuration](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/user-guide/configuration.md). 무인 API/webhook session의 위험 명령 기본값은 deny이고 `--yolo`/approval-off 경로도 존재한다: [security](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/user-guide/security.md).
- 공개 subagent lifecycle API는 active parent turn 안에서만 launch되고 opaque capability handle, idempotent bounded result, stop/cleanup을 제공하지만 per-launch timeout과 일부 override를 거부한다: [subagent lifecycle API](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/developer-guide/subagent-lifecycle-api.md). 이는 Python plugin 내부 API이며 Cue 외부 adapter의 첫 경계로 삼지 않는다.

### Windows/runtime/install side effects와 명시 제한

- Python 범위는 `>=3.11,<3.14`다: [pyproject.toml](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/pyproject.toml).
- Native Windows 10/11 x86_64/aarch64는 Tier 1이지만 dashboard의 embedded terminal pane은 POSIX PTY가 없어 지원되지 않는다. PyPI/pip/uv-tool install과 Homebrew/AUR는 공식적으로 unsupported이고 Docker는 `hermes update`를 지원하지 않는다: [platform support](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/getting-started/platform-support.md), [Windows guide](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/user-guide/windows-native.md).
- Windows installer는 `%LOCALAPPDATA%\hermes` 계열에 source/venv/state를 만들고 User PATH를 변경하며 uv, Python 3.11, Node, ripgrep, ffmpeg, PortableGit/Git Bash를 provision할 수 있다. browser 첫 사용은 npm package와 약 400 MB Chromium 다운로드를 유발할 수 있다: [installation](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/getting-started/installation.md), [Windows guide](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/user-guide/windows-native.md), [ACP guide](https://github.com/NousResearch/hermes-agent/blob/20816c13cdde3fbc7b4b2b25ea2e3a404b487c1c/website/docs/user-guide/features/acp.md).

### Cue 적합성 / adapter boundary

Identity가 Nous 제품으로 확정된 뒤에도 agent runtime으로만 등록한다. 우선 경계는 `hermes-acp` child process + stdio ACP이며 Cue가 spawn/timeout/process-tree cleanup과 protocol version pin을 소유하고 Hermes가 한 session 내부 tool/model/memory를 소유한다. OpenAI-compatible API는 이미 실행 중인 Hermes Gateway를 사용자 지정 remote runtime으로 연결할 때만 별도 adapter 후보로 둔다. desktop, messaging gateway, updater, browser bootstrap, config/auth migration은 자동 호출하지 않는다.

활성화 전 최소 미해결 항목은 (1) owner/URL identity 확인, (2) 로컬 binary/package와 upstream pin 대응, (3) ACP initialize/capability/approval/cancel/EOF 계약, (4) Windows process-tree 종료와 state path, (5) auth를 읽지 않는 readiness probe다.

## `openclaw` — resolved externally, inactive-unqualified

### Identity와 관측 pin

- 공식 저장소/website/docs가 서로 연결되고 package metadata가 name/bin 모두 `openclaw`로 선언한다: [README @ `4393642`](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/README.md), [package.json @ `4393642`](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/package.json), [공식 docs](https://docs.openclaw.ai/).
- 조사한 `main` HEAD: [`43936423ad6860820967601e8ea4eb087951d849`, 2026-09-12T02:15:20Z](https://github.com/openclaw/openclaw/commit/43936423ad6860820967601e8ea4eb087951d849).
- 최신 공개 릴리스: [`v2026.9.4`, published 2026-09-11](https://github.com/openclaw/openclaw/releases/tag/v2026.9.4), signed source/tag commit [`3a9d69d`](https://github.com/openclaw/openclaw/tree/3a9d69db306cd7f081e06254cb89c4bcc14a7107).

### License / redistribution

- First-party root는 [MIT License @ `4393642`](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/LICENSE), package metadata도 MIT다. 재배포 시 notice를 유지한다.
- bundled/derived component 고지는 [THIRD_PARTY_NOTICES.md @ `4393642`](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/THIRD_PARTY_NOTICES.md)에 별도로 있다. 외부 protocol adapter만 구현하면 OpenClaw source 편입을 피할 수 있다.

### 역할, capability, control API/protocol/auth

- OpenClaw는 model 자체가 아니라 multi-channel AI assistant와 **Gateway control plane**이다. Gateway가 sessions, tools, events, channel connections를 소유하고 UI/CLI/TUI/node가 client다: [README](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/README.md), [architecture](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/docs/concepts/architecture.md).
- 공개 control plane은 기본 port `18789`의 WebSocket text JSON frames다. request `{type:"req", id, method, params}`, response, event를 사용하고 schemas가 method/event surface를 정의한다: [Gateway protocol](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/docs/gateway/protocol.md), [architecture summary](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/docs/concepts/architecture.md).
- session control은 `sessions.list/create/send/abort/reset/delete/compact`, `chat.history/send/abort` 등을 제공한다. run ID를 주면 abort를 그 run으로 제한할 수 있고 여러 method는 `operator.write` 또는 `operator.admin` scope를 요구한다: [session control RPC](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/docs/gateway/protocol/rpc-session-control.md).
- handshake auth는 shared token/password, device token과 role/scope pairing, Tailscale/trusted-proxy 경로를 가진다. `gateway.auth.mode:none`은 private ingress 전용이고 public/untrusted ingress에 노출하지 말라고 명시한다: [protocol auth](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/docs/gateway/protocol/auth.md).
- main session의 tools는 sandbox를 별도 구성하지 않으면 host에서 실행되고, 한 Gateway는 하나의 operator trust boundary다. hostile-user isolation에는 OS user/host 및 Gateway 분리가 필요하다: [trust model](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/docs/gateway/security/trust-model.md), [README security](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/README.md).

### Windows/runtime/install side effects와 제한/maintenance

- package `2026.9.4`는 Node `>=24.16.0 <25 || >=26.1.0`을 요구한다: [package.json](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/package.json).
- installer는 필요하면 Node를 provision하고 onboarding을 시작한다. `openclaw onboard --install-daemon`은 workspace/config/Gateway service를 만든다: [install docs](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/docs/install/index.md).
- Windows에는 native CLI/Gateway와 별도 Windows Hub가 있다. Hub의 local setup은 app-owned `OpenClawGateway` WSL distro를 provision하고 pair하며, native managed Gateway는 Scheduled Task와 VBS wrapper를 만들고 실패 시 Startup-folder login item으로 fallback한다: [Windows docs](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/docs/platforms/windows.md). WSL2가 가장 Linux-compatible한 Gateway runtime이라고 공식 문서가 권한다.
- state dir에는 config token, channel credentials, model auth, MCP OAuth, transcripts/tool output가 포함될 수 있다: [secrets and storage](https://github.com/openclaw/openclaw/blob/43936423ad6860820967601e8ea4eb087951d849/docs/gateway/security/secrets-and-storage.md). Cue discovery가 이 경로를 자동 탐색하거나 복사하면 안 된다.
- 최신 릴리스는 active maintenance 신호이나 release verification에 Telegram/Parallels waiver, Android native qualification failure, Windows historical-upgrade advisory failure, 일부 publication/closeout pending을 명시한다: [v2026.9.4 release](https://github.com/openclaw/openclaw/releases/tag/v2026.9.4). release 존재만으로 모든 platform gate 통과를 주장하지 않는다.

### Cue 적합성 / adapter boundary

Cue에는 `agent-platform`/`gateway-runtime`으로만 등록한다. 가장 안정적인 경계는 **기존 Gateway에 대한 version-pinned WebSocket client**다. Cue는 connect/auth reference, request ID, run ID, timeout, reconnect budget과 desired session을 소유하고, OpenClaw Gateway는 channel/model/tool/session persistence와 child runtime을 소유한다. Cue가 Gateway-owned session/worktree/process를 동시에 직접 종료하지 않는다. CLI stdout parsing이나 `openclaw agent --json`은 protocol bootstrap/diagnostic fallback일 뿐 canonical lifecycle 경계로 삼지 않는다.

활성화 전에는 exact installed npm tree/launcher/Node identity, Gateway protocol version negotiation, read-only health method, auth reference 주입 방식, `sessions.abort` 후 terminal state, disconnect/reconnect replay, Windows service process-tree cleanup을 실제 fixture에서 검증해야 한다.

## `paseo` — resolved externally, inactive-unqualified

### Identity와 관측 pin

- 공식 저장소는 coding-agent orchestrator를 설명하고, package `@getpaseo/cli`가 bin `paseo`를 선언한다: [README @ `fa93c42`](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/README.md), [CLI package.json @ `fa93c42`](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/packages/cli/package.json), [official site](https://paseo.sh/).
- 조사한 `main` HEAD: [`fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b`, 2026-09-11T16:58:13Z](https://github.com/getpaseo/paseo/commit/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b).
- 최신 공개 릴리스: [`v0.8.0`, published 2026-09-10](https://github.com/getpaseo/paseo/releases/tag/v0.8.0), tag commit [`b8e2467`](https://github.com/getpaseo/paseo/tree/b8e24677e12b226c7c38c1c3a40649daa9f1152f).

### License / redistribution

- First-party 부분은 [Apache-2.0 @ `fa93c42`](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/LICENSE)이고 third-party component는 각 원 저작자의 license를 유지한다고 명시한다. 재배포 시 Apache-2.0의 license/notice/modified-file 조건과 실제 bundled third-party licenses를 함께 점검해야 한다.
- Cue adapter는 공개 client/protocol을 dependency 또는 외부 process boundary로 사용하고 server/provider 구현을 복사하지 않는 것이 license 및 ownership 면에서 작다.

### 역할, capability, control API/protocol/auth

- Paseo는 agent/model을 제공하지 않는다. 이미 설치·인증된 Claude Code, Codex, OpenCode, Pi 등의 CLI를 daemon이 subprocess로 launch/supervise하고 desktop/mobile/web/CLI가 연결한다. native adapter와 generic ACP-over-stdio provider tier가 있다: [providers](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/providers.md), [supported providers](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/supported-providers.md).
- daemon은 local agent lifecycle, workspace/worktree, terminal/browser/diff와 orchestration을 소유한다. agents는 MCP tools 또는 CLI로 다른 agents를 만들고 prompt를 보내며 schedule/heartbeat를 구성할 수 있다; MCP injection은 기본 off다: [orchestration](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/orchestration.md), [workspaces](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/workspaces.md).
- 공식 TypeScript client `@getpaseo/client`가 daemon WebSocket(`ws://127.0.0.1:6767/ws`)을 제어한다. `agents.create/list/ref`, handle `send/run/waitForFinish/archive/detach/subscribe`와 provider/mode/model/feature/MCP tool-policy fields를 공개한다: [SDK overview](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/sdk/index.md), [SDK reference](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/sdk/reference.md).
- direct daemon은 기본 `127.0.0.1:6767`; network bind에는 password를 권장한다. HTTP는 Bearer header, WebSocket은 subprotocol로 인증하며 `/api/health`만 예외다. password는 bcrypt hash로 config에 저장된다: [security](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/security.md).
- optional relay는 기본 off이고 opt-in pairing 후 Curve25519 + NaCl box(XSalsa20-Poly1305) E2EE를 사용한다. SSH client transport는 remote daemon을 install/start/configure하지 않으며 non-interactive OpenSSH를 사용한다: [security](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/security.md), [connectivity](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/connectivity.md).
- provider auth는 Paseo가 관리하지 않고 각 CLI의 기존 user-context credential을 사용한다. 문서는 Paseo가 provider API key를 저장/전송하지 않는다고 명시한다: [security — Agent authentication](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/security.md).

### Windows/runtime/install side effects와 제한/maintenance

- `npm install -g @getpaseo/cli`는 global CLI/server dependency를 설치하고 `paseo` 시작 시 daemon과 optional relay pairing prompt를 연다. state/config/log는 `PASEO_HOME`(기본 `~/.paseo`)에 남는다: [getting started](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/index.md), [README](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/README.md).
- v0.8.0 릴리스에는 x64/arm64 Windows installer와 zip assets가 있다: [release assets](https://github.com/getpaseo/paseo/releases/tag/v0.8.0). Windows launch는 받은 environment를 사용하고 log는 `%APPDATA%\Paseo\logs\main.log`다: [troubleshooting](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/troubleshooting.md).
- inspected root/CLI package metadata에는 Node `engines` 범위가 선언되어 있지 않다: [root package.json](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/package.json), [CLI package.json](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/packages/cli/package.json). 그러므로 Cue가 지원 Node 범위를 추정하면 안 된다.
- provider CLI는 bundle되지 않으며 PATH에 없으면 unavailable이다. ACP agent도 별도 command/install이 필요하다: [troubleshooting](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/troubleshooting.md), [custom providers](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/public-docs/custom-providers.md).
- plugin은 daemon machine과 connected client 안에서 실행되므로 trusted code만 설치하라고 명시한다. v0.8.0은 v0.7 plugin에 migration이 필요하고, Windows file-watcher 및 Codex reload active-writer 문제 수정도 포함한다: [README plugin warning](https://github.com/getpaseo/paseo/blob/fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b/README.md), [v0.8.0 release](https://github.com/getpaseo/paseo/releases/tag/v0.8.0). 최근 release/HEAD는 active maintenance 신호이나 API/plugin drift도 빠르다는 신호다.

### Cue 적합성 / adapter boundary

Paseo는 Cue와 같은 orchestration/lifecycle owner가 될 수 있으므로 경계를 하나만 선택해야 한다. 적합한 연결은 **Paseo daemon이 agent process, workspace/worktree, provider protocol을 전부 소유하고 Cue는 `@getpaseo/client`/WebSocket의 remote supervisor 역할만 하는 방식**이다. Cue는 agent ID, 요청 timeout, user-visible cancel/archive intent와 reconnect를 관리하되 provider child PID, worktree 삭제, credential/PATH를 직접 관리하지 않는다. 반대로 Cue가 provider process와 workspace를 직접 소유하는 execution path에서는 Paseo를 끼우지 않는다.

활성화 전에는 exact installed CLI/desktop version, daemon protocol compatibility, password/relay를 건드리지 않는 local health probe, `run` timeout과 실제 cancel 차이, `archive`의 process 종료 및 worktree 보존/삭제, reconnect event replay, Windows child process cleanup을 fixture로 확인해야 한다. 공식 SDK의 기본 10분 wait timeout은 agent cancellation을 뜻하지 않으므로 별도 lifecycle 증거가 필요하다.

## S0 결론

- `hermesagent`: owner/product URL을 받기 전까지 **inactive-unresolved**. 어떤 installer나 local executable에도 bind하지 않는다.
- `openclaw`, `paseo`: 공개 product identity만 resolved. 둘 다 model provider가 아니라 stateful agent platform/orchestrator이며 **inactive-unqualified**다.
- 다음 단계가 허용되더라도 먼저 pinned local identity와 read-only handshake를 검증하고, Cue와 vendor 중 한쪽만 process/session/worktree cleanup owner로 둔다.
