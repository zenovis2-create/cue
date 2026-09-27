# Evaluation UI independent review

Initial verdict: **BLOCKED**

Final source disposition after correction: **PASS**

Product edits: 0. Actual Electron, native helpers, models, providers, and network were not run.

## Blocking finding

`app/ipc.mjs` does not enforce the required no-getter/no-proxy boundary on Core-returned evaluation DTOs. `evaluationProjection()` reads output properties directly (`value.version`, `value.dataset?.id`, and nested equivalents) before producing its frozen allowlisted object. A Core-returned accessor therefore executes inside the privileged IPC process; proxy traps can likewise run. The current hostile-input test only covers renderer-command accessors/proxies, not hostile projection output.

Independent focused probe against the current source returned:

```text
{"touched":1,"available":true,"version":"v"}
```

The probe supplied `enrollEvaluation()` with an otherwise valid enrollment whose `version` was an enumerable getter. Invoking `cue:evaluation` executed that getter once and returned a successful response. This failed the contract item “Projection bounded and sanitizes paths/secrets/prompts/errors, no getters/proxies.”

## Correction disposition

Resolved in a distinct correction unit while preserving the initial blocked evidence. The corrected projection rejects proxies before reflection, accepts only exact enumerable own data descriptors, checks plain/null-prototype records, verifies dense ordinary arrays with explicit limits, recursively validates every actual enrollment/observation/coverage variant (including recorded and unavailable outcomes, monetary/local/unknown accounting, attempts, receipts, acceptance, readiness, expected cases, slots, and nested observations), and freezes the allowlisted projection. The enrollment reread used to derive dataset/arm/policy coverage scope now passes through the same projection first. All projection failures return only `{available:false,reason:'evaluation-unavailable'}`.

The focused hostile tests verify top-level, nested-record, array-element, sparse-array, proxy, and recorded-outcome accessors remain `touched === 0`; valid Core-shaped DTOs still project. No remaining source blocker was found in the assigned scope.

## Verified behavior

- Registered Electron handlers retain the existing trusted-sender gate through `host.isTrustedSender(event)`.
- Evaluation commands have exact own-data-property shapes; renderer cannot supply run ID, enrollment time, outcome, quality, elapsed time, result, or cohort selector fields.
- Enrollment is bound to the latest successfully prepared run. Approval and execution lock enrollment before Core dispatch, including synchronous throws.
- Observation uses the trusted current enrollment and caller-supplied exact observation ID plus expected prior revision. Coverage derives dataset digest, arm, and policy digest from the trusted enrollment and accepts only the last observed cutoff ID from the UI.
- Preload adds one direct `evaluation` function over the exact `cue:evaluation` channel; the exact API/channel regression passes.
- Renderer makes zero evaluation calls on initial render and requires explicit submit/click actions. It binds enrollment to the current prepared run, locks before approval dispatch, derives replay revision and coverage cutoff from trusted responses, fences stale run/generation responses, and clears stale observation/coverage on errors.
- UI copy discloses claimed-not-verified input binding, unsupported manual baseline, current-membership coverage, unobserved/fail/unknown values, and avoids promotion/improvement claims. Long identifiers are bounded/wrapped by input limits and CSS.
- Existing focused stop/recovery/renderer and exact surface regressions pass.

## Independent checks

- `npx vitest run test/integration-evaluation-ui.test.ts test/integration-evaluation-observations-core.test.ts test/integration-evaluation-enrollment.test.ts test/integration-evaluation-observations.test.ts test/integration-evaluation-outcome.test.ts test/integration-evaluation.test.ts test/p10c-renderer.test.ts test/p11-electron-surface.test.ts` from `daemon/`: **8 files, 42 tests passed**.
- `npx tsc -p tsconfig.json --noEmit` from `daemon/`: exit 0.
- `node --check app/ipc.mjs`, `app/preload.cjs`, and `app/renderer/renderer.js`: exit 0.
- A first test invocation from the repository root produced only fixture-path ENOENT failures; rerunning from the suite's required `daemon/` working directory passed completely.

Post-correction independent checks:

- Focused hostile/UI/IPC/Core/regression run from `daemon/`: **7 files, 31 tests passed** (`integration-evaluation-ui`, observation Core, enrollment, observations, outcome, renderer regression, and exact Electron surface).
- `npx tsc -p tsconfig.json --noEmit` from `daemon/`: exit 0.
- JavaScript syntax checks for IPC, preload, and renderer: exit 0.

## Reviewed source hashes (SHA-256)

- `app/ipc.mjs` initial blocked hash `A430CE43C53A75311B958A14E30C880D72E9CB9B0577B4CAC57BD27E5696DC1F`; corrected reviewed hash `02A29ECE551883D5B3E2754651C1B392D9AAA1012E97232D99DC69D2399C25B7`
- `app/ipc.d.mts` `71D4F1AB0741B10C2B3EEEFB31D4119686F3F79B4A73D9005B627DFBBA28D7C5`
- `app/preload.cjs` `BAEC01DBC7DFD3FA7665887A02B2B9A0B91D4316D90B0F517D7C9902B843FEDC`
- `app/renderer/renderer.js` `8B7F9A2A2611860844201868DEB8FF82BDEC134C1DAC72C1FAA3FB49B57DC243`
- `app/renderer/index.html` `FBECDA575265C4C5FF32C7270B53C6971E98C42DDAA2E92D80A9FB7514584475`
- `app/renderer/styles.css` `606890BA693D219E6D4A4E014B87DE470550B6B6444B34FD5702B2B76E141344`
- `daemon/test/integration-evaluation-ui.test.ts` initial hash `5F5714F02E76D62B5317F90B316737E322086500AF4897F571E21C643DE493DB`; corrected reviewed hash `67BD1ED38B4B6CB5D715A7E88D9EC1B60CB67EA1CDB4996480DB3FCE55DB33B3`
- `daemon/test/p11-electron-surface.test.ts` `B19F178CED52CB1CA164DA828CA98ABE1F6CF66E7CC552E58AB052F160C73F1E`

Actual Electron execution remains a separate pending evidence gate. Product edits by this reviewer: 0.
