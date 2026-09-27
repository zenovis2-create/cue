CREATE TABLE attempt_staging_migration(
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 version TEXT NOT NULL CHECK(version='cue-attempt-staging-authority-v1')
);
CREATE TABLE run_staging_authority(
 run_id TEXT PRIMARY KEY REFERENCES run(id),envelope_hash TEXT NOT NULL,plan_digest TEXT NOT NULL,policy_digest TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),factory_protocol TEXT,factory_sha256 TEXT,publication_worktree_realpath TEXT,
 publication_volume_serial TEXT,publication_file_id TEXT,base_commit_id TEXT,clean_snapshot_sha256 TEXT,
 target_contract_digest TEXT NOT NULL CHECK(length(target_contract_digest)=64),created_at_ms INTEGER NOT NULL CHECK(created_at_ms>=0),
 payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64),payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576),
 CHECK((enabled=0 AND factory_protocol IS NULL AND factory_sha256 IS NULL AND publication_worktree_realpath IS NULL AND publication_volume_serial IS NULL AND publication_file_id IS NULL AND base_commit_id IS NULL AND clean_snapshot_sha256 IS NULL)
  OR (enabled=1 AND factory_protocol='cue-attempt-staging-factory-v1' AND length(factory_sha256)=64 AND publication_worktree_realpath IS NOT NULL AND length(publication_volume_serial)=16 AND length(publication_file_id)=32 AND length(base_commit_id) IN(40,64) AND length(clean_snapshot_sha256)=64))
);

CREATE TABLE attempt_staging_setup(
 setup_id TEXT PRIMARY KEY,
 attempt_id TEXT NOT NULL UNIQUE REFERENCES orchestration_attempt(attempt_id),
 run_id TEXT NOT NULL,
 task_id TEXT NOT NULL,
 candidate_id TEXT NOT NULL,
 publication_worktree_realpath TEXT NOT NULL,
 publication_volume_serial TEXT NOT NULL CHECK(length(publication_volume_serial)=16),
 publication_file_id TEXT NOT NULL CHECK(length(publication_file_id)=32),
 base_commit_id TEXT NOT NULL CHECK(length(base_commit_id) IN(40,64)),
 clean_snapshot_sha256 TEXT NOT NULL CHECK(length(clean_snapshot_sha256)=64),
 expected_subject_digest TEXT NOT NULL CHECK(length(expected_subject_digest)=64),
 factory_protocol TEXT NOT NULL CHECK(factory_protocol='cue-attempt-staging-factory-v1'),
 factory_sha256 TEXT NOT NULL CHECK(length(factory_sha256)=64),
 created_at_ms INTEGER NOT NULL CHECK(created_at_ms>=0),
 payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64),
 payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576),
 FOREIGN KEY(run_id,task_id) REFERENCES orchestration_step(run_id,task_id)
);

CREATE TABLE attempt_staging_authority(
 attempt_id TEXT PRIMARY KEY REFERENCES attempt_staging_setup(attempt_id),
 stage_envelope_hash TEXT NOT NULL UNIQUE REFERENCES orchestration_stage_envelope(stage_envelope_hash),
 parent_envelope_hash TEXT NOT NULL,
 plan_digest TEXT NOT NULL CHECK(length(plan_digest)=64),
 policy_digest TEXT NOT NULL CHECK(length(policy_digest)=64),
 execution_worktree_realpath TEXT NOT NULL UNIQUE,
 execution_volume_serial TEXT NOT NULL CHECK(length(execution_volume_serial)=16),
 execution_file_id TEXT NOT NULL CHECK(length(execution_file_id)=32),
 activated_at_ms INTEGER NOT NULL CHECK(activated_at_ms>=0),
 payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64),
 payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576)
);

CREATE TABLE attempt_staging_cleanup(
 attempt_id TEXT PRIMARY KEY REFERENCES attempt_staging_setup(attempt_id),
 result TEXT NOT NULL CHECK(result IN('create_failed_verified','create_unknown','active_cleanup_verified','active_cleanup_unknown')),
 observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0),
 evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
 payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64),
 payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576)
);

