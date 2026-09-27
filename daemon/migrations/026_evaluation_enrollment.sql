CREATE TABLE IF NOT EXISTS evaluation_dataset (
  digest TEXT PRIMARY KEY CHECK(length(digest)=64),
  dataset_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576),
  UNIQUE(dataset_id,revision)
);
CREATE TRIGGER IF NOT EXISTS evaluation_dataset_update BEFORE UPDATE ON evaluation_dataset
BEGIN SELECT RAISE(ABORT,'evaluation dataset immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_dataset_delete BEFORE DELETE ON evaluation_dataset
BEGIN SELECT RAISE(ABORT,'evaluation dataset immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_dataset_replace BEFORE INSERT ON evaluation_dataset
WHEN EXISTS(SELECT 1 FROM evaluation_dataset WHERE digest=NEW.digest OR (dataset_id=NEW.dataset_id AND revision=NEW.revision))
BEGIN SELECT RAISE(ABORT,'evaluation dataset immutable'); END;

CREATE TABLE IF NOT EXISTS evaluation_enrollment (
  enrollment_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES run(id),
  dataset_digest TEXT NOT NULL REFERENCES evaluation_dataset(digest),
  case_id TEXT NOT NULL,
  arm TEXT NOT NULL CHECK(arm IN ('efficiency','performance','value','speed','manual-baseline')),
  policy_kind TEXT NOT NULL CHECK(policy_kind IN ('monetary','local-invocation')),
  policy_digest TEXT NOT NULL CHECK(length(policy_digest)=64),
  input_binding TEXT NOT NULL CHECK(input_binding='claimed-not-verified'),
  payload_digest TEXT NOT NULL CHECK(length(payload_digest)=64),
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576),
  UNIQUE(dataset_digest,case_id,arm,policy_digest)
);
CREATE TRIGGER IF NOT EXISTS evaluation_enrollment_update BEFORE UPDATE ON evaluation_enrollment
BEGIN SELECT RAISE(ABORT,'evaluation enrollment immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_enrollment_delete BEFORE DELETE ON evaluation_enrollment
BEGIN SELECT RAISE(ABORT,'evaluation enrollment immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_enrollment_replace BEFORE INSERT ON evaluation_enrollment
WHEN EXISTS(SELECT 1 FROM evaluation_enrollment WHERE enrollment_id=NEW.enrollment_id OR run_id=NEW.run_id
  OR (dataset_digest=NEW.dataset_digest AND case_id=NEW.case_id AND arm=NEW.arm AND policy_digest=NEW.policy_digest))
BEGIN SELECT RAISE(ABORT,'evaluation enrollment immutable'); END;
