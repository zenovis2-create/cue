# S0-01 / S1-01~05 current input audit

Date: 2026-09-16 (Asia/Seoul)  
Scope: read-only inspection of current protected-installation source, stored manifests, command resolution, file hashes, PE/package version metadata, Authenticode status, and profile-file identity. No CLI binary was executed. No credential contents were read. No provider/model call, download, Qwen access, or broad home scan was performed.

## Completion contract

Done means this report identifies a presently installed candidate and profile reference that a production host can bind to, or names the precise missing input. One authoring attempt is allowed. Every pass checks path, length, SHA-256, version metadata, and signature metadata where applicable. A mismatch or missing candidate must produce a new hypothesis or human handoff; it must not trigger execution of an unknown binary.

Verification commands for this report are `git diff --check -- evidence/integrations/planning/20260916-progress-reconcile-72/input-audit.md` and a fresh metadata-only remeasurement of the paths listed below.

## Finding

The deferred, source-unknown historical Codex SHA is **not** a global block on installed alternatives. Two separate current candidates are present and vendor-signed:

1. **Preferred first host target: Claude Code 2.1.270.0**
   - executable: `C:\Users\User\.local\bin\claude.exe`
   - length: `227051168`
   - SHA-256: `FD7F35EC7761195AB5BA4EFF423E48A78A7849E78F60D93EC31256CDB1A9EC7E`
   - PE file/product version: `2.1.270.0`
   - Authenticode: `Valid`, signer `Anthropic, PBC`
   - signer thumbprint: `0D7581D2C51C59DF686C3000C70BF543F9F6C6CB`
   - timestamp authority: DigiCert; timestamp certificate thumbprint `51D9ABDA034973D84F4266ACA48248E6B369C439`
   - profile references present, without inspecting contents:
     - `C:\Users\User\.claude.json`, length `56541`, SHA-256 `DF618AA12E03635298BECE6478ADC3AC57B257D90DCC7B7FA313BCA2A1506D4A`
     - `C:\Users\User\.claude\settings.json`, length `8450`, SHA-256 `E8D62D79A67B76DCFF171129FC7225E1FD41822B3E3527E7F188002DA24FB1EC`
   - stored offline evidence binds the same path at version 2.1.267 to prior SHA-256 `23DDE2A47CF1D7D9C4A2D96D21FA80EA9BFC872DFDE0EE06E9982D2908603350` and records successful bounded `--version`/`--help` introspection. The current 2.1.270 bytes are therefore an update and need a fresh protocol qualification; the old evidence is useful as a baseline, not current-byte qualification.

2. **Independent Codex alternative: OpenAI-signed 0.154.0 bytes**
   - direct executable: `C:\Users\User\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`
   - length: `298169136`
   - SHA-256: `BE96B992178B1E467C225800DA0D65F2C86D5EBA1EF0B14632F65DB381CBDFDE`
   - Authenticode: `Valid`, signer `OpenAI OpCo, LLC`
   - signer thumbprint: `FEAA595B06C5C389641FF093A5FB6506A7AF50B9`
   - Microsoft timestamp certificate thumbprint: `FF73F729152A9059805E5E0832449D996EF60411`
   - the same executable hash exists under the installed npm platform package at `C:\Users\User\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`
   - package metadata: `@openai/codex` `0.154.0`, package manifest SHA-256 `18C49EBA7183828E84F3F9F387A915DA8C918BE452F9746B0A6685C82486CD97`; platform package `0.154.0-win32-x64`, manifest SHA-256 `CFBAD545E49F73F266DC7DD6DA345C0A3397C173EBF5F9D0A1E3030D23BD4329`
   - profile reference present, without inspecting contents: `C:\Users\User\.codex\auth.json`, length `3973`, SHA-256 `7F287EBED8801649C475685CBDED963CBC46DBC2C904ED2620C801D8F3C64696`
   - `PATH` resolves npm shims before the direct executable. Shim hashes are `codex.ps1` `0C149DB80ED0BF442C810146B0AD0163B74982FE4542D673F56C354D7B8229CB`, `codex.cmd` `00743F8084CBC1594683B33CFB8BF14D2CE40D46CA6BA9F7142DE6BA31502A84`, and extensionless `codex` `508F6F63B9A11FBBA698712E331E1667DF029EAC8F8559D8EF12AFE455F2FAFC`. A protected host should pin the signed direct executable and its hash, not command-name resolution or an unsigned shim.

This OpenAI-signed/current-package candidate is factually distinct from the user-deferred unknown `oldCodexSHA`. The old hash remains ignored as directed. Current signed bytes may be admitted only through a new exact-byte qualification and do not inherit legacy qualification merely because a profile exists.

## Exact implementation input

Implement the first production provider host against this immutable tuple:

