CREATE TABLE account_identity_migration(singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL);
INSERT INTO account_identity_migration VALUES(1,'cue-account-identity-v1');
CREATE TABLE orchestration_account_identity(run_id TEXT NOT NULL,candidate_id TEXT NOT NULL,digest TEXT NOT NULL CHECK(length(digest)=64),payload BLOB NOT NULL,PRIMARY KEY(run_id,candidate_id),FOREIGN KEY(run_id) REFERENCES run(id));
CREATE TRIGGER account_identity_no_update BEFORE UPDATE ON orchestration_account_identity BEGIN SELECT RAISE(ABORT,'account identity immutable'); END;
CREATE TRIGGER account_identity_no_delete BEFORE DELETE ON orchestration_account_identity BEGIN SELECT RAISE(ABORT,'account identity immutable'); END;
CREATE TRIGGER account_identity_no_replace BEFORE INSERT ON orchestration_account_identity WHEN EXISTS(SELECT 1 FROM orchestration_account_identity WHERE run_id=NEW.run_id AND candidate_id=NEW.candidate_id) BEGIN SELECT RAISE(ABORT,'account identity immutable'); END;

CREATE TRIGGER account_identity_insert_guard BEFORE INSERT ON orchestration_account_identity
WHEN typeof(NEW.payload)<>'blob' OR length(NEW.payload) NOT BETWEEN 1 AND 16384 OR cue_sha256(NEW.payload)<>NEW.digest
 OR json_valid(NEW.payload)<>1
 OR (SELECT count(*) FROM json_each(NEW.payload))<>11
 OR NOT(json_extract(NEW.payload,'$.runId') IS NEW.run_id)
 OR NOT(json_extract(NEW.payload,'$.candidateId') IS NEW.candidate_id)
 OR json_type(NEW.payload,'$.authReference') IS NOT 'text'
 OR length(json_extract(NEW.payload,'$.authReference')) NOT BETWEEN 1 AND 200
 OR json_type(NEW.payload,'$.endpointId') IS NULL
 OR json_type(NEW.payload,'$.modelId') IS NULL
 OR NOT EXISTS(SELECT 1 FROM run r JOIN orchestration_plan p ON p.run_id=r.id JOIN selection_run_policy q ON q.run_id=r.id
   WHERE r.id=NEW.run_id AND r.envelope_hash=json_extract(NEW.payload,'$.envelopeHash')
    AND p.digest=json_extract(NEW.payload,'$.planDigest') AND q.digest=json_extract(NEW.payload,'$.policyDigest'))
 OR EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id)
 OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'account identity insert binding mismatch'); END;
