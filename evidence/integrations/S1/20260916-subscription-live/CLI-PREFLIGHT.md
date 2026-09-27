# Subscription CLI live-test preflight

## Completion contract (declared before the report was written)

- **Done:** document the exact signed executables, safe auth projections, current model settings, and the narrowest one-turn/no-tool command for each installed subscription CLI; call out every control that cannot be enforced.
- **Attempt cap:** 2 report-writing passes.
- **Gate every pass:** re-read this file; confirm it contains no token, email, organization identifier, or credential content; confirm all executable paths, hashes, versions, and command flags match local evidence/help.
- **Failure rule:** retry only with a new evidence-based hypothesis; otherwise hand the unresolved item to the human/operator. No provider/model invocation is part of this preflight.

## Verdict

Both installed CLIs are currently authenticated through user subscriptions and can be used without a paid API key. Claude exposes a strong CLI-enforced no-tool, no-customization, one-turn shape. Codex can disable user config, plugins/hooks, web search, multi-agent mode, persistence, approvals, and transport retries, but `codex exec` has no advertised disable-all-tools switch. A Codex run therefore needs an explicit no-tool prompt, a read-only sandbox, and fail-closed transcript rejection if any tool event appears. This is a known residual risk, not a proven no-tool guarantee.

The user's cap is **at most four actual test tasks/invocations**. Transport retry controls below prevent Codex HTTP/stream retries. Anthropic's official [environment-variable reference](https://code.claude.com/docs/en/env-vars) documents `CLAUDE_CODE_MAX_RETRIES`; set it to `0` to override the failed-request default of 10. Also set `MAX_STRUCTURED_OUTPUT_RETRIES=0` and do not request a JSON schema. The live plan intentionally uses `CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096` to accommodate medium reasoning. These controls bound known CLI retry paths, but the evidence ledger must still distinguish a spawned task from provider attempts observed in its transcript/usage.

## Installed and signed executables

| CLI | Exact executable | Observed CLI version | SHA-256 | Signature |
|---|---|---|---|---|
| Claude | `C:\Users\User\.local\bin\claude.exe` | `2.1.270 (Claude Code)` | `FD7F35EC7761195AB5BA4EFF423E48A78A7849E78F60D93EC31256CDB1A9EC7E` | Valid; subject contains `Anthropic, PBC` |
| Codex | `C:\Users\User\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe` | `codex-cli 0.154.0` | `BE96B992178B1E467C225800DA0D65F2C86D5EBA1EF0B14632F65DB381CBDFDE` | Valid; subject contains `OpenAI OpCo, LLC` |

The version receipt and PE file metadata agree for Claude (`2.1.270.0`). Codex has no populated Windows file/product-version field, so its `--version` receipt is authoritative. The `REVIEWED_CLAUDE_VERSION = '2.1.267'` constant in `scripts/reuse/claude-launch-spec.mjs` is stale relative to the installed binary and must not be used to claim that the current binary passed that adapter's version gate.

## Secret-free authentication and model projection

- `claude auth status --json`, projected without printing identity fields: `loggedIn=true`, `authMethod=claude.ai`, `subscriptionType=pro`, `apiProvider=firstParty`. A Claude credential file is present. Its content was not opened. `--safe-mode` preserves authentication; `--bare` must not be used because current help says it disables OAuth/keychain reads and restricts Anthropic auth to an API key or `apiKeyHelper`.
- `codex login status`, classified without echoing its raw text: exit `0`, status class `ChatGPT subscription`, no `@` character. `~/.codex/auth.json` is present; its content was not opened. If isolation is required, the runner may copy this file directly into a unique temporary `CODEX_HOME` without parsing/logging it, delete the temporary profile afterward, and never fall back to login or an API key.
- Current Codex config selects `gpt-6-astra` with reasoning effort `high`. The local model cache lists that exact ID and supports `low, medium, high, xhigh, max, ultra`; its default is `medium`. Preserve the explicit configured `high` setting unless the test plan says otherwise.
- The safe-projected Claude settings select model alias `opus` and effort `medium`; the environment model/default-model/effort overrides are unset. Preserve `--model opus --effort medium`. Treat the resolved canonical model reported by the live init/result stream as observed evidence; a full-ID precondition is unnecessary for this bounded subscription test.

## Claude: reviewed one-turn command

Pass the prompt on stdin and use an isolated empty working directory. Argument vector:

```text
--safe-mode
--restricted
--print
--output-format stream-json
--verbose
--include-partial-messages
--no-session-persistence
--tools ""
--disallowedTools mcp__*
--strict-mcp-config
--mcp-config {"mcpServers":{}}
--permission-mode dontAsk
--permission-prompts none
--max-turns 1
--model opus
--effort medium
```

Set these additional environment entries for the child process:

```text
CLAUDE_CODE_MAX_RETRIES=0
MAX_STRUCTURED_OUTPUT_RETRIES=0
CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096
```

Do not pass `--fallback-model`; omission leaves no requested fallback chain. Current help confirms: safe mode disables skills/plugins/hooks/MCP/custom agents; restricted mode ignores user/project/local settings and removes command/code tools and WebFetch; `--tools ""` disables all built-ins; strict empty MCP config suppresses other MCP servers; permission prompts are denied; session persistence is off. `--max-turns 1 --help` parsed successfully on the installed binary even though the option is absent from its rendered help, so retain it as a defense but record this documentation mismatch.

The existing `buildClaudeModelOnlySpec` is useful for transcript invariants, but it declares the older reviewed version, requires a full canonical ID, and sets an isolated home with auth `unconfigured`. It is not directly executable for this subscription test. For a live subscription run, preserve access to the original authenticated Claude profile while relying on `--safe-mode` and `--restricted`; do not use `--bare` and do not copy or print credential plaintext.

Fail closed unless the init frame reports empty `tools` and `mcp_servers`, all assistant content is text/thinking/redacted-thinking, and the terminal result is successful. Capture model/session/usage fields only from the emitted JSONL and redact identity-bearing fields.

## Codex: reviewed one-turn command

Use an isolated empty working directory and preferably a unique temporary `CODEX_HOME` containing only a direct, non-logged copy of the existing subscription auth file. Pass the prompt on stdin. Argument vector:

```text
exec
--ignore-user-config
--strict-config
--ephemeral
--json
--color never
--sandbox read-only
--ask-for-approval never
-C <isolated-empty-cwd>
-m gpt-6-astra
-c model_reasoning_effort="high"
-c forced_login_method="chatgpt"
-c model_providers.openai.request_max_retries=0
-c model_providers.openai.stream_max_retries=0
-c web_search="disabled"
-c features.multi_agent_v2=false
```

`--ignore-user-config` is essential because the normal profile contains plugins, MCP servers, multi-agent configuration, and hooks. Help explicitly says auth still uses `CODEX_HOME`. The isolated working directory avoids project instructions. `--ephemeral` disables session-file persistence, read-only plus never approval blocks writes, web search is disabled, and the known multi-agent feature is disabled. The forced login method prevents an API-key fallback. The zero retry settings are provider-scoped.

Codex uncertainty: no installed `exec` help flag disables every built-in tool. Do not add guessed feature names under `--strict-config`. Put `Do not call tools, apps, skills, subagents, shell, web search, or plugins; answer once from the supplied prompt only` in the test prompt, then reject the result if JSONL shows a tool call. Read-only sandbox reduces consequences but does not itself prevent read-only tool execution.

## Non-model checks performed

Only signed-binary `--help`, auth-status, filesystem-presence booleans, targeted configuration/model-cache projections, and receipt inspection were performed. No provider/model request was invoked. Qwen was not inspected or enabled.
