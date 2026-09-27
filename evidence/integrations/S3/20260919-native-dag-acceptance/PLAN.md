# Native DAG acceptance plan

Done gate: legacy single-producer acceptance tests remain green; a two-writer fixture with distinct approved targets and requirements produces separate outcomes under one independent verifier; a corrupt second target, swapped producer mapping, or missing verifier receipt blocks acceptance. Identical registration retries succeed; conflicting bindings fail. Focused command from `daemon`: `npx vitest run test/integration-native-existing-file-acceptance-host.test.ts --reporter=verbose --no-file-parallelism` exits 0. Root owns the coordinated build and broad suite.

Attempt cap: two implementation passes. Run the focused gate after each; on failure change hypothesis before retry. Keep only a gate-improving change. A separate reviewer checks the diff.

Ownership: `daemon/src/verification/native-existing-file-acceptance-host.ts`, only necessary checker contract files, new dedicated tests, and this evidence directory. Other agents own host composition and staging; preserve their edits. Exact preimages are saved before edits. No provider, model, or service call.
