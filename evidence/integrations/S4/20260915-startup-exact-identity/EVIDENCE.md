# Evidence

Source freeze (SHA-256):

- `daemon/src/recovery.ts`: `FCA73ACE0058476C103CEA6F06F03ABC032F2255E732CE95F43A302B0F556FDA`
- `daemon/test/integration-startup-exact-identity.test.ts`: `7C77020E55BD03B9A3060FECC9F0AED7E906ACA94DD451357282CAE8B86D7739`
- `PLAN.md`: `6D1282E33EF1C33A0FEEAEB895F10B53FAF22220E48E6C07D9091E35AB765FA2`
- `fullpreimages/recovery.ts`: `95B27D155495443F183590739FD65F5155F54B8413A1E8E97008B155268B054E`

Offline gates on Windows:

- `npx vitest run test/integration-startup-exact-identity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: PASS, 7/7.
- `npx tsc -p tsconfig.json --noEmit`: PASS.
- `npx vitest run test/p11-writer-corrective.test.ts -t "failed initial process query" --reporter=verbose --fileParallelism=false --maxWorkers=1`: PASS, 1/1 selected (14 skipped).

The command and tree-termination boundaries were mocked in the focused test. No actual process kill, build, provider/network call, or localhost call ran.

Compatibility: legacy `session_handle.start_time` values captured from wall-clock launch metadata can differ from the OS process creation timestamp and are now refused safely. They remain quarantined rather than being reported as terminated. Only a valid PID plus the exact same ISO-8601 creation instant (up to seven fractional digits, with equivalent offsets normalized) authorizes the existing verified tree-termination path.
