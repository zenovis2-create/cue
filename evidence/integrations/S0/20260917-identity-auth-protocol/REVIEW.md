# S0-01 Independent Review — identity / auth reference / protocol

Reviewer role: independent (did not produce the artifact). Objective: attempt to break the artifact.
Artifact under review: `evidence/integrations/S0/20260917-identity-auth-protocol/observation.json`
Checklist item: S0-01 (`docs/INTEGRATION_CHECKLIST.md` line 51).
Completion condition (`docs/integration/REMAINING_EXECUTION_MAP.md` row S0-01): "설치 binary provenance, auth reference semantics, stream protocol을 현재 bytes에 묶어 세 대상 각각 qualified/unsupported 판정".
Host: Windows, PowerShell. Review timestamp: 2026-09-17T20:3x+09:00.

Every factual claim was re-measured from scratch. I did NOT trust the artifact's numbers or the project's reproduction scripts' hard-coded constants; where I used a project script I also independently reimplemented the computation (tarball hashing, bundle digest, attestation decode, cache-path derivation).

Note on method: several multi-statement PowerShell one-liners returned empty stdout with exit 1 under this shell's code page; I re-ran those as `-File` scripts or as Node programs. This is a shell I/O artifact, not a measurement failure — the file-based re-runs succeeded.

---

## Commands run and raw measured values

### 1. Installed Codex binary (path/bytes/sha256/version)
Node resolver replicating `bin/codex.js`'s `require.resolve('@openai/codex-win32-x64/package.json')`:
```
PJ  = C:\Users\User\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\package.json
EXE = ...\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe
EXISTS = true
BYTES  = 298169136
SHA256 = be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde
```
`codex --version` → `codex-cli 0.154.0`
(Initial direct `Test-Path`/Directory read missed the binary: default Directory excludes `node_modules`; the launcher resolves the platform sub-package. Node resolution confirms the exact artifact path.)

### 2. npm published metadata
`npm view "@openai/codex@0.154.0-win32-x64" dist.integrity dist.tarball dist.shasum --json`:
```
dist.integrity = sha512-Stg2KEJPIKVqPPR1wCverGOR4ey3RR3cvakR07w7FNKQUMzmHaOZomRsP2bR1qOT/67yHsks9rB+MCMfIWXcRA==
dist.tarball   = https://registry.npmjs.org/@openai/codex/-/codex-0.154.0-win32-x64.tgz
dist.shasum    = 236f93e72691e01ee67a1879110986ab00fce04a
```

### 3. Cache tarball, independently re-hashed
`npm config get cache` → `D:\Caches\npm-cache`
base64(integrity) → hex = `4ad83628424f20a56a3cf475c02bdeac6391e1ecb7451ddcbda911d3bc3b14d29050cce61da399a2646c3f66d1d6a393ffaef21ec92cf6b07e30231f2165dc44`
Cache path `_cacache/content-v2/sha512/4a/d8/3628...dc44` EXISTS.
```
TARBALL_BYTES      = 142162836
TARBALL_SHA512_B64 = Stg2KEJPIKVqPPR1...IWXcRA==   (== published integrity → SHA512_MATCH=true)
TARBALL_SHA512_HEX = 4ad83628...2165dc44           (== artifact.tarballSha512Hex)
TARBALL_SHA1       = 236f93e72691e01ee67a1879110986ab00fce04a (== published shasum → SHA1_MATCH=true)
```

### 4. Attestations (fetched + DSSE-decoded independently)
`https://registry.npmjs.org/-/npm/v1/attestations/@openai%2fcodex@0.154.0-win32-x64`
```
ATTESTATION_COUNT = 2
[1] predicateType = https://github.com/npm/attestation/tree/main/specs/publish/v0.1
    subject.sha512 = 4ad83628...2165dc44  → subjectMatchesTarball = true
[2] predicateType = https://slsa.dev/provenance/v1
    subject.sha512 = 4ad83628...2165dc44  → subjectMatchesTarball = true
    builder.id          = https://github.com/actions/runner/github-hosted
    workflow.repository = https://github.com/openai/codex
    workflow.path       = .github/workflows/rust-release.yml
```

