CREATE TABLE IF NOT EXISTS orchestration_handoff_migration (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1), version TEXT NOT NULL CHECK(version='cue-handoff-activity-v1')
);
CREATE TABLE IF NOT EXISTS orchestration_handoff_legacy (
  attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id), reason TEXT NOT NULL CHECK(reason='legacy-handoff-unavailable')
);
INSERT INTO orchestration_handoff_legacy
  SELECT attempt_id,'legacy-handoff-unavailable' FROM orchestration_attempt
  WHERE NOT EXISTS(SELECT 1 FROM orchestration_handoff_migration);
INSERT INTO orchestration_handoff_migration SELECT 1,'cue-handoff-activity-v1'
  WHERE NOT EXISTS(SELECT 1 FROM orchestration_handoff_migration);

CREATE TABLE IF NOT EXISTS orchestration_launch_intent (
  attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id),
  run_id TEXT NOT NULL, task_id TEXT NOT NULL, candidate_id TEXT NOT NULL,
  selection_digest TEXT NOT NULL CHECK(length(selection_digest)=64),
  expected_subject_digest TEXT NOT NULL CHECK(length(expected_subject_digest)=64),
  tool_id TEXT NOT NULL, tool_revision TEXT NOT NULL,
  model_id TEXT, model_revision TEXT,
  parent_envelope_hash TEXT NOT NULL CHECK(length(parent_envelope_hash)=64),
  stage_envelope_hash TEXT NOT NULL CHECK(length(stage_envelope_hash)=64),
  plan_digest TEXT NOT NULL CHECK(length(plan_digest)=64), policy_digest TEXT NOT NULL CHECK(length(policy_digest)=64),
  payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64), payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 32768),
  FOREIGN KEY(run_id,task_id) REFERENCES orchestration_step(run_id,task_id)
);
CREATE TABLE IF NOT EXISTS orchestration_attempt_identity (
  identity_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE REFERENCES orchestration_launch_intent(attempt_id),
  subject_digest TEXT NOT NULL CHECK(length(subject_digest)=64), durable_ref TEXT NOT NULL CHECK(length(durable_ref) BETWEEN 9 AND 128),
  observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0),
  payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64), payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 16384)
);
CREATE TABLE IF NOT EXISTS orchestration_handoff (
  handoff_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE REFERENCES orchestration_attempt(attempt_id),
  receipt_id TEXT NOT NULL UNIQUE REFERENCES orchestration_receipt(receipt_id) DEFERRABLE INITIALLY DEFERRED,
  receipt_revision INTEGER NOT NULL CHECK(receipt_revision>=0),
  identity_id TEXT NOT NULL REFERENCES orchestration_attempt_identity(identity_id),
  outcome TEXT NOT NULL CHECK(outcome IN ('succeeded','failed')), cleanup TEXT NOT NULL CHECK(cleanup='clean'),
  payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64), payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576)
);
CREATE TABLE IF NOT EXISTS orchestration_handoff_artifact (
  handoff_id TEXT NOT NULL REFERENCES orchestration_handoff(handoff_id) DEFERRABLE INITIALLY DEFERRED,
  ordinal INTEGER NOT NULL CHECK(ordinal>=0), attempt_id TEXT NOT NULL REFERENCES orchestration_attempt(attempt_id),
  kind TEXT NOT NULL CHECK(length(kind) BETWEEN 1 AND 128), source_ref TEXT NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 128),
  sha256 TEXT NOT NULL CHECK(length(sha256)=64), byte_length INTEGER NOT NULL CHECK(byte_length>=0),
  PRIMARY KEY(handoff_id,ordinal), UNIQUE(handoff_id,source_ref)
);

