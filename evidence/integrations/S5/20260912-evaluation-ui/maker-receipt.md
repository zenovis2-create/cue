# Evaluation UI maker receipt

Implemented one explicit `cue:evaluation` surface for pre-approval enrollment, user-triggered stored-state observation, and last-observation coverage. IPC retains the latest successfully prepared run, injects the run and host clock, locks enrollment before approval/execution dispatch, derives coverage cohort fields from the current-run enrollment, and returns bounded allowlisted DTOs with generic unavailability. The renderer makes no evaluation call during load or render, fences async responses by generation/run, derives revision and cutoff from the last trusted observation, and keeps unknown/fail/cancel/unobserved values distinct without improvement, trial, or promotion claims.

Correction cap used: 2/2 diagnosed passes. Pass 1 corrected invalid SHA fixtures and a missing async readiness wait. Pass 2 updated the exact preload/channel regression and its test mock type. Final gate: 8 files, 27 tests passed; `npx tsc -p tsconfig.json --noEmit` exit 0; `npm run build` exit 0; JS syntax checks exit 0. No Electron, native helper, model, network, or provider call was made.

Source hashes:

- `app/ipc.mjs` `A430CE43C53A75311B958A14E30C880D72E9CB9B0577B4CAC57BD27E5696DC1F`
- `app/ipc.d.mts` `71D4F1AB0741B10C2B3EEEFB31D4119686F3F79B4A73D9005B627DFBBA28D7C5`
- `app/preload.cjs` `BAEC01DBC7DFD3FA7665887A02B2B9A0B91D4316D90B0F517D7C9902B843FEDC`
- `app/renderer/renderer.js` `8B7F9A2A2611860844201868DEB8FF82BDEC134C1DAC72C1FAA3FB49B57DC243`
- `app/renderer/index.html` `FBECDA575265C4C5FF32C7270B53C6971E98C42DDAA2E92D80A9FB7514584475`
- `app/renderer/styles.css` `606890BA693D219E6D4A4E014B87DE470550B6B6444B34FD5702B2B76E141344`
- `daemon/test/integration-evaluation-ui.test.ts` `5F5714F02E76D62B5317F90B316737E322086500AF4897F571E21C643DE493DB`
- `daemon/test/p11-electron-surface.test.ts` `B19F178CED52CB1CA164DA828CA98ABE1F6CF66E7CC552E58AB052F160C73F1E`
