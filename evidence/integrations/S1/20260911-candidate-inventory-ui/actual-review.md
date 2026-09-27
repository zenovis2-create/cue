# Candidate inventory — final actual Electron fixture PASS

2026-09-11, attempt 2 of the original two-attempt QA unit. Attempt 1 remains [historical pre-correction evidence](pre-correction/status.json) and is not current acceptance. This executor changed only the QA script/evidence, not product sources.

[Proof](electron-proof.mjs) exercised the shipped renderer/preload/IPC and real core/catalog against two isolated SQLite databases. [Final result](electron-result.json) SHA-256 `64FB4618BE6DD4C9DE4BE5C9DC5C8C1C44354548711C8464D87D4CB67F3284BD` records matching pre/post source hashes, including core `68cfd656899dcb032614775109f967aad7f83cabd2a67b7ac7597362ff0bbf53` and renderer `7903a288b2b07b36d33496dd8602f692eb6fc1a99729fd5155da2c9032d8719c`.

Observed gates:

- Actual catalog rows showed fresh available and missing-installation/auth unavailable conditions. A 200-character canonical ID remained complete, wrapped and vertically scrollable with no page horizontal overflow. Auth references, aliases, binding/model/endpoint values and hostile source-version markup were absent from the real IPC projection and no injected image element appeared.
- Advancing the fixture catalog clock made the same record stale. Refresh preserved its original `observedAt`; display reads did not renew observation evidence.
- A real inventory response delayed at the host delivery seam arrived after an unavailable response. It did not resurrect the previous list.
- A configured real four-policy fixed pair displayed the limited same-pair/no-ranking claim. Writing one different pair through the actual policy/settings stores changed the real inventory and displayed comparison to `unknown`, removing the same-pair claim.
- Both databases retained zero tasks, sessions, orchestration attempts, approvals and local invocation budgets. Forbidden execution callbacks were never called. Stop stayed hidden for the empty execution state; no active-run Stop scenario is claimed.

All three PNGs were opened and inspected directly: [available](available.png), [unavailable](unavailable.png), [different policy pair](mixed-policy.png). Their SHA-256 values are respectively `C72F59C8A472BD48EDF653A6A8EE28EF211AA4C0B65D9F72FA3FCE3C5A99ED04`, `0CC201C5DB9BDDA90D4726EC24E15CA60104BC2089D86B0826E429360B23B328`, `FD6B8B84EA42365EFA6BD908A2AC3BCE8EEFB4C8AAB874EBFC903C961DA99249`. The fixed-height row list scrolls internally; long IDs are fully available through that scroll. The QA host switch refreshed only the inventory panel, so the left mode controls retain their initial fixture state; this is not a product host-switch workflow.

[Process receipt](electron-process.json): PID 51736, exit 0, closed child handle, validated temporary root removed. There were zero observed non-file renderer requests and no model calls. Fixture-only settings/policy setup writes are explicit; the read-only inventory did not mutate execution state. This is neither native provider qualification, real external CLI discovery, default package startup proof nor a measured optimization claim.
