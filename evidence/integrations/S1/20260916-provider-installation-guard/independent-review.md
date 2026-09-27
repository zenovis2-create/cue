# Independent provider-installation guard review

Reviewer: `/root/qualification_inputs72`  
Date: 2026-09-16  
Verdict: **CLEAR for the bounded identity guard**

Reviewed frozen ownership:

- `app/provider-installation.mjs`
- `app/provider-installation.d.mts`
- `daemon/test/integration-provider-installation.test.ts`

The guard snapshots plain own-data descriptors and rejects proxies, accessors, unknown fields, relative paths, substitution hashes, unsupported providers, and unissued descriptors. Every executable, manifest, and profile path is resolved component-by-component and any symlink/reparse traversal is refused. Executable and manifest measurement uses bounded file-descriptor reads with pre/open/post filesystem identity checks. Authenticode path, status, simple signer name, thumbprint, and PE/package version must match exact expectations.

Auth profile handling is path and stat identity only: the profile files are canonicalized and measured without opening or reading their contents. Returned descriptors are deeply frozen, issued through a private weak identity map, and conservatively report `status: unqualified`, `authenticated: false`, `entitled: false`, and `qualified: false`.

Codex binds the audited canonical npm payload rather than command-name lookup or the reparse launcher:

`C:\Users\User\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`

`assertCurrentProviderInstallation` repeats the full measurement for an issued descriptor. Its comment accurately limits the result to a pre-use drift check and explicitly disclaims an atomic anti-TOCTOU guarantee for a later launch.

Independent commands and results:

- `npx vitest run daemon/test/integration-provider-installation.test.ts --reporter=dot` — exit 0; 3 passed, 2 opt-in live tests skipped.
- `$env:CUE_PROVIDER_INSTALLATION_LIVE_TEST='1'; npx vitest run daemon/test/integration-provider-installation.test.ts --reporter=dot` — exit 0; 5/5 passed; environment switch removed after the command.

Reviewed pins:

- guard SHA-256: `E850CE66DE8036CAC24A82F9C41914D94400526BF72CAC6CFD41E80DE6498D06`
- test SHA-256: `AC4FBFAB77114A9CB5A240BEDB3A5E300D971FFCBC15A442CE8B3C89A5FA4F08`

Optional hardening, not a bounded-contract failure: the Authenticode PowerShell helper could receive a minimal environment instead of spreading `process.env`. Provider bytes are never launched by this module, and no inherited value is incorporated into the descriptor, so this does not change the verdict.
