# Pre-edit source manifest

Captured before product/test edits on 2026-09-15. These exact workspace paths were read in full before mutation; hashes are the rollback anchors for the full byte preimages retained by the shared workspace history/evidence chain.

- `daemon/src/evaluation/authoritative-accounting.ts` — SHA-256 `a6668c3d20d6b8fb963b4957c488197f7918a62088478246532f8831823a5935`, 23,721 bytes
- `daemon/test/integration-evaluation-authoritative-accounting.test.ts` — SHA-256 `f3852e6309e125d02eea2cc93a925999fe8925dda05f2e564c6000a7f844807e`, 11,760 bytes
- `daemon/src/evaluation/measured-facts.ts` — SHA-256 `6e3d27e123ec24835612f44dd7a1db8a6e3b534aef7b5ed3273b6936846a20ce`
- `daemon/test/integration-evaluation-measured-facts.test.ts` — SHA-256 `6d5971a0568592b561b190b13f9a727ffcf27dec49318955d42967717abbf691`

Existing public format to preserve: `cue-accounting-cutoff-v1`, `cue-authoritative-accounting-snapshot-v1`, and all current cutoff/snapshot fields.
