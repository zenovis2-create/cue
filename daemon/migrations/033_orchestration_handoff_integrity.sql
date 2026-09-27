CREATE TABLE IF NOT EXISTS orchestration_handoff_integrity_migration (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  version TEXT NOT NULL CHECK(version='cue-handoff-integrity-v1')
);
CREATE TABLE IF NOT EXISTS orchestration_handoff_integrity_legacy (
  attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id),
  reason TEXT NOT NULL CHECK(reason='pre-current-handoff-integrity-unavailable')
);

INSERT INTO orchestration_handoff_integrity_legacy
  SELECT attempt_id,'pre-current-handoff-integrity-unavailable' FROM orchestration_attempt
  WHERE NOT EXISTS(SELECT 1 FROM orchestration_handoff_integrity_migration);
INSERT INTO orchestration_handoff_integrity_migration SELECT 1,'cue-handoff-integrity-v1'
  WHERE NOT EXISTS(SELECT 1 FROM orchestration_handoff_integrity_migration);

CREATE TRIGGER IF NOT EXISTS handoff_integrity_migration_no_update BEFORE UPDATE ON orchestration_handoff_integrity_migration BEGIN SELECT RAISE(ABORT,'handoff integrity migration immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_integrity_migration_no_delete BEFORE DELETE ON orchestration_handoff_integrity_migration BEGIN SELECT RAISE(ABORT,'handoff integrity migration immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_integrity_migration_no_replace BEFORE INSERT ON orchestration_handoff_integrity_migration WHEN EXISTS(SELECT 1 FROM orchestration_handoff_integrity_migration) BEGIN SELECT RAISE(ABORT,'handoff integrity migration immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_integrity_legacy_no_update BEFORE UPDATE ON orchestration_handoff_integrity_legacy BEGIN SELECT RAISE(ABORT,'handoff integrity legacy immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_integrity_legacy_no_delete BEFORE DELETE ON orchestration_handoff_integrity_legacy BEGIN SELECT RAISE(ABORT,'handoff integrity legacy immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_integrity_legacy_no_insert BEFORE INSERT ON orchestration_handoff_integrity_legacy BEGIN SELECT RAISE(ABORT,'handoff integrity legacy membership closed'); END;

CREATE TRIGGER IF NOT EXISTS launch_intent_current_hash BEFORE INSERT ON orchestration_launch_intent
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256
BEGIN SELECT RAISE(ABORT,'launch intent payload hash mismatch'); END;
CREATE TRIGGER IF NOT EXISTS attempt_identity_current_hash BEFORE INSERT ON orchestration_attempt_identity
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256
BEGIN SELECT RAISE(ABORT,'attempt identity payload hash mismatch'); END;
CREATE TRIGGER IF NOT EXISTS handoff_current_hash BEFORE INSERT ON orchestration_handoff
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256
BEGIN SELECT RAISE(ABORT,'handoff payload hash mismatch'); END;
CREATE TRIGGER IF NOT EXISTS handoff_current_attempt BEFORE INSERT ON orchestration_handoff
WHEN EXISTS(SELECT 1 FROM orchestration_handoff_integrity_legacy WHERE attempt_id=NEW.attempt_id)
BEGIN SELECT RAISE(ABORT,'legacy handoff integrity unavailable'); END;

CREATE TRIGGER IF NOT EXISTS attempt_terminal_current_integrity BEFORE UPDATE OF state ON orchestration_attempt
WHEN NEW.state IN ('completed','failed') AND OLD.state<>NEW.state AND (
  EXISTS(SELECT 1 FROM orchestration_handoff_integrity_legacy WHERE attempt_id=NEW.attempt_id)
  OR NOT EXISTS(
    SELECT 1 FROM orchestration_handoff h
    JOIN orchestration_launch_intent l ON l.attempt_id=h.attempt_id
    JOIN orchestration_attempt_identity i ON i.identity_id=h.identity_id AND i.attempt_id=h.attempt_id
    JOIN orchestration_receipt r ON r.receipt_id=h.receipt_id AND r.attempt_id=h.attempt_id AND r.revision=h.receipt_revision
    WHERE h.attempt_id=NEW.attempt_id
      AND cue_sha256(l.payload)=l.payload_sha256
      AND cue_sha256(i.payload)=i.payload_sha256
      AND cue_sha256(h.payload)=h.payload_sha256
      AND h.outcome=CASE NEW.state WHEN 'completed' THEN 'succeeded' ELSE 'failed' END
      AND h.cleanup='clean'
      AND json_extract(r.payload,'$.attemptId')=NEW.attempt_id
      AND json_extract(r.payload,'$.receiptId')=h.receipt_id
      AND json_extract(r.payload,'$.revision')=h.receipt_revision
      AND json_extract(r.payload,'$.outcome')=h.outcome
      AND json_extract(r.payload,'$.cleanup')='clean'
      AND h.receipt_revision=(SELECT MAX(revision) FROM orchestration_receipt WHERE attempt_id=NEW.attempt_id)
      AND cue_handoff_terminal_authorized(NEW.attempt_id,h.payload_sha256)=1
  )
)
BEGIN SELECT RAISE(ABORT,'terminal handoff integrity unavailable'); END;
