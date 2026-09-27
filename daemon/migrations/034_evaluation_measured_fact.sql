CREATE TABLE IF NOT EXISTS evaluation_metric_contract (
  digest TEXT PRIMARY KEY CHECK(length(digest)=64), contract_id TEXT NOT NULL, revision TEXT NOT NULL,
  authority_class TEXT NOT NULL CHECK(authority_class IN ('host-observed','offline-fixture')),
  source_revision TEXT NOT NULL, source_digest TEXT NOT NULL CHECK(length(source_digest)=64), registered_at_ms INTEGER NOT NULL CHECK(registered_at_ms>=0),
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576), UNIQUE(contract_id,revision)
);
CREATE TABLE IF NOT EXISTS evaluation_environment_snapshot (
  digest TEXT PRIMARY KEY CHECK(length(digest)=64), snapshot_id TEXT NOT NULL, revision TEXT NOT NULL,
  authority_class TEXT NOT NULL CHECK(authority_class IN ('host-observed','offline-fixture')),
  source_revision TEXT NOT NULL, source_digest TEXT NOT NULL CHECK(length(source_digest)=64), observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0),
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576), UNIQUE(snapshot_id,revision)
);
CREATE TABLE IF NOT EXISTS evaluation_account_limits_snapshot (
  digest TEXT PRIMARY KEY CHECK(length(digest)=64), snapshot_id TEXT NOT NULL, revision TEXT NOT NULL,
  authority_class TEXT NOT NULL CHECK(authority_class IN ('host-observed','offline-fixture')),
  source_revision TEXT NOT NULL, source_digest TEXT NOT NULL CHECK(length(source_digest)=64), observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0),
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576), UNIQUE(snapshot_id,revision)
);
CREATE TABLE IF NOT EXISTS evaluation_price_snapshot (
  digest TEXT PRIMARY KEY CHECK(length(digest)=64), snapshot_id TEXT NOT NULL, revision TEXT NOT NULL,
  authority_class TEXT NOT NULL CHECK(authority_class IN ('host-observed','offline-fixture')),
  source_revision TEXT NOT NULL, source_digest TEXT NOT NULL CHECK(length(source_digest)=64), observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0),
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576), UNIQUE(snapshot_id,revision)
);
CREATE TABLE IF NOT EXISTS evaluation_measured_fact (
  fact_id TEXT PRIMARY KEY, enrollment_id TEXT NOT NULL REFERENCES evaluation_enrollment(enrollment_id),
  observation_id TEXT NOT NULL UNIQUE REFERENCES evaluation_observation(observation_id), run_id TEXT NOT NULL,
  dataset_digest TEXT NOT NULL CHECK(length(dataset_digest)=64), case_id TEXT NOT NULL, arm TEXT NOT NULL,
  policy_digest TEXT NOT NULL CHECK(length(policy_digest)=64), producer_class TEXT NOT NULL CHECK(producer_class IN ('host-observed','offline-fixture')),
  producer_revision TEXT NOT NULL, producer_digest TEXT NOT NULL CHECK(length(producer_digest)=64), recorded_at_ms INTEGER NOT NULL CHECK(recorded_at_ms>=0),
  payload_digest TEXT NOT NULL CHECK(length(payload_digest)=64), payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576),
  UNIQUE(enrollment_id,observation_id)
);

CREATE TRIGGER IF NOT EXISTS evaluation_metric_contract_update BEFORE UPDATE ON evaluation_metric_contract BEGIN SELECT RAISE(ABORT,'evaluation metric contract immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_metric_contract_delete BEFORE DELETE ON evaluation_metric_contract BEGIN SELECT RAISE(ABORT,'evaluation metric contract immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_metric_contract_replace BEFORE INSERT ON evaluation_metric_contract WHEN EXISTS(SELECT 1 FROM evaluation_metric_contract WHERE digest=NEW.digest OR (contract_id=NEW.contract_id AND revision=NEW.revision)) BEGIN SELECT RAISE(ABORT,'evaluation metric contract immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_environment_snapshot_update BEFORE UPDATE ON evaluation_environment_snapshot BEGIN SELECT RAISE(ABORT,'evaluation environment snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_environment_snapshot_delete BEFORE DELETE ON evaluation_environment_snapshot BEGIN SELECT RAISE(ABORT,'evaluation environment snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_environment_snapshot_replace BEFORE INSERT ON evaluation_environment_snapshot WHEN EXISTS(SELECT 1 FROM evaluation_environment_snapshot WHERE digest=NEW.digest OR (snapshot_id=NEW.snapshot_id AND revision=NEW.revision)) BEGIN SELECT RAISE(ABORT,'evaluation environment snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_account_limits_snapshot_update BEFORE UPDATE ON evaluation_account_limits_snapshot BEGIN SELECT RAISE(ABORT,'evaluation account limits snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_account_limits_snapshot_delete BEFORE DELETE ON evaluation_account_limits_snapshot BEGIN SELECT RAISE(ABORT,'evaluation account limits snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_account_limits_snapshot_replace BEFORE INSERT ON evaluation_account_limits_snapshot WHEN EXISTS(SELECT 1 FROM evaluation_account_limits_snapshot WHERE digest=NEW.digest OR (snapshot_id=NEW.snapshot_id AND revision=NEW.revision)) BEGIN SELECT RAISE(ABORT,'evaluation account limits snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_price_snapshot_update BEFORE UPDATE ON evaluation_price_snapshot BEGIN SELECT RAISE(ABORT,'evaluation price snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_price_snapshot_delete BEFORE DELETE ON evaluation_price_snapshot BEGIN SELECT RAISE(ABORT,'evaluation price snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_price_snapshot_replace BEFORE INSERT ON evaluation_price_snapshot WHEN EXISTS(SELECT 1 FROM evaluation_price_snapshot WHERE digest=NEW.digest OR (snapshot_id=NEW.snapshot_id AND revision=NEW.revision)) BEGIN SELECT RAISE(ABORT,'evaluation price snapshot immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_measured_fact_update BEFORE UPDATE ON evaluation_measured_fact BEGIN SELECT RAISE(ABORT,'evaluation measured fact immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_measured_fact_delete BEFORE DELETE ON evaluation_measured_fact BEGIN SELECT RAISE(ABORT,'evaluation measured fact immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_measured_fact_replace BEFORE INSERT ON evaluation_measured_fact WHEN EXISTS(SELECT 1 FROM evaluation_measured_fact WHERE fact_id=NEW.fact_id OR observation_id=NEW.observation_id OR (enrollment_id=NEW.enrollment_id AND observation_id=NEW.observation_id)) BEGIN SELECT RAISE(ABORT,'evaluation measured fact immutable'); END;
