# Pure Claude protocol maker contract

Done: focused integration-claude-protocol tests and tsc --noEmit exit0. No own build; root coordinates shared build. Maximum2 correction hypotheses; each pass executes affected protocol tests and final typecheck. New files only, historical scripts/reuse/claude-launch-spec.mjs unchanged.

New unit supports an explicitly synthetic cue-claude-fixture-v1 dialect only. It cannot qualify real Claude schema or execute a CLI. Auth unconfigured, executable false, eligibility unverified. Exact version2.1.267 is the historical reviewed fixture constraint, not a current binary observation.

## Result

- New canonical fixture-only module: daemon/src/adapters/claude-protocol.ts. Historical R-02 scripts unchanged; builder preserves exact own-data/path/version/flag/env constraints. The identityVerified fixture field is not an actual evidence verifier. No executor/process/filesystem/network/credential APIs or registry wiring.
- Decoder exact cue-claude-fixture-v1: init -> one assistant text message OR one streamed text block -> matching success result -> EOF. Canonical JSON.stringify frames; LF/CRLF accepted. Text-only; thinking, usage, model/session fields, tools, unsupported stop reasons and unknown fields rejected, not invented as upstream support.
- Fatal streaming UTF8, 1MiB total/64KiB frame/4096frame bounds, intrinsic byte snapshot avoids getters/valueOf, Proxy/SAB/detached refusal, sticky failures, duplicate fields/terminal/partialEOF rejected. Provisional text events cannot confer acceptance/authority; final status fixture-success, usage unknown, acceptance/cleanup unverified, remoteBilling unknown, executable false and eligibility unverified.
- Completion contract file was created in the same tool call BEFORE writing first product source. Zero correction hypotheses consumed. Focused test 9PASS, 269ms, exit0; npx tsc -p tsconfig.json --noEmit exit0. No own build; source paused for root coordinated build/freeze.

```powershell
cd daemon
npx vitest run test/integration-claude-protocol.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx tsc -p tsconfig.json --noEmit
```

All byte splits tested for direct text and streamed Korean/emoji. Adversarial fixtures cover getters, privilege fields, aliases, version drift, invalid UTF8/BOM, duplicate keys, truncation, mismatched indices/text, unknown identity/usage/tool frames, max tokens, event limit, abort-equivalent incomplete EOF. Actual OS/process cancellation is outside this pure unit and untested.

Reuse provenance: own scripts/reuse/claude-launch-spec.mjs SHA57A07D016BE906F01CF2AE1D188A936CB36A036D385DF9D0EC67E86F66B4FD17; its historical test SHA3DB03F2F1AF964BF7BB886ECF5009FFB3F189638EC31DA9BB8CF1C6AC6E1CECB. Only Node built-in path/util/TextDecoder/JSON and native typed arrays reused. No external code/dependencies or current upstream claims. Host JS intrinsics are trusted.

Independent review pending; these maker tests neither qualify Claude nor complete a second coding-agent integration. Source hashes attached separately.

Fit correction contract before edits: remove unconsumed synthetic production adapter; retain decoder under test/fixtures only and remove duplicate builder. Preserve pre-fit source/test and9PASS. Gate: decoder fixture tests + historical node tests +tsc noEmit. Max2 corrections, no build/no CLI.

## Fit correction result (supersedes production-location implication above)

The synthetic decoder has been relocated to daemon/test/fixtures/claude-jsonl-fixture.ts and tests to daemon/test/claude-jsonl-fixture.test.ts. Both original new production/test files removed; duplicate launch-spec builder removed. Historical scripts remain byte-identical and are the existing offline launch-spec experiment. pre-fit-source.ts.txt / pre-fit-test.ts.txt preserve old bytes and original9PASS remains historical.

Current gate: fixture decoder7PASS (267ms), unchanged node launchspec9PASS (76ms), tsc noEmit exit0. No own build and no production/runtime/schema qualification. The source contains only experimental fixture framing/state tests; no production consumer or export. A future real parser must derive model/session/usage/assistant+partial rules from pinned actual primary source evidence; only bounded UTF8/JSONL mechanics are candidates for reuse.

```powershell
cd daemon
npx vitest run test/claude-jsonl-fixture.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx tsc -p tsconfig.json --noEmit
cd ..
node --test scripts/reuse/claude-launch-spec.test.mjs
```

Root coordinates compiled output cleanup/build; tsc does not automatically remove previously emitted deleted-source files. This worker did not inspect or modify dist. Independent review requested before marking this experimental scope complete.
