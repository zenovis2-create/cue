CREATE TABLE attempt_staging_discard_migration(
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 version TEXT NOT NULL CHECK(version='cue-attempt-staging-discard-v1')
);
CREATE TABLE attempt_staging_discard_authorization(
 attempt_id TEXT PRIMARY KEY REFERENCES attempt_staging_setup(attempt_id),
 receipt_id TEXT NOT NULL UNIQUE,receipt_revision INTEGER NOT NULL CHECK(receipt_revision>=1),
 receipt_sha256 TEXT NOT NULL UNIQUE CHECK(length(receipt_sha256)=64),
 verification_sha256 TEXT NOT NULL CHECK(length(verification_sha256)=64),
 payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64),
 payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576)
);
CREATE TABLE attempt_staging_discard(
 attempt_id TEXT PRIMARY KEY REFERENCES attempt_staging_setup(attempt_id),
 result TEXT NOT NULL CHECK(result IN('discard_verified','discard_unknown')),
 observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0),
 evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
 payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64),
 payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576)
);

CREATE TRIGGER attempt_staging_discard_migration_no_update BEFORE UPDATE ON attempt_staging_discard_migration BEGIN SELECT RAISE(ABORT,'attempt staging discard migration immutable'); END;
CREATE TRIGGER attempt_staging_discard_migration_no_delete BEFORE DELETE ON attempt_staging_discard_migration BEGIN SELECT RAISE(ABORT,'attempt staging discard migration immutable'); END;
CREATE TRIGGER attempt_staging_discard_migration_no_replace BEFORE INSERT ON attempt_staging_discard_migration WHEN EXISTS(SELECT 1 FROM attempt_staging_discard_migration) BEGIN SELECT RAISE(ABORT,'attempt staging discard migration immutable'); END;
CREATE TRIGGER attempt_staging_discard_authorization_insert_guard BEFORE INSERT ON attempt_staging_discard_authorization
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256 OR json_valid(NEW.payload)<>1 OR cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT)
 OR (SELECT count(*) FROM json_each(NEW.payload))<>11
 OR json_extract(NEW.payload,'$.schemaVersion') IS NOT 'cue-attempt-staging-discard-authorization-v1'
 OR json_extract(NEW.payload,'$.attemptId') IS NOT NEW.attempt_id OR json_extract(NEW.payload,'$.receiptId') IS NOT NEW.receipt_id
 OR json_extract(NEW.payload,'$.receiptRevision') IS NOT NEW.receipt_revision OR json_extract(NEW.payload,'$.receiptSha256') IS NOT NEW.receipt_sha256
 OR json_extract(NEW.payload,'$.verificationSha256') IS NOT NEW.verification_sha256
 OR json_extract(NEW.payload,'$.outcome') IS NOT 'failed' OR json_extract(NEW.payload,'$.cleanup') IS NOT 'clean'
 OR json_type(NEW.payload,'$.verification') IS NOT 'object'
 OR cue_sha256(cue_canonical_json(json_extract(NEW.payload,'$.verification')))<>NEW.verification_sha256
 OR NOT EXISTS(SELECT 1 FROM orchestration_attempt a JOIN orchestration_step s ON s.run_id=a.run_id AND s.task_id=a.task_id
   JOIN attempt_staging_authority sa ON sa.attempt_id=a.attempt_id
   WHERE a.attempt_id=NEW.attempt_id AND a.run_id=json_extract(NEW.payload,'$.runId') AND a.task_id=json_extract(NEW.payload,'$.taskId')
   AND a.state='running' AND s.state='running')
 OR EXISTS(SELECT 1 FROM attempt_staging_cleanup WHERE attempt_id=NEW.attempt_id)
 OR EXISTS(SELECT 1 FROM attempt_staging_discard WHERE attempt_id=NEW.attempt_id)
