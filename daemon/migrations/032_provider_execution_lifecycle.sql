CREATE TABLE IF NOT EXISTS provider_lifecycle_migration (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  version TEXT NOT NULL CHECK(version='cue-provider-lifecycle-v1')
);
CREATE TABLE IF NOT EXISTS provider_lifecycle_legacy (
  attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id),
  reason TEXT NOT NULL CHECK(reason='legacy-provider-lifecycle-unavailable')
);
INSERT INTO provider_lifecycle_legacy
  SELECT attempt_id,'legacy-provider-lifecycle-unavailable' FROM orchestration_attempt
  WHERE NOT EXISTS(SELECT 1 FROM provider_lifecycle_migration);
INSERT INTO provider_lifecycle_migration SELECT 1,'cue-provider-lifecycle-v1'
  WHERE NOT EXISTS(SELECT 1 FROM provider_lifecycle_migration);

CREATE TABLE IF NOT EXISTS provider_lifecycle_event (
  event_id TEXT PRIMARY KEY CHECK(length(event_id) BETWEEN 1 AND 128),
  run_id TEXT NOT NULL CHECK(length(run_id) BETWEEN 1 AND 128),
  task_id TEXT NOT NULL CHECK(length(task_id) BETWEEN 1 AND 128),
  attempt_id TEXT NOT NULL REFERENCES orchestration_attempt(attempt_id),
  candidate_id TEXT NOT NULL CHECK(length(candidate_id) BETWEEN 1 AND 128),
  ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 1 AND 1000000),
  kind TEXT NOT NULL CHECK(kind IN ('cancel-requested','client-cancel-acknowledged','provider-terminal','local-controller-observed','local-tree-observed','cleanup-observed','billing-finalized','lifecycle-sealed')),
  observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms BETWEEN 0 AND 8640000000000000),
  status TEXT,
  evidence_digest TEXT CHECK(evidence_digest IS NULL OR length(evidence_digest)=64),
  provider_receipt_digest TEXT CHECK(provider_receipt_digest IS NULL OR length(provider_receipt_digest)=64),
  payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64),
  payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 16384),
  UNIQUE(attempt_id,ordinal),
  FOREIGN KEY(run_id,task_id) REFERENCES orchestration_step(run_id,task_id)
);
CREATE INDEX IF NOT EXISTS provider_lifecycle_event_attempt ON provider_lifecycle_event(attempt_id,ordinal);

CREATE TABLE IF NOT EXISTS provider_subtask_binding (
  binding_id TEXT PRIMARY KEY CHECK(length(binding_id) BETWEEN 1 AND 128),
  run_id TEXT NOT NULL CHECK(length(run_id) BETWEEN 1 AND 128),
  task_id TEXT NOT NULL CHECK(length(task_id) BETWEEN 1 AND 128),
  attempt_id TEXT NOT NULL REFERENCES orchestration_attempt(attempt_id),
  candidate_id TEXT NOT NULL CHECK(length(candidate_id) BETWEEN 1 AND 128),
  event_id TEXT NOT NULL REFERENCES provider_lifecycle_event(event_id),
  ref_type TEXT NOT NULL CHECK(ref_type IN ('thread','turn','subtask')),
  label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 128),
  reference_digest TEXT NOT NULL UNIQUE CHECK(length(reference_digest)=64),
  payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64),
  payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 8192),
  FOREIGN KEY(run_id,task_id) REFERENCES orchestration_step(run_id,task_id)
);
CREATE INDEX IF NOT EXISTS provider_subtask_binding_attempt ON provider_subtask_binding(attempt_id,event_id);