CREATE TRIGGER IF NOT EXISTS handoff_migration_no_update BEFORE UPDATE ON orchestration_handoff_migration BEGIN SELECT RAISE(ABORT,'handoff migration immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_migration_no_delete BEFORE DELETE ON orchestration_handoff_migration BEGIN SELECT RAISE(ABORT,'handoff migration immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_migration_no_replace BEFORE INSERT ON orchestration_handoff_migration WHEN EXISTS(SELECT 1 FROM orchestration_handoff_migration) BEGIN SELECT RAISE(ABORT,'handoff migration immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_legacy_no_update BEFORE UPDATE ON orchestration_handoff_legacy BEGIN SELECT RAISE(ABORT,'legacy handoff immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_legacy_no_delete BEFORE DELETE ON orchestration_handoff_legacy BEGIN SELECT RAISE(ABORT,'legacy handoff immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_legacy_no_insert BEFORE INSERT ON orchestration_handoff_legacy BEGIN SELECT RAISE(ABORT,'legacy handoff membership closed'); END;
CREATE TRIGGER IF NOT EXISTS launch_intent_no_update BEFORE UPDATE ON orchestration_launch_intent BEGIN SELECT RAISE(ABORT,'launch intent immutable'); END;
CREATE TRIGGER IF NOT EXISTS launch_intent_no_delete BEFORE DELETE ON orchestration_launch_intent BEGIN SELECT RAISE(ABORT,'launch intent immutable'); END;
CREATE TRIGGER IF NOT EXISTS launch_intent_no_replace BEFORE INSERT ON orchestration_launch_intent WHEN EXISTS(SELECT 1 FROM orchestration_launch_intent WHERE attempt_id=NEW.attempt_id OR payload_sha256=NEW.payload_sha256) BEGIN SELECT RAISE(ABORT,'launch intent immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_identity_no_update BEFORE UPDATE ON orchestration_attempt_identity BEGIN SELECT RAISE(ABORT,'attempt identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_identity_no_delete BEFORE DELETE ON orchestration_attempt_identity BEGIN SELECT RAISE(ABORT,'attempt identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_identity_no_replace BEFORE INSERT ON orchestration_attempt_identity WHEN EXISTS(SELECT 1 FROM orchestration_attempt_identity WHERE identity_id=NEW.identity_id OR attempt_id=NEW.attempt_id OR payload_sha256=NEW.payload_sha256) BEGIN SELECT RAISE(ABORT,'attempt identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS attempt_identity_exact_durable BEFORE INSERT ON orchestration_attempt_identity
WHEN json_valid(NEW.payload)<>1 OR json_type(NEW.payload,'$')<>'object' OR (SELECT COUNT(*) FROM json_each(NEW.payload))<>5
 OR EXISTS(SELECT 1 FROM json_each(NEW.payload) WHERE key NOT IN ('identityId','attemptId','subjectDigest','durableRef','observedAtMs'))
 OR json_extract(NEW.payload,'$.identityId')<>NEW.identity_id OR json_extract(NEW.payload,'$.attemptId')<>NEW.attempt_id
 OR json_extract(NEW.payload,'$.subjectDigest')<>NEW.subject_digest OR json_extract(NEW.payload,'$.durableRef')<>NEW.durable_ref
 OR json_extract(NEW.payload,'$.observedAtMs')<>NEW.observed_at_ms OR NEW.durable_ref NOT LIKE 'session:%'
 OR NOT EXISTS(SELECT 1 FROM session_handle s JOIN orchestration_attempt a ON a.attempt_id=NEW.attempt_id
   WHERE s.handle=substr(NEW.durable_ref,9) AND s.run_id=NEW.attempt_id AND a.candidate_id=(SELECT candidate_id FROM orchestration_launch_intent WHERE attempt_id=NEW.attempt_id))
BEGIN SELECT RAISE(ABORT,'attempt identity durable lineage required'); END;
CREATE TRIGGER IF NOT EXISTS handoff_no_update BEFORE UPDATE ON orchestration_handoff BEGIN SELECT RAISE(ABORT,'handoff immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_no_delete BEFORE DELETE ON orchestration_handoff BEGIN SELECT RAISE(ABORT,'handoff immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_no_replace BEFORE INSERT ON orchestration_handoff WHEN EXISTS(SELECT 1 FROM orchestration_handoff WHERE handoff_id=NEW.handoff_id OR attempt_id=NEW.attempt_id OR receipt_id=NEW.receipt_id OR payload_sha256=NEW.payload_sha256) BEGIN SELECT RAISE(ABORT,'handoff immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_artifact_no_update BEFORE UPDATE ON orchestration_handoff_artifact BEGIN SELECT RAISE(ABORT,'handoff artifact immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_artifact_no_delete BEFORE DELETE ON orchestration_handoff_artifact BEGIN SELECT RAISE(ABORT,'handoff artifact immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_artifact_no_replace BEFORE INSERT ON orchestration_handoff_artifact
WHEN EXISTS(SELECT 1 FROM orchestration_handoff_artifact WHERE handoff_id=NEW.handoff_id AND (ordinal=NEW.ordinal OR source_ref=NEW.source_ref))
BEGIN SELECT RAISE(ABORT,'handoff artifact immutable'); END;
CREATE TRIGGER IF NOT EXISTS handoff_artifact_exact_member BEFORE INSERT ON orchestration_handoff_artifact
WHEN NOT EXISTS(SELECT 1 FROM orchestration_handoff h WHERE h.handoff_id=NEW.handoff_id AND h.attempt_id=NEW.attempt_id
  AND NEW.ordinal<json_array_length(h.payload,'$.artifacts')
  AND json_extract(h.payload,'$.artifacts['||NEW.ordinal||'].kind')=NEW.kind
  AND json_extract(h.payload,'$.artifacts['||NEW.ordinal||'].sourceRef')=NEW.source_ref
  AND json_extract(h.payload,'$.artifacts['||NEW.ordinal||'].sha256')=NEW.sha256
  AND json_extract(h.payload,'$.artifacts['||NEW.ordinal||'].byteLength')=NEW.byte_length)
BEGIN SELECT RAISE(ABORT,'handoff artifact member mismatch'); END;
CREATE TRIGGER IF NOT EXISTS handoff_exact_lineage BEFORE INSERT ON orchestration_handoff
WHEN json_valid(NEW.payload)<>1 OR json_type(NEW.payload,'$')<>'object'
 OR (SELECT COUNT(*) FROM json_each(NEW.payload))<>9
 OR EXISTS(SELECT 1 FROM json_each(NEW.payload) WHERE key NOT IN ('schemaVersion','handoffId','attemptId','receiptId','receiptRevision','identityId','outcome','cleanup','artifacts'))
 OR json_extract(NEW.payload,'$.schemaVersion')<>'cue-handoff-v1'
 OR json_extract(NEW.payload,'$.handoffId')<>NEW.handoff_id OR json_extract(NEW.payload,'$.attemptId')<>NEW.attempt_id
 OR json_extract(NEW.payload,'$.receiptId')<>NEW.receipt_id OR json_extract(NEW.payload,'$.receiptRevision')<>NEW.receipt_revision
 OR json_extract(NEW.payload,'$.identityId')<>NEW.identity_id OR json_extract(NEW.payload,'$.outcome')<>NEW.outcome
 OR json_extract(NEW.payload,'$.cleanup')<>NEW.cleanup OR json_type(NEW.payload,'$.artifacts')<>'array'
 OR json_array_length(NEW.payload,'$.artifacts')<1 OR json_array_length(NEW.payload,'$.artifacts')>128
 OR EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.artifacts') a
   WHERE json_type(a.value,'$')<>'object' OR (SELECT COUNT(*) FROM json_each(a.value))<>4
     OR EXISTS(SELECT 1 FROM json_each(a.value) WHERE key NOT IN ('kind','sourceRef','sha256','byteLength'))
     OR json_type(a.value,'$.kind')<>'text' OR json_type(a.value,'$.sourceRef')<>'text' OR json_type(a.value,'$.sha256')<>'text' OR json_type(a.value,'$.byteLength')<>'integer'
     OR length(json_extract(a.value,'$.kind')) NOT BETWEEN 1 AND 128 OR length(json_extract(a.value,'$.sourceRef')) NOT BETWEEN 1 AND 128
     OR length(json_extract(a.value,'$.sha256'))<>64 OR json_extract(a.value,'$.byteLength')<0)
 OR NOT EXISTS(
  SELECT 1 FROM orchestration_receipt r
  JOIN orchestration_attempt_identity i ON i.identity_id=NEW.identity_id AND i.attempt_id=NEW.attempt_id
  JOIN orchestration_launch_intent l ON l.attempt_id=NEW.attempt_id
  WHERE r.receipt_id=NEW.receipt_id AND r.attempt_id=NEW.attempt_id AND r.revision=NEW.receipt_revision
    AND json_extract(r.payload,'$.attemptId')=NEW.attempt_id
    AND json_extract(r.payload,'$.receiptId')=NEW.receipt_id
    AND json_extract(r.payload,'$.revision')=NEW.receipt_revision
    AND json_extract(r.payload,'$.outcome')=NEW.outcome
    AND json_extract(r.payload,'$.cleanup')='clean'
)
BEGIN SELECT RAISE(ABORT,'handoff exact lineage required'); END;
CREATE TRIGGER IF NOT EXISTS attempt_terminal_requires_handoff BEFORE UPDATE OF state ON orchestration_attempt
WHEN NEW.state IN ('completed','failed') AND NOT EXISTS(SELECT 1 FROM orchestration_handoff h JOIN orchestration_receipt r ON r.receipt_id=h.receipt_id
    WHERE h.attempt_id=NEW.attempt_id AND r.attempt_id=NEW.attempt_id AND r.revision=h.receipt_revision
      AND h.outcome=CASE NEW.state WHEN 'completed' THEN 'succeeded' ELSE 'failed' END
      AND json_extract(r.payload,'$.outcome')=h.outcome
      AND h.receipt_revision=(SELECT MAX(revision) FROM orchestration_receipt WHERE attempt_id=NEW.attempt_id)
      AND (SELECT COUNT(*) FROM orchestration_handoff_artifact x WHERE x.handoff_id=h.handoff_id)=json_array_length(h.payload,'$.artifacts')
      AND NOT EXISTS(SELECT 1 FROM json_each(h.payload,'$.artifacts') a
        WHERE NOT EXISTS(SELECT 1 FROM orchestration_handoff_artifact x WHERE x.handoff_id=h.handoff_id AND x.ordinal=CAST(a.key AS INTEGER)
          AND x.attempt_id=h.attempt_id AND x.kind=json_extract(a.value,'$.kind') AND x.source_ref=json_extract(a.value,'$.sourceRef')
          AND x.sha256=json_extract(a.value,'$.sha256') AND x.byte_length=json_extract(a.value,'$.byteLength'))))
BEGIN SELECT RAISE(ABORT,'terminal handoff required'); END;