CREATE TRIGGER attempt_staging_migration_no_update BEFORE UPDATE ON attempt_staging_migration BEGIN SELECT RAISE(ABORT,'attempt staging migration immutable'); END;
CREATE TRIGGER attempt_staging_migration_no_delete BEFORE DELETE ON attempt_staging_migration BEGIN SELECT RAISE(ABORT,'attempt staging migration immutable'); END;
CREATE TRIGGER attempt_staging_migration_no_replace BEFORE INSERT ON attempt_staging_migration WHEN EXISTS(SELECT 1 FROM attempt_staging_migration) BEGIN SELECT RAISE(ABORT,'attempt staging migration immutable'); END;
CREATE TRIGGER run_staging_authority_insert_guard BEFORE INSERT ON run_staging_authority WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256 OR cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT) OR json_valid(NEW.payload)<>1 OR (SELECT count(*) FROM json_each(NEW.payload))<>14
 OR json_extract(NEW.payload,'$.schemaVersion') IS NOT 'cue-run-staging-authority-v1' OR json_extract(NEW.payload,'$.runId') IS NOT NEW.run_id OR json_extract(NEW.payload,'$.envelopeHash') IS NOT NEW.envelope_hash OR json_extract(NEW.payload,'$.planDigest') IS NOT NEW.plan_digest OR json_extract(NEW.payload,'$.policyDigest') IS NOT NEW.policy_digest OR json_extract(NEW.payload,'$.enabled') IS NOT NEW.enabled
 OR NOT(json_extract(NEW.payload,'$.factoryProtocol') IS NEW.factory_protocol) OR NOT(json_extract(NEW.payload,'$.factorySha256') IS NEW.factory_sha256) OR NOT(json_extract(NEW.payload,'$.publicationWorktreeRealpath') IS NEW.publication_worktree_realpath) OR NOT(json_extract(NEW.payload,'$.publicationRootIdentity.volumeSerial') IS NEW.publication_volume_serial) OR NOT(json_extract(NEW.payload,'$.publicationRootIdentity.fileId') IS NEW.publication_file_id) OR NOT(json_extract(NEW.payload,'$.baseCommitId') IS NEW.base_commit_id) OR NOT(json_extract(NEW.payload,'$.cleanSnapshotSha256') IS NEW.clean_snapshot_sha256) OR json_extract(NEW.payload,'$.targetContractDigest') IS NOT NEW.target_contract_digest OR json_extract(NEW.payload,'$.createdAtMs') IS NOT NEW.created_at_ms
 OR (NEW.enabled=1 AND (json_type(NEW.payload,'$.publicationRootIdentity') IS NOT 'object' OR (SELECT count(*) FROM json_each(NEW.payload,'$.publicationRootIdentity'))<>2 OR NEW.publication_volume_serial GLOB '*[^0-9a-f]*' OR NEW.publication_file_id GLOB '*[^0-9a-f]*'))
 OR (NEW.enabled=0 AND json_type(NEW.payload,'$.publicationRootIdentity') IS NOT 'null')
 OR NOT EXISTS(SELECT 1 FROM run r JOIN orchestration_plan p ON p.run_id=r.id WHERE r.id=NEW.run_id AND r.envelope_hash=NEW.envelope_hash AND p.digest=NEW.plan_digest
   AND (EXISTS(SELECT 1 FROM selection_run_policy q WHERE q.run_id=r.id AND q.digest=NEW.policy_digest) OR (NEW.enabled=0 AND EXISTS(SELECT 1 FROM local_selection_run_policy q WHERE q.run_id=r.id AND q.digest=NEW.policy_digest))))
 OR NOT((EXISTS(SELECT 1 FROM change_root_contract rc WHERE rc.run_id=NEW.run_id AND rc.payload_sha256=NEW.target_contract_digest)) OR (NOT EXISTS(SELECT 1 FROM change_root_contract rc WHERE rc.run_id=NEW.run_id) AND NEW.target_contract_digest=cue_sha256('[]')))
 OR EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id) OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'run staging authority invalid'); END;
