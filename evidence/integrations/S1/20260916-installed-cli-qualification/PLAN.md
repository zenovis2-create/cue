# Exact installed CLI offline qualification contract

## Scope

Qualify only these already measured vendor-signed candidates with offline metadata commands:

- Claude: `C:\Users\User\.local\bin\claude.exe`, expected SHA-256 `FD7F35EC7761195AB5BA4EFF423E48A78A7849E78F60D93EC31256CDB1A9EC7E`, signer subject containing `Anthropic, PBC`.
- Codex: `C:\Users\User\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`, expected SHA-256 `BE96B992178B1E467C225800DA0D65F2C86D5EBA1EF0B14632F65DB381CBDFDE`, signer subject containing `OpenAI OpCo, LLC`.

Allowed child arguments are exactly `--version`, `--help`, and, for Codex only, `app-server --help`. No stdin is supplied. No model request, login, upgrade, auth mutation, provider qualification, or historical binary execution is allowed. Qwen remains off.

## Done

Done means one reusable runner:

1. canonicalizes the exact executable path and rejects links/reparse points;
2. immediately checks the expected SHA-256 and valid Authenticode signer before each child start;
3. creates a unique temporary home and working directory and replaces `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `TEMP`, `TMP`, `CODEX_HOME`, and `CLAUDE_CONFIG_DIR` with paths inside it;
4. disables update checks through documented environment switches without importing source credentials;
5. starts a hidden, shell-free owned child with redirected stdin/stdout/stderr, bounded bytes and timeout, killing its tree on timeout;
6. records exit, duration, exact arguments, pre/post executable hashes, signature identity, output hashes/text, and temporary-profile before/after inventory;
7. removes the unique temporary root after measurement and records cleanup success;
8. emits versioned JSON that a later native host can consume as independently measured identity evidence.

Attempt cap: one implementation pass and one correction pass. Every pass runs the runner self-test, then all five allowed observations. A failure permits one changed-hypothesis correction; otherwise hand off without weakening checks.

## Gates

- `node --test scripts/reuse/installed-cli-offline-qualification.test.mjs`
- Five observations exit through the runner with `passed: true`: Claude version/help; Codex version/help/app-server-help.
- Exact candidate hashes are unchanged before and after every child.
- Every temporary profile inventory is empty before execution, cleanup reports success, and no source profile path is passed to a child.
- `git diff --check -- scripts/reuse/installed-cli-offline-qualification.mjs scripts/reuse/installed-cli-offline-qualification.test.mjs evidence/integrations/S1/20260916-installed-cli-qualification`

This gate establishes current-byte identity and offline declared protocol surface only. It does not establish authenticated transport, provider availability, success/failure/cancel/restart behavior, cleanup of real work, entitlement, billing finality, or P13/M qualification.
