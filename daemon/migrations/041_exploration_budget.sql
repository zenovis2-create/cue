CREATE TABLE IF NOT EXISTS exploration_budget_authorization (
  run_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  policy_revision INTEGER NOT NULL CHECK(policy_revision > 0),
  policy_digest TEXT NOT NULL CHECK(length(policy_digest) = 64),
  candidate_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  unit TEXT NOT NULL CHECK(unit IN ('minor','micro')),
  limit_units INTEGER NOT NULL CHECK(limit_units > 0 AND limit_units <= 9007199254740991),
  authorized_at TEXT NOT NULL,
  source_version TEXT NOT NULL,
  payload TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  UNIQUE(run_id,candidate_id),
  FOREIGN KEY(policy_id,policy_revision,policy_digest)
    REFERENCES selection_policy_snapshot(policy_id,revision,digest),
  FOREIGN KEY(run_id) REFERENCES integration_budget(run_id)
);

CREATE TABLE IF NOT EXISTS exploration_budget_reservation (
  run_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  upper_units INTEGER NOT NULL CHECK(upper_units >= 0 AND upper_units <= 9007199254740991),
  payload TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  PRIMARY KEY(run_id,request_id),
  UNIQUE(run_id,attempt_id),
  FOREIGN KEY(run_id,candidate_id) REFERENCES exploration_budget_authorization(run_id,candidate_id),
  FOREIGN KEY(run_id,request_id) REFERENCES integration_budget_reservation(run_id,request_id)
);

CREATE TRIGGER IF NOT EXISTS exploration_budget_authorization_insert_guard
BEFORE INSERT ON exploration_budget_authorization
BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id)
    OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
    OR EXISTS(SELECT 1 FROM integration_budget_reservation WHERE run_id=NEW.run_id)
    OR EXISTS(SELECT 1 FROM integration_budget_receipt WHERE run_id=NEW.run_id)
    THEN RAISE(ABORT,'exploration authorization too late') END;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM selection_run_policy rp
    JOIN selection_policy_snapshot ps ON ps.policy_id=rp.policy_id AND ps.revision=rp.revision AND ps.digest=rp.digest
    WHERE rp.run_id=NEW.run_id AND rp.policy_id=NEW.policy_id AND rp.revision=NEW.policy_revision
      AND rp.digest=NEW.policy_digest
      AND EXISTS(SELECT 1 FROM json_each(ps.policy_json,'$.allowedCandidateIds') WHERE value=NEW.candidate_id)
  ) THEN RAISE(ABORT,'exploration policy mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM integration_budget b WHERE b.run_id=NEW.run_id
    AND b.policy_revision=NEW.policy_id||':'||NEW.policy_revision AND b.currency=NEW.currency AND b.unit=NEW.unit AND NEW.limit_units<=b.limit_units)
    THEN RAISE(ABORT,'exploration budget mismatch') END;
  SELECT CASE WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256 OR CASE WHEN json_valid(NEW.payload)=0 THEN 1 ELSE
    json_extract(NEW.payload,'$.authorizedAt')<>NEW.authorized_at OR json_extract(NEW.payload,'$.candidateId')<>NEW.candidate_id
    OR json_extract(NEW.payload,'$.currency')<>NEW.currency OR json_extract(NEW.payload,'$.limitUnits')<>NEW.limit_units
    OR json_extract(NEW.payload,'$.policyDigest')<>NEW.policy_digest OR json_extract(NEW.payload,'$.policyId')<>NEW.policy_id
    OR json_extract(NEW.payload,'$.policyRevision')<>NEW.policy_revision OR json_extract(NEW.payload,'$.runId')<>NEW.run_id
    OR json_extract(NEW.payload,'$.sourceVersion')<>NEW.source_version OR json_extract(NEW.payload,'$.unit')<>NEW.unit END
    THEN RAISE(ABORT,'exploration authorization payload mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS exploration_budget_reservation_insert_guard
BEFORE INSERT ON exploration_budget_reservation
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM integration_budget_reservation r
    WHERE r.run_id=NEW.run_id AND r.request_id=NEW.request_id AND r.attempt_id=NEW.attempt_id AND r.upper_units=NEW.upper_units)
    THEN RAISE(ABORT,'ordinary reservation mismatch') END;
  SELECT CASE WHEN cue_sha256(NEW.payload)<>NEW.payload_sha256 OR CASE WHEN json_valid(NEW.payload)=0 THEN 1 ELSE
    json_extract(NEW.payload,'$.attemptId')<>NEW.attempt_id OR json_extract(NEW.payload,'$.candidateId')<>NEW.candidate_id
    OR json_extract(NEW.payload,'$.requestId')<>NEW.request_id OR json_extract(NEW.payload,'$.runId')<>NEW.run_id
    OR json_extract(NEW.payload,'$.upperUnits')<>NEW.upper_units END
    THEN RAISE(ABORT,'exploration reservation payload mismatch') END;
  SELECT CASE WHEN (
    SELECT COALESCE(SUM(CASE WHEN lr.kind='actual' AND lr.provider_final=1 THEN lr.units
      ELSE MAX(br.upper_units,COALESCE(obs.max_units,0)) END),0)
    FROM exploration_budget_reservation er
    JOIN integration_budget_reservation br ON br.run_id=er.run_id AND br.request_id=er.request_id
    LEFT JOIN integration_budget_receipt lr ON lr.run_id=er.run_id AND lr.request_id=er.request_id
      AND lr.revision=(SELECT MAX(x.revision) FROM integration_budget_receipt x WHERE x.run_id=er.run_id AND x.request_id=er.request_id)
    LEFT JOIN (SELECT run_id,request_id,MAX(units) max_units FROM integration_budget_receipt GROUP BY run_id,request_id) obs
      ON obs.run_id=er.run_id AND obs.request_id=er.request_id
    WHERE er.run_id=NEW.run_id
  ) + NEW.upper_units > (SELECT limit_units FROM exploration_budget_authorization WHERE run_id=NEW.run_id)
  THEN RAISE(ABORT,'exploration budget limit exceeded') END;
END;

CREATE TRIGGER IF NOT EXISTS exploration_budget_authorization_no_update BEFORE UPDATE ON exploration_budget_authorization
BEGIN SELECT RAISE(ABORT,'exploration authorization immutable'); END;
CREATE TRIGGER IF NOT EXISTS exploration_budget_authorization_no_delete BEFORE DELETE ON exploration_budget_authorization
BEGIN SELECT RAISE(ABORT,'exploration authorization immutable'); END;
CREATE TRIGGER IF NOT EXISTS exploration_budget_authorization_no_replace BEFORE INSERT ON exploration_budget_authorization
WHEN EXISTS(SELECT 1 FROM exploration_budget_authorization WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'exploration authorization immutable'); END;
CREATE TRIGGER IF NOT EXISTS exploration_budget_reservation_no_update BEFORE UPDATE ON exploration_budget_reservation
BEGIN SELECT RAISE(ABORT,'exploration reservation immutable'); END;
CREATE TRIGGER IF NOT EXISTS exploration_budget_reservation_no_delete BEFORE DELETE ON exploration_budget_reservation
BEGIN SELECT RAISE(ABORT,'exploration reservation immutable'); END;
CREATE TRIGGER IF NOT EXISTS exploration_budget_reservation_no_replace BEFORE INSERT ON exploration_budget_reservation
WHEN EXISTS(SELECT 1 FROM exploration_budget_reservation WHERE run_id=NEW.run_id AND request_id=NEW.request_id)
BEGIN SELECT RAISE(ABORT,'exploration reservation immutable'); END;

