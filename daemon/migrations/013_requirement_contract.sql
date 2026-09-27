CREATE TABLE IF NOT EXISTS requirement_contract_binding (
  run_id TEXT PRIMARY KEY REFERENCES run(id), envelope_hash TEXT NOT NULL REFERENCES envelope(envelope_hash),
  plan_digest TEXT NOT NULL, policy_digest TEXT NOT NULL, requirements_digest TEXT NOT NULL,
  payload TEXT NOT NULL, bound_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS requirement_contract_no_update BEFORE UPDATE ON requirement_contract_binding
BEGIN SELECT RAISE(ABORT, 'immutable_requirement_contract'); END;
CREATE TRIGGER IF NOT EXISTS requirement_contract_no_delete BEFORE DELETE ON requirement_contract_binding
BEGIN SELECT RAISE(ABORT, 'immutable_requirement_contract'); END;
CREATE TRIGGER IF NOT EXISTS requirement_contract_no_replace BEFORE INSERT ON requirement_contract_binding
WHEN EXISTS(SELECT 1 FROM requirement_contract_binding WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT, 'immutable_requirement_contract'); END;
CREATE TRIGGER IF NOT EXISTS requirement_contract_before_approval BEFORE INSERT ON requirement_contract_binding
WHEN EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id AND decision='accept')
  OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT, 'requirement_contract_too_late'); END;
