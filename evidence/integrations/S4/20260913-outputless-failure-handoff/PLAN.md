# Outputless failed execution handoff plan

Done means the generated JSON host can terminalize an outputless failed model attempt with an exact failed/clean handoff backed by its already persisted verified-clean cleanup observation; the attempt remains failed, its dependent checker does not launch, acceptance stays unverified, and the artifact resolver survives SQLite reopen while rejecting tamper, foreign lineage, unknown cleanup, and success-path reuse.

Attempt cap: 2 implementation/verification passes.

Every pass runs, from `daemon`, after `npm run build`:

`npm exec vitest run -- test/integration-generated-json-host.test.ts test/integration-recovery-handoff.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

On failure: inspect the exact failed assertion and persisted rows, form a new hypothesis, and make at most one corrective pass. If the second pass fails, stop with the exact failure and hand it to the human/root agent.

Preimages (SHA-256 before source edits):

- `app/generated-json-host.mjs`: `F72110F8FFA69B3F83D94716C6385566BF773DACD2069C157A4705A6DA65FFAA`
- `app/generated-json-handoff-authority.mjs`: `F8AA5B0A41D9A3CA2AE28C00F84F08D970432E6857D0C2756FB28E83135462E7`
- `app/generated-json-handoff-authority.d.mts`: `935F9CABA9EA903BE5F7B75152B8DDDE4CD74F22D10E8EC2743614401525E6AF`
- `daemon/test/integration-generated-json-host.test.ts`: `CA4E3D3C6152E51404B27D3C23BA84EAD5E85D5D6B1DADC2DEA367098FF47726`
- `daemon/test/integration-recovery-handoff.test.ts`: `EE946B490C36470B10345C0A1DD12E5C45B24B7D6902BE6C44EF2B5A4D2820EF`

All five owned files were already untracked in the shared worktree. Preserve their full contents and limit edits to this unit.