CREATE TRIGGER run_staging_authority_no_update BEFORE UPDATE ON run_staging_authority BEGIN SELECT RAISE(ABORT,'run staging authority immutable'); END;
CREATE TRIGGER run_staging_authority_no_delete BEFORE DELETE ON run_staging_authority BEGIN SELECT RAISE(ABORT,'run staging authority immutable'); END;
CREATE TRIGGER run_staging_authority_no_replace BEFORE INSERT ON run_staging_authority WHEN EXISTS(SELECT 1 FROM run_staging_authority WHERE run_id=NEW.run_id) BEGIN SELECT RAISE(ABORT,'run staging authority immutable'); END;

CREATE TRIGGER attempt_staging_setup_insert_guard BEFORE INSERT ON attempt_staging_setup
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256 OR json_valid(NEW.payload)<>1 OR cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT)
 OR (SELECT count(*) FROM json_each(NEW.payload))<>14
 OR json_extract(NEW.payload,'$.schemaVersion') IS NOT 'cue-attempt-staging-setup-v1'
 OR json_extract(NEW.payload,'$.setupId') IS NOT NEW.setup_id OR json_extract(NEW.payload,'$.attemptId') IS NOT NEW.attempt_id
 OR json_extract(NEW.payload,'$.runId') IS NOT NEW.run_id OR json_extract(NEW.payload,'$.taskId') IS NOT NEW.task_id
 OR json_extract(NEW.payload,'$.candidateId') IS NOT NEW.candidate_id
 OR json_extract(NEW.payload,'$.publicationWorktreeRealpath') IS NOT NEW.publication_worktree_realpath
 OR json_type(NEW.payload,'$.publicationRootIdentity') IS NOT 'object' OR (SELECT count(*) FROM json_each(NEW.payload,'$.publicationRootIdentity'))<>2
 OR json_type(NEW.payload,'$.publicationRootIdentity.volumeSerial') IS NOT 'text' OR json_type(NEW.payload,'$.publicationRootIdentity.fileId') IS NOT 'text'
 OR json_extract(NEW.payload,'$.publicationRootIdentity.volumeSerial') IS NOT NEW.publication_volume_serial
 OR json_extract(NEW.payload,'$.publicationRootIdentity.fileId') IS NOT NEW.publication_file_id
 OR json_extract(NEW.payload,'$.baseCommitId') IS NOT NEW.base_commit_id
 OR json_extract(NEW.payload,'$.cleanSnapshotSha256') IS NOT NEW.clean_snapshot_sha256
 OR json_extract(NEW.payload,'$.expectedSubjectDigest') IS NOT NEW.expected_subject_digest
 OR json_extract(NEW.payload,'$.factoryProtocol') IS NOT NEW.factory_protocol
 OR json_extract(NEW.payload,'$.factorySha256') IS NOT NEW.factory_sha256
 OR json_extract(NEW.payload,'$.createdAtMs') IS NOT NEW.created_at_ms
 OR NOT EXISTS(
  SELECT 1 FROM orchestration_attempt a
  JOIN attempt_selection s ON s.attempt_id=a.attempt_id AND s.run_id=a.run_id
  JOIN orchestration_account_identity ai ON ai.run_id=a.run_id AND ai.candidate_id=a.candidate_id
  JOIN orchestration_step os ON os.run_id=a.run_id AND os.task_id=a.task_id
  JOIN orchestration_plan op ON op.run_id=a.run_id
  JOIN run_staging_authority rsa ON rsa.run_id=a.run_id
  JOIN run r ON r.id=a.run_id JOIN envelope e ON e.envelope_hash=r.envelope_hash
  JOIN approval_event ae ON ae.run_id=a.run_id AND ae.envelope_hash=r.envelope_hash AND ae.decision='accept'
  JOIN change_root_contract rc ON rc.run_id=a.run_id AND rc.task_id=a.task_id
  JOIN workspace_write_lease wl ON wl.run_id=a.run_id AND lower(wl.worktree_realpath)=lower(a.worktree_realpath)
  WHERE a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND a.task_id=NEW.task_id AND a.candidate_id=NEW.candidate_id
   AND a.state='running' AND os.state='running' AND a.lease_acquired_at IS NOT NULL AND wl.acquired_at=a.lease_acquired_at
   AND NEW.publication_worktree_realpath=a.worktree_realpath AND NEW.publication_worktree_realpath=e.worktree_realpath
   AND NEW.publication_worktree_realpath=rc.worktree_realpath AND NEW.publication_worktree_realpath=wl.worktree_realpath
   AND NEW.publication_volume_serial=rc.volume_serial AND NEW.publication_file_id=rc.file_id
   AND rc.snapshot_protocol='cue-change-snapshot-v1'
   AND json_extract(ai.payload,'$.subjectDigest')=NEW.expected_subject_digest
   AND json_extract(ai.payload,'$.planDigest')=op.digest AND json_extract(ai.payload,'$.policyDigest')=(SELECT digest FROM selection_run_policy WHERE run_id=a.run_id)
   AND json_extract(ai.payload,'$.envelopeHash')=r.envelope_hash
   AND rsa.enabled=1 AND rsa.envelope_hash=r.envelope_hash AND rsa.plan_digest=op.digest AND rsa.policy_digest=json_extract(ai.payload,'$.policyDigest')
   AND rsa.factory_protocol=NEW.factory_protocol AND rsa.factory_sha256=NEW.factory_sha256 AND rsa.publication_worktree_realpath=NEW.publication_worktree_realpath
   AND rsa.publication_volume_serial=NEW.publication_volume_serial AND rsa.publication_file_id=NEW.publication_file_id AND rsa.base_commit_id=NEW.base_commit_id AND rsa.clean_snapshot_sha256=NEW.clean_snapshot_sha256
   AND rsa.target_contract_digest=rc.payload_sha256)