### 5. Tarball member extraction (system tar, fresh temp dir)
Member `package/vendor/x86_64-pc-windows-msvc/bin/codex.exe`:
```
EXTRACTED_BYTES  = 298169136
EXTRACTED_SHA256 = be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde
INSTALLED_SHA256 = be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde
EXTRACTED_EQ_INSTALLED = true    EXTRACTED_EQ_ARTIFACT = true
```

### 6. Authenticode (Codex)
```
Status         = Valid
SignerSubject  = CN="OpenAI OpCo, LLC", O="OpenAI OpCo, LLC", L=San Francisco, S=California, C=US
Thumbprint     = FEAA595B06C5C389641FF093A5FB6506A7AF50B9
TimeStamper    = CN=Microsoft Public RSA Time Stamping Authority, ...
```

### 7. auth.json (metadata only; NO values read)
```
%USERPROFILE%\.codex\auth.json  EXISTS
BYTES     = 3973
MTIME_UTC = 2026-09-10T09:23:33.8223690Z
KEYS      = auth_mode, OPENAI_API_KEY, tokens, last_refresh   (key names only)
```
`OPENAI_API_KEY` is a top-level KEY NAME, not a value. No secret value appears in the artifact or in this review.

### 8. Protocol bundles (generated fresh; digest reimplemented independently)
`codex app-server generate-json-schema --out <stable>` (exit 0) and `--experimental` (exit 0).
My own digest impl (sorted rel-path + NUL + sha256(bytes), sha256 over the stream):
```
STABLE       fileCount=305  bytes=3492670  bundleSha256=208997f71f9895bb8e63fe28675f6d845fac6f5ca5337ec5fbedaadf2a78ece4  → MATCH
EXPERIMENTAL fileCount=426  bytes=4210655  bundleSha256=2e9678b9fc7ec36adad2cc071f0ae8163fcea8e7d4c7872887869b32e55cfcda  → MATCH
```
Both target digests reproduced exactly.
`codex app-server --help` header = `[experimental]`; subcommands = daemon, proxy, generate-ts, generate-json-schema (+ help). Matches `appServerSubcommands` / `appServerStability`.

### 9. Feature presence
Artifact: environments {stable 0, exp 20}; dynamicTools {stable 4, exp 4}.
- Case-SENSITIVE content substring: env 0/18, dyn 0/4 — does NOT match.
- Case-INSENSITIVE content substring of the same tokens: env 0/20, dyn 4/4 — **matches artifact exactly.**
The artifact's featurePresence is reproduced under case-insensitive substring counting (the schema uses `Environment*`/`DynamicTool*` file and type names). Numbers SUPPORTED; the counting convention is implicit but reproducible.

### 10. Claude Code
```
PATH        = C:\Users\User\.local\bin\claude.exe
BYTES       = 233691808
SHA256      = 4e4c1746aff835bb05e5ed14cda72d21ee6fbda4147aa99b3135718614da117e
SigStatus   = Valid
Signer      = CN="Anthropic, PBC", O="Anthropic, PBC", L=San Francisco, S=California, C=US, SERIALNUMBER=4860621, OID.2.5.4.15=Private Organization, OID.1.3.6.1.4.1.311.60.2.1.2=Delaware, OID.1.3.6.1.4.1.311.60.2.1.3=US
--version   = 2.1.274 (Claude Code)
.credentials.json EXISTS bytes=519 ; ~/.claude.json EXISTS ; ~/.claude/settings.json EXISTS
--help declares: output-format=true, input-format=true, stream-json=true
npm global @anthropic-ai present = False  (NOT installed via npm — confirmed)
```

### 11. Local endpoint (listener enumeration only; NO connect)
`Get-NetTCPConnection -State Listen`, ports 8080/11434/1234/5000/8000:
```
PORT_8080=no_listener  PORT_11434=no_listener  PORT_1234=no_listener  PORT_5000=no_listener  PORT_8000=no_listener
```
No connect attempt was issued. Artifact `listenersFound: []` supported. No connect-attempt evidence exists anywhere in the artifact.

### 12. Coupled pin change
```
app/core.mjs:50                        PINNED_CODEX_SHA256 = be96b992...cbdfde   ✓
daemon/scripts/p10c-manifest-proof.mjs expectedSha256      = be96b992...cbdfde   ✓
daemon/test/p10c-manifest.test.ts:30   binarySha256        = be96b992...cbdfde   ✓
```
All three equal the SHA-256 I independently computed in step 5.

