# Independent fit correction review — PASS, limited experiment

2026-09-12. The correction appropriately confines the synthetic JSONL decoder to `daemon/test/fixtures/claude-jsonl-fixture.ts`, with `daemon/test/claude-jsonl-fixture.test.ts`. The duplicated launch builder is removed; the historical R-02 launch experiment remains the single existing fixture builder. This is not a production Claude adapter.

Read-only verification confirmed that both former source/test paths and the two stale compiled files listed in [root removal receipt](root-stale-artifact-removal.json) are absent. The pre-fit source/test and compiled preimages remain in this evidence directory. The decoder implementation from its typed-byte snapshot onward is byte-identical to the reviewed pre-fit source; its behavior was not silently expanded into real protocol support. Search found no application or production daemon import of the new fixture.

Independent gates, all exit 0:

- `npx --no-install vitest run test/claude-jsonl-fixture.test.ts --reporter=verbose`: **7 PASS**.
- `node --test scripts/reuse/claude-launch-spec.test.mjs`: **9 PASS**.
- `npx --no-install tsc --noEmit`: PASS.

Current fixture SHA-256 `9239ABFD92B69D6C09DDC2A6635F485817B8EDB743132FCE9B667C8B8CFEEDF4`; test `BB42A158DBCE0BB67B684F58B1CE6AE6A7B8F58E8F3E0F27140C739F8DBDB91D`. Historical launch experiment hash remains `57A07D016BE906F01CF2AE1D188A936CB36A036D385DF9D0EC67E86F66B4FD17`, historical test `3DB03F2F1AF964BF7BB886ECF5009FFB3F189638EC31DA9BB8CF1C6AC6E1CECB`, matching recorded pre-fit provenance.

The original nine-test module review is historical and its old source links are superseded by this relocation. The [maker correction](maker.md) and test-helper header explicitly describe the fixture scope. Useful UTF-8/framing bounds and failure-state tests remain available, while real init metadata, session/model/usage fields and real CLI event combinations remain unsupported. No S1 real-protocol completion, qualification, credentials or execution authority follows from this PASS.

Reviewer product edits/build/native/actual CLI/provider calls: zero. Only pure test/typecheck commands and this review artifact were written/executed.