BEGIN SELECT RAISE(ABORT,'attempt staging setup invalid'); END;
CREATE TRIGGER attempt_staging_setup_no_update BEFORE UPDATE ON attempt_staging_setup BEGIN SELECT RAISE(ABORT,'attempt staging setup immutable'); END;
CREATE TRIGGER attempt_staging_setup_no_delete BEFORE DELETE ON attempt_staging_setup BEGIN SELECT RAISE(ABORT,'attempt staging setup immutable'); END;
CREATE TRIGGER attempt_staging_setup_no_replace BEFORE INSERT ON attempt_staging_setup WHEN EXISTS(SELECT 1 FROM attempt_staging_setup WHERE setup_id=NEW.setup_id OR attempt_id=NEW.attempt_id) BEGIN SELECT RAISE(ABORT,'attempt staging setup immutable'); END;

CREATE TRIGGER attempt_staging_authority_insert_guard BEFORE INSERT ON attempt_staging_authority
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256 OR json_valid(NEW.payload)<>1 OR cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT)
 OR (SELECT count(*) FROM json_each(NEW.payload))<>9
 OR json_extract(NEW.payload,'$.schemaVersion') IS NOT 'cue-attempt-staging-authority-v1'
 OR json_extract(NEW.payload,'$.attemptId') IS NOT NEW.attempt_id OR json_extract(NEW.payload,'$.stageEnvelopeHash') IS NOT NEW.stage_envelope_hash
 OR json_extract(NEW.payload,'$.parentEnvelopeHash') IS NOT NEW.parent_envelope_hash
 OR json_extract(NEW.payload,'$.planDigest') IS NOT NEW.plan_digest OR json_extract(NEW.payload,'$.policyDigest') IS NOT NEW.policy_digest
 OR json_extract(NEW.payload,'$.executionWorktreeRealpath') IS NOT NEW.execution_worktree_realpath
 OR json_type(NEW.payload,'$.executionRootIdentity') IS NOT 'object' OR (SELECT count(*) FROM json_each(NEW.payload,'$.executionRootIdentity'))<>2
 OR json_type(NEW.payload,'$.executionRootIdentity.volumeSerial') IS NOT 'text' OR json_type(NEW.payload,'$.executionRootIdentity.fileId') IS NOT 'text'
 OR json_extract(NEW.payload,'$.executionRootIdentity.volumeSerial') IS NOT NEW.execution_volume_serial
 OR json_extract(NEW.payload,'$.executionRootIdentity.fileId') IS NOT NEW.execution_file_id
 OR json_extract(NEW.payload,'$.activatedAtMs') IS NOT NEW.activated_at_ms
 OR EXISTS(SELECT 1 FROM attempt_staging_cleanup WHERE attempt_id=NEW.attempt_id)
 OR NOT EXISTS(
  SELECT 1 FROM attempt_staging_setup ss
  JOIN orchestration_stage_envelope se ON se.attempt_id=ss.attempt_id
  JOIN run sr ON sr.id=se.stage_run_id
  JOIN envelope ee ON ee.envelope_hash=se.stage_envelope_hash
  JOIN orchestration_attempt a ON a.attempt_id=ss.attempt_id
  JOIN run pr ON pr.id=a.run_id
  JOIN orchestration_step os ON os.run_id=a.run_id AND os.task_id=a.task_id
  JOIN workspace_write_lease wl ON wl.run_id=a.run_id AND wl.acquired_at=a.lease_acquired_at AND wl.worktree_realpath=ss.publication_worktree_realpath
  JOIN approval_event ae ON ae.run_id=a.run_id AND ae.envelope_hash=se.parent_envelope_hash AND ae.decision='accept'
  WHERE ss.attempt_id=NEW.attempt_id AND se.stage_envelope_hash=NEW.stage_envelope_hash
   AND se.workflow_run_id=ss.run_id AND ss.run_id=a.run_id AND se.plan_task_id=ss.task_id AND ss.task_id=a.task_id
   AND se.parent_envelope_hash=pr.envelope_hash
   AND se.stage_run_id=NEW.attempt_id AND sr.id=NEW.attempt_id AND sr.envelope_hash=NEW.stage_envelope_hash
   AND json_extract(se.stage_json,'$.run_id')=NEW.attempt_id
   AND json_extract(se.stage_json,'$.worktree_realpath')=NEW.execution_worktree_realpath AND ee.worktree_realpath=NEW.execution_worktree_realpath
   AND se.parent_envelope_hash=NEW.parent_envelope_hash AND se.plan_digest=NEW.plan_digest AND se.policy_digest=NEW.policy_digest
   AND (SELECT digest FROM selection_run_policy WHERE run_id=a.run_id)=NEW.policy_digest
   AND ((NOT EXISTS(SELECT 1 FROM orchestration_attempt_revision ar WHERE ar.attempt_id=a.attempt_id)
     AND EXISTS(SELECT 1 FROM orchestration_plan p WHERE p.run_id=a.run_id AND p.digest=NEW.plan_digest))
    OR EXISTS(SELECT 1 FROM orchestration_attempt_revision ar JOIN orchestration_plan_revision p ON p.run_id=ar.run_id AND p.revision=ar.revision
      WHERE ar.attempt_id=a.attempt_id AND p.plan_digest=NEW.plan_digest))
   AND a.state='running' AND os.state='running' AND lower(NEW.execution_worktree_realpath)<>lower(ss.publication_worktree_realpath)
   AND (NEW.execution_volume_serial<>ss.publication_volume_serial OR NEW.execution_file_id<>ss.publication_file_id))
