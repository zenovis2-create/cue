# Reuse adoption manifests

Done: offline canonical validator verifies exact bounded manifest schemas and every declared local artifact hash; rejects malformed, duplicate, absent, escaping, or drifted inputs; reports one digest and explicit adoption status. R04/R06 manifests use existing facts; R01/R02 remain deferred. Cap 3. Run node CLI and focused Vitest each pass; preserve failures. New script/test/manifests had no preimages. No imports, installs, network, or source-graph changes.
