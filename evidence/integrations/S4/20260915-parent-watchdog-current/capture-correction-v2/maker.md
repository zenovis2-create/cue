# Parent-watchdog capture correction v2 receipt

The single actual OS invocation is consumed. Vitest exited 0 with 5 files and 10 tests passing, source/dist hashes were unchanged, the read-only AppContainer profile count was 6 before and after, and stdout contained exactly one `P12_PARENT_DEATH_IDENTITY` frame.

The runner result is **failed closed** at `postcheck`. The captured identity reported parent PID 84100, wrapper PID 131696, worker PID 15356, all four alive fields false, and termination latency 6932 ms. The runner required latency at most 5000 ms, so it retained the empty owned directory `D:\Temp\User\cue-parent-watchdog-capture-v2-gN4iBr`. Its next identity assertion also expected `createdAt`, while the real frame uses `created`; this assertion was not reached. No retry or retrospective PASS classification was made.

This evidence proves the five test files passed and preserves the requested raw identity output. It does not satisfy the runner's strict overall PASS contract.

- `result.json` SHA-256: `786D7288A42228A04A318EEFE3C9548A26FEC3AEDD107B198A73ED4A142BBF30`
- `gate.log` SHA-256: `068B0EAB200F7430921A73396451D0A9B17B3B3805E1D52BD60CE2A204105F87`
- `attempt1.intent.json` SHA-256: `6FF8C387E1FD48C083F793962DF81C7AE29918D627F24669025F7AA82799D3A0`
- `preflight.json` SHA-256: `546BC8FF588122522268B2C58E4C9D5547EA4609419824CACF15FB8F95B15AFB`
- runner SHA-256: `34E203305EE52902AFED085E2B280E56C0B7BA7E5F1595FC09135F9EC017ED32`
- offline test SHA-256: `71C641E6F7833DCDADAE1FE92FABDCE153A03C0D5C7C358E71B90FD9BFF84729`
- PLAN SHA-256: `D2709A2CB9111543E7CD0CD005E151E5E8A0891F05E1883D5C086A57E955E704`

Offline preflight: Node syntax passed, focused tests 2/2 passed, and the corrected PowerShell profile query returned status 0 with empty stderr before the actual intent was created.
