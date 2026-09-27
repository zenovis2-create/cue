CREATE TABLE IF NOT EXISTS change_publication_migration(
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 version TEXT NOT NULL CHECK(version='cue-change-publication-v1')
);

CREATE TABLE IF NOT EXISTS change_publication_intent(
 publication_id TEXT PRIMARY KEY,
 change_set_id TEXT NOT NULL REFERENCES change_set(change_set_id),
 run_id TEXT NOT NULL,
 task_id TEXT NOT NULL,
 attempt_id TEXT NOT NULL REFERENCES orchestration_attempt(attempt_id),
 stage_envelope_hash TEXT NOT NULL REFERENCES envelope(envelope_hash),
 parent_envelope_hash TEXT NOT NULL REFERENCES envelope(envelope_hash),
 plan_digest TEXT NOT NULL CHECK(length(plan_digest)=64),
 worktree_realpath TEXT NOT NULL,
 root_volume_serial TEXT NOT NULL CHECK(length(root_volume_serial)=16),
 root_file_id TEXT NOT NULL CHECK(length(root_file_id)=32),
 snapshot_protocol TEXT NOT NULL CHECK(snapshot_protocol='cue-change-snapshot-v1'),
 snapshot_helper_sha256 TEXT NOT NULL CHECK(length(snapshot_helper_sha256)=64),
 target_ordinal INTEGER NOT NULL CHECK(target_ordinal>=0),
 relative_path TEXT NOT NULL,
 max_bytes INTEGER NOT NULL CHECK(max_bytes BETWEEN 1 AND 16777216),
 preimage_volume_serial TEXT NOT NULL CHECK(length(preimage_volume_serial)=16),
 preimage_file_id TEXT NOT NULL CHECK(length(preimage_file_id)=32),
 preimage_byte_length INTEGER NOT NULL CHECK(preimage_byte_length BETWEEN 0 AND 16777216),
 preimage_sha256 TEXT NOT NULL CHECK(length(preimage_sha256)=64),
 replacement_byte_length INTEGER NOT NULL CHECK(replacement_byte_length BETWEEN 0 AND 16777216),
 replacement_sha256 TEXT NOT NULL CHECK(length(replacement_sha256)=64),
 lease_acquired_at TEXT NOT NULL,
 created_at_ms INTEGER NOT NULL CHECK(created_at_ms>=0),
 payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
 payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576),
 UNIQUE(change_set_id,relative_path,replacement_sha256,replacement_byte_length)
);

CREATE TABLE IF NOT EXISTS change_publication_result(
 publication_id TEXT PRIMARY KEY REFERENCES change_publication_intent(publication_id),
 state TEXT NOT NULL CHECK(state IN('committed','contention','unknown')),
 reason TEXT,
 root_volume_serial TEXT,
 root_file_id TEXT,
 before_volume_serial TEXT,
 before_file_id TEXT,
 before_byte_length INTEGER,
 before_sha256 TEXT,
 after_volume_serial TEXT,
 after_file_id TEXT,
 after_byte_length INTEGER,
 after_sha256 TEXT,
 recorded_at_ms INTEGER NOT NULL CHECK(recorded_at_ms>=0),
 payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
 payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576),
 CHECK((state='committed' AND reason IS NULL AND root_volume_serial IS NOT NULL AND root_file_id IS NOT NULL
   AND before_volume_serial IS NOT NULL AND before_file_id IS NOT NULL AND before_byte_length IS NOT NULL AND before_sha256 IS NOT NULL
   AND after_volume_serial IS NOT NULL AND after_file_id IS NOT NULL AND after_byte_length IS NOT NULL AND after_sha256 IS NOT NULL)
  OR (state='contention' AND reason='native-contention' AND root_volume_serial IS NULL AND root_file_id IS NULL
   AND before_volume_serial IS NULL AND before_file_id IS NULL AND before_byte_length IS NULL AND before_sha256 IS NULL
   AND after_volume_serial IS NULL AND after_file_id IS NULL AND after_byte_length IS NULL AND after_sha256 IS NULL)
  OR (state='unknown' AND reason='native-unknown' AND root_volume_serial IS NULL AND root_file_id IS NULL
   AND before_volume_serial IS NULL AND before_file_id IS NULL AND before_byte_length IS NULL AND before_sha256 IS NULL
   AND after_volume_serial IS NULL AND after_file_id IS NULL AND after_byte_length IS NULL AND after_sha256 IS NULL))
);

