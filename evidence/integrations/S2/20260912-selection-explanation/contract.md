# Selection explanation projection contract

Preimage orchestration.ts: 7B4D6BB809E40BD0A1E10FECD6CACE71AFE140FF65FEC15424DB84CD5AD63227
Done: read-only strict store projection; recorded / legacy-not-recorded / invalid / not-started distinct. No raw estimates or source strings. Maximum 50 assessments with total and truncation. Frozen DTOs, no admission or execution authority.
Identifiers are projected only as bounded plain opaque IDs (alphanumeric dot underscore hyphen); path-like/namespaced strings are redacted to null, not reinterpreted.
Gate: focused SQLite projection tests plus existing observation and driver tests; typecheck exit 0; independent reviewer. Root coordinates build.
Attempt cap: 2 diagnosed corrections. Every pass: same relevant focused gate; new hypothesis before fixing a failure. No native/model calls.
Owner only ui/orchestration.ts and new projection test; existing driver snapshot seam unchanged.
