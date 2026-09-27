# Independent measured-evidence UI review

## Verdict

**PASS after root correction.** The initial independent pass was BLOCKED on three concrete defects. That verdict and its hash remain preserved in `review-before-root.md`. Root corrected only those defects under `ROOT-CORRECTION.md`; the final pinned source now satisfies the bounded saved measured-fact read contract.

## Failure and correction history

The maker's two-pass record remains intact: pass 1 build passed and tests were 23/24 because returned fact identity was not bound; pass 2 bound the requested `factId`, built successfully, and passed 24/24. Independent review then found: an arbitrary rendered accounting kind, measured evidence surviving execution lock, and a bridge limit of 64 attempts despite Core admitting 1024. The initial review was saved as `review-before-root.md` with SHA-256 `a96a71d37ddf3a5fa0bab41cfa29d05a4ca283fbd367ffd6c66d70cf8497e920`.

Root's separate correction pass allowlists `unknown`, `local-invocation`, and `monetary`, binds availability to kind, raises the exact descriptor-safe attempt bound to 1024, and rejects 1025. It also disables and guards the form for a locked prepared run, increments the measured generation, clears visible output, and prevents an in-flight response from rendering after approval. Historical manual lookup still works before prepare. Root recorded a successful build and 3 files / 28 tests; no root second pass was needed.

## Independent verification

- Final pins: **5/5 match** `final-pins.json`.
- Preserved maker-handoff copies: **5/5 match** `before-root-gate.json`.
- Original captured preimages: **4/4 match** `preimages.json`.
- Root's passing build was not duplicated.
- Reserved independent pass 2, run once from `daemon/`:
  `npx vitest run test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`
  -> exit 0, **3 files / 28 tests**.

The added executable cases reject arbitrary or inconsistent accounting pairs, accept every valid kind/availability pair, return all 65 and all 1024 attempts, reject 1025, clear visible evidence at approval, ignore the pending response after approval, disable further reads for the locked run, and confirm that Core is not called again.

## Contract assessment

The exact own-property `measured-fact-read` command is available before prepare and delegates only to `Core.projectEvaluationMeasuredFactEvidence({factId})`. Proxy, accessor, malformed, extra-field, wrong-identity, wrong-authority, readiness, promotion, hostile nested shape, oversized array, and throwing-Core cases fail through the fixed unavailable reply. The returned frozen summary excludes evidence references and digests, raw bytes, quality scores, accounting amounts/totals, uncertainty text, and exception details. Arbitrary uncertainty reasons are counted but never rendered.

The renderer performs no automatic lookup. It requires an explicit fact ID, distinguishes host-observed from offline-fixture production, displays unavailable quality/timing/accounting explicitly, retains the no-trial/no-promotion statement, rejects a mismatched returned fact, clears errors, fences different-run results, and now clears/fences approval locking. No unresolved blocker remains in this unit.

## Limitations

This evidence is component-level mocked IPC/DOM coverage plus the existing synthetic SQLite/Core regression with injected terminal authority and test lineage. It does not establish a real Core-to-IPC happy path, live Electron visuals, runtime/provider measurement accuracy, production measurement qualification, default-host availability, trials, or promotion authority. No Electron, native process, server, network, provider, or model was run; the local model remained off.
