CREATE TABLE IF NOT EXISTS integration_budget (
  run_id TEXT PRIMARY KEY,
  currency TEXT NOT NULL,
  unit TEXT NOT NULL CHECK(unit IN ('minor','micro')),
  limit_units INTEGER NOT NULL CHECK(limit_units >= 0 AND limit_units <= 9007199254740991),
  policy_revision TEXT NOT NULL,
  source TEXT NOT NULL,
  observed_at_ms INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS integration_budget_immutable_update BEFORE UPDATE ON integration_budget
BEGIN SELECT RAISE(ABORT, 'budget policy is immutable'); END;
CREATE TRIGGER IF NOT EXISTS integration_budget_immutable_delete BEFORE DELETE ON integration_budget
BEGIN SELECT RAISE(ABORT, 'budget policy is immutable'); END;
CREATE TRIGGER IF NOT EXISTS integration_budget_immutable_replace BEFORE INSERT ON integration_budget
WHEN EXISTS(SELECT 1 FROM integration_budget WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT, 'budget policy is immutable'); END;
CREATE TABLE IF NOT EXISTS integration_budget_reservation (
  run_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  upper_units INTEGER NOT NULL CHECK(upper_units >= 0 AND upper_units <= 9007199254740991),
  payload TEXT NOT NULL,
  PRIMARY KEY(run_id, request_id),
  UNIQUE(run_id, attempt_id),
  FOREIGN KEY(run_id) REFERENCES integration_budget(run_id)
);
CREATE TABLE IF NOT EXISTS integration_budget_receipt (
  run_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 0),
  kind TEXT NOT NULL CHECK(kind IN ('actual','estimated','unknown')),
  units INTEGER CHECK(units >= 0 AND units <= 9007199254740991),
  provider_final INTEGER NOT NULL CHECK(provider_final IN (0,1)),
  payload TEXT NOT NULL,
  PRIMARY KEY(run_id, receipt_id),
  UNIQUE(run_id, request_id, revision),
  FOREIGN KEY(run_id, request_id) REFERENCES integration_budget_reservation(run_id, request_id)
);