`claude | C:\Users\User\.local\bin\claude.exe | FD7F35EC7761195AB5BA4EFF423E48A78A7849E78F60D93EC31256CDB1A9EC7E | PE 2.1.270.0 | Anthropic Authenticode thumbprint 0D7581D2C51C59DF686C3000C70BF543F9F6C6CB | profile references C:\Users\User\.claude.json and C:\Users\User\.claude\settings.json`

Use the Codex tuple as the S1-02 preservation candidate:

`codex | C:\Users\User\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe | BE96B992178B1E467C225800DA0D65F2C86D5EBA1EF0B14632F65DB381CBDFDE | package 0.154.0 | OpenAI Authenticode thumbprint FEAA595B06C5C389641FF093A5FB6506A7AF50B9 | profile reference C:\Users\User\.codex\auth.json`

The existing `app/protected-installation.mjs` does not yet discover either tuple. It protects Cue, Node, PowerShell, and SQLite installation paths and its only startup orchestration route is the disabled/deferred local generated-JSON host. `app/installation-identity.mjs` similarly measures Cue/runtime/SQLite bytes, not provider executables or profile references. The missing production code is therefore an external-provider installation/profile descriptor and remeasurement guard modeled on these exact tuples.

## What remains externally missing by item

| Item | Input now available | Precise remaining input |
| --- | --- | --- |
| S0-01 | Vendor-signed current Claude and Codex executable identities; profile references; stored Claude protocol-option baseline; stored Codex schema inventory | Fresh, current-byte offline protocol introspection for Claude 2.1.270 and Codex 0.154.0, followed by an explicit `qualified` or `unsupported` decision. Profile presence is not authentication/entitlement proof. |
| S1-01 | Two exact candidates can enter changed-hypothesis adapter fixtures | Actual selected-transport lifecycle run for success/failure/cancel/restart. Start with Claude; no Qwen dependency and no old Codex SHA dependency. |
| S1-02 | Exact signed Codex 0.154.0 candidate and profile-file identity exist | Fresh app-server/worktree/event/Stop/reopen comparison against the preserved legacy baseline, with cleanup-unknown count zero. The deferred old hash need not be resolved if this new candidate is separately qualified. |
| S1-03 | Exact signed Claude 2.1.270 candidate and profile-file identities exist | Second-agent current-byte protocol run. The local-model half stays deferred while Qwen is OFF and must remain independently unsupported/unqualified. |
| S1-04 | Candidate and owner/profile references now have exact identities; receipt-admission seam already exists | Actual provider terminal and billing-final receipts bound to account/attempt/candidate, including child ownership. No offline metadata can supply these. |
| S1-05 | Current-source aggregate test can run after target decisions | Fresh P13/M receipts for each supported target and zero skipped required targets. Unsupported/deferred local must be explicit rather than silently skipped. |

No credentials, account entitlement, quota, billing authority, or live qualification was inferred from the profile files or signatures.

## Source evidence identities

- `C:\Users\User\cue\app\protected-installation.mjs` — SHA-256 `482B241A542C8E4659512391328F9395534C0BC11F9E085A3CE1CAE6FCDC57AB`
- `C:\Users\User\cue\app\installation-identity.mjs` — SHA-256 `2C8CA7A183594FF25251591C9FDCCBE0FEC13122E16AE8FC9209FDA422711608`
- `C:\Users\User\cue\evidence\integrations\S0\20260911-claude-introspection\version.json` — SHA-256 `B843760A789A53CF4861EEAD56B968F005CEB3F9393D3A7B40321CBC881EBF60`
- `C:\Users\User\cue\evidence\integrations\S0\20260911-claude-introspection\report.md` — SHA-256 `51AAAD271C5C2E4ABC4F33806A654DB5EA83F3ED487FE53BF81FDADC055D4F6F`
- `C:\Users\User\cue\evidence\integrations\S1\20260912-installed-protocol\stable-inventory.json` — SHA-256 `D4E544A60C3FE56A71F14842BF6509AC677FE52DA1FD0A9C8161F06D684C813D`
- `C:\Users\User\cue\docs\integration\REMAINING_EXECUTION_MAP.md` — SHA-256 `758085EF25A7C9534462909E82206C02F7B95648BB3D266671C7750F96CC9A22`
- `C:\Users\User\cue\evidence\integrations\planning\20260916-progress-reconcile-71\contract-audit.md` — SHA-256 `8FF0425DEE7BE28BA28AF16CF91551BBA8C47CB72CA3F98D043D86CB298B5A66`

## Verdict

Input blockage is narrower than batch71 stated. S0-01/S1-01~03 are no longer blocked on identifying a trustworthy installed candidate: exact vendor-signed Claude and Codex candidates and profile references are available now. They remain unqualified pending current-byte offline introspection and then authorized lifecycle runs. S1-04 and the live-receipt portion of S1-05 remain genuinely external because provider terminal/billing/P13/M evidence cannot be manufactured offline. The unknown historical Codex SHA remains deferred without blocking separate qualification of the signed 0.154.0 installation.
