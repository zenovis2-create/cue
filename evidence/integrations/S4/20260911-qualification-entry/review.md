# Independent qualification entry/application review

Reviewer: broker_review, 2026-09-11. PASS for the explicit entry and application lifecycle unit. Completion criterion: six source hashes, focused offline gate, lifecycle/config review and limitations. Correction cap 2; used 0. No product edits, rebuild, live qualification command, or model calls.

## Independent gate

From daemon: `npx vitest run test/integration-qualification-start.test.ts test/integration-qualification-application.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.

Exit 0, 13 PASS, start 22:33:32 KST, duration 389 ms. Maker separately reported build 0; no redundant build during parent startup QA freeze. These tests use VM/module mocks and owned temporary config files. They are not an actual Electron qualification execution.

## Source hashes

| File | SHA-256 |
| --- | --- |
| app/qualification-start.mjs | 38B9DE10851D1AEA9DA5E32048E2D3966E1119AE84931FA001CD5E1673A2E37A |
| app/qualification-start.d.mts | 5D58B6899E04BADAE2E49AD9F59F456BCD62486D00B409D66956AE0508A5A3D9 |
| app/qualification-application.mjs | 25CA835F8B597BA04C28D04E98B02613046EEDFD90556EFA22D970B43E2BC058 |
| app/qualification-application.d.mts | 75F5BCDE9B4E3B34488A5A0C83CD5A4D27493AE3700A35595A4E1F8898120475 |
| daemon/test/integration-qualification-start.test.ts | EBB0416B27ACAAD5420B150FB06A0F6046EBCA4868301A840A030AB57FFE7B4C |
| daemon/test/integration-qualification-application.test.ts | 93B52067546F70BE53A862CB53EC100D5C1B2F8EEBF76072F41CEB732D67CFB5 |

## Findings

No actionable blocker in the declared protected-entry contract. Entry requires exactly the explicit flag and rejects CUE_LIVE_RUN=1; it exposes no renderer arguments or fallback. The only application import is inside runGuardedEntry, and initialization occurs after that helper releases its post-assert result. Electron's builtin app and the trusted identity/entry primitives load first.

The application module defines functions without starting measurement. Its canonical module latch consumes the first invocation. Genuine generation membership and assertCurrent precede readiness/config/daemon work. Existing config read is bounded to 32769 bytes with a 32768-byte acceptance limit, fatal UTF-8 decoding, regular-file/no-link checks, fd/path identity and metadata checks. It calls the existing exported validator, whose source binds the ledger to userData/cue-ledger.sqlite and requires canonical worktree. No initialize-config or config write path is called.

One AppDaemon receives that config and is passed unchanged to discovery/qualification. SIGINT and before-quit request abort; before-quit prevents exit. Collection must settle before finally awaits daemon.close; listeners are then removed. Unknown collection cleanup or failed close cannot return success. Summary exit codes preserve incomplete, unknown, and clean-abort distinctions; only eligible failure-free collection with confirmed cleanup returns 0. No result includes fabricated capability references.

## Limits

Existing-config reading does not make the subsequent AppDaemon lifecycle read-only: opening the ledger can apply its normal migrations, and qualification intentionally persists evidence. A valid config pointing to a missing ledger is not independently refused by this reader. Config is local host input, not renderer/model authority. Trusted installation roots, builtin integrity, canonical entry loading, and previous generation limitations remain prerequisites.

The fixture tests prove lifecycle branches, not real package command registration, production native discovery, actual module-cache closure, live M evidence, Qwen behavior, or workflow acceptance. Those require separately authorized execution after source freeze. AppDaemon/protected-installation/default-startup correctness is attributed to their separate review scopes; no new broad certification is claimed here.

## Package registration follow-up (static only)

Root package.json SHA-256: `3FB3E209EF1494C6BA3E75EE78887FE23CBA3D7D305700945FC62BF05E444123`.

The new script is exactly `electron app/qualification-start.mjs --generated-json-qualify`. Its executable/entry/one-flag layout matches the entry's process.argv.slice(2) contract. Additional forwarded arguments would be refused. The ordinary package main remains app/start.mjs, start remains electron ., and its existing prestart build remains separate. There is no prequalify:local-json or postqualify:local-json hook and no build command in this script. A completed current daemon build and source freeze are prerequisites, consistent with docs/integration/LOOP.md; this command does not repair missing/stale compiled assets automatically.

This follow-up read only package/source/documentation and did not execute npm run qualify:local-json, Electron, a build, or any model call. Registration is statically verified; actual CLI argument delivery and live qualification remain unexecuted here. Earlier 13-PASS fixture gate is preserved without rerun.
