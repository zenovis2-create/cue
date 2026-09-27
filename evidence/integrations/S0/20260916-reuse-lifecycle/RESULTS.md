# R03-R06 selected reuse lifecycle maker results

Status: focused maker gates pass. Independent review remains separate. No provider/runtime-dispatch or broad R03-R06 closure is claimed.

## Concrete consumer path

`verifyReceiptArtifacts()` in `scripts/reuse/reuse-fixture-receipts.mjs` is the existing receipt eligibility boundary used by its `--verify` CLI mode and focused tests. It now constructs the expected canonical receipt binding and calls `evaluateReuseEvidence()` before reading any result as reusable. A missing current `receipt.json` returns explicit `missing-receipt` refusal. Changed receipt bytes return explicit `changed-binding` refusal. A fallback is read only when its directory was explicitly supplied and its pinned binding exactly matches the regenerated current binding. There is no product/provider dispatch claim because these scripts remain fixture/tool-only.

The pure evaluator binds three independent values: canonical selected revision, canonical manifest digest, and receipt SHA-256. Its input passes through the existing descriptor/proxy/cycle-bounded snapshot before decisions are made.

## Scope findings

- R-03 historical transport evidence remains `incomplete-historical-transport-receipt`; cancel/restart/duplicate are not relabeled N/A or qualified.
- R-02/R-04/R-05/R-06 record a lifecycle matrix with N/A only for process/cancel/restart aspects of synchronous pure functions, plus concrete normal/failure/duplicate evidence.
- R-04 identifies the selected Cue-authored thin fixture adapter, zero selected TeamAI bytes, and the notice boundary.
- R-05 keeps the Cue normalizer contract separate from pinned upstream field-shape references; no SDK/client byte incorporation is claimed.
- R-06 remains a fixture-only strict-guard boundary. Deferred packages and transports remain incomplete and unauthorized.

## Gates

- `node --test scripts/reuse/reuse-fixture-receipts.test.mjs`: exit 0, 4/4 pass. Raw stdout: `node-test.stdout.txt`; exit byte: `node-test.exit.txt`.
- `npm exec -- vitest run test/integration-reuse-manifest.test.ts` from `daemon`: exit 0, 8/8 pass. Raw stdout: `vitest.stdout.txt`; exit byte: `vitest.exit.txt`.

## Final filesystem-byte pins

| Path | Bytes | SHA-256 |
|---|---:|---|
| `scripts/reuse/reuse-manifest.mjs` | 10504 | `6833dce115012359128bccebed39716beaa8af402d55c092fc7f57984edef6a9` |
| `scripts/reuse/reuse-fixture-receipts.mjs` | 12853 | `c74f35dd7952f7b29bfbada95f3f125e9217892b1d3a0b4e9218d2da659ab49d` |
| `scripts/reuse/reuse-fixture-receipts.test.mjs` | 4069 | `75562e58bdb619b93ea30a21e2b5637ca1f389179b0e24cf512af3e110521bc1` |
| `daemon/test/integration-reuse-manifest.test.ts` | 6476 | `e5d1a75f9de82502951714bbb53667c481f48513a9403212c45ca1b016e8c527` |
| `receipts/receipt.json` | 11342 | `8c38a733a5a924d44dd89d1cae2000bcb78726cf6b9a8774e3370bfcb1fbfc0e` |

Exact pre-edit and final filesystem bytes for the four changed source/test files are under `preimages/` and `final-bytes/`. Generated result bytes and raw gate evidence remain alongside this report.
