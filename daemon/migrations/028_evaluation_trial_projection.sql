CREATE TABLE IF NOT EXISTS evaluation_trial_projection (
  projection_id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES evaluation_enrollment(enrollment_id),
  observation_id TEXT NOT NULL REFERENCES evaluation_observation(observation_id),
  enrollment_digest TEXT NOT NULL CHECK(length(enrollment_digest)=64),
  observation_digest TEXT NOT NULL CHECK(length(observation_digest)=64),
  payload_digest TEXT NOT NULL CHECK(length(payload_digest)=64),
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576),
  UNIQUE(enrollment_id,observation_id)
);
CREATE TRIGGER IF NOT EXISTS evaluation_trial_projection_update BEFORE UPDATE ON evaluation_trial_projection
BEGIN SELECT RAISE(ABORT,'evaluation trial projection immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_trial_projection_delete BEFORE DELETE ON evaluation_trial_projection
BEGIN SELECT RAISE(ABORT,'evaluation trial projection immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_trial_projection_replace BEFORE INSERT ON evaluation_trial_projection
WHEN EXISTS(SELECT 1 FROM evaluation_trial_projection WHERE projection_id=NEW.projection_id
  OR (enrollment_id=NEW.enrollment_id AND observation_id=NEW.observation_id))
BEGIN SELECT RAISE(ABORT,'evaluation trial projection immutable'); END;
