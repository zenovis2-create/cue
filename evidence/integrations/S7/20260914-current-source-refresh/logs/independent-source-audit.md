# Independent source audit

Audited without generating or rebuilding the report.

- `scripts/reuse/cue-current-source-report.mjs` `7f9c8a75df1ad4194fce0869a914ea4d3b9dc6f7b4309c29c5aaae6215688455`
- `daemon/test/current-source-report.test.ts` `0ced200c15a8763e7268b7078427cc16f797c9bf563b886ee855d90ed9add062`

Source contract findings:

1. Capture reads bounded `app` and `daemon/src` source bytes and verifies the same snapshot before and after rendering.
2. The source basis binds snapshot digest, HEAD, and scoped porcelain status hash/count, excluding evidence output writes.
3. A generation contains exactly five artifacts plus `generation.json`; every artifact receives a byte length and SHA-256 entry.
4. Existing generations are reused only when all names and bytes match the newly staged bundle. A new generation is renamed atomically before the current pointer is published.
5. Pointer publication validates the final manifest digest and restores the previous pointer on its own failed commit without overwriting a competing writer.

Pre-generation result: no source-contract defect found. Final verdict waits for root generation and direct integrity checks of the pointer, manifest, five artifacts, current source hashes, and retained historical pins/preimages.
