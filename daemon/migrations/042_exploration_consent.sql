CREATE TABLE IF NOT EXISTS exploration_consent (
  run_id TEXT PRIMARY KEY,
  envelope_hash TEXT NOT NULL,
  plan_digest TEXT NOT NULL CHECK(length(plan_digest)=64),
  policy_digest TEXT NOT NULL CHECK(length(policy_digest)=64),
  authorization_digest TEXT NOT NULL CHECK(length(authorization_digest)=64),
  candidate_id TEXT NOT NULL,
  task_ids_json TEXT NOT NULL CHECK(json_valid(task_ids_json)),
  consent_digest TEXT NOT NULL CHECK(length(consent_digest)=64),
  consented_at_ms INTEGER NOT NULL CHECK(consented_at_ms>=0),
  FOREIGN KEY(run_id) REFERENCES exploration_budget_authorization(run_id)
);

CREATE TRIGGER IF NOT EXISTS exploration_consent_insert_guard
BEFORE INSERT ON exploration_consent
BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id)
    OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
    OR NOT EXISTS(SELECT 1 FROM orchestration_plan p WHERE p.run_id=NEW.run_id AND p.digest=NEW.plan_digest AND p.envelope_hash=NEW.envelope_hash)
    OR NOT EXISTS(SELECT 1 FROM selection_run_policy rp WHERE rp.run_id=NEW.run_id AND rp.digest=NEW.policy_digest)
    OR NOT EXISTS(SELECT 1 FROM exploration_budget_authorization a WHERE a.run_id=NEW.run_id AND a.payload_sha256=NEW.authorization_digest AND a.candidate_id=NEW.candidate_id)
    THEN RAISE(ABORT,'exploration consent binding mismatch') END;
  SELECT CASE WHEN cue_sha256(json_object('authorizationDigest',NEW.authorization_digest,'candidateId',NEW.candidate_id,
    'envelopeHash',NEW.envelope_hash,'planDigest',NEW.plan_digest,'policyDigest',NEW.policy_digest,
    'runId',NEW.run_id,'taskIds',json(NEW.task_ids_json)))<>NEW.consent_digest
    THEN RAISE(ABORT,'exploration consent digest mismatch') END;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.task_ids_json) x
    WHERE NOT EXISTS(SELECT 1 FROM orchestration_step s WHERE s.run_id=NEW.run_id AND s.task_id=x.value))
    OR (SELECT count(*) FROM json_each(NEW.task_ids_json))=0
    THEN RAISE(ABORT,'exploration consent task mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS exploration_consent_no_update BEFORE UPDATE ON exploration_consent
BEGIN SELECT RAISE(ABORT,'exploration consent immutable'); END;
CREATE TRIGGER IF NOT EXISTS exploration_consent_no_delete BEFORE DELETE ON exploration_consent
BEGIN SELECT RAISE(ABORT,'exploration consent immutable'); END;
CREATE TRIGGER IF NOT EXISTS exploration_consent_no_replace BEFORE INSERT ON exploration_consent
WHEN EXISTS(SELECT 1 FROM exploration_consent WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'exploration consent immutable'); END;
