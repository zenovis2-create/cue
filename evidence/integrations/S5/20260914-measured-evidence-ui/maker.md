# Maker record

## Pass 1

- `npm run build` from `daemon/`: PASS, exit 0.
- `npx vitest run test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-ui.test.ts`: FAIL, exit 1; 3 files, 24 tests, 23 passed and 1 failed.
- Failure: the IPC hostile-contract test expected a returned `foreign` fact ID to be denied, but the bridge accepted the syntactically valid ID.
- New hypothesis for pass 2: the strict projection must bind the projected `factId` to the exact requested `command.factId`. Add that comparison after descriptor-safe projection and before returning the success envelope.

No server, native process, model, provider, live Electron, commit, push, capture, registration, launch, trial, promotion, or automatic lookup was run.

## Pass 2

- Source change under the written hypothesis: bound the descriptor-safe projected `factId` to the requested `command.factId` before returning success.
- `npm run build` from `daemon/`: PASS, exit 0.
- `npx vitest run test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-ui.test.ts`: PASS, exit 0; 3 files, 24 tests, 24 passed.
- Breakdown: new measured-evidence IPC/DOM component suite 4/4; existing protected Core evidence regression 5/5; existing evaluation UI regression 15/15.

The maker cap of two passes is exhausted. No source edits or third maker pass followed. Full captured preimages re-hashed equal to `preimages.json` for all four existing files.

Limitations: tests use mocked IPC and DOM components plus a separate existing SQLite/Core regression. They do not prove a real Core-to-IPC happy path, a live Electron rendering, runtime/provider measurement accuracy, production qualification, trials, or promotion. Default host behavior remains disabled/unavailable. Local model/server and exhausted live caps remained untouched.
