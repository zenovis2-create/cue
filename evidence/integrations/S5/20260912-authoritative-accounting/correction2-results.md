# S5 authoritative accounting correction 2

Date: 2026-09-12 KST  
Status: source frozen for independent review

Preserved both earlier reviews and corrected only the two remaining boundedness findings.

- `projectAt` count-gates the union of current monetary/local request IDs at 4,096 before materialization, uses `LIMIT 4097`, and applies the 2 MiB bound to the complete projection including current disclosure.
- Dependency capture now executes SQL `length`/`max(length(...))` preflights before fetching or base64-normalizing original plans, local policies, retry contracts, retry-link payloads, referenced orchestration receipts, plan revisions, revision steps, and attempt claim payloads. Revision-step payloads use the schema's stricter 262,144-byte limit; the remaining dependency payloads use 1 MiB, with the local policy's existing 4 KiB bound retained.
- A regression inserts 4,097 post-cutoff reservations and proves `projectAt` fails with `inventory_limit` before disclosure materialization.
- A regression replaces a bounded retry-link dependency with a 1,048,577-byte payload and proves capture fails with `payload_limit` before normalization.

## Verification

- Focused accounting suite: 6/6 PASS.
- Full daemon build: PASS.
- Owned/evidence `git diff --check`: PASS.
- Source SHA-256: `A6668C3D20D6B8FB963B4957C488197F7918A62088478246532F8831823A5935`.
- Test SHA-256: `F3852E6309E125D02EEA2CC93A925999FE8925DDA05F2E564C6000A7F844807E`.

Core remains quarantined and no revised-role classification was added. No external calls occurred.