CREATE TRIGGER change_publication_migration_no_update BEFORE UPDATE ON change_publication_migration
BEGIN SELECT RAISE(ABORT,'change publication migration immutable'); END;
CREATE TRIGGER change_publication_migration_no_delete BEFORE DELETE ON change_publication_migration
BEGIN SELECT RAISE(ABORT,'change publication migration immutable'); END;
CREATE TRIGGER change_publication_migration_no_replace BEFORE INSERT ON change_publication_migration
WHEN EXISTS(SELECT 1 FROM change_publication_migration WHERE singleton=NEW.singleton)
BEGIN SELECT RAISE(ABORT,'change publication migration immutable'); END;

CREATE TRIGGER change_publication_intent_insert_guard BEFORE INSERT ON change_publication_intent
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256
 OR json_valid(NEW.payload)<>1
 OR json_extract(NEW.payload,'$.schemaVersion') IS NOT 'cue-change-publication-intent-v1'
 OR json_extract(NEW.payload,'$.publicationId') IS NOT NEW.publication_id
 OR json_extract(NEW.payload,'$.changeSetId') IS NOT NEW.change_set_id
 OR json_extract(NEW.payload,'$.runId') IS NOT NEW.run_id
 OR json_extract(NEW.payload,'$.taskId') IS NOT NEW.task_id
 OR json_extract(NEW.payload,'$.attemptId') IS NOT NEW.attempt_id
 OR json_extract(NEW.payload,'$.stageEnvelopeHash') IS NOT NEW.stage_envelope_hash
 OR json_extract(NEW.payload,'$.parentEnvelopeHash') IS NOT NEW.parent_envelope_hash
 OR json_extract(NEW.payload,'$.planDigest') IS NOT NEW.plan_digest
 OR json_extract(NEW.payload,'$.worktreeRealpath') IS NOT NEW.worktree_realpath
 OR json_extract(NEW.payload,'$.rootIdentity.volumeSerial') IS NOT NEW.root_volume_serial
 OR json_extract(NEW.payload,'$.rootIdentity.fileId') IS NOT NEW.root_file_id
 OR json_extract(NEW.payload,'$.snapshotProtocol') IS NOT NEW.snapshot_protocol
 OR json_extract(NEW.payload,'$.snapshotHelperSha256') IS NOT NEW.snapshot_helper_sha256
 OR json_extract(NEW.payload,'$.targetOrdinal') IS NOT NEW.target_ordinal
 OR json_extract(NEW.payload,'$.relativePath') IS NOT NEW.relative_path
 OR json_extract(NEW.payload,'$.maxBytes') IS NOT NEW.max_bytes
 OR json_extract(NEW.payload,'$.preimage.identity.volumeSerial') IS NOT NEW.preimage_volume_serial
 OR json_extract(NEW.payload,'$.preimage.identity.fileId') IS NOT NEW.preimage_file_id
 OR json_extract(NEW.payload,'$.preimage.byteLength') IS NOT NEW.preimage_byte_length
 OR json_extract(NEW.payload,'$.preimage.sha256') IS NOT NEW.preimage_sha256
 OR json_extract(NEW.payload,'$.replacement.byteLength') IS NOT NEW.replacement_byte_length
 OR json_extract(NEW.payload,'$.replacement.sha256') IS NOT NEW.replacement_sha256
 OR json_extract(NEW.payload,'$.leaseAcquiredAt') IS NOT NEW.lease_acquired_at
 OR json_extract(NEW.payload,'$.createdAtMs') IS NOT NEW.created_at_ms
 OR NOT EXISTS(
  SELECT 1 FROM change_set cs
  JOIN change_entry ce ON ce.change_set_id=cs.change_set_id AND ce.ordinal=NEW.target_ordinal
  JOIN change_native_binding nb ON nb.change_set_id=cs.change_set_id
  JOIN change_root_contract rc ON rc.run_id=cs.run_id AND rc.task_id=cs.task_id
  JOIN change_target_contract tc ON tc.run_id=cs.run_id AND tc.task_id=cs.task_id AND tc.relative_path=ce.relative_path
  JOIN orchestration_attempt a ON a.attempt_id=cs.attempt_id
  JOIN orchestration_stage_envelope se ON se.attempt_id=a.attempt_id
  JOIN orchestration_step os ON os.run_id=a.run_id AND os.task_id=a.task_id
  JOIN orchestration_plan op ON op.run_id=a.run_id
  JOIN run wr ON wr.id=a.run_id
  JOIN task wt ON wt.id=wr.task_id
  JOIN run sr ON sr.id=se.stage_run_id
  JOIN task st ON st.id=sr.task_id
  JOIN workspace_write_lease wl ON wl.run_id=a.run_id AND lower(wl.worktree_realpath)=lower(a.worktree_realpath)
  WHERE cs.change_set_id=NEW.change_set_id AND cs.run_id=NEW.run_id AND cs.task_id=NEW.task_id AND cs.attempt_id=NEW.attempt_id
   AND cs.stage_envelope_hash=NEW.stage_envelope_hash AND cs.worktree_realpath=NEW.worktree_realpath
   AND a.state='running' AND os.state='running' AND wt.state='running' AND st.state='running'
   AND se.workflow_run_id=NEW.run_id AND se.plan_task_id=NEW.task_id AND se.stage_envelope_hash=NEW.stage_envelope_hash
   AND se.parent_envelope_hash=NEW.parent_envelope_hash AND se.plan_digest=NEW.plan_digest AND op.digest=NEW.plan_digest
   AND a.worktree_realpath=NEW.worktree_realpath AND a.lease_acquired_at=NEW.lease_acquired_at AND wl.acquired_at=NEW.lease_acquired_at
   AND nb.run_id=NEW.run_id AND nb.task_id=NEW.task_id
   AND nb.volume_serial=NEW.root_volume_serial AND nb.file_id=NEW.root_file_id
   AND nb.snapshot_protocol=NEW.snapshot_protocol AND nb.snapshot_helper_sha256=NEW.snapshot_helper_sha256
   AND rc.worktree_realpath=NEW.worktree_realpath AND rc.volume_serial=NEW.root_volume_serial AND rc.file_id=NEW.root_file_id
   AND rc.snapshot_protocol=NEW.snapshot_protocol AND rc.snapshot_helper_sha256=NEW.snapshot_helper_sha256
   AND ce.relative_path=NEW.relative_path AND ce.object_kind='file' AND ce.restorable=1 AND ce.preimage IS NOT NULL
   AND ce.file_identity=NEW.preimage_volume_serial||':'||NEW.preimage_file_id
   AND ce.byte_length=NEW.preimage_byte_length AND ce.sha256=NEW.preimage_sha256 AND cue_sha256(ce.preimage)=NEW.preimage_sha256
   AND tc.max_backup_bytes=NEW.max_bytes AND NEW.preimage_byte_length<=NEW.max_bytes AND NEW.replacement_byte_length<=NEW.max_bytes
 )
 OR EXISTS(SELECT 1 FROM held_recovery h WHERE h.attempt_id=NEW.attempt_id)
 OR EXISTS(SELECT 1 FROM orchestration_recovery_decision d WHERE d.prior_attempt_id=NEW.attempt_id AND d.action='stop')
