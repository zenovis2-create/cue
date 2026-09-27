# Failed-start protected context maker evidence

The driver conditionally wraps `verifyFailedStartCleanup` and forwards the same frozen account-enriched context previously passed to a launch that rejected. The property remains absent when the host does not provide the optional hook. The regression captures the launch context, forces a synthetic rejection, and verifies exact object identity plus opaque account reference and binding digest at failed-start cleanup.

Observed commands and results:

- Build pass 1 exited 2. TypeScript reported `TS1005` in the new regression because the resolver arrow function lacked its closing brace. Exact output is retained in `logs/build1.log`.
- Build pass 2 exited 0. Exact output is retained in `logs/build2.log`.
- Focused serial Vitest command for `integration-driver.test.ts` and `integration-generated-json-host.test.ts` exited 0: 2 files and 95 tests passed. Exact output is retained in `logs/test2.log`.

No separate exit-code files were produced; these exit codes are the observed tool results from the recorded commands. No provider, local model, native, Electron, credential, or network call occurred.

Current pins are in `final-pins.json`. Full source/test preimages captured before edits remain under `preimages/`. This is maker evidence; independent review determines qualification.
