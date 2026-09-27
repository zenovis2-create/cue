# Exact installed CLI offline qualification result

Status: **PASS — identity and declared protocol surface only**  
Date: 2026-09-16

Five sequential, hidden, shell-free observations passed against exact vendor-signed bytes after the runner self-test passed 3/3:

| Candidate | Observation | Declared result | Exit | Pre/post SHA-256 | stderr | Cleanup |
| --- | --- | --- | ---: | --- | ---: | --- |
| Claude | `--version` | `2.1.270 (Claude Code)` | 0 | `FD7F35EC...B1A9EC7E` unchanged | empty | verified quiescent; temp removed |
| Claude | `--help` | current CLI option/command surface | 0 | same | empty | verified quiescent; temp removed |
| Codex | `--version` | `codex-cli 0.154.0` | 0 | `BE96B992...81CBDFDE` unchanged | empty | verified quiescent; temp removed |
| Codex | `--help` | current CLI option/command surface | 0 | same | empty | verified quiescent; temp removed |
| Codex | `app-server --help` | `stdio://` default plus schema/daemon/proxy commands | 0 | same | empty | verified quiescent; temp removed |

Before every child start and again after exit, the runner rehashed the canonical executable and required a valid Authenticode signature from the expected vendor. Claude bound to Anthropic thumbprint `0D7581D2C51C59DF686C3000C70BF543F9F6C6CB`. Codex bound to OpenAI thumbprint `FEAA595B06C5C389641FF093A5FB6506A7AF50B9`.

All home/config/temp variables pointed into a unique system temporary root. Claude created no entries beyond the seven prepared directories. Codex created only isolated `CODEX_HOME/tmp/arg0/<nonce>/{.lock,apply_patch.bat,applypatch.bat}` bootstrap files. All five roots were removed after process quiescence; a bounded post-check found zero `cue-cli-qualification-*` roots.

The direct Codex launcher path `C:\Users\User\AppData\Local\Programs\OpenAI\Codex\bin` is a junction to `C:\Users\User\.codex\packages\standalone\current\bin` and was rejected by the strict canonicalizer. Qualification used the non-reparse, byte-identical, OpenAI-signed npm payload:

`C:\Users\User\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`

## Original-clause effect

- **S0-01 partially satisfied:** current installed binary provenance and declared protocol/auth-reference surfaces are now bound to exact current bytes. Claude declares `text|stream-json` input and `text|json|stream-json` output, restricted/safe/bare configuration behavior, and explicit auth modes in current help. Codex declares `CODEX_HOME`-relative profile/config behavior and app-server `stdio://` transport in current help. Disposition for both is `offline-metadata-qualified / authenticated transport unqualified`. S0-01 remains open because help text and profile-file presence do not prove authentication, entitlement, stream behavior, or provider availability; Qwen remains deferred/OFF.
- **S1-01 prerequisite satisfied only:** exact identity/protocol pins now exist for changed-hypothesis fixtures. The required actual success/failure/cancel/restart lifecycle matrix and adopt/limited/reject/defer transport decision remain open.
- **S1-02 prerequisite satisfied:** a currently installed, vendor-signed Codex 0.154.0 SHA and declared app-server surface are known independently of the deferred historical `oldCodexSHA`. The required app-server/worktree/event/Stop/reopen comparison and cleanup-unknown-zero measurement remain open.
- **S1-03 installation prerequisite satisfied for the second agent:** Claude 2.1.270 exact identity and current declared stream surface are available. An authenticated second-agent protocol run remains open. The separate local-model M/P gates remain deferred while Qwen is OFF.

No lifecycle, provider success, cancellation, restart, worktree behavior, remote termination, billing, P13/M, account entitlement, or model qualification is claimed.

## Reusable input artifact schema

Each `*.input.json` is the immutable request:

```json
{
  "candidate": "claude|codex",
  "observation": "version|help|app-server-help",
  "executable": "canonical absolute non-reparse path",
  "expectedSha256": "64 uppercase hex",
  "signerContains": "required Authenticode subject fragment"
}
```

Each `*.result.json` is `cue-installed-cli-offline-qualification-v1` and contains candidate/observation, canonical executable and exact arguments, expected hash/signer, pre/post `{sha256, signature:{Status,Subject,Thumbprint}}`, redacted unique profile-root label, before/after relative inventory, bounded child `{code,signal,durationMs,timedOut,overflow,expectedCreatedAt,terminationVerified,terminationError,quiescent,stdout,stderr,stdoutSha256,stderrSha256}`, `passed`, and `cleanupSucceeded`.

A native host may consume identity fields only after independently remeasuring the executable. Output text is a declared-interface receipt, not launch authority. Any hash/version/path/signature change invalidates these artifacts.

## Raw artifact hashes

- `claude-version.result.json`: `739871739A9B59F44E54F7AF63FB22B77133E85331E82A6A3E1D858FACB24F40`
- `claude-help.result.json`: `D8F453C329E419A730D7AFF49C351DA77E1477B96705909F9D7A1963864200BF`
- `codex-version.result.json`: `4F3A68BBC34F98327E21407CB7B19E008F6FB9C423CC25CBE1CA0BE4F87DB504`
- `codex-help.result.json`: `FCA81DF35C078703C206C8463FBB642536211ACD47CBDB5D10C3C919F08C0887`
- `codex-app-server-help.result.json`: `B61FF23EDC935BCAD75A0E148ABF07F72B4588C4DD53133E3B0328464A1F4D59`

Earlier pre-execution failures are preserved by this report's history: the initial schema-order self-test failure, parallel signature timeouts, direct-launcher junction rejection, JavaScript path escaping, and missing PowerShell module autoload. None launched a candidate. The final runner imports the fixed built-in security module path, snapshots plain data inputs without invoking accessors, and uses Cue's verified process-tree termination with captured creation identity for timeout/overflow paths. It retains the temp root if quiescence cannot be proven.

The five retained metadata receipts were produced before the final fault-path hardening and do not contain `quiescenceScope`; their `quiescent:true` field proves the owned root emitted `close`, not that arbitrary descendants were enumerated after normal exit. This limitation is acceptable only for the fixed signed `--version`, `--help`, and `app-server --help` allowlist and must not be generalized to a provider/model/session launch. Their producer identified itself as schema `cue-installed-cli-offline-qualification-v1`; an exact pre-hardening producer-file hash was not captured, so the receipts are scoped to their embedded command, executable identity, outputs, and cleanup measurements rather than claimed as outputs of the final runner bytes.

The final strict-SHA correction preserved these exact immediate preimages: runner SHA-256 `C9A989C4F7E3C31DB0BEB71070AEA970D1E3CB57CFCAB64C643193D913B389B3` and test SHA-256 `16BF185EC34DC39C01C2A6FDA7014F103556C155C95ADDA1777093C3836442E9`. It added a `typeof string` guard before the SHA regex and a hostile `Symbol.toPrimitive` regression that observes zero coercions. Frozen final runner SHA-256 is `04C45708246E8F32468F6D4C98CF4281B7815A5427602C57068E3696AA62BA3A`; frozen final test SHA-256 is `685FAF1F6C6F99D7A655C6F3BF8C568C4269F9AD58BA0515E4C263AED2AC8C8A`. The locked final 6/6 Node gate covers the five-value allowlist/input snapshots plus failed spawn, output overflow, and timeout. Overflow and timeout tests capture process creation identity, invoke Cue's verified-tree termination, and require verified death. Failed spawn reports `spawn-failed-no-child`. The final runner reports the actual cleanup result and retained temporary root, destroys/unrefs streams on unverified timeout termination, and never claims cleanup when quiescence is unknown.
