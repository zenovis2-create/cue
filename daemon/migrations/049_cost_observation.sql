CREATE TABLE cost_observation_migration(singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL CHECK(version='cue-persisted-cost-observation-v1')) STRICT;
INSERT INTO cost_observation_migration VALUES(1,'cue-persisted-cost-observation-v1');

CREATE TABLE orchestration_cost_observation(
 observation_id TEXT PRIMARY KEY CHECK(length(observation_id) BETWEEN 1 AND 128),
 run_id TEXT NOT NULL REFERENCES run(id),
 attempt_id TEXT NOT NULL UNIQUE REFERENCES orchestration_attempt(attempt_id),
 candidate_id TEXT NOT NULL CHECK(length(candidate_id) BETWEEN 1 AND 128),
 subject_digest TEXT NOT NULL CHECK(length(subject_digest)=64),
 identity_kind TEXT NOT NULL CHECK(identity_kind IN('account','local-attempt')),
 identity_ref TEXT NOT NULL CHECK(length(identity_ref) BETWEEN 1 AND 200),
 identity_digest TEXT NOT NULL CHECK(length(identity_digest)=64),
 cost_dimension TEXT NOT NULL CHECK(cost_dimension IN('api','subscription','local-resource')),
 cost_state TEXT NOT NULL CHECK(cost_state IN('actual','estimated','unknown')),
 observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0),
 valid_until_ms INTEGER NOT NULL CHECK(valid_until_ms>=observed_at_ms),
 source_ref TEXT NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 128),
 source_digest TEXT NOT NULL CHECK(length(source_digest)=64),
 payload BLOB NOT NULL CHECK(typeof(payload)='blob' AND length(payload) BETWEEN 1 AND 16384),
 payload_digest TEXT NOT NULL CHECK(length(payload_digest)=64),
 source_evidence BLOB NOT NULL CHECK(typeof(source_evidence)='blob' AND length(source_evidence) BETWEEN 1 AND 1048576)
) STRICT;

CREATE TRIGGER cost_observation_insert_guard BEFORE INSERT ON orchestration_cost_observation
WHEN cue_sha256(NEW.payload)<>NEW.payload_digest OR cue_sha256(NEW.source_evidence)<>NEW.source_digest
 OR json_valid(NEW.payload)<>1 OR cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT)
 OR (SELECT count(*) FROM json_each(NEW.payload))<>3
 OR json_extract(NEW.payload,'$.version') IS NOT 'cue-persisted-cost-observation-v1'
 OR json_type(NEW.payload,'$.lineage') IS NOT 'object' OR (SELECT count(*) FROM json_each(NEW.payload,'$.lineage'))<>7
 OR json_extract(NEW.payload,'$.lineage.runId') IS NOT NEW.run_id OR json_extract(NEW.payload,'$.lineage.attemptId') IS NOT NEW.attempt_id
 OR json_extract(NEW.payload,'$.lineage.candidateId') IS NOT NEW.candidate_id OR json_extract(NEW.payload,'$.lineage.subjectDigest') IS NOT NEW.subject_digest
 OR json_extract(NEW.payload,'$.lineage.identityKind') IS NOT NEW.identity_kind OR json_extract(NEW.payload,'$.lineage.identityRef') IS NOT NEW.identity_ref
 OR json_extract(NEW.payload,'$.lineage.identityDigest') IS NOT NEW.identity_digest
 OR json_type(NEW.payload,'$.observation') IS NOT 'object' OR (SELECT count(*) FROM json_each(NEW.payload,'$.observation'))<>17
 OR json_extract(NEW.payload,'$.observation.candidateId') IS NOT NEW.candidate_id
 OR json_extract(NEW.payload,'$.observation.costDimension') IS NOT NEW.cost_dimension OR json_extract(NEW.payload,'$.observation.costState') IS NOT NEW.cost_state
 OR json_extract(NEW.payload,'$.observation.observedAtMs') IS NOT NEW.observed_at_ms OR json_extract(NEW.payload,'$.observation.validUntilMs') IS NOT NEW.valid_until_ms
 OR json_extract(NEW.payload,'$.observation.sourceRef') IS NOT NEW.source_ref OR json_extract(NEW.payload,'$.observation.sourceDigest') IS NOT NEW.source_digest
 OR NOT EXISTS(SELECT 1 FROM orchestration_attempt a WHERE a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND a.candidate_id=NEW.candidate_id)
 OR NOT EXISTS(SELECT 1 FROM orchestration_launch_intent l JOIN orchestration_attempt_identity i ON i.attempt_id=l.attempt_id
   WHERE l.attempt_id=NEW.attempt_id AND l.candidate_id=NEW.candidate_id AND l.expected_subject_digest=NEW.subject_digest AND i.subject_digest=NEW.subject_digest
   AND json_extract(NEW.payload,'$.observation.providerId')=l.tool_id)
 OR ((NEW.identity_kind='account')<>(NEW.cost_dimension IN('api','subscription')))
 OR (NEW.identity_kind='account' AND NOT EXISTS(SELECT 1 FROM orchestration_account_identity a WHERE a.run_id=NEW.run_id AND a.candidate_id=NEW.candidate_id
   AND a.digest=NEW.identity_digest AND json_extract(a.payload,'$.subjectDigest')=NEW.subject_digest AND json_extract(a.payload,'$.authReference')=NEW.identity_ref))
 OR (NEW.identity_kind='local-attempt' AND NOT EXISTS(SELECT 1 FROM orchestration_attempt_identity i WHERE i.attempt_id=NEW.attempt_id
   AND i.identity_id=NEW.identity_ref AND i.payload_sha256=NEW.identity_digest AND i.subject_digest=NEW.subject_digest))
BEGIN SELECT RAISE(ABORT,'cost observation integrity'); END;
CREATE TRIGGER cost_observation_no_update BEFORE UPDATE ON orchestration_cost_observation BEGIN SELECT RAISE(ABORT,'cost observation immutable'); END;
CREATE TRIGGER cost_observation_no_delete BEFORE DELETE ON orchestration_cost_observation BEGIN SELECT RAISE(ABORT,'cost observation immutable'); END;
CREATE TRIGGER cost_observation_no_replace BEFORE INSERT ON orchestration_cost_observation
WHEN EXISTS(SELECT 1 FROM orchestration_cost_observation WHERE observation_id=NEW.observation_id OR attempt_id=NEW.attempt_id)
BEGIN SELECT RAISE(ABORT,'cost observation immutable'); END;