BEGIN SELECT RAISE(ABORT,'attempt staging authority invalid'); END;
CREATE TRIGGER attempt_staging_authority_no_update BEFORE UPDATE ON attempt_staging_authority BEGIN SELECT RAISE(ABORT,'attempt staging authority immutable'); END;
CREATE TRIGGER attempt_staging_authority_no_delete BEFORE DELETE ON attempt_staging_authority BEGIN SELECT RAISE(ABORT,'attempt staging authority immutable'); END;
CREATE TRIGGER attempt_staging_authority_no_replace BEFORE INSERT ON attempt_staging_authority WHEN EXISTS(SELECT 1 FROM attempt_staging_authority WHERE attempt_id=NEW.attempt_id OR stage_envelope_hash=NEW.stage_envelope_hash OR lower(execution_worktree_realpath)=lower(NEW.execution_worktree_realpath)) BEGIN SELECT RAISE(ABORT,'attempt staging authority immutable'); END;

CREATE TRIGGER attempt_staging_cleanup_insert_guard BEFORE INSERT ON attempt_staging_cleanup
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256 OR json_valid(NEW.payload)<>1 OR cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT)
 OR (SELECT count(*) FROM json_each(NEW.payload))<>(CASE WHEN NEW.result LIKE '%_verified' THEN 11 ELSE 10 END)
 OR json_extract(NEW.payload,'$.schemaVersion') IS NOT 'cue-attempt-staging-cleanup-v1'
 OR json_extract(NEW.payload,'$.attemptId') IS NOT NEW.attempt_id OR json_extract(NEW.payload,'$.result') IS NOT NEW.result
 OR json_extract(NEW.payload,'$.setupId') IS NOT (SELECT setup_id FROM attempt_staging_setup WHERE attempt_id=NEW.attempt_id)
 OR json_extract(NEW.payload,'$.observedAtMs') IS NOT NEW.observed_at_ms OR json_extract(NEW.payload,'$.evidenceSha256') IS NOT NEW.evidence_sha256
 OR json_extract(NEW.payload,'$.factoryProtocol') IS NOT (SELECT factory_protocol FROM attempt_staging_setup WHERE attempt_id=NEW.attempt_id)
 OR json_extract(NEW.payload,'$.factorySha256') IS NOT (SELECT factory_sha256 FROM attempt_staging_setup WHERE attempt_id=NEW.attempt_id)
 OR json_type(NEW.payload,'$.root') IS NOT 'object'
 OR (SELECT count(*) FROM json_each(NEW.payload,'$.root'))<>3
 OR json_extract(NEW.payload,'$.root.kind') NOT IN('execution','unknown-execution')
 OR (json_extract(NEW.payload,'$.root.kind')='execution' AND (json_type(NEW.payload,'$.root.worktreeRealpath') IS NOT 'text'
   OR json_type(NEW.payload,'$.root.identity') IS NOT 'object' OR (SELECT count(*) FROM json_each(NEW.payload,'$.root.identity'))<>2
   OR json_type(NEW.payload,'$.root.identity.volumeSerial') IS NOT 'text' OR json_type(NEW.payload,'$.root.identity.fileId') IS NOT 'text'))
 OR (json_extract(NEW.payload,'$.root.kind')='unknown-execution' AND (json_type(NEW.payload,'$.root.worktreeRealpath') IS NOT 'null' OR json_type(NEW.payload,'$.root.identity') IS NOT 'null'))
 OR (NEW.result LIKE 'active_%' AND NOT EXISTS(SELECT 1 FROM attempt_staging_authority a WHERE a.attempt_id=NEW.attempt_id
   AND a.execution_worktree_realpath=json_extract(NEW.payload,'$.root.worktreeRealpath')
   AND a.execution_volume_serial=json_extract(NEW.payload,'$.root.identity.volumeSerial') AND a.execution_file_id=json_extract(NEW.payload,'$.root.identity.fileId')))
 OR ((NEW.result LIKE '%_verified') AND (json_extract(NEW.payload,'$.rootAbsent') IS NOT 1 OR json_extract(NEW.payload,'$.metadataAbsent') IS NOT 1))
 OR ((NEW.result LIKE '%_unknown') AND (json_type(NEW.payload,'$.reason') IS NOT 'text' OR length(json_extract(NEW.payload,'$.reason'))<1))
 OR ((NEW.result LIKE 'create_%')<>(NOT EXISTS(SELECT 1 FROM attempt_staging_authority WHERE attempt_id=NEW.attempt_id)))
 OR (NEW.result='active_cleanup_verified' AND NOT EXISTS(
   SELECT 1 FROM change_set cs WHERE cs.attempt_id=NEW.attempt_id
    AND (SELECT count(*) FROM json_each(cs.approved_targets_json))=(SELECT count(*) FROM change_publication_intent i WHERE i.change_set_id=cs.change_set_id)
    AND NOT EXISTS(SELECT 1 FROM json_each(cs.approved_targets_json) target WHERE
      (SELECT count(*) FROM change_publication_intent i JOIN change_publication_result r USING(publication_id)
       WHERE i.change_set_id=cs.change_set_id AND i.relative_path=target.value AND r.state='committed')<>1)))
