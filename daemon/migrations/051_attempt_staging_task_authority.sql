CREATE TABLE run_staging_task_authority(
 run_id TEXT NOT NULL,task_id TEXT NOT NULL,root_contract_digest TEXT NOT NULL CHECK(length(root_contract_digest)=64),
 created_at_ms INTEGER NOT NULL CHECK(created_at_ms>=0),payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
 payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576),
 PRIMARY KEY(run_id,task_id),FOREIGN KEY(run_id,task_id) REFERENCES orchestration_step(run_id,task_id)
);
CREATE TRIGGER run_staging_task_authority_insert_guard BEFORE INSERT ON run_staging_task_authority
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256 OR cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT)
 OR json_valid(NEW.payload)<>1 OR (SELECT count(*) FROM json_each(NEW.payload))<>5
 OR json_extract(NEW.payload,'$.schemaVersion') IS NOT 'cue-run-staging-task-authority-v1'
 OR json_extract(NEW.payload,'$.runId') IS NOT NEW.run_id OR json_extract(NEW.payload,'$.taskId') IS NOT NEW.task_id
 OR json_extract(NEW.payload,'$.rootContractDigest') IS NOT NEW.root_contract_digest OR json_extract(NEW.payload,'$.createdAtMs') IS NOT NEW.created_at_ms
 OR NOT EXISTS(SELECT 1 FROM change_root_contract rc JOIN orchestration_step os ON os.run_id=rc.run_id AND os.task_id=rc.task_id
   JOIN orchestration_plan op ON op.run_id=rc.run_id WHERE rc.run_id=NEW.run_id AND rc.task_id=NEW.task_id AND rc.payload_sha256=NEW.root_contract_digest)
 OR EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id) OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'run staging task authority invalid'); END;
CREATE TRIGGER run_staging_task_authority_no_update BEFORE UPDATE ON run_staging_task_authority BEGIN SELECT RAISE(ABORT,'run staging task authority immutable'); END;
CREATE TRIGGER run_staging_task_authority_no_delete BEFORE DELETE ON run_staging_task_authority BEGIN SELECT RAISE(ABORT,'run staging task authority immutable'); END;
CREATE TRIGGER run_staging_task_authority_no_replace BEFORE INSERT ON run_staging_task_authority WHEN EXISTS(SELECT 1 FROM run_staging_task_authority WHERE run_id=NEW.run_id AND task_id=NEW.task_id) BEGIN SELECT RAISE(ABORT,'run staging task authority immutable'); END;
DROP TRIGGER attempt_staging_setup_insert_guard;
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
   AND (rsa.target_contract_digest=rc.payload_sha256 OR EXISTS(SELECT 1 FROM run_staging_task_authority sta WHERE sta.run_id=a.run_id AND sta.task_id=a.task_id AND sta.root_contract_digest=rc.payload_sha256)))
BEGIN SELECT RAISE(ABORT,'attempt staging setup invalid'); END;
