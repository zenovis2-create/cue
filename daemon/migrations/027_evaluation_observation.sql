CREATE TABLE IF NOT EXISTS evaluation_observation (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  observation_id TEXT NOT NULL UNIQUE,
  enrollment_id TEXT NOT NULL REFERENCES evaluation_enrollment(enrollment_id),
  revision INTEGER NOT NULL CHECK(revision>=1),
  supersedes_observation_id TEXT REFERENCES evaluation_observation(observation_id),
  recorded_at_ms INTEGER NOT NULL CHECK(recorded_at_ms>=0),
  payload_digest TEXT NOT NULL CHECK(length(payload_digest)=64),
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576),
  UNIQUE(enrollment_id,revision)
);
CREATE TRIGGER IF NOT EXISTS evaluation_observation_update BEFORE UPDATE ON evaluation_observation
BEGIN SELECT RAISE(ABORT,'evaluation observation immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_observation_delete BEFORE DELETE ON evaluation_observation
BEGIN SELECT RAISE(ABORT,'evaluation observation immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_observation_replace BEFORE INSERT ON evaluation_observation
WHEN EXISTS(SELECT 1 FROM evaluation_observation WHERE observation_id=NEW.observation_id
  OR (enrollment_id=NEW.enrollment_id AND revision=NEW.revision))
BEGIN SELECT RAISE(ABORT,'evaluation observation immutable'); END;