BEGIN SELECT RAISE(ABORT,'attempt staging discard authorization invalid'); END;
CREATE TRIGGER attempt_staging_discard_authorization_no_update BEFORE UPDATE ON attempt_staging_discard_authorization BEGIN SELECT RAISE(ABORT,'attempt staging discard authorization immutable'); END;
CREATE TRIGGER attempt_staging_discard_authorization_no_delete BEFORE DELETE ON attempt_staging_discard_authorization BEGIN SELECT RAISE(ABORT,'attempt staging discard authorization immutable'); END;
CREATE TRIGGER attempt_staging_discard_authorization_no_replace BEFORE INSERT ON attempt_staging_discard_authorization WHEN EXISTS(SELECT 1 FROM attempt_staging_discard_authorization WHERE attempt_id=NEW.attempt_id OR receipt_id=NEW.receipt_id) BEGIN SELECT RAISE(ABORT,'attempt staging discard authorization immutable'); END;
CREATE TRIGGER attempt_staging_discard_insert_guard BEFORE INSERT ON attempt_staging_discard
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256 OR json_valid(NEW.payload)<>1 OR cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT)
 OR (SELECT count(*) FROM json_each(NEW.payload))<>(CASE WHEN NEW.result='discard_verified' THEN 20 ELSE 19 END)
 OR json_extract(NEW.payload,'$.schemaVersion') IS NOT 'cue-attempt-staging-discard-v1'
 OR json_extract(NEW.payload,'$.attemptId') IS NOT NEW.attempt_id OR json_extract(NEW.payload,'$.result') IS NOT NEW.result
 OR json_extract(NEW.payload,'$.setupId') IS NOT (SELECT setup_id FROM attempt_staging_setup WHERE attempt_id=NEW.attempt_id)
 OR json_extract(NEW.payload,'$.runId') IS NOT (SELECT run_id FROM attempt_staging_setup WHERE attempt_id=NEW.attempt_id)
 OR json_extract(NEW.payload,'$.taskId') IS NOT (SELECT task_id FROM attempt_staging_setup WHERE attempt_id=NEW.attempt_id)
 OR json_extract(NEW.payload,'$.outcome') IS NOT 'failed' OR json_extract(NEW.payload,'$.cleanup') IS NOT 'clean'
 OR json_type(NEW.payload,'$.receiptId') IS NOT 'text' OR length(json_extract(NEW.payload,'$.receiptId'))<1
 OR json_type(NEW.payload,'$.receiptRevision') IS NOT 'integer' OR json_extract(NEW.payload,'$.receiptRevision')<1
 OR json_type(NEW.payload,'$.receiptObservedAtMs') IS NOT 'integer' OR json_extract(NEW.payload,'$.receiptObservedAtMs')<0
 OR json_extract(NEW.payload,'$.receiptSha256') IS NOT (SELECT receipt_sha256 FROM attempt_staging_discard_authorization WHERE attempt_id=NEW.attempt_id AND receipt_id=json_extract(NEW.payload,'$.receiptId') AND receipt_revision=json_extract(NEW.payload,'$.receiptRevision'))
 OR json_type(NEW.payload,'$.receiptEvidenceRef') IS NOT 'text' OR length(json_extract(NEW.payload,'$.receiptEvidenceRef'))<1
 OR json_extract(NEW.payload,'$.observedAtMs') IS NOT NEW.observed_at_ms OR json_extract(NEW.payload,'$.evidenceSha256') IS NOT NEW.evidence_sha256
 OR json_extract(NEW.payload,'$.factoryProtocol') IS NOT (SELECT factory_protocol FROM attempt_staging_setup WHERE attempt_id=NEW.attempt_id)
 OR json_extract(NEW.payload,'$.factorySha256') IS NOT (SELECT factory_sha256 FROM attempt_staging_setup WHERE attempt_id=NEW.attempt_id)
 OR json_type(NEW.payload,'$.root') IS NOT 'object' OR (SELECT count(*) FROM json_each(NEW.payload,'$.root'))<>3
 OR json_extract(NEW.payload,'$.root.kind') IS NOT 'execution'
 OR json_type(NEW.payload,'$.root.worktreeRealpath') IS NOT 'text'
 OR json_type(NEW.payload,'$.root.identity') IS NOT 'object' OR (SELECT count(*) FROM json_each(NEW.payload,'$.root.identity'))<>2
 OR NOT EXISTS(SELECT 1 FROM attempt_staging_authority a WHERE a.attempt_id=NEW.attempt_id
   AND a.execution_worktree_realpath=json_extract(NEW.payload,'$.root.worktreeRealpath')
   AND a.execution_volume_serial=json_extract(NEW.payload,'$.root.identity.volumeSerial')
   AND a.execution_file_id=json_extract(NEW.payload,'$.root.identity.fileId'))
 OR NOT EXISTS(SELECT 1 FROM orchestration_attempt a JOIN orchestration_step s ON s.run_id=a.run_id AND s.task_id=a.task_id
   WHERE a.attempt_id=NEW.attempt_id AND a.run_id=json_extract(NEW.payload,'$.runId') AND a.task_id=json_extract(NEW.payload,'$.taskId')
   AND a.state='running' AND s.state='running')
 OR EXISTS(SELECT 1 FROM attempt_staging_cleanup WHERE attempt_id=NEW.attempt_id)
 OR EXISTS(SELECT 1 FROM change_publication_intent WHERE attempt_id=NEW.attempt_id)
 OR ((NEW.result='discard_verified') AND (json_extract(NEW.payload,'$.rootAbsent') IS NOT 1 OR json_extract(NEW.payload,'$.metadataAbsent') IS NOT 1))
 OR ((NEW.result='discard_unknown') AND (json_type(NEW.payload,'$.reason') IS NOT 'text' OR length(json_extract(NEW.payload,'$.reason'))<1))
