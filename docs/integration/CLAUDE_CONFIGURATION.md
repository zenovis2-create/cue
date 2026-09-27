# Claude configuration binding (inactive host integration)

Implemented for the S1 second-agent prerequisite. **This is not a Claude authentication implementation or an enabled candidate.** See [batch87 verification](../../evidence/integrations/S1/20260922-claude-configuration/RESULTS.md).

## Host contract

`app/claude-configuration.mjs` exports:

- `createClaudeConfigurationResolver({ installation, now, maxAgeMs, resolveAuthorizedSession })`: creates the host-only resolver used as `ClaudeCliExecutorHost.resolveAuthorizedConfig`.
- `consumeClaudeConfiguration(binding, request, installation)`: executor-only consumption immediately before spawn.

The request contains exact attempt, candidate, current subject digest, approved account reference/digest, model and canonical worktree. The trusted callback returns either `null` (unavailable) or a session record containing the same request, an identified `authProfilePath`, an explicit environment, and observation/expiry times. It may return a native Promise; untrusted thenables are not accepted.

The callback **must independently establish authorization and the exact CLI version's session/profile mapping**. Echoing a request or finding an auth file is not authentication, entitlement, subscription permission, or qualification. There is intentionally no default callback, ambient-login discovery, automatic credential copy, sign-in flow or UI-supplied authorization boolean.

The current version gate remains Claude CLI `2.1.274`, as in the existing inactive executor. It is not evidence that SDK fields, this layout, or these launch flags work with a real installation.

## Explicit environment policy

Exactly these nine keys are accepted; none are inherited:

`SystemRoot`, `WINDIR`, `USERPROFILE`, `HOME`, `APPDATA`, `LOCALAPPDATA`, `TEMP`, `TMP`, `CLAUDE_CONFIG_DIR`.

All directories must already exist at canonical absolute paths without symlinks/junctions. `HOME` equals `USERPROFILE`, `TMP` equals `TEMP`, and `WINDIR` equals `SystemRoot`. AppData, local AppData, temp and Claude config are strict descendants of the explicitly selected home; the selected profile is inside that home and already belongs to the installation descriptor. The actual ambient user home is refused. Home/worktree and system/home/worktree overlaps are refused.

This is a **Cue-side path/configuration contract**, not a proven Claude-supported login migration layout or an OS isolation boundary. It does not create directories, read/copy credential contents, or validate managed-policy contents. Required managed policy, CLI compatibility, filesystem/network/process containment, and runtime qualification remain separate gates. Extra environment keys (including PATH and credential variables) are refused rather than silently forwarded.

## Issuance and launch ordering

1. Validate and snapshot the approved launch fields; reject the former launch-supplied `env` property.
2. Check attempt/account/owner/envelope/current installation, then request the explicit host configuration.
3. Match the complete request and identified profile, check bounded time validity and filesystem metadata, and issue a private one-use binding.
4. After asynchronous lookup, reject cancellation or unavailable configuration.
5. Consume only an object issued in the same process for the same installation/request. Recheck installation, directory/file identities and expiry. Clones, foreign bindings, reuse and drift refuse.
6. Recheck cancellation and envelope validity after the potentially slow installation measurement, then call the existing `spawnOwned` boundary with the immutable explicit environment.

Launch data is snapshotted before lookup; a host callback cannot mutate the pending prompt/model/owner/actions through the original object. Configuration bindings expose no environment/path/credential data in their serializable payload. Per-resolver duplicate attempt lookup is denied, including concurrent calls. Consumption failures also retire that binding.

In-memory one-use checks do not replace durable driver ownership or restart guards. A new process cannot deserialize an old binding into authority. Metadata freshness is not atomic protection against a hostile writer racing validation and spawn; protected host-owned configuration and independently qualified runtime boundaries are still required.

## Remaining production work

- An authorized, version-supported source for Claude session/config/account observations (not the test resolver).
- Current measurement subject, capability/entitlement evidence and candidate registration.
- Actual process/stream/cleanup and workflow acceptance qualification with newly approved live-call budget.
- Provider termination/final billing evidence, four-mode holdout measurements and release acceptance.

Until those gates pass, no candidate becomes ready and no existing Codex or local-model startup path is changed.
