# Independent review: fixed isolated JSON checker execution

Reviewer `/root/broker_review`, 2026-09-11. Product code read-only; no Qwen request or global host-policy change.

Initial status: **snapshot contract correction requested**. The native protocol and existing runtime regressions passed, but the adapter byte snapshot could call an input object's own conversion hook and copy different bytes.

## Initial source identities

- `daemon/src/adapters/isolated-json-checker.ts`: `4CF6B4A376BAC01EFB63EAE40EFFBFD5AC893EC980AE5A58DB13F1A3F586AA98`
- `daemon/src/json-checker-client.cjs`: `F0A5FE10E9C3E689D9529ED6197FB2FCD1995DC9C2C35D2A259F216F38584484`
- `daemon/src/model-only-launch.ps1`: `DA326DA897BE4C131AD8499F48B581771D6ABEA236097BEFCF639F1918AB0441`
- `daemon/test/integration-isolated-json-checker.test.ts`: `07B3C55F35AB90BDBF099F6BB52263BF6F05913EA5BD031661774FB995E2724F`
- Fixed core: `34AB9E98F097710643694446E8DEE97D5FB2F2BE437D0206F734148A443CFBDC` (separately reviewed exact JSON predicate).

## Initial independent checks

`npx --no-install vitest run test/integration-isolated-json-checker.test.ts test/integration-isolated-local-model.test.ts test/integration-model-boundary-observation.test.ts test/integration-model-boundary-hardkill.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, **10 passed**, 26.31 s, start 18:40:22 local time.

These tests execute the compiled adapter through actual Windows child isolation for pass/fail/unknown computations, original input/output digests, native core hash observations and independent cleanup. They also cover carrier overflow, role denial, immediate cancellation, malformed/extra-code/EOF/identity protocol rejection and the existing model/guardian/native observer paths. Transport regression uses fixtures; no provider call.

## Snapshot finding

The initial `bytes()` checked properties directly and used `Buffer.from(value)`. Node honors an own `valueOf` on a Uint8Array: independent reproduction with native bytes `[123,125]` (`{}`) and `valueOf` returning a Buffer for `{"changed":true}` produced that changed text and invoked the hook. Consequently the function did not always snapshot the supplied typed array's actual approved bytes, and direct `byteLength`/`buffer` access could invoke supplied accessors. The parent accepted this as a bounded contract-correctness finding and requested the same intrinsic-getter snapshot approach used by the fixed core, with Proxy/shared-buffer refusal. This is not a claim that arbitrary code can originate in a JSON model response; the flaw concerns the advertised host Uint8Array API.

## Protocol / native assessment

- The adapter uses the existing owned piped launcher and recorded session, validates run/role/owner/worktree linkage and sends only fixed metadata in argv. Byte payloads use bounded base64 stdin.
- The child hashes decoded byte payloads and emits an identity request; the host verifies the exact contract/request/attempt and both byte digests before issuing the fixed authorization acknowledgment. Returned verdict identity and field shapes are checked separately from execution outcome.
- Only packaged `json-checker-client.cjs` and `verification/json-format-checker.cjs` are selected. There is no request-supplied module, URL, path or command. The launcher copies and hashes staged assets, seals the private tree and observes the suspended child before resume. `--preserve-symlinks` is enabled only for this static checker selection so fixed dependency loading stays within the staged tree; the default model launch arguments remain unchanged.
- Child output is always relayed as base64 frames, so input text resembling native prefixes cannot create host observations. Frame, aggregate output, carrier and lifecycle bounds remain enforced.
- `pass`, `fail` and `unknown` are checker verdicts. Any correctly completed calculation may have execution outcome `succeeded`; that is not task acceptance. Conversely a verdict may remain present on a later failed/cancelled execution, so a composing host must require a successful execution and valid cleanup before consuming it as evidence.
- Native cleanup flags alone remain insufficient: result cleanup and provider stop are unknown, and the separate observer measures actual process/path absence. No qualifier, billing settlement or acceptance publication is introduced here.

Final correction evidence follows when available. Earlier live Qwen reports retain their original source/hash scopes.

## Final correction / review result

**PASS for the corrected fixed checker execution adapter and reviewed native changes.** The approved snapshot correction uses Node type/proxy checks and intrinsic typed-array backing-buffer/offset/length getters, rejects shared or detached backing memory, and copies a fresh native view. Caller `valueOf`, `buffer`, `byteLength` and `byteOffset` properties are not invoked. The native launcher and fixed child/core were unchanged by this correction.

Final changed hashes:

- Adapter: `81F976C364CCCAF26A67C1B1F6E67A18FC610500E0500051F910FF2BF3AC1D66`
- Focused test: `57AE5096F1D43417D1EA9A9FE13EB80A355846CF54F6CBA941C6A56751ED708F`
- Launcher and client still match their initial hashes listed above.

Independent final checks:

- `npx --no-install vitest run test/integration-isolated-json-checker.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, **4 passed**, 9.29 s, start 18:43:31 local time. The compiled real-child pass/fail/unknown cases now install throwing accessors on both input/output byte objects, require zero hook calls and still verify the original byte hashes. Proxy/shared/detached cases refuse before launch, with zero Proxy traps and zero session records.
- `npx --no-install vitest run test/p4.test.ts test/p45.test.ts test/integration-model-boundary-qualification.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, **21 passed / 3 skipped**, 36.24 s, start 18:42:36 local time. These cover the unchanged single owned-spawn architecture and current launcher's default native model regression. They do not automatically qualify the new checker client configuration.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0. The maker rebuilt before the reviewer executed the compiled adapter.
- The initial four-file command's model broker/observation/hardkill coverage remains applicable because the snapshot correction touched only the checker adapter/test. Its original 10-pass count included the earlier three checker tests and is not added as ten new distinct final tests.

The actual cleanup observer was exercised, but this checker's test persistence callback returns a fixture reference; it is not evidence of a production durable acceptance sink. The separate cleanup observer review covers real SQLite persistence/runtime settlement. This review grants no execution eligibility, final acceptance, provider-billing guarantee, default UI integration or checker-specific native qualification publication. A composing host must still bind the approved artifacts, independent principal, current measured files, successful execution and durable evidence before accepting a task.