BEGIN SELECT RAISE(ABORT,'attempt staging discard invalid'); END;
CREATE TRIGGER attempt_staging_discard_no_update BEFORE UPDATE ON attempt_staging_discard BEGIN SELECT RAISE(ABORT,'attempt staging discard immutable'); END;
CREATE TRIGGER attempt_staging_discard_no_delete BEFORE DELETE ON attempt_staging_discard BEGIN SELECT RAISE(ABORT,'attempt staging discard immutable'); END;
CREATE TRIGGER attempt_staging_discard_no_replace BEFORE INSERT ON attempt_staging_discard WHEN EXISTS(SELECT 1 FROM attempt_staging_discard WHERE attempt_id=NEW.attempt_id) BEGIN SELECT RAISE(ABORT,'attempt staging discard immutable'); END;

DROP TRIGGER attempt_staging_lease_no_unsafe_delete;
DROP TRIGGER attempt_staging_lease_no_unsafe_update;
DROP TRIGGER attempt_staging_lease_no_unsafe_replace;
CREATE TRIGGER attempt_staging_lease_no_unsafe_delete BEFORE DELETE ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM attempt_staging_setup s LEFT JOIN attempt_staging_cleanup c USING(attempt_id) LEFT JOIN attempt_staging_discard d USING(attempt_id)
 WHERE s.run_id=OLD.run_id AND lower(s.publication_worktree_realpath)=lower(OLD.worktree_realpath)
 AND NOT(d.result='discard_verified' OR (d.attempt_id IS NULL AND c.attempt_id IS NOT NULL AND c.result NOT LIKE '%_unknown'
  AND (c.result<>'active_cleanup_verified' OR (EXISTS(SELECT 1 FROM change_set cs WHERE cs.attempt_id=s.attempt_id AND (SELECT count(*) FROM json_each(cs.approved_targets_json))=(SELECT count(*) FROM change_publication_intent i WHERE i.change_set_id=cs.change_set_id))
   AND NOT EXISTS(SELECT 1 FROM change_publication_intent i LEFT JOIN change_publication_result r USING(publication_id) WHERE i.attempt_id=s.attempt_id AND (r.publication_id IS NULL OR r.state<>'committed')))))))
BEGIN SELECT RAISE(ABORT,'attempt staging cleanup unresolved'); END;
CREATE TRIGGER attempt_staging_lease_no_unsafe_update BEFORE UPDATE ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM attempt_staging_setup s LEFT JOIN attempt_staging_cleanup c USING(attempt_id) LEFT JOIN attempt_staging_discard d USING(attempt_id)
 WHERE s.run_id=OLD.run_id AND lower(s.publication_worktree_realpath)=lower(OLD.worktree_realpath)
 AND NOT(d.result='discard_verified' OR (d.attempt_id IS NULL AND c.attempt_id IS NOT NULL AND c.result NOT LIKE '%_unknown'
  AND (c.result<>'active_cleanup_verified' OR (EXISTS(SELECT 1 FROM change_set cs WHERE cs.attempt_id=s.attempt_id AND (SELECT count(*) FROM json_each(cs.approved_targets_json))=(SELECT count(*) FROM change_publication_intent i WHERE i.change_set_id=cs.change_set_id))
   AND NOT EXISTS(SELECT 1 FROM change_publication_intent i LEFT JOIN change_publication_result r USING(publication_id) WHERE i.attempt_id=s.attempt_id AND (r.publication_id IS NULL OR r.state<>'committed')))))))
BEGIN SELECT RAISE(ABORT,'attempt staging cleanup unresolved'); END;
CREATE TRIGGER attempt_staging_lease_no_unsafe_replace BEFORE INSERT ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM workspace_write_lease w JOIN attempt_staging_setup s ON s.run_id=w.run_id AND lower(s.publication_worktree_realpath)=lower(w.worktree_realpath)
 LEFT JOIN attempt_staging_cleanup c USING(attempt_id) LEFT JOIN attempt_staging_discard d USING(attempt_id)
 WHERE (lower(w.worktree_realpath)=lower(NEW.worktree_realpath) OR w.run_id=NEW.run_id)
 AND NOT(d.result='discard_verified' OR (d.attempt_id IS NULL AND c.attempt_id IS NOT NULL AND c.result NOT LIKE '%_unknown'
  AND (c.result<>'active_cleanup_verified' OR (EXISTS(SELECT 1 FROM change_set cs WHERE cs.attempt_id=s.attempt_id AND (SELECT count(*) FROM json_each(cs.approved_targets_json))=(SELECT count(*) FROM change_publication_intent i WHERE i.change_set_id=cs.change_set_id))
   AND NOT EXISTS(SELECT 1 FROM change_publication_intent i LEFT JOIN change_publication_result r USING(publication_id) WHERE i.attempt_id=s.attempt_id AND (r.publication_id IS NULL OR r.state<>'committed')))))))
BEGIN SELECT RAISE(ABORT,'attempt staging cleanup unresolved'); END;

INSERT INTO attempt_staging_discard_migration VALUES(1,'cue-attempt-staging-discard-v1');
