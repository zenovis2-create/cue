CREATE TABLE policy_deployment_migration(
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  version TEXT NOT NULL CHECK(version='cue-policy-deployment-v1')
) STRICT;
INSERT INTO policy_deployment_migration VALUES(1,'cue-policy-deployment-v1');

CREATE TABLE selection_policy_qualification(
  qualification_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  authority_id TEXT NOT NULL,
  body_json TEXT NOT NULL,
  qualified_at_ms INTEGER NOT NULL CHECK(qualified_at_ms >= 0),
  PRIMARY KEY(qualification_id,digest),
  CHECK(length(digest)=64 AND digest=lower(digest))
) STRICT;

CREATE TABLE selection_policy_deployment_transition(
  transition_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK(ordinal >= 1),
  kind TEXT NOT NULL CHECK(kind IN ('initialize','promote','revert')),
  previous_transition_id TEXT,
  reverted_promotion_id TEXT,
  from_policy_id TEXT,
  from_revision INTEGER,
  from_digest TEXT,
  to_policy_id TEXT NOT NULL,
  to_revision INTEGER NOT NULL,
  to_digest TEXT NOT NULL,
  qualification_id TEXT,
  qualification_digest TEXT,
  payload_json TEXT NOT NULL,
  digest TEXT NOT NULL,
  recorded_at_ms INTEGER NOT NULL CHECK(recorded_at_ms >= 0),
  UNIQUE(channel_id,ordinal),
  FOREIGN KEY(previous_transition_id) REFERENCES selection_policy_deployment_transition(transition_id),
  FOREIGN KEY(reverted_promotion_id) REFERENCES selection_policy_deployment_transition(transition_id),
  FOREIGN KEY(from_policy_id,from_revision) REFERENCES selection_policy_snapshot(policy_id,revision),
  FOREIGN KEY(to_policy_id,to_revision) REFERENCES selection_policy_snapshot(policy_id,revision),
  FOREIGN KEY(qualification_id,qualification_digest) REFERENCES selection_policy_qualification(qualification_id,digest),
  CHECK(length(digest)=64 AND digest=lower(digest)),
  CHECK(length(to_digest)=64 AND to_digest=lower(to_digest)),
  CHECK(qualification_digest IS NULL OR (length(qualification_digest)=64 AND qualification_digest=lower(qualification_digest))),
  CHECK((kind='initialize' AND ordinal=1 AND previous_transition_id IS NULL AND reverted_promotion_id IS NULL
    AND from_policy_id IS NULL AND from_revision IS NULL AND from_digest IS NULL AND qualification_id IS NULL AND qualification_digest IS NULL)
    OR (kind='promote' AND ordinal>1 AND previous_transition_id IS NOT NULL AND reverted_promotion_id IS NULL
    AND from_policy_id IS NOT NULL AND from_revision IS NOT NULL AND from_digest IS NOT NULL AND qualification_id IS NOT NULL AND qualification_digest IS NOT NULL)
    OR (kind='revert' AND ordinal>1 AND previous_transition_id IS NOT NULL AND reverted_promotion_id IS NOT NULL
    AND from_policy_id IS NOT NULL AND from_revision IS NOT NULL AND from_digest IS NOT NULL AND qualification_id IS NULL AND qualification_digest IS NULL))
) STRICT;

CREATE TRIGGER selection_policy_qualification_insert_guard BEFORE INSERT ON selection_policy_qualification BEGIN
  SELECT CASE WHEN cue_sha256(NEW.body_json)<>NEW.digest THEN RAISE(ABORT,'policy_qualification_digest') END;
END;
CREATE TRIGGER selection_policy_qualification_no_update BEFORE UPDATE ON selection_policy_qualification BEGIN SELECT RAISE(ABORT,'policy_qualification_immutable'); END;
CREATE TRIGGER selection_policy_qualification_no_delete BEFORE DELETE ON selection_policy_qualification BEGIN SELECT RAISE(ABORT,'policy_qualification_immutable'); END;

