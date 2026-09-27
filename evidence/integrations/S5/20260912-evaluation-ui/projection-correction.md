# Evaluation projection correction contract

Done means `cue:evaluation` rejects hostile top-level and nested Core return values without invoking proxy traps or accessors, returns only generic `evaluation-unavailable`, and preserves valid real Core enrollment/observation/coverage DTO projection. Every object and array level is checked for an ordinary prototype, exact own keys, enumerable data descriptors, ordinary dense array elements and bounded length before values are read.

Correction cap: two diagnosed hypotheses. Every pass runs the focused evaluation IPC/UI tests, hostile projection regressions, relevant exact IPC surface tests, TypeScript no-emit, and JavaScript syntax checks. A failure gets one new evidence-backed correction; after two failures the unit is handed back blocked. No Electron, model, native helper, network, backend, migration, or renderer feature work is permitted.

## Maker result

PASS. The local IPC projector now checks proxy status, ordinary `Object.prototype`/null records, exact own enumerable data descriptors, and dense ordinary bounded arrays before reading values. This is applied to enrollment datasets/cases/policy/refs, observation outcomes and all nested policy/attempt/selection/acceptance/accounting/receipt/breakdown/trial-readiness records, plus coverage cutoff/cases/slots and nested observations. The enrollment reread used for run/cohort scope also crosses this projector before its fields are read.

Hostile top-level and nested getters, proxies, sparse arrays, and accessor elements return generic unavailability with the probe counter at zero; valid complete Core-shaped DTO fixtures still project. Final gate: 4 files, 13 tests passed; TypeScript no-emit exit 0; IPC and renderer JavaScript syntax exit 0. Correction hypotheses used: 1/2. No build was needed because only runtime JavaScript and tests changed.

Hashes: `app/ipc.mjs` `02A29ECE551883D5B3E2754651C1B392D9AAA1012E97232D99DC69D2399C25B7`; `daemon/test/integration-evaluation-ui.test.ts` `67BD1ED38B4B6CB5D715A7E88D9EC1B60CB67EA1CDB4996480DB3FCE55DB33B3`.
