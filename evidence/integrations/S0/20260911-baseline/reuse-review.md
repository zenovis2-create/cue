# Independent reuse contract review

Reviewer: /root/contracts_review. Date: 2026-09-11.

Verdict: PASS for the bounded offline contracts and investigation-record consistency below. External component adoption remains DEFER. This is not S1 live qualification, a production security audit, or approval to use credentials/paid models.

Completion gate: focused tests exit 0, correction regression coverage, matching source/evidence hashes, explicit unqualified scope. Artifact write cap 1; read/hash verification after write. Authors made implementation corrections; reviewer changed only this artifact.

Command: `node --test scripts/reuse/role-contract.test.mjs scripts/reuse/claude-launch-spec.test.mjs`

Observed exit 0, 15 tests, 15 passed, 0 failed, 0 skipped; duration 101.2588 ms. No real CLI/model calls. Node v24.18.0 (existing evidence). No production edits or process cleanup operations by reviewer.

## Findings and corrections

- Role ID accepted `a/../../escape` despite the path-ID rejection contract. Corrected with a role-specific character set excluding slash, backslash and colon, keeping canonical model identifiers separate. Added path/drive/dot regressions.
- Claude launch input accepted unknown/inherited fields and repeatedly invoked prompt getters (independent reproduction: five getter calls). Corrected with strict own data snapshots of input and modelBinding, rejecting custom prototype, symbols, accessors and proxies before field use; prompt captured once. Added zero-getter-call regressions.
- R-05 inline source hash initially lagged the usage correction. It now matches source/result.json: `2D5EB58C2D1D85A9BDEAF5B00840A780FAAAAEFD1585D9C5BCE4668517F375FC`. Usage implementation review belongs to the separate transport/usage reviewer.

No remaining blocking finding within reviewed scope.

## Verified boundaries and limits

Role JSON serialization is deterministic and preserves instruction strings as data; unknown permission-bearing keys, accessors, unsupported role enum values and tested malformed values fail. Role input scope is plain/JSON data, not arbitrary hostile executable JavaScript objects. Canonical model IDs are syntax only, not model discovery or qualification.

Claude launch spec is non-executable with auth unconfigured. Prompt goes to stdin, static options and constrained model ID form argv, environment is explicit. This proves builder output properties, not enforcement by Claude, filesystem path identity, process isolation or remote billing termination. Caller-supplied identityVerified is fixture input, not identity evidence.

Transcript fixtures reject tested unsafe tool frames and unsuccessful/missing/duplicate terminal records; output keeps acceptance/local cleanup unverified and remote billing unknown. Full live schema and nested stream ordering are explicitly out of scope in R-02 and are not qualified by this review.

Read R-01 through R-06 and candidate inventory for source-link, evidence, decision and scope consistency. Native experiments are distinguished from external adoption and actual CLI/model support. Ambiguous aliases and unsupported model identities remain unqualified. External URLs/licenses were not independently re-fetched or legally assessed in this review; cited upstream behavior remains author research pending integration experiments. No claim of upstream package tests, comparative cost savings, production integration or P13 completion.

## Reviewed snapshot SHA-256

Subsequent documentation status/link updates may change document hashes; implementation findings apply only to the source/test snapshots below.

| Path | SHA-256 |
|---|---|
| scripts/reuse/role-contract.mjs | E87000F81D394BBE1C766AF199778DF2B85062E6A9B26A27B6BC6FC13653948B |
| scripts/reuse/role-contract.test.mjs | D31A41B36C4CBCCF53E0269C4E4B92DF66347CCD98DF5F55239D01C1D16496C4 |
| scripts/reuse/claude-launch-spec.mjs | 57A07D016BE906F01CF2AE1D188A936CB36A036D385DF9D0EC67E86F66B4FD17 |
| scripts/reuse/claude-launch-spec.test.mjs | 3DB03F2F1AF964BF7BB886ECF5009FFB3F189638EC31DA9BB8CF1C6AC6E1CECB |
| docs/reuse-decisions/R-01.md | CD7D6615A5EFB9237F4F1E571A3D689451A3C314C3E1E6401E66AD320BB299D8 |
| docs/reuse-decisions/R-02.md | BF41C2E53C19D504D9A8A719A0B2D8A3F923F090D59B7AA5482515DA4D3EE13E |
| docs/reuse-decisions/R-03.md | 295408B878D0698E035839890312C1AA0B62C9A028D257CAACF25DA008888242 |
| docs/reuse-decisions/R-04.md | DCE36A8F0A7A97D724AF82AAA82519EDC484CE5645867B4506CFBE35FE598CC0 |
| docs/reuse-decisions/R-05.md | 854BAE669AF54C2ABA973E8839BF60567F512941EB4578A5DF61E8FCAA03B895 |
| docs/reuse-decisions/R-06.md | 18354C5C83C2420BDF919CE70FA2E93C7D1768C72DAAB1A84A6060575D4305ED |
| docs/reuse-decisions/CANDIDATE_INVENTORY.md | 021F8D38C291A6B58B87F6FFF91EF5C90A2513D3CABFD430DA4BD649675C3D58 |

