CREATE TABLE IF NOT EXISTS acceptance_blob (sha256 TEXT PRIMARY KEY, bytes BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS acceptance_evaluation (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES run(id), payload TEXT NOT NULL, payload_sha256 TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS acceptance_final (
  run_id TEXT PRIMARY KEY REFERENCES run(id), evaluation_id TEXT NOT NULL UNIQUE REFERENCES acceptance_evaluation(id),
  payload TEXT NOT NULL, payload_sha256 TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS acceptance_blob_no_replace BEFORE INSERT ON acceptance_blob WHEN EXISTS(SELECT 1 FROM acceptance_blob WHERE sha256=NEW.sha256)
BEGIN SELECT RAISE(ABORT, 'immutable_acceptance_blob'); END;
CREATE TRIGGER IF NOT EXISTS acceptance_blob_no_update BEFORE UPDATE ON acceptance_blob BEGIN SELECT RAISE(ABORT, 'immutable_acceptance_blob'); END;
CREATE TRIGGER IF NOT EXISTS acceptance_blob_no_delete BEFORE DELETE ON acceptance_blob BEGIN SELECT RAISE(ABORT, 'immutable_acceptance_blob'); END;
CREATE TRIGGER IF NOT EXISTS acceptance_evaluation_no_replace BEFORE INSERT ON acceptance_evaluation WHEN EXISTS(SELECT 1 FROM acceptance_evaluation WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT, 'immutable_acceptance_evaluation'); END;
CREATE TRIGGER IF NOT EXISTS acceptance_evaluation_no_update BEFORE UPDATE ON acceptance_evaluation BEGIN SELECT RAISE(ABORT, 'immutable_acceptance_evaluation'); END;
CREATE TRIGGER IF NOT EXISTS acceptance_evaluation_no_delete BEFORE DELETE ON acceptance_evaluation BEGIN SELECT RAISE(ABORT, 'immutable_acceptance_evaluation'); END;
CREATE TRIGGER IF NOT EXISTS acceptance_final_no_replace BEFORE INSERT ON acceptance_final WHEN EXISTS(SELECT 1 FROM acceptance_final WHERE run_id=NEW.run_id OR evaluation_id=NEW.evaluation_id)
BEGIN SELECT RAISE(ABORT, 'immutable_acceptance_final'); END;
CREATE TRIGGER IF NOT EXISTS acceptance_final_no_update BEFORE UPDATE ON acceptance_final BEGIN SELECT RAISE(ABORT, 'immutable_acceptance_final'); END;
CREATE TRIGGER IF NOT EXISTS acceptance_final_no_delete BEFORE DELETE ON acceptance_final BEGIN SELECT RAISE(ABORT, 'immutable_acceptance_final'); END;
