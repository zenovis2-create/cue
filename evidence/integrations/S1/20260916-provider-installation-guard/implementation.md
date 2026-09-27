# Provider installation identity guard

Date: 2026-09-16 (Asia/Seoul)

## Scope and result

Added a builtin-only provider installation identity guard for caller-supplied, trusted `claude` or `codex` expectations. It accepts no command name or PATH lookup. It canonicalizes every executable, package-manifest, profile, PowerShell, and path component; rejects reparse points; hashes provider bytes through a stable file descriptor; checks exact Authenticode signer identity and either PE or package version; then hashes the executable again after the signature subprocess. Auth profile files are represented only by canonical path and filesystem identity. Their contents are never opened or read.

The returned object is branded, deeply frozen, and explicitly says `status: unqualified`, `authenticated: false`, `entitled: false`, and `qualified: false`. `assertCurrentProviderInstallation` accepts only an issued object and fully remeasures it immediately before use. This is a drift check and does not claim atomic anti-TOCTOU protection for a later launch.

No provider executable, credential content, model/provider call, local model, shared build, secret, or configuration was executed or changed. The product source does not embed the audited current user paths, hashes, versions, or profile locations; trusted callers must supply them.

## Workflow record

Before editing, the maker sent the root agent the proposed two-function API, exact completion command, cap 2, per-pass checks, and new-hypothesis rule in a timestamped collaboration message. No filesystem PLAN was saved before editing. This is an explicit workflow evidence limitation; this record is not represented as a pre-edit artifact. All three implementation files were new, so there were no existing-file preimages.

The first focused run failed 2/3 because Windows PowerShell did not auto-load its security module and because the package-version branch rejected valid package expectations. The second failed 2/3 while isolating the same boundary. The next distinct hypothesis explicitly loaded the fixed system security module, split the package validation branch, hardened dense data arrays and input descriptors, bound parsed manifest bytes to one descriptor/hash, and added post-signature remeasurement. It then passed Claude and left only a mistaken fixture package name. The installed manifest showed `@openai/codex`; correcting only that fixture produced 4/4. Root review then required portable default tests, so live installed-candidate cases became explicit opt-in tests and a deterministic self-contained signed-metadata fixture covered success and executable/profile drift.

## Verification

- Default portable gate: `npx vitest run daemon/test/integration-provider-installation.test.ts --reporter=default` — exit 0, 3 passed, 2 live tests skipped.
- Explicit current-machine gate: `$env:CUE_PROVIDER_INSTALLATION_LIVE_TEST='1'; npx vitest run daemon/test/integration-provider-installation.test.ts --reporter=dot` — exit 0, 5 passed.
- `git diff --check -- app/provider-installation.mjs app/provider-installation.d.mts daemon/test/integration-provider-installation.test.ts` — exit 0, no output.

Current source SHA-256:

- `app/provider-installation.mjs`: `E850CE66DE8036CAC24A82F9C41914D94400526BF72CAC6CFD41E80DE6498D06`
- `app/provider-installation.d.mts`: `53546D7B408F3509313C3DD2D032F80EC79EEB9777F84E90A5686DC0BB5ACC84`
- `daemon/test/integration-provider-installation.test.ts`: `AC4FBFAB77114A9CB5A240BEDB3A5E300D971FFCBC15A442CE8B3C89A5FA4F08`

The live gate identified the non-reparse Claude 2.1.270.0 installation and the canonical npm Codex payload at package version 0.154.0-win32-x64 with the audit signer/SHA tuples. This proves only current offline installation identity and drift checking. It does not prove authentication, entitlement, protocol support, billing, lifecycle behavior, or qualification.