BEGIN SELECT RAISE(ABORT,'change publication intent invalid'); END;
CREATE TRIGGER change_publication_intent_no_update BEFORE UPDATE ON change_publication_intent
BEGIN SELECT RAISE(ABORT,'change publication intent immutable'); END;
CREATE TRIGGER change_publication_intent_no_delete BEFORE DELETE ON change_publication_intent
BEGIN SELECT RAISE(ABORT,'change publication intent immutable'); END;
CREATE TRIGGER change_publication_intent_no_replace BEFORE INSERT ON change_publication_intent
WHEN EXISTS(SELECT 1 FROM change_publication_intent WHERE publication_id=NEW.publication_id)
BEGIN SELECT RAISE(ABORT,'change publication intent immutable'); END;

CREATE TRIGGER change_publication_result_insert_guard BEFORE INSERT ON change_publication_result
WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256
 OR json_valid(NEW.payload)<>1
 OR json_extract(NEW.payload,'$.schemaVersion') IS NOT 'cue-change-publication-result-v1'
 OR json_extract(NEW.payload,'$.publicationId') IS NOT NEW.publication_id
 OR json_extract(NEW.payload,'$.state') IS NOT NEW.state
 OR NOT(json_extract(NEW.payload,'$.reason') IS NEW.reason)
 OR (NEW.state='contention' AND NEW.reason<>'native-contention')
 OR (NEW.state='unknown' AND NEW.reason<>'native-unknown')
 OR NOT(json_extract(NEW.payload,'$.rootIdentity.volumeSerial') IS NEW.root_volume_serial)
 OR NOT(json_extract(NEW.payload,'$.rootIdentity.fileId') IS NEW.root_file_id)
 OR NOT(json_extract(NEW.payload,'$.before.identity.volumeSerial') IS NEW.before_volume_serial)
 OR NOT(json_extract(NEW.payload,'$.before.identity.fileId') IS NEW.before_file_id)
 OR NOT(json_extract(NEW.payload,'$.before.byteLength') IS NEW.before_byte_length)
 OR NOT(json_extract(NEW.payload,'$.before.sha256') IS NEW.before_sha256)
 OR NOT(json_extract(NEW.payload,'$.after.identity.volumeSerial') IS NEW.after_volume_serial)
 OR NOT(json_extract(NEW.payload,'$.after.identity.fileId') IS NEW.after_file_id)
 OR NOT(json_extract(NEW.payload,'$.after.byteLength') IS NEW.after_byte_length)
 OR NOT(json_extract(NEW.payload,'$.after.sha256') IS NEW.after_sha256)
 OR json_extract(NEW.payload,'$.recordedAtMs') IS NOT NEW.recorded_at_ms
 OR NOT EXISTS(SELECT 1 FROM change_publication_intent i WHERE i.publication_id=NEW.publication_id AND NEW.recorded_at_ms>=i.created_at_ms
   AND (NEW.state<>'committed' OR (NEW.root_volume_serial=i.root_volume_serial AND NEW.root_file_id=i.root_file_id
    AND NEW.before_volume_serial=i.preimage_volume_serial AND NEW.before_file_id=i.preimage_file_id
    AND NEW.before_byte_length=i.preimage_byte_length AND NEW.before_sha256=i.preimage_sha256
    AND NEW.after_volume_serial=i.preimage_volume_serial AND NEW.after_file_id=i.preimage_file_id
    AND NEW.after_byte_length=i.replacement_byte_length AND NEW.after_sha256=i.replacement_sha256)))
