# Independent review — WFP diagnostic bridge

## Verdict

**PASS for the frozen offline producer bridge.** The generated entry owns an invocation-local lease provider, emits only after `LaunchWithObservationLease` finalization, and produces a provisional nonce/root-bound frame that the real TypeScript parser accepts. This does not activate the generated launcher, establish live WFP collection, prove a PID association or network denial, or make the frame acceptance authority.

## Review contract and attempts

Done required source inspection plus the focused generator, adapter, bridge, and parser tests; exact C# compilation and generated-entry execution; deterministic/base-boundary checks; and scoped diff validation. The correction cap was two. The initial frozen candidate lacked executable generated-entry throw and writer-failure cases; the maker added those cases in the final correction. No further correction was required.

## Frozen inputs

- generator: `F4852DE9E02E721FEB5C07D845A381DB5019560C0741A856AD799B02D53865F1`
- generator test: `CA429AD1B882C453C01498037E4FDC9B5D1AA9A7E8A835EB17048EB7642F54FD`
- adapter/diagnostic source: `6566E134B895AF41C710E5D37580B5AF37EFDBEC00D98671E6DB9EAAEDC4C86C`
- existing adapter test: `23AAD1BCACED3DDB2966553A00102C442666B5825E3FAE05314335C4DDF93166`
- bridge test: `87C7CF001B6F90908A5B26CBAED63E3EA1E8262CD27B9E5800B2160D29EB0A71`
- plan: `84880A3A26C62AD50F9B30773C114168520835E5F5662F5AF41B9A11C7E7B6DD`
- unchanged base launcher: `6060955CD91AFB9D0470697C1B8945A75850AFD3A0307CF60AC0063C271A48FF`

## Independent evidence

The focused tests passed as two proportional invocations: generator, adapter, and bridge **30/30**; real parser **5/5**; total **4 files, 35/35**. The tests compile the exact embedded C# and execute the exact generated entry body with the OS launch edge stubbed. They verify normal return, original launch exception, and throwing output writer behavior. A writer failure preserves return `31`; a launch failure preserves the original exception; each path attempts at most one diagnostic emission.

The bridge test captures a nonempty `captured` frame produced by the actual C# emitter, including `UInt64.MaxValue` decimal strings and canonical base64, and passes that exact line into `parseReadonlyWfpDiagnostic`. Duplicate provider invocation is sticky-invalid and the actual emitted frame parses as `unknown` with empty events. Invalid binding emits no frame. Bounds cover 64 events, 4096 decoded App ID bytes, 184-character package SID, and 524288 UTF-8 JSON bytes; malformed or overflowing observations cannot remain captured.

Source inspection confirms the narrow generated route supplies the validated payload nonce and held root identity and supplies no caller observation or authority flag. The base PowerShell boundary outside the route is compared exactly in the generator tests; the default launcher remains byte unchanged. `git diff --check` for the scoped files passed.

## Limits

All evidence is offline and injected. No generated wrapper, AppContainer worker, WFP query/subscription, network operation, model/provider, or historical gate ran. The C# frame is emitted before the unchanged outer PowerShell cleanup completes, so it is provisional. Separate consumer evidence must authenticate it against the invocation and downgrade `captured` unless the original worker outcome and late cleanup succeed. The shared build and packaged-byte parity are the root-owned next gate and were not claimed by this review.
