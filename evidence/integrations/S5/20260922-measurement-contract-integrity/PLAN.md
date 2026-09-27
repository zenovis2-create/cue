# Batch93 — production measurement contract prerequisites

2026-09-22. Direct implementation/self-review, no live providers/models/accounts or native GUI gate; Qwen OFF, subscription4/4 spent. Preserve previous dirty work and exact preimages.

Inspection found concrete prerequisite defects: canonicalData rejects every array because length is nonenumerable; register probes raw.then and can run accessors/proxy traps; only top-level returned contracts are frozen; nowMs can mutate unsnapshotted host response; immutable id/revision retry gets a fresh timestamp and conflicts; measured-fact dependencies compare digest but not enrolled contract id/revision. Fix these before introducing a production producer or promoting facts into trials.

Implement descriptor-safe bounded recursive definition snapshots with a shared content-only producer serializer, no authority issuance; freeze all nested output, preserve historical canonical bytes. Reject reentrant same-ledger registration and async/hostile responses without inspecting then; retain exact identifier replay and original registration time, check final conflicts in an IMMEDIATE transaction. Validate complete metric/environment/account reference identity in measured facts on capture and read. No invented measurements, authority upgrade or changes to trial:null.

Add red regression tests for actual defects, then targeted and coupled suites. Maximum two correction hypotheses per unchanged blocker; retain failed logs. Whole-suite and independent review remain pending. Original parent count33/44 closed,11 open.
