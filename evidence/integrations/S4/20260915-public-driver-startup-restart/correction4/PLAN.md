# Actual1 publication-intent binding correction

The completion contract and two-pass cap were declared in commentary before source edits; this durable file was written after the source edit because the planned pre-edit file write was omitted.

Done means the fixture resolves exactly one durable publication intent before native write using the actual attempt ID and the callback's root path/identity, target, max bytes, preimage identity/length/hash, and replacement length/hash. Missing, duplicate, or corrupt intent data refuses before native write. The effect frame includes the resolved publication ID and the exact stored intent payload and payload hash. The existing `intentCount: 1` assertion remains unchanged.

Attempt cap: two edit-and-gate passes. Each pass runs fixture syntax, TypeScript no-emit, and focused Vitest. No build or actual run.
