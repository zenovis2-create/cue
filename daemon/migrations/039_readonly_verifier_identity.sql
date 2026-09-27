CREATE TABLE IF NOT EXISTS readonly_verifier_migration(singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL CHECK(version='cue-readonly-verifier-v1'));
CREATE TABLE IF NOT EXISTS readonly_verifier_identity(
 sha256 TEXT PRIMARY KEY CHECK(length(sha256)=64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
 attempt_id TEXT NOT NULL UNIQUE REFERENCES orchestration_attempt(attempt_id),
 session_handle TEXT NOT NULL UNIQUE REFERENCES session_handle(handle),
 subject_digest TEXT NOT NULL CHECK(length(subject_digest)=64 AND subject_digest NOT GLOB '*[^0-9a-f]*'),
 payload BLOB NOT NULL
);
CREATE TRIGGER readonly_verifier_identity_hash BEFORE INSERT ON readonly_verifier_identity
 WHEN cue_sha256(NEW.payload)<>NEW.sha256 BEGIN SELECT RAISE(ABORT,'readonly verifier identity hash mismatch'); END;
CREATE TRIGGER readonly_verifier_identity_payload BEFORE INSERT ON readonly_verifier_identity WHEN
 typeof(NEW.payload)<>'blob' OR length(NEW.payload) NOT BETWEEN 1 AND 32768 OR json_valid(NEW.payload)<>1 OR
 json_extract(NEW.payload,'$.version') IS NOT 'cue-readonly-verifier-identity-v1' OR json_extract(NEW.payload,'$.attemptId') IS NOT NEW.attempt_id OR
 json_extract(NEW.payload,'$.subjectDigest') IS NOT NEW.subject_digest OR json_extract(NEW.payload,'$.session.handle') IS NOT NEW.session_handle OR
 (SELECT COUNT(*) FROM json_each(NEW.payload))<>11 OR length(json_extract(NEW.payload,'$.environmentDigest'))<>64 OR (SELECT COUNT(*) FROM json_each(NEW.payload,'$.session'))<>6 OR (SELECT COUNT(*) FROM json_each(NEW.payload,'$.worker'))<>2
 BEGIN SELECT RAISE(ABORT,'readonly verifier identity payload mismatch'); END;
CREATE TRIGGER readonly_verifier_identity_lineage BEFORE INSERT ON readonly_verifier_identity
 WHEN NOT EXISTS(SELECT 1 FROM orchestration_attempt a JOIN orchestration_step s ON s.run_id=a.run_id AND s.task_id=a.task_id
 JOIN orchestration_launch_intent l ON l.attempt_id=a.attempt_id
 JOIN orchestration_plan p ON p.run_id=a.run_id JOIN json_each(p.payload,'$.tasks') t
 JOIN orchestration_stage_envelope e ON e.attempt_id=a.attempt_id
 JOIN session_handle h ON h.handle=NEW.session_handle AND h.run_id=e.attempt_id AND h.task_id=e.stage_task_id
 WHERE a.attempt_id=NEW.attempt_id AND json_extract(t.value,'$.id')=a.task_id AND json_extract(t.value,'$.role')='verifier' AND l.expected_subject_digest=NEW.subject_digest)
 BEGIN SELECT RAISE(ABORT,'readonly verifier identity lineage mismatch'); END;
CREATE TRIGGER readonly_verifier_identity_session BEFORE INSERT ON readonly_verifier_identity WHEN NOT EXISTS(
 SELECT 1 FROM session_handle h WHERE h.handle=NEW.session_handle AND h.pid=json_extract(NEW.payload,'$.session.pid') AND h.start_time=json_extract(NEW.payload,'$.session.start_time')
 AND h.cwd=json_extract(NEW.payload,'$.session.cwd') AND h.task_id=json_extract(NEW.payload,'$.session.task_id') AND h.run_id=json_extract(NEW.payload,'$.session.run_id'))
 BEGIN SELECT RAISE(ABORT,'readonly verifier session mismatch'); END;
CREATE TRIGGER readonly_verifier_identity_update BEFORE UPDATE ON readonly_verifier_identity BEGIN SELECT RAISE(ABORT,'readonly verifier identity immutable'); END;
CREATE TRIGGER readonly_verifier_identity_delete BEFORE DELETE ON readonly_verifier_identity BEGIN SELECT RAISE(ABORT,'readonly verifier identity immutable'); END;

CREATE TABLE IF NOT EXISTS readonly_verifier_cleanup(
 sha256 TEXT PRIMARY KEY CHECK(length(sha256)=64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
 attempt_id TEXT NOT NULL UNIQUE REFERENCES readonly_verifier_identity(attempt_id),
 identity_sha256 TEXT NOT NULL REFERENCES readonly_verifier_identity(sha256),
 payload BLOB NOT NULL
);
CREATE TRIGGER readonly_verifier_cleanup_hash BEFORE INSERT ON readonly_verifier_cleanup
 WHEN cue_sha256(NEW.payload)<>NEW.sha256 BEGIN SELECT RAISE(ABORT,'readonly verifier cleanup hash mismatch'); END;
CREATE TRIGGER readonly_verifier_cleanup_payload BEFORE INSERT ON readonly_verifier_cleanup WHEN
 typeof(NEW.payload)<>'blob' OR length(NEW.payload) NOT BETWEEN 1 AND 32768 OR json_valid(NEW.payload)<>1 OR
 json_extract(NEW.payload,'$.version') IS NOT 'cue-readonly-verifier-cleanup-v1' OR json_extract(NEW.payload,'$.attemptId') IS NOT NEW.attempt_id OR
 json_extract(NEW.payload,'$.identitySha256') IS NOT NEW.identity_sha256 OR json_extract(NEW.payload,'$.result') IS NOT 'verified-clean' OR
 json_extract(NEW.payload,'$.aclRestored') IS NOT 1 OR json_extract(NEW.payload,'$.profileAbsent') IS NOT 1 OR json_extract(NEW.payload,'$.runtimeAbsent') IS NOT 1 OR json_extract(NEW.payload,'$.processesDead') IS NOT 1 OR
 (SELECT COUNT(*) FROM json_each(NEW.payload))<>10
 BEGIN SELECT RAISE(ABORT,'readonly verifier cleanup payload mismatch'); END;
CREATE TRIGGER readonly_verifier_cleanup_lineage BEFORE INSERT ON readonly_verifier_cleanup
 WHEN NOT EXISTS(SELECT 1 FROM readonly_verifier_identity i WHERE i.attempt_id=NEW.attempt_id AND i.sha256=NEW.identity_sha256 AND json_extract(i.payload,'$.rootIdentity')=json_extract(NEW.payload,'$.rootIdentity'))
 BEGIN SELECT RAISE(ABORT,'readonly verifier cleanup lineage mismatch'); END;
CREATE TRIGGER readonly_verifier_cleanup_update BEFORE UPDATE ON readonly_verifier_cleanup BEGIN SELECT RAISE(ABORT,'readonly verifier cleanup immutable'); END;
CREATE TRIGGER readonly_verifier_cleanup_delete BEFORE DELETE ON readonly_verifier_cleanup BEGIN SELECT RAISE(ABORT,'readonly verifier cleanup immutable'); END;
INSERT INTO readonly_verifier_migration SELECT 1,'cue-readonly-verifier-v1' WHERE NOT EXISTS(SELECT 1 FROM readonly_verifier_migration);
CREATE TRIGGER readonly_verifier_migration_update BEFORE UPDATE ON readonly_verifier_migration BEGIN SELECT RAISE(ABORT,'readonly verifier migration immutable'); END;
CREATE TRIGGER readonly_verifier_migration_delete BEFORE DELETE ON readonly_verifier_migration BEGIN SELECT RAISE(ABORT,'readonly verifier migration immutable'); END;
