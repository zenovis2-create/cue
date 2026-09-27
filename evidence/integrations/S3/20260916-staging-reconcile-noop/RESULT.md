# Reconciliation no-op correction result

`reconcilePublished` now rejects dirty paths outside the approved set while
allowing approved targets to remain unchanged. It native-snapshots every approved
execution/publication target against the published digest, restores only dirty
approved members to immutable preimages, and still requires a fully clean root.

Real Git/native regression passes no-op plus mixed changed/unchanged targets and
cleanup. Existing unknown-file/divergence behavior remains passing.

- Focused factory gate: 6/6, exit 0.
- TypeScript no-emit: exit 0.
- No provider/model execution or shared build ran.