CREATE TABLE selection_policy_deployment_head(
  channel_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK(mode IN ('efficiency','performance','value','speed')),
  generation INTEGER NOT NULL CHECK(generation >= 1),
  policy_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  policy_digest TEXT NOT NULL CHECK(length(policy_digest)=64 AND policy_digest=lower(policy_digest)),
  latest_transition_id TEXT NOT NULL UNIQUE,
  FOREIGN KEY(policy_id,revision) REFERENCES selection_policy_snapshot(policy_id,revision),
  FOREIGN KEY(latest_transition_id) REFERENCES selection_policy_deployment_transition(transition_id)
) STRICT;

CREATE TRIGGER selection_policy_deployment_transition_insert_guard BEFORE INSERT ON selection_policy_deployment_transition BEGIN
  SELECT CASE WHEN cue_sha256(NEW.payload_json)<>NEW.digest THEN RAISE(ABORT,'policy_deployment_digest') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM selection_policy_snapshot p WHERE p.policy_id=NEW.to_policy_id AND p.revision=NEW.to_revision AND p.digest=NEW.to_digest) THEN RAISE(ABORT,'policy_deployment_to_policy') END;
  SELECT CASE WHEN NEW.kind<>'initialize' AND NOT EXISTS(
    SELECT 1 FROM selection_policy_deployment_transition p
    WHERE p.transition_id=NEW.previous_transition_id AND p.channel_id=NEW.channel_id AND p.ordinal=NEW.ordinal-1
      AND p.to_policy_id=NEW.from_policy_id AND p.to_revision=NEW.from_revision AND p.to_digest=NEW.from_digest
  ) THEN RAISE(ABORT,'policy_deployment_predecessor') END;
  SELECT CASE WHEN NEW.kind='revert' AND NOT EXISTS(
    SELECT 1 FROM selection_policy_deployment_transition p
    WHERE p.transition_id=NEW.reverted_promotion_id AND p.kind='promote' AND p.transition_id=NEW.previous_transition_id
      AND p.to_policy_id=NEW.from_policy_id AND p.to_revision=NEW.from_revision AND p.to_digest=NEW.from_digest
      AND p.from_policy_id=NEW.to_policy_id AND p.from_revision=NEW.to_revision AND p.from_digest=NEW.to_digest
  ) THEN RAISE(ABORT,'policy_deployment_revert_target') END;
END;
CREATE TRIGGER selection_policy_deployment_transition_no_update BEFORE UPDATE ON selection_policy_deployment_transition BEGIN SELECT RAISE(ABORT,'policy_deployment_immutable'); END;
CREATE TRIGGER selection_policy_deployment_transition_no_delete BEFORE DELETE ON selection_policy_deployment_transition BEGIN SELECT RAISE(ABORT,'policy_deployment_immutable'); END;

CREATE TRIGGER selection_policy_deployment_head_insert_guard BEFORE INSERT ON selection_policy_deployment_head BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM selection_policy_deployment_transition t WHERE t.transition_id=NEW.latest_transition_id AND t.channel_id=NEW.channel_id AND t.ordinal=1 AND t.kind='initialize' AND t.to_policy_id=NEW.policy_id AND t.to_revision=NEW.revision AND t.to_digest=NEW.policy_digest) THEN RAISE(ABORT,'policy_deployment_head_transition') END;
END;
CREATE TRIGGER selection_policy_deployment_head_update_guard BEFORE UPDATE ON selection_policy_deployment_head BEGIN
  SELECT CASE WHEN NEW.channel_id<>OLD.channel_id OR NEW.mode<>OLD.mode OR NEW.generation<>OLD.generation+1 THEN RAISE(ABORT,'policy_deployment_head_cas') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM selection_policy_deployment_transition t WHERE t.transition_id=NEW.latest_transition_id AND t.channel_id=NEW.channel_id AND t.ordinal=NEW.generation AND t.previous_transition_id=OLD.latest_transition_id AND t.from_policy_id=OLD.policy_id AND t.from_revision=OLD.revision AND t.from_digest=OLD.policy_digest AND t.to_policy_id=NEW.policy_id AND t.to_revision=NEW.revision AND t.to_digest=NEW.policy_digest) THEN RAISE(ABORT,'policy_deployment_head_transition') END;
END;
CREATE TRIGGER selection_policy_deployment_head_no_delete BEFORE DELETE ON selection_policy_deployment_head BEGIN SELECT RAISE(ABORT,'policy_deployment_immutable'); END;
