CREATE TABLE native_runtime_receipt_migration(
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  version TEXT NOT NULL CHECK(version='cue-native-runtime-receipt-v1')
);
INSERT INTO native_runtime_receipt_migration VALUES(1,'cue-native-runtime-receipt-v1');

CREATE TABLE native_runtime_receipt(
  receipt_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL UNIQUE,
  candidate_id TEXT NOT NULL,
  subject_digest TEXT NOT NULL CHECK(length(subject_digest)=64 AND subject_digest NOT GLOB '*[^a-f0-9]*'),
  session_handle TEXT NOT NULL UNIQUE,
  outcome TEXT NOT NULL CHECK(outcome IN('succeeded','failed')),
  payload_digest TEXT NOT NULL UNIQUE CHECK(length(payload_digest)=64 AND payload_digest NOT GLOB '*[^a-f0-9]*'),
  payload BLOB NOT NULL CHECK(length(payload) BETWEEN 1 AND 65536),
  FOREIGN KEY(attempt_id) REFERENCES orchestration_attempt(attempt_id),
  FOREIGN KEY(session_handle) REFERENCES session_handle(handle)
);

CREATE TRIGGER native_runtime_receipt_insert_guard BEFORE INSERT ON native_runtime_receipt BEGIN
  SELECT CASE WHEN cue_sha256(NEW.payload)<>NEW.payload_digest THEN RAISE(ABORT,'native_runtime_receipt_digest') END;
  SELECT CASE WHEN cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT) THEN RAISE(ABORT,'native_runtime_receipt_canonical') END;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM orchestration_attempt a JOIN orchestration_step s ON s.run_id=a.run_id AND s.task_id=a.task_id
    JOIN orchestration_stage_envelope e ON e.attempt_id=a.attempt_id
    JOIN session_handle h ON h.handle=NEW.session_handle AND h.run_id=e.attempt_id AND h.task_id=e.stage_task_id
    WHERE a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND a.task_id=NEW.task_id AND a.candidate_id=NEW.candidate_id
  ) THEN RAISE(ABORT,'native_runtime_receipt_lineage') END;
END;
CREATE TRIGGER native_runtime_receipt_no_update BEFORE UPDATE ON native_runtime_receipt BEGIN SELECT RAISE(ABORT,'native_runtime_receipt_immutable'); END;
CREATE TRIGGER native_runtime_receipt_no_delete BEFORE DELETE ON native_runtime_receipt BEGIN SELECT RAISE(ABORT,'native_runtime_receipt_immutable'); END;
CREATE TRIGGER native_runtime_receipt_no_replace BEFORE INSERT ON native_runtime_receipt
WHEN EXISTS(SELECT 1 FROM native_runtime_receipt WHERE attempt_id=NEW.attempt_id OR receipt_id=NEW.receipt_id OR session_handle=NEW.session_handle)
BEGIN SELECT RAISE(ABORT,'native_runtime_receipt_immutable'); END;

CREATE TRIGGER native_runtime_receipt_migration_no_update BEFORE UPDATE ON native_runtime_receipt_migration BEGIN SELECT RAISE(ABORT,'native_runtime_receipt_migration_immutable'); END;
CREATE TRIGGER native_runtime_receipt_migration_no_delete BEFORE DELETE ON native_runtime_receipt_migration BEGIN SELECT RAISE(ABORT,'native_runtime_receipt_migration_immutable'); END;
CREATE TRIGGER native_runtime_receipt_migration_no_replace BEFORE INSERT ON native_runtime_receipt_migration
WHEN EXISTS(SELECT 1 FROM native_runtime_receipt_migration WHERE singleton=NEW.singleton)
BEGIN SELECT RAISE(ABORT,'native_runtime_receipt_migration_immutable'); END;