BEGIN SELECT RAISE(ABORT,'attempt staging cleanup invalid'); END;
CREATE TRIGGER attempt_staging_cleanup_no_update BEFORE UPDATE ON attempt_staging_cleanup BEGIN SELECT RAISE(ABORT,'attempt staging cleanup immutable'); END;
CREATE TRIGGER attempt_staging_cleanup_no_delete BEFORE DELETE ON attempt_staging_cleanup BEGIN SELECT RAISE(ABORT,'attempt staging cleanup immutable'); END;
CREATE TRIGGER attempt_staging_cleanup_no_replace BEFORE INSERT ON attempt_staging_cleanup WHEN EXISTS(SELECT 1 FROM attempt_staging_cleanup WHERE attempt_id=NEW.attempt_id) BEGIN SELECT RAISE(ABORT,'attempt staging cleanup immutable'); END;

CREATE TRIGGER attempt_staging_lease_no_unsafe_delete BEFORE DELETE ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM attempt_staging_setup s LEFT JOIN attempt_staging_cleanup c USING(attempt_id)
 WHERE s.run_id=OLD.run_id AND lower(s.publication_worktree_realpath)=lower(OLD.worktree_realpath)
 AND (c.attempt_id IS NULL OR c.result LIKE '%_unknown' OR (c.result='active_cleanup_verified' AND
  (NOT EXISTS(SELECT 1 FROM change_set cs WHERE cs.attempt_id=s.attempt_id AND (SELECT count(*) FROM json_each(cs.approved_targets_json))=(SELECT count(*) FROM change_publication_intent i WHERE i.change_set_id=cs.change_set_id))
   OR EXISTS(SELECT 1 FROM change_publication_intent i LEFT JOIN change_publication_result r USING(publication_id) WHERE i.attempt_id=s.attempt_id AND (r.publication_id IS NULL OR r.state<>'committed'))))))
