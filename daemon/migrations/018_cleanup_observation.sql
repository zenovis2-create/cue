CREATE TABLE IF NOT EXISTS cleanup_observation (
  sha256 TEXT PRIMARY KEY CHECK(length(sha256)=64),
  run_id TEXT NOT NULL REFERENCES run(id),
  subject_digest TEXT NOT NULL CHECK(length(subject_digest)=64),
  session_handle TEXT REFERENCES session_handle(handle),
  payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 65536)
);
CREATE INDEX IF NOT EXISTS cleanup_observation_run ON cleanup_observation(run_id);
CREATE TRIGGER IF NOT EXISTS cleanup_observation_insert_guard BEFORE INSERT ON cleanup_observation
WHEN EXISTS(SELECT 1 FROM cleanup_observation WHERE sha256=NEW.sha256)
BEGIN SELECT RAISE(ABORT, 'immutable_cleanup_observation'); END;
CREATE TRIGGER IF NOT EXISTS cleanup_observation_no_update BEFORE UPDATE ON cleanup_observation
BEGIN SELECT RAISE(ABORT, 'immutable_cleanup_observation'); END;
CREATE TRIGGER IF NOT EXISTS cleanup_observation_no_delete BEFORE DELETE ON cleanup_observation
BEGIN SELECT RAISE(ABORT, 'immutable_cleanup_observation'); END;
