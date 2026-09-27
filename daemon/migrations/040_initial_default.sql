CREATE TABLE IF NOT EXISTS initial_default_migration(
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL CHECK(version='cue-initial-default-v1')
);
CREATE TABLE IF NOT EXISTS initial_default(
 run_id TEXT PRIMARY KEY REFERENCES run(id),policy_id TEXT NOT NULL,policy_revision INTEGER NOT NULL,
 policy_digest TEXT NOT NULL CHECK(length(policy_digest)=64),default_candidate_id TEXT NOT NULL,
 digest TEXT NOT NULL CHECK(length(digest)=64),payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576),
 FOREIGN KEY(run_id) REFERENCES selection_run_policy(run_id),
 FOREIGN KEY(policy_id,policy_revision,policy_digest) REFERENCES selection_policy_snapshot(policy_id,revision,digest)
);
CREATE TABLE IF NOT EXISTS initial_default_attempt(
 attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id),run_id TEXT NOT NULL,request_id TEXT NOT NULL,
 disposition TEXT NOT NULL CHECK(disposition IN('legacy-observation-absent','no-statistics')),candidate_id TEXT NOT NULL,
 default_digest TEXT NOT NULL,digest TEXT NOT NULL CHECK(length(digest)=64),payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 1048576),
 FOREIGN KEY(run_id) REFERENCES initial_default(run_id),FOREIGN KEY(run_id,request_id) REFERENCES integration_budget_reservation(run_id,request_id)
);

CREATE TRIGGER initial_default_hash BEFORE INSERT ON initial_default WHEN cue_sha256(NEW.payload)<>NEW.digest BEGIN SELECT RAISE(ABORT,'initial default hash mismatch'); END;
CREATE TRIGGER initial_default_payload BEFORE INSERT ON initial_default WHEN json_valid(NEW.payload)<>1 OR json_extract(NEW.payload,'$.version')<>'cue-initial-default-v1' OR json_extract(NEW.payload,'$.runId')<>NEW.run_id OR json_extract(NEW.payload,'$.policyId')<>NEW.policy_id OR json_extract(NEW.payload,'$.policyRevision')<>NEW.policy_revision OR json_extract(NEW.payload,'$.policyDigest')<>NEW.policy_digest OR json_extract(NEW.payload,'$.defaultCandidateId')<>NEW.default_candidate_id OR (SELECT COUNT(*) FROM json_each(NEW.payload))<>9 OR (SELECT COUNT(*) FROM json_each(NEW.payload,'$.conservativeEstimate'))<>9 BEGIN SELECT RAISE(ABORT,'initial default payload mismatch'); END;
CREATE TRIGGER initial_default_lineage BEFORE INSERT ON initial_default WHEN NOT EXISTS(
 SELECT 1 FROM selection_run_policy r JOIN selection_policy_snapshot p ON p.policy_id=r.policy_id AND p.revision=r.revision AND p.digest=r.digest
 JOIN integration_budget b ON b.run_id=r.run_id JOIN json_each(p.policy_json,'$.allowedCandidateIds') c
 WHERE r.run_id=NEW.run_id AND r.policy_id=NEW.policy_id AND r.revision=NEW.policy_revision AND r.digest=NEW.policy_digest
 AND b.currency=json_extract(NEW.payload,'$.conservativeEstimate.currency') AND b.policy_revision=NEW.policy_id||':'||NEW.policy_revision
 AND json_extract(p.policy_json,'$.currency')=json_extract(NEW.payload,'$.conservativeEstimate.currency')
 AND c.value=NEW.default_candidate_id AND json_extract(NEW.payload,'$.conservativeEstimate.scope')='verified-completion-total'
 AND typeof(json_extract(NEW.payload,'$.conservativeEstimate.quality')) IN('integer','real') AND json_extract(NEW.payload,'$.conservativeEstimate.quality')>=json_extract(p.policy_json,'$.qualityMinimum') AND json_extract(NEW.payload,'$.conservativeEstimate.quality')<=1
 AND typeof(json_extract(NEW.payload,'$.conservativeEstimate.expectedCost')) IN('integer','real') AND json_extract(NEW.payload,'$.conservativeEstimate.expectedCost') BETWEEN 0 AND 9007199254740991
 AND typeof(json_extract(NEW.payload,'$.conservativeEstimate.conservativeMaxCost')) IN('integer','real') AND json_extract(NEW.payload,'$.conservativeEstimate.conservativeMaxCost')>=json_extract(NEW.payload,'$.conservativeEstimate.expectedCost')
 AND json_extract(NEW.payload,'$.conservativeEstimate.conservativeMaxCost')<=9007199254740991 AND (json_extract(p.policy_json,'$.costLimit') IS NULL OR json_extract(NEW.payload,'$.conservativeEstimate.conservativeMaxCost')<=json_extract(p.policy_json,'$.costLimit'))
 AND typeof(json_extract(NEW.payload,'$.conservativeEstimate.expectedTimeMs')) IN('integer','real') AND json_extract(NEW.payload,'$.conservativeEstimate.expectedTimeMs') BETWEEN 0 AND 9007199254740991
 AND typeof(json_extract(NEW.payload,'$.conservativeEstimate.conservativeMaxTimeMs')) IN('integer','real') AND json_extract(NEW.payload,'$.conservativeEstimate.conservativeMaxTimeMs')>=json_extract(NEW.payload,'$.conservativeEstimate.expectedTimeMs')
 AND json_extract(NEW.payload,'$.conservativeEstimate.conservativeMaxTimeMs')<=9007199254740991 AND (json_extract(p.policy_json,'$.remainingTimeMs') IS NULL OR json_extract(NEW.payload,'$.conservativeEstimate.conservativeMaxTimeMs')<=json_extract(p.policy_json,'$.remainingTimeMs'))
 AND typeof(json_extract(NEW.payload,'$.conservativeEstimate.observedAtMs'))='integer' AND json_extract(NEW.payload,'$.conservativeEstimate.observedAtMs') BETWEEN 0 AND 9007199254740991
 AND typeof(json_extract(NEW.payload,'$.boundAtMs'))='integer' AND json_extract(NEW.payload,'$.boundAtMs') BETWEEN 0 AND 9007199254740991 AND json_extract(NEW.payload,'$.conservativeEstimate.observedAtMs')<=json_extract(NEW.payload,'$.boundAtMs')
 AND json_extract(NEW.payload,'$.boundAtMs')-json_extract(NEW.payload,'$.conservativeEstimate.observedAtMs')<=json_extract(p.policy_json,'$.maxEstimateAgeMs')
 AND typeof(json_extract(NEW.payload,'$.source'))='text' AND length(trim(json_extract(NEW.payload,'$.source'))) BETWEEN 1 AND 256
 AND typeof(json_extract(NEW.payload,'$.conservativeEstimate.source'))='text' AND length(trim(json_extract(NEW.payload,'$.conservativeEstimate.source'))) BETWEEN 1 AND 256
) BEGIN SELECT RAISE(ABORT,'initial default lineage mismatch'); END;
CREATE TRIGGER initial_default_timing BEFORE INSERT ON initial_default WHEN EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id) OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id) BEGIN SELECT RAISE(ABORT,'initial default binding too late'); END;
CREATE TRIGGER initial_default_update BEFORE UPDATE ON initial_default BEGIN SELECT RAISE(ABORT,'initial default immutable'); END;
CREATE TRIGGER initial_default_delete BEFORE DELETE ON initial_default BEGIN SELECT RAISE(ABORT,'initial default immutable'); END;
CREATE TRIGGER initial_default_replace BEFORE INSERT ON initial_default WHEN EXISTS(SELECT 1 FROM initial_default WHERE run_id=NEW.run_id) BEGIN SELECT RAISE(ABORT,'initial default immutable'); END;