BEGIN SELECT RAISE(ABORT,'attempt staging cleanup unresolved'); END;
CREATE TRIGGER attempt_staging_lease_no_unsafe_update BEFORE UPDATE ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM attempt_staging_setup s LEFT JOIN attempt_staging_cleanup c USING(attempt_id)
 WHERE s.run_id=OLD.run_id AND lower(s.publication_worktree_realpath)=lower(OLD.worktree_realpath)
 AND (c.attempt_id IS NULL OR c.result LIKE '%_unknown' OR (c.result='active_cleanup_verified' AND
  (NOT EXISTS(SELECT 1 FROM change_set cs WHERE cs.attempt_id=s.attempt_id AND (SELECT count(*) FROM json_each(cs.approved_targets_json))=(SELECT count(*) FROM change_publication_intent i WHERE i.change_set_id=cs.change_set_id))
   OR EXISTS(SELECT 1 FROM change_publication_intent i LEFT JOIN change_publication_result r USING(publication_id) WHERE i.attempt_id=s.attempt_id AND (r.publication_id IS NULL OR r.state<>'committed'))))))
BEGIN SELECT RAISE(ABORT,'attempt staging cleanup unresolved'); END;
CREATE TRIGGER attempt_staging_lease_no_unsafe_replace BEFORE INSERT ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM workspace_write_lease w JOIN attempt_staging_setup s ON s.run_id=w.run_id AND lower(s.publication_worktree_realpath)=lower(w.worktree_realpath)
 LEFT JOIN attempt_staging_cleanup c USING(attempt_id)
 WHERE (lower(w.worktree_realpath)=lower(NEW.worktree_realpath) OR w.run_id=NEW.run_id)
 AND (c.attempt_id IS NULL OR c.result LIKE '%_unknown' OR (c.result='active_cleanup_verified' AND
  (NOT EXISTS(SELECT 1 FROM change_set cs WHERE cs.attempt_id=s.attempt_id AND (SELECT count(*) FROM json_each(cs.approved_targets_json))=(SELECT count(*) FROM change_publication_intent i WHERE i.change_set_id=cs.change_set_id))
   OR EXISTS(SELECT 1 FROM change_publication_intent i LEFT JOIN change_publication_result r USING(publication_id) WHERE i.attempt_id=s.attempt_id AND (r.publication_id IS NULL OR r.state<>'committed'))))))
BEGIN SELECT RAISE(ABORT,'attempt staging cleanup unresolved'); END;

INSERT INTO attempt_staging_migration VALUES(1,'cue-attempt-staging-authority-v1');
