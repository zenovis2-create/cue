# Independent parent startup/config/checklist delta review

Verdict: PASS for the specifically assigned parent delta. No product changes or model calls by reviewer.

validatePersistedConfig changes from a private function to an exported function; its existing body remains unchanged in the diff. It validates already-read persisted JSON, fixed state-ledger location and canonical workspace, returns a frozen config, and uses no configuration-creation/write function. The new declaration matches that signature. This remains a persisted-JSON validator rather than a generic hostile getter/proxy input boundary; callers should continue supplying parsed config data.

P9 now requires package main app/start.mjs, the guarded dynamic import of main, explicit loaded.startCueApplication({guard}), and the exported initializer in main. This replaces the obsolete BrowserWindow-in-entry text assumption with the actual protected entry structure. Independent P9 gate: `npx --prefix daemon --no-install vitest run test/p9.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, exit 0, 13 passed, 1.10 seconds at 2026-09-11 22:30:57 KST (tool 55958d). Actual runtime ordering remains covered separately by the earlier startup/guard reviews and pending fresh-app QA; this source assertion is not promoted to live startup proof.

## Narrow checklist receipt crosscheck

Parent clarified the requested delta is six checked rows, not nine. All six were crosschecked against their linked independent receipts:
- Local engine identity/count bridge: linked 8-suite/101 PASS review supports the bounded engine claim, with actual workflow acceptance explicitly separate.
- Explicit JSON IPC/UI: code review plus actual Electron fixture preparation/approval receipt supports checked state; model/session calls are zero and live qualification is not implied.
- Four local policies/V2 atomic settings plus core: backend and core reviews support persistence and corrected readiness distinction. The checklist retains restart requirement and unresolved UI execution-race scope.
- Execution ownership observation: linked 12 PASS review checks all unresolved attempts, write flag and retained handles without calling this new OS cleanup or acceptance proof.
- Guarded entry and explicit qualification API: linked ordering-primitive review and qualification API 16 PASS record support these components. No fresh qualification issuance is claimed.
- Resource UI: linked independent code and actual Electron fixture review supports the desktop workflow; host chooser fixture, no native dialog interaction and sub-900px limitation remain explicit.

The two pending rows for setup-UI locking/stop visibility and actual default startup remain unchecked. This review does not re-score unrelated historical checklist rows or treat historical source hashes as current live qualification. Earlier startup and failure receipts remain preserved.

Current hashes:
- app/core.mjs SHA256 BD7F47D4C9FA4F54FA40325B48B49D2D9BF00835AC49C6A785709C51860948AB
- app/core.d.mts SHA256 07358379446C85C5FD4968399D38BA6EDB876EF55EA135C04559002EE0B3E6AE
- daemon/test/p9.test.ts SHA256 D4ABFFAA4123E91C5A84FA1FD3A1AFAC2CA3649EE00E7285EFE20776D1239E72
- docs/INTEGRATION_CHECKLIST.md SHA256 7880A8806D74DFF9E83BEFE953A51BE3FAB34A2BD21FB56442B586225C397150
