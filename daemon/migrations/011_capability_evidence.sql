CREATE TABLE IF NOT EXISTS capability_evidence (
  id TEXT PRIMARY KEY, payload_sha256 TEXT NOT NULL,
  subject_digest TEXT NOT NULL, probe TEXT NOT NULL, measured_at TEXT NOT NULL,
  payload BLOB NOT NULL, observation BLOB NOT NULL, observation_sha256 TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS capability_evidence_subject ON capability_evidence(subject_digest,probe,measured_at);
CREATE TRIGGER IF NOT EXISTS capability_evidence_insert_guard BEFORE INSERT ON capability_evidence
WHEN EXISTS(SELECT 1 FROM capability_evidence WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT, 'immutable_capability_evidence'); END;
CREATE TRIGGER IF NOT EXISTS capability_evidence_no_update BEFORE UPDATE ON capability_evidence
BEGIN SELECT RAISE(ABORT, 'immutable_capability_evidence'); END;
CREATE TRIGGER IF NOT EXISTS capability_evidence_no_delete BEFORE DELETE ON capability_evidence
BEGIN SELECT RAISE(ABORT, 'immutable_capability_evidence'); END;
