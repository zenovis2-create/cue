CREATE TABLE IF NOT EXISTS attempt_selection_migration (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1), version TEXT NOT NULL CHECK(version='cue-attempt-selection-v1')
);
CREATE TABLE IF NOT EXISTS attempt_selection_legacy (
  attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id)
);
CREATE TRIGGER IF NOT EXISTS attempt_selection_legacy_sealed BEFORE INSERT ON attempt_selection_legacy
WHEN EXISTS(SELECT 1 FROM attempt_selection_migration) OR (SELECT count(*) FROM attempt_selection_legacy)>=100000
BEGIN SELECT RAISE(ABORT,'attempt selection legacy sealed'); END;
INSERT INTO attempt_selection_legacy SELECT attempt_id FROM orchestration_attempt
WHERE NOT EXISTS(SELECT 1 FROM attempt_selection_migration);
INSERT INTO attempt_selection_migration SELECT 1,'cue-attempt-selection-v1'
WHERE NOT EXISTS(SELECT 1 FROM attempt_selection_migration);
CREATE TRIGGER IF NOT EXISTS attempt_selection_marker_update BEFORE UPDATE ON attempt_selection_migration
BEGIN SELECT RAISE(ABORT,'attempt selection marker immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_selection_marker_delete BEFORE DELETE ON attempt_selection_migration
BEGIN SELECT RAISE(ABORT,'attempt selection marker immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_selection_marker_replace BEFORE INSERT ON attempt_selection_migration
WHEN EXISTS(SELECT 1 FROM attempt_selection_migration)
BEGIN SELECT RAISE(ABORT,'attempt selection marker immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_selection_legacy_update BEFORE UPDATE ON attempt_selection_legacy
BEGIN SELECT RAISE(ABORT,'attempt selection legacy immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_selection_legacy_delete BEFORE DELETE ON attempt_selection_legacy
BEGIN SELECT RAISE(ABORT,'attempt selection legacy immutable'); END;
CREATE TABLE IF NOT EXISTS attempt_selection (
  attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id), run_id TEXT NOT NULL REFERENCES run(id),
  request_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('monetary','local-invocation')),
  digest TEXT NOT NULL CHECK(length(digest)=64), payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576)
);
CREATE TRIGGER IF NOT EXISTS attempt_selection_update BEFORE UPDATE ON attempt_selection
BEGIN SELECT RAISE(ABORT,'attempt selection immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_selection_delete BEFORE DELETE ON attempt_selection
BEGIN SELECT RAISE(ABORT,'attempt selection immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_selection_replace BEFORE INSERT ON attempt_selection
WHEN EXISTS(SELECT 1 FROM attempt_selection WHERE attempt_id=NEW.attempt_id)
BEGIN SELECT RAISE(ABORT,'attempt selection immutable'); END;