CREATE TRIGGER initial_default_attempt_hash BEFORE INSERT ON initial_default_attempt WHEN cue_sha256(NEW.payload)<>NEW.digest BEGIN SELECT RAISE(ABORT,'initial default attempt hash mismatch'); END;
CREATE TRIGGER initial_default_attempt_lineage BEFORE INSERT ON initial_default_attempt WHEN NOT EXISTS(SELECT 1 FROM orchestration_attempt a JOIN integration_budget_reservation b ON b.run_id=a.run_id AND b.attempt_id=a.attempt_id AND b.request_id=NEW.request_id JOIN initial_default d ON d.run_id=a.run_id WHERE a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND a.candidate_id=NEW.candidate_id AND d.digest=NEW.default_digest) BEGIN SELECT RAISE(ABORT,'initial default attempt lineage mismatch'); END;
CREATE TRIGGER initial_default_attempt_update BEFORE UPDATE ON initial_default_attempt BEGIN SELECT RAISE(ABORT,'initial default attempt immutable'); END;
CREATE TRIGGER initial_default_attempt_delete BEFORE DELETE ON initial_default_attempt BEGIN SELECT RAISE(ABORT,'initial default attempt immutable'); END;
CREATE TRIGGER initial_default_attempt_replace BEFORE INSERT ON initial_default_attempt WHEN EXISTS(SELECT 1 FROM initial_default_attempt WHERE attempt_id=NEW.attempt_id) BEGIN SELECT RAISE(ABORT,'initial default attempt immutable'); END;

INSERT INTO initial_default_migration SELECT 1,'cue-initial-default-v1' WHERE NOT EXISTS(SELECT 1 FROM initial_default_migration);
CREATE TRIGGER initial_default_migration_update BEFORE UPDATE ON initial_default_migration BEGIN SELECT RAISE(ABORT,'initial default migration immutable'); END;
CREATE TRIGGER initial_default_migration_delete BEFORE DELETE ON initial_default_migration BEGIN SELECT RAISE(ABORT,'initial default migration immutable'); END;
CREATE TRIGGER initial_default_migration_replace BEFORE INSERT ON initial_default_migration WHEN EXISTS(SELECT 1 FROM initial_default_migration) BEGIN SELECT RAISE(ABORT,'initial default migration immutable'); END;
