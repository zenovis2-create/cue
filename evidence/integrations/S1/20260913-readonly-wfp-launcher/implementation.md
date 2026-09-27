# Self-contained read-only WFP launcher implementation

## Result

The deterministic generator renders one self-contained PowerShell launcher from the reviewed base launcher, collector, and observation adapter. The generated variant exposes a narrow `LaunchWithWfpObservation` entry that constructs the fixed WFP request (`48193`, `5000 ms`, held executable path, fresh package SID) internally. The provider-taking launcher entry remains internal. The default launcher and default application dispatch remain unchanged.

## Verification

- `cd daemon && npx vitest run test/integration-readonly-wfp-launcher-generation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: 9/9 passed.
- `cd daemon && npm run build`: exit 0.
- `buildDefault()` equals `daemon/dist/src/readonly-verifier-wfp-launch.ps1` byte for byte.
- The tests compile the exact generated C# and execute both the exact PowerShell route and the exact generated C# entry against an inert real factory plus a stubbed launch edge. No WFP API, AppContainer, or worker is started.

## Frozen hashes

- generator: `ABDEA994BC183B4BD9371D1806C1DC315B40D387EFA1A3FEB5333CAD39FC611E`
- declaration: `62981974900A783945EC677E5B6371547D85B6DAA41F364929B8A2DAA7E38C33`
- focused test: `0C9A6513FA1D47C3C3CA477B56BD76641CEB51DC37A57FD6606BD46F9278C7C9`
- generated launcher: `E45D94BA23C988383B43D7B5F603978477630301BCE511E0BFDD0048B5BB9424` (43,990 bytes)
- base launcher input: `6060955CD91AFB9D0470697C1B8945A75850AFD3A0307CF60AC0063C271A48FF`
- collector input: `5871FB8684AA3D8C2B6D635E3C31B6FD5A9FE45E18CDD9D7A1164C106C9CCB4F`
- adapter input: `9C00E6A55D93BCC43CFBCA33CA2DBC305CF3BB72734E8A24469EF3154D882F60`

## Limitations

This unit creates and packages the selectable launcher variant. It does not register global/default WFP dispatch, execute the native launcher, or establish actual network-denial evidence.
