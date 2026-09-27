# Staged existing-file publication host — bounded plan

Done means the new production adapter derives an opened staged contract from the
existing ledger, reads only exact approved target bytes from the native-identified
execution root, delegates final authority to a trusted callback, and exposes the
existing native compare/write publisher. It grants no staging or candidate capability.

- Attempt cap: 2.
- Every pass: focused Vitest and `tsc --noEmit` when concurrent source is frozen.
- Gate: exact positive ledger/native path plus malformed contract, lineage/target,
  traversal, root identity and unopened/read drift refusals before bytes escape.
- Failure: retry only with a new hypothesis; after cap, preserve evidence and hand off.
- No provider/model/paid run, configuration enablement, or shared build.

## Root-review correction

Fresh cap: 1. Validate target arrays only through own data descriptors before
reading any element, reject extra keys/custom iterators/sparse/accessor entries,
and detect Windows-equivalent case-folded duplicates. Hostile getter must remain
uninvoked and reach neither ledger nor native work.