BEGIN SELECT RAISE(ABORT,'change publication result invalid'); END;
CREATE TRIGGER change_publication_result_no_update BEFORE UPDATE ON change_publication_result
BEGIN SELECT RAISE(ABORT,'change publication result immutable'); END;
CREATE TRIGGER change_publication_result_no_delete BEFORE DELETE ON change_publication_result
BEGIN SELECT RAISE(ABORT,'change publication result immutable'); END;
CREATE TRIGGER change_publication_result_no_replace BEFORE INSERT ON change_publication_result
WHEN EXISTS(SELECT 1 FROM change_publication_result WHERE publication_id=NEW.publication_id)
BEGIN SELECT RAISE(ABORT,'change publication result immutable'); END;

CREATE TRIGGER change_publication_lease_no_unsafe_delete BEFORE DELETE ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM change_publication_intent i LEFT JOIN change_publication_result r USING(publication_id)
 WHERE i.run_id=OLD.run_id AND lower(i.worktree_realpath)=lower(OLD.worktree_realpath) AND i.lease_acquired_at=OLD.acquired_at
 AND (r.publication_id IS NULL OR r.state='unknown'))
BEGIN SELECT RAISE(ABORT,'change publication outcome unresolved'); END;
CREATE TRIGGER change_publication_lease_no_unsafe_update BEFORE UPDATE ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM change_publication_intent i LEFT JOIN change_publication_result r USING(publication_id)
 WHERE i.run_id=OLD.run_id AND lower(i.worktree_realpath)=lower(OLD.worktree_realpath) AND i.lease_acquired_at=OLD.acquired_at
 AND (r.publication_id IS NULL OR r.state='unknown'))
BEGIN SELECT RAISE(ABORT,'change publication outcome unresolved'); END;
CREATE TRIGGER change_publication_lease_no_unsafe_replace BEFORE INSERT ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM workspace_write_lease w JOIN change_publication_intent i
 ON i.run_id=w.run_id AND lower(i.worktree_realpath)=lower(w.worktree_realpath) AND i.lease_acquired_at=w.acquired_at
 LEFT JOIN change_publication_result r USING(publication_id)
 WHERE (lower(w.worktree_realpath)=lower(NEW.worktree_realpath) OR w.run_id=NEW.run_id)
 AND (r.publication_id IS NULL OR r.state='unknown'))
BEGIN SELECT RAISE(ABORT,'change publication outcome unresolved'); END;

INSERT INTO change_publication_migration VALUES(1,'cue-change-publication-v1');