CREATE TRIGGER IF NOT EXISTS provider_lifecycle_migration_no_update BEFORE UPDATE ON provider_lifecycle_migration BEGIN SELECT RAISE(ABORT,'provider lifecycle migration immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_lifecycle_migration_no_delete BEFORE DELETE ON provider_lifecycle_migration BEGIN SELECT RAISE(ABORT,'provider lifecycle migration immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_lifecycle_migration_no_replace BEFORE INSERT ON provider_lifecycle_migration WHEN EXISTS(SELECT 1 FROM provider_lifecycle_migration) BEGIN SELECT RAISE(ABORT,'provider lifecycle migration immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_lifecycle_legacy_no_update BEFORE UPDATE ON provider_lifecycle_legacy BEGIN SELECT RAISE(ABORT,'provider lifecycle legacy immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_lifecycle_legacy_no_delete BEFORE DELETE ON provider_lifecycle_legacy BEGIN SELECT RAISE(ABORT,'provider lifecycle legacy immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_lifecycle_legacy_no_insert BEFORE INSERT ON provider_lifecycle_legacy BEGIN SELECT RAISE(ABORT,'provider lifecycle legacy membership closed'); END;
CREATE TRIGGER IF NOT EXISTS provider_lifecycle_event_no_update BEFORE UPDATE ON provider_lifecycle_event BEGIN SELECT RAISE(ABORT,'provider lifecycle event immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_lifecycle_event_no_delete BEFORE DELETE ON provider_lifecycle_event BEGIN SELECT RAISE(ABORT,'provider lifecycle event immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_lifecycle_event_no_replace BEFORE INSERT ON provider_lifecycle_event
WHEN EXISTS(SELECT 1 FROM provider_lifecycle_event WHERE event_id=NEW.event_id OR payload_sha256=NEW.payload_sha256 OR (attempt_id=NEW.attempt_id AND ordinal=NEW.ordinal))
BEGIN SELECT RAISE(ABORT,'provider lifecycle event immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_lifecycle_event_exact BEFORE INSERT ON provider_lifecycle_event
WHEN json_valid(NEW.payload)<>1 OR json_type(NEW.payload,'$')<>'object'
 OR cue_sha256(NEW.payload)<>NEW.payload_sha256
 OR (SELECT COUNT(*) FROM json_each(NEW.payload))<>10
 OR EXISTS(SELECT 1 FROM json_each(NEW.payload) WHERE key NOT IN ('schemaVersion','runId','taskId','attemptId','candidateId','eventId','ordinal','kind','observedAtMs','data'))
 OR json_extract(NEW.payload,'$.schemaVersion')<>'cue-provider-lifecycle-event-v1'
 OR json_extract(NEW.payload,'$.runId')<>NEW.run_id OR json_extract(NEW.payload,'$.taskId')<>NEW.task_id
 OR json_extract(NEW.payload,'$.attemptId')<>NEW.attempt_id OR json_extract(NEW.payload,'$.candidateId')<>NEW.candidate_id
 OR json_extract(NEW.payload,'$.eventId')<>NEW.event_id OR json_extract(NEW.payload,'$.ordinal')<>NEW.ordinal
 OR json_extract(NEW.payload,'$.kind')<>NEW.kind OR json_extract(NEW.payload,'$.observedAtMs')<>NEW.observed_at_ms
 OR json_type(NEW.payload,'$.data')<>'object'
 OR NOT EXISTS(SELECT 1 FROM orchestration_attempt a WHERE a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND a.task_id=NEW.task_id AND a.candidate_id=NEW.candidate_id)
 OR EXISTS(SELECT 1 FROM provider_lifecycle_legacy WHERE attempt_id=NEW.attempt_id)
 OR NEW.ordinal<>COALESCE((SELECT MAX(ordinal)+1 FROM provider_lifecycle_event WHERE attempt_id=NEW.attempt_id),1)
 OR EXISTS(SELECT 1 FROM provider_lifecycle_event WHERE attempt_id=NEW.attempt_id AND kind='lifecycle-sealed')
 OR (NEW.kind='provider-terminal' AND EXISTS(SELECT 1 FROM provider_lifecycle_event WHERE attempt_id=NEW.attempt_id AND kind='provider-terminal'))
 OR (NEW.kind='billing-finalized' AND EXISTS(SELECT 1 FROM provider_lifecycle_event WHERE attempt_id=NEW.attempt_id AND kind='billing-finalized'))
 OR (NEW.kind='client-cancel-acknowledged' AND NOT EXISTS(SELECT 1 FROM provider_lifecycle_event WHERE attempt_id=NEW.attempt_id AND kind='cancel-requested'))
 OR (NEW.kind='billing-finalized' AND NOT EXISTS(SELECT 1 FROM provider_lifecycle_event
      WHERE attempt_id=NEW.attempt_id AND kind='provider-terminal' AND provider_receipt_digest=NEW.provider_receipt_digest))
 OR CASE NEW.kind
   WHEN 'cancel-requested' THEN NEW.status IS NOT NULL OR NEW.evidence_digest IS NULL OR NEW.provider_receipt_digest IS NOT NULL
   WHEN 'client-cancel-acknowledged' THEN NEW.status IS NOT 'acknowledged' OR NEW.evidence_digest IS NOT NULL OR NEW.provider_receipt_digest IS NOT NULL
   WHEN 'provider-terminal' THEN NEW.status IS NULL OR NEW.status NOT IN ('succeeded','failed','cancelled') OR NEW.evidence_digest IS NOT NULL OR NEW.provider_receipt_digest IS NULL
   WHEN 'local-controller-observed' THEN NEW.status IS NULL OR NEW.status NOT IN ('running','stopped','unknown') OR NEW.evidence_digest IS NULL OR NEW.provider_receipt_digest IS NOT NULL
   WHEN 'local-tree-observed' THEN NEW.status IS NULL OR NEW.status NOT IN ('alive','dead','unknown') OR NEW.evidence_digest IS NULL OR NEW.provider_receipt_digest IS NOT NULL
   WHEN 'cleanup-observed' THEN NEW.status IS NULL OR NEW.status NOT IN ('clean','dirty','unknown') OR NEW.evidence_digest IS NULL OR NEW.provider_receipt_digest IS NOT NULL
   WHEN 'billing-finalized' THEN NEW.status IS NOT 'final' OR NEW.evidence_digest IS NOT NULL OR NEW.provider_receipt_digest IS NULL
   WHEN 'lifecycle-sealed' THEN NEW.status IS NOT NULL OR NEW.evidence_digest IS NOT NULL OR NEW.provider_receipt_digest IS NOT NULL
   ELSE 1 END
 OR CASE NEW.kind
   WHEN 'cancel-requested' THEN (SELECT COUNT(*) FROM json_each(NEW.payload,'$.data'))<>1
     OR EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.data') WHERE key<>'reasonDigest')
     OR json_type(NEW.payload,'$.data.reasonDigest')<>'text' OR json_extract(NEW.payload,'$.data.reasonDigest')<>NEW.evidence_digest
   WHEN 'client-cancel-acknowledged' THEN (SELECT COUNT(*) FROM json_each(NEW.payload,'$.data'))<>1
     OR EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.data') WHERE key<>'status')
     OR json_extract(NEW.payload,'$.data.status')<>NEW.status
   WHEN 'provider-terminal' THEN (SELECT COUNT(*) FROM json_each(NEW.payload,'$.data'))<>2
     OR EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.data') WHERE key NOT IN ('status','receiptDigest'))
     OR json_extract(NEW.payload,'$.data.status')<>NEW.status
     OR json_type(NEW.payload,'$.data.receiptDigest')<>'text' OR json_extract(NEW.payload,'$.data.receiptDigest')<>NEW.provider_receipt_digest
   WHEN 'local-controller-observed' THEN (SELECT COUNT(*) FROM json_each(NEW.payload,'$.data'))<>2
     OR EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.data') WHERE key NOT IN ('status','observationDigest'))
     OR json_extract(NEW.payload,'$.data.status')<>NEW.status
     OR json_type(NEW.payload,'$.data.observationDigest')<>'text' OR json_extract(NEW.payload,'$.data.observationDigest')<>NEW.evidence_digest
   WHEN 'local-tree-observed' THEN (SELECT COUNT(*) FROM json_each(NEW.payload,'$.data'))<>2
     OR EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.data') WHERE key NOT IN ('status','observationDigest'))
     OR json_extract(NEW.payload,'$.data.status')<>NEW.status
     OR json_type(NEW.payload,'$.data.observationDigest')<>'text' OR json_extract(NEW.payload,'$.data.observationDigest')<>NEW.evidence_digest
   WHEN 'cleanup-observed' THEN (SELECT COUNT(*) FROM json_each(NEW.payload,'$.data'))<>2
     OR EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.data') WHERE key NOT IN ('status','receiptDigest'))
     OR json_extract(NEW.payload,'$.data.status')<>NEW.status
     OR json_type(NEW.payload,'$.data.receiptDigest')<>'text' OR json_extract(NEW.payload,'$.data.receiptDigest')<>NEW.evidence_digest
   WHEN 'billing-finalized' THEN (SELECT COUNT(*) FROM json_each(NEW.payload,'$.data'))<>2
     OR EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.data') WHERE key NOT IN ('status','providerReceiptDigest'))
     OR json_extract(NEW.payload,'$.data.status')<>NEW.status
     OR json_type(NEW.payload,'$.data.providerReceiptDigest')<>'text' OR json_extract(NEW.payload,'$.data.providerReceiptDigest')<>NEW.provider_receipt_digest
   WHEN 'lifecycle-sealed' THEN (SELECT COUNT(*) FROM json_each(NEW.payload,'$.data'))<>0
   ELSE 1 END
BEGIN SELECT RAISE(ABORT,'provider lifecycle exact event required'); END;

CREATE TRIGGER IF NOT EXISTS provider_subtask_binding_no_update BEFORE UPDATE ON provider_subtask_binding BEGIN SELECT RAISE(ABORT,'provider reference binding immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_subtask_binding_no_delete BEFORE DELETE ON provider_subtask_binding BEGIN SELECT RAISE(ABORT,'provider reference binding immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_subtask_binding_no_replace BEFORE INSERT ON provider_subtask_binding
WHEN EXISTS(SELECT 1 FROM provider_subtask_binding WHERE binding_id=NEW.binding_id OR reference_digest=NEW.reference_digest OR payload_sha256=NEW.payload_sha256)
BEGIN SELECT RAISE(ABORT,'provider reference binding immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_subtask_binding_exact BEFORE INSERT ON provider_subtask_binding
WHEN json_valid(NEW.payload)<>1 OR json_type(NEW.payload,'$')<>'object'
 OR cue_sha256(NEW.payload)<>NEW.payload_sha256
 OR (SELECT COUNT(*) FROM json_each(NEW.payload))<>10
 OR EXISTS(SELECT 1 FROM json_each(NEW.payload) WHERE key NOT IN ('schemaVersion','bindingId','runId','taskId','attemptId','candidateId','eventId','refType','label','referenceDigest'))
 OR json_extract(NEW.payload,'$.schemaVersion')<>'cue-provider-reference-v1'
 OR json_extract(NEW.payload,'$.bindingId')<>NEW.binding_id OR json_extract(NEW.payload,'$.runId')<>NEW.run_id
 OR json_extract(NEW.payload,'$.taskId')<>NEW.task_id OR json_extract(NEW.payload,'$.attemptId')<>NEW.attempt_id
 OR json_extract(NEW.payload,'$.candidateId')<>NEW.candidate_id OR json_extract(NEW.payload,'$.eventId')<>NEW.event_id
 OR json_extract(NEW.payload,'$.refType')<>NEW.ref_type OR json_extract(NEW.payload,'$.label')<>NEW.label
 OR json_extract(NEW.payload,'$.referenceDigest')<>NEW.reference_digest
 OR NOT EXISTS(SELECT 1 FROM provider_lifecycle_event e WHERE e.event_id=NEW.event_id AND e.run_id=NEW.run_id AND e.task_id=NEW.task_id AND e.attempt_id=NEW.attempt_id AND e.candidate_id=NEW.candidate_id)
 OR EXISTS(SELECT 1 FROM provider_lifecycle_event WHERE attempt_id=NEW.attempt_id AND kind='lifecycle-sealed')
BEGIN SELECT RAISE(ABORT,'provider reference exact lineage required'); END;
