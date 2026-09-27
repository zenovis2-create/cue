# WFP diagnostic bridge implementation

The generated WFP launcher now owns diagnostics per invocation. It passes the existing payload nonce and held root identity into its narrow WFP entry, retains the exact lease locally, and emits at most one `CUE_READONLY_WFP=` frame after launcher finalization. The default launcher, collector, and null-provider route are unchanged.

The frame uses the exact v1 schema and bounded event representation. Invalid invocation binding emits no frame. Duplicate provider use, callback loss, overflow, invalid events, or an oversized frame cannot report captured evidence. Output failures are swallowed without replacing the launcher's return or original exception. The raw frame precedes outer PowerShell ACL/profile cleanup, so it remains provisional diagnostic data; the separate consumer requires the existing successful worker outcome before retaining `captured`.

Verification:

- Focused producer, adapter, generator, and real parser tests: 4 files, 35/35 passed.
- Scoped `git diff --check`: passed.
- Independent review: PASS, `1FAC92DE38E625F599E155A45926600A6AD36019FC30B23CB82E3C28942595B7`.
- No native WFP, AppContainer, wrapper, network, model/provider, policy, or elevated operation ran.

Frozen source hashes:

- generator: `F4852DE9E02E721FEB5C07D845A381DB5019560C0741A856AD799B02D53865F1`
- adapter: `6566E134B895AF41C710E5D37580B5AF37EFDBEC00D98671E6DB9EAAEDC4C86C`
- generator test: `CA429AD1B882C453C01498037E4FDC9B5D1AA9A7E8A835EB17048EB7642F54FD`
- producer/parser bridge test: `87C7CF001B6F90908A5B26CBAED63E3EA1E8262CD27B9E5800B2160D29EB0A71`
- plan: `84880A3A26C62AD50F9B30773C114168520835E5F5662F5AF41B9A11C7E7B6DD`

The shared build and packaged byte-parity gate are coordinated by the root after both producer and consumer freezes.