### 13. Coupled test
`npx vitest run test/p10c-manifest.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`
```
Test Files  1 passed (1)
Tests       2 passed (2)
EXIT_CODE=0
```

### 14. Historical evidence integrity
`git status --short -- evidence/P10C evidence/P11 evidence/P12 evidence/P13 evidence/integrations/S0/20260911-baseline`
```
?? evidence/integrations/S0/20260911-baseline/
```
Only one untracked (`??`) directory. No `M`/`D`/`R` on any P10C/P11/P12/P13 file. No pre-existing tracked historical evidence was modified.

---

## Per-claim results

| # | Claim | Result |
|---|-------|--------|
| 1 | Installed Codex path/bytes/sha256/version | PASS |
| 2 | npm dist.integrity/tarball/shasum | PASS |
| 3 | Cache tarball bytes + sha512(b64) + sha1(hex) match published | PASS |
| 4 | 2 attestations, both subject sha512 == tarball; builder/repo/workflow | PASS |
| 5 | Member extraction bytes+sha256 == installed == artifact | PASS |
| 6 | Codex Authenticode Valid + signer + thumbprint + timestamper | PASS |
| 7 | auth.json exists/bytes/mtime/keys; no values recorded | PASS |
| 8 | stable/experimental fileCount, bytes, both bundleSha256 reproduced | PASS |
| 9 | featurePresence env 0/20, dyn 4/4 (case-insensitive substring) | PASS |
| 10 | Claude path/bytes/sha256/authenticode/version/creds/help/no-npm | PASS |
| 11 | No listener on stated ports; no connect attempt | PASS |
| 12 | Three pin locations equal independently computed sha256 | PASS |
| 13 | p10c-manifest test: 2 passed, exit 0 | PASS |
| 14 | No historical evidence modified | PASS |

## Per-target judgement

- **codex** — artifact verdict "provenance qualified; protocol declaration qualified and byte-bound; auth reference present but authentication/entitlement unverified" is **SUPPORTED**. Not overclaimed: it explicitly refrains from claiming authentication/entitlement, matching that both were unverified here. Provenance chain (npm integrity → SLSA subject → extracted member → installed binary → Authenticode) fully reproduced.
- **claudeCode** — artifact verdict "installed and protocol-declared, but unsupported for Cue dispatch; provenance lacks build attestation" is **SUPPORTED**. Correctly UNDER-claims: EV Authenticode only, no npm/SLSA chain (confirmed: no npm global package), no stream/auth exchange claimed. Not overclaimed.
- **localEndpoint** — artifact verdict "unsupported / deferred by user decision; listening-port enumeration only, no connect" is **SUPPORTED**. No listeners; no connect-attempt evidence. Respects the "local server OFF" rule.

## Claims I could not fully verify
- Attestation cryptographic signature chain (Fulcio/Rekor certificate trust) was NOT re-verified; I verified DSSE payload contents and subject-digest binding only. The artifact likewise only claims `subjectMatchesTarball` and predicate/builder/workflow strings, so this is not an overclaim.
- The featurePresence counting convention is implicit in the artifact (no method stated); it is reproducible only under case-insensitive substring matching. Reproduced, but the artifact would be stronger if it named the method. Non-blocking.

## Project-rule compliance
- No synthetic/documentary evidence promoted to real-world fact: OK (all bytes measured live).
- No claim of authentication success / entitlement / capability / quota / billing / dispatch authority: OK (artifact `notClaimed` list holds; `authenticationVerified:false`, `entitlementVerified:false`).
- Local model server OFF: OK — enumeration only, zero connect attempts, `listenersFound:[]`.
- No credential values recorded: OK — only key names and byte sizes present.
- Historical evidence not rewritten: OK — git shows no modification to tracked evidence.

## Verdict

All 14 verification items PASS, all three per-target verdicts are SUPPORTED (none overclaimed), every project rule is satisfied, and the completion condition — binding installed binary provenance, auth-reference semantics, and stream protocol to current bytes with a qualified/unsupported judgement for each of the three targets — is met and independently reproduced.

REVIEW_PASS
