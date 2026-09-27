# Native existing-file authority implementation result

## Verdict

FAILED / NO PRODUCTION SOURCE RETAINED. The three assigned source/test paths
match their absent preimages. Unit 1 is not complete and the required real
Core/staging positive flow did not run.

## Rejected hypotheses

The first hypothesis was blocked before test collection by the emitted subject
collector's incorrect application import. Root repaired the shared build copy
path and verified an unmocked import smoke; that failure remains evidence of the
initial gate and is no longer the final blocker.

The second hypothesis was rejected during source review. It exposed a
caller-supplied cleanup fixture, retained the caller executor's `resolveBinding`
as launch authority, never populated the expected checker contracts, identified
the checker principal only by ID/revision rather than current authority code
digest, and omitted required acceptance evidence-policy fields. Its receipt
queries also initially referenced a nonexistent execution-receipt table before
correction. Those defects made the available path grant-producing while its
acceptance path was unreachable. The draft and its insufficient negative tests
were removed rather than retained as partial implementation.

## Blocking evidence

The first focused gate failed before test collection. The emitted file
`daemon/dist/src/native-provider-measurement-subject.js` imports
`../../app/provider-installation.mjs`. From that emitted location Node resolves
`daemon/app/provider-installation.mjs`, which was absent. Root subsequently
fixed this shared build defect. No remaining external dependency blocks the
unit; the remaining boundary is a new implementation that derives every launch
binding from persisted lineage, creates no caller authority seams, constructs a
reachable native snapshot checker with full evidence policy, and passes the
real Core/staging flow.

## Checks

- rejected draft syntax check: exit 0
- rejected negative-only isolated Vitest: 2/2 pass (not qualification)
- daemon TypeScript check while draft existed: exit 0 (not qualification)
- required real Core/staging positive flow: not run, therefore not passed
- independent checker: not requested because source is not frozen as complete

The rejected draft source bytes and hashes were not retained. No commit or
repository-history pin exists for them. Only post-hoc material excerpts copied
from the displayed tool outputs and this findings record are durable; no
complete contemporaneously captured raw gate log exists in this directory.

Status: FAILED / ALL THREE PREIMAGES ABSENT / NOT `READYBUILD`.
