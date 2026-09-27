# Control bundle — independent bounded review

2026-09-11, contracts_review. PASS for frozen control pins and scoped native checks. No product edits, no Qwen calls. Maker reuse_cli/root.

Done: inspect strict bundle, adapter success conditions, guardian lock and before-resume staging; compare current hashes with native regression evidence; run narrow focused gate and typecheck. Correction cap2, used0. Evidence one write then hash/readback.

Independent execution (cwd daemon):

- npx --no-install vitest run test/integration-model-control-bundle.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1 — exit0, 6PASS, 19:16:10, 4.99s. Includes actual private control-root mutations of client/core/guardian and missing native pins.
- npx --no-install tsc -p tsconfig.json --noEmit — exit0. Loop guard warned about repetition of this typecheck command; it was not repeated again.

All 11 entries in source-hashes.json matched current files. Maker result.md separately records 20PASS including compiled checker, real isolated fixture broker, normal/cancel independent cleanup, observer and hardkill; additional qualification/process-limit/P45 8PASS/1SKIP. This reviewer did not repeat that full native set or present maker results as independently executed tests.

Bundle snapshot validates exact own data, rejects accessor/proxy/extra properties, checks fixed ordered digest and node/kind consistency, and freezes values. Neither adapter remeasures installed changes into replacement approval pins. Both require the original control bundle and matching native boundary metadata for success. ProbeHarness remains explicit diagnostic-unpinned, not a production approval route.

Guardian is hash checked, opened FileShare.Read (denying write/delete), checked again under that lock, launched, and the lock held until readiness. This protects that loaded script window; installation trust is still a prerequisite. Staged node/client/checker-core are compared directly with approved hashes and rechecked in suspended sealing before resume. Model core must be null; checker core hash and dependency symlink flag are fixed. Metadata mismatch cannot report successful execution.

Observed failures showed expected mismatch identifiers and no child PID/observation/frame markers; client/core temporary task roots cleaned. Guardian mismatch rejects before guardian/child startup. Existing lifecycle evidence remains scoped to its recorded hashes and conditions.

Limitations: this bundle is not the full compiled host dependency subject, installation/OS trust proof, universal TOCTOU defense, capability qualification, semantic acceptance or default host wiring. Self-hashing cannot establish trust in a malicious installed launcher. Full canonical subject and fresh matching M evidence remain separate.

Current SHA256:
- daemon/src/model-control-bundle.ts : 28539C343C6F5790C9088249061A3F349C3251022D4BBC10AC97B1A1BE91EDF1
- daemon/src/adapters/isolated-local-model.ts : C7B14F149EA96DC2312C7C31BD3D97B919FE95CDF85BCB332B2114A0D73CFBC1
- daemon/src/adapters/isolated-json-checker.ts : 9C1A6E6049CC90D85B2FBA5D578BC8C251CEE64AC4FAEC90D21DE6DCA39FA1B7
- daemon/src/model-only-launch.ps1 : 3562523506AF57205E0EC1C04EF75BCE55ABE28C4F88052F8EBB73ACA347B13A
- daemon/src/model-only-profile-cleanup.ps1 : 2D2E60085FA79B98EE1D3149FBA0673EA62288A1C60DC5661E227B0545988A69
- daemon/test/integration-model-control-bundle.test.ts : 97D0883F8C2770B17E14E00D29E9F0FEDDBF1F3DCEE04F30C25DF17A3521A3D6
- evidence/integrations/S1/20260911-control-bundle/source-hashes.json : 69F0B16321586297D35ABBD556F9A3ED70A02DD8C7C2E6F17E75D43C2517AFD8
- evidence/integrations/S1/20260911-control-bundle/result.md : 4601D329C5F933323A8156B706F7FE1C5BB79265C20B06D662D6B6787EAEDA92
