CREATE TABLE IF NOT EXISTS evaluation_comparison_snapshot (
  snapshot_id TEXT PRIMARY KEY,
  recorded_at_ms INTEGER NOT NULL CHECK(recorded_at_ms>=0),
  dataset_digest TEXT NOT NULL CHECK(length(dataset_digest)=64),
  membership_digest TEXT NOT NULL CHECK(length(membership_digest)=64),
  constraints_digest TEXT NOT NULL CHECK(length(constraints_digest)=64),
  result_digest TEXT NOT NULL CHECK(length(result_digest)=64),
  request_digest TEXT NOT NULL CHECK(length(request_digest)=64),
  payload_digest TEXT NOT NULL CHECK(length(payload_digest)=64),
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576)
);
CREATE TRIGGER IF NOT EXISTS evaluation_comparison_snapshot_update BEFORE UPDATE ON evaluation_comparison_snapshot
BEGIN SELECT RAISE(ABORT,'evaluation comparison snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_comparison_snapshot_delete BEFORE DELETE ON evaluation_comparison_snapshot
BEGIN SELECT RAISE(ABORT,'evaluation comparison snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_comparison_snapshot_replace BEFORE INSERT ON evaluation_comparison_snapshot
WHEN EXISTS(SELECT 1 FROM evaluation_comparison_snapshot WHERE snapshot_id=NEW.snapshot_id)
BEGIN SELECT RAISE(ABORT,'evaluation comparison snapshot immutable'); END;
