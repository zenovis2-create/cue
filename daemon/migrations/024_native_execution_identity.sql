CREATE TABLE IF NOT EXISTS native_execution_identity (
  sha256 TEXT PRIMARY KEY CHECK(length(sha256)=64),
  run_id TEXT NOT NULL REFERENCES run(id),
  session_handle TEXT NOT NULL UNIQUE REFERENCES session_handle(handle),
  candidate_id TEXT NOT NULL CHECK(length(candidate_id) BETWEEN 1 AND 200),
  subject_digest TEXT NOT NULL CHECK(length(subject_digest)=64),
  payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 16384)
);
CREATE INDEX IF NOT EXISTS native_execution_identity_run ON native_execution_identity(run_id);
CREATE TRIGGER IF NOT EXISTS native_identity_no_replace BEFORE INSERT ON native_execution_identity
WHEN EXISTS(SELECT 1 FROM native_execution_identity WHERE sha256=NEW.sha256 OR session_handle=NEW.session_handle)
BEGIN SELECT RAISE(ABORT,'immutable_native_identity'); END;
CREATE TRIGGER IF NOT EXISTS native_identity_no_update BEFORE UPDATE ON native_execution_identity
BEGIN SELECT RAISE(ABORT,'immutable_native_identity'); END;
CREATE TRIGGER IF NOT EXISTS native_identity_no_delete BEFORE DELETE ON native_execution_identity
BEGIN SELECT RAISE(ABORT,'immutable_native_identity'); END;
