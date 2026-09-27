# Static generation idempotency result

Status: PASS after the bounded maker passes plus one root-requested pre-run correction gate. The real repository generator was not run.

- Focused gate: `npm exec vitest run -- test/current-source-report.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon` — exit 0, 5/5 tests.
- Build: `npm run build` — exit 0.
- Identical generation reuse requires the exact expected entry set, matching schema/digest, and byte-identical manifest plus all staged artifacts, including source basis and report provenance.
- Missing, extra, tampered, stale-basis, or manifest-mismatched content throws before pointer publication and never overwrites the generation.
- A newly created, internally named staging directory is removed after reuse by unlinking its six known files and calling `rmdirSync` on the now-empty directory; the executable test covers this branch and rejects an outside path. No recursive deletion is used. Historical staging directories are untouched.
- Generator stdout includes `reused:true` for this path, allowing the actual gate to distinguish reuse from new publication.

## Frozen hashes

- `scripts/reuse/cue-current-source-report.mjs`: `7f9c8a75df1ad4194fce0869a914ea4d3b9dc6f7b4309c29c5aaae6215688455`
- `daemon/test/current-source-report.test.ts`: `0ced200c15a8763e7268b7078427cc16f797c9bf563b886ee855d90ed9add062`

## Recommended actual verification

After independent review and with scoped source frozen, record the current pointer, generation, and preserved failed-staging hashes; run the generator once; require `ready:true` and `reused:true`; then prove the active pointer and existing generation hashes are unchanged and `.staging-cb93d71b-d95d-4ed7-9980-e15e71db330b` remains untouched. Any mismatch or source-basis change is a stop condition, not permission to replace evidence.
