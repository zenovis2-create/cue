# Measured-fact evidence view contract

Done: read-only bounded provenance/measurement-availability view through protected Core accepts factId only, revalidates saved fact via existing store and explicit trusted host, denies unconfigured/foreign/malformed before callbacks, preserves producer class and immutable trial semantics. Actual SQLite Core positive populated-attempt/reopen/tamper/zero-write and missing-availability tests pass, final build0, independent Sol review PASS.

Maker cap2 substantive passes; every pass safe focused tests/syntax, final build once stable. Real Core positive and populated persisted attempt coverage are required before final gate; do not substitute mocked success. No schema/trial/measurement authority relaxation or default-host activation. Root docs reconciliation47. Preserve failures/dirty work, no model/server/native/network/live Electron/commit/push.
