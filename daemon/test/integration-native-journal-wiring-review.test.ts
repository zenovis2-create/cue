import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { captureChangeSet, registerNativeChangeJournal } from '../src/change-records.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';

const roots: string[] = [];
const dbs: Ledger[] = [];
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

afterEach(() => {
  dbs.splice(0).forEach(db => db.open && db.close());
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
});

function fixture(targets: readonly { targetId: string; relativePath: string; maxBackupBytes: number }[]) {
  const root = mkdtempSync(join(tmpdir(), 'cue-s4-review-'));
  roots.push(root);
  const db = openLedger(join(root, 'ledger.db'));
  dbs.push(db);
  const work = join(root, 'work');
  mkdirSync(work);
  const parent = hash('parent'), stage = hash('stage'), plan = hash('plan'), policy = hash('policy');
  const selection = hash('selection'), subject = hash('subject');
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(parent, work, '[]', 'now');
  db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(parent);
  db.prepare("INSERT INTO orchestration_plan VALUES('run',?,?,?)").run(parent, plan, JSON.stringify({ revision: 'plan', tasks: [{ id: 'stage', role: 'implementation', dependencyIds: [] }] }));
  db.prepare("INSERT INTO orchestration_step VALUES('run','stage','running')").run();
  registerNativeChangeJournal(db, { runId: 'run', worktreeRealpath: work,
    targets: targets.map(target => ({ taskId: 'stage', ...target })), observedAtMs: 0 });
  db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','stage','candidate','running','{}',?,NULL,0)").run(work);
  db.prepare("INSERT INTO task VALUES('stage-task','running',NULL,'now')").run();
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(stage, work, '[]', 'now');
  db.prepare("INSERT INTO run VALUES('attempt','stage-task',?,0,'now')").run(stage);
  db.prepare("INSERT INTO orchestration_stage_envelope VALUES('attempt','run','stage','stage-task','attempt',?,?,?,?,?,?,?,?)").run(parent, stage, plan, policy, '{}', '{}', '{}', '{}');
  db.prepare("INSERT INTO attempt_selection VALUES('attempt','run','request','monetary',?,?)").run(selection, '{}');
  db.prepare("INSERT INTO workspace_write_lease VALUES(?,'run','now')").run(work);
  createHandoffActivityStore(db, { authorizeArtifact: () => false, resolveArtifact: () => null }).recordLaunchIntent({
    runId: 'run', taskId: 'stage', attemptId: 'attempt', candidateId: 'candidate', selectionDigest: selection,
    expectedSubjectDigest: subject, tool: { id: 'tool', revision: 'r' }, model: null,
    parentEnvelopeHash: parent, stageEnvelopeHash: stage, planDigest: plan, policyDigest: policy,
  });
  const input = { changeSetId: 'set', runId: 'run', taskId: 'stage', attemptId: 'attempt',
    stageEnvelopeHash: stage, launchIntentId: 'attempt', worktree: work,
    targets: targets.map(target => target.relativePath),
    limits: { maxTargets: targets.length, maxBackupBytes: Math.max(...targets.map(target => target.maxBackupBytes)) }, nowMs: 1 };
  return { db, work, input };
}

describe('independent native journal wiring regressions', () => {
  it('uses one common approved byte cap across SQL and JS sort differences', () => {
    const f = fixture([
      { targetId: 'upper', relativePath: 'Z.txt', maxBackupBytes: 8 },
      { targetId: 'lower', relativePath: 'a.txt', maxBackupBytes: 8 },
    ]);
    writeFileSync(join(f.work, 'a.txt'), '12345678');
    const captured = captureChangeSet(f.db, f.input);
    expect(captured.entries.find(entry => entry.relativePath === 'a.txt')?.byteLength).toBe(8);
  });

  it('rejects mixed target caps during preapproval before any journal contract is stored', () => {
    expect(() => fixture([
      { targetId: 'upper', relativePath: 'Z.txt', maxBackupBytes: 1 },
      { targetId: 'lower', relativePath: 'a.txt', maxBackupBytes: 8 },
    ])).toThrow('change_target_common_cap_required');
    const db = dbs.at(-1)!;
    expect(db.prepare('SELECT COUNT(*) AS n FROM change_target_contract').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM change_root_contract').get()).toEqual({ n: 0 });
  });

  it('rejects replay after an entry scalar diverges from its immutable payload', () => {
    const f = fixture([{ targetId: 'one', relativePath: 'a.txt', maxBackupBytes: 8 }]);
    writeFileSync(join(f.work, 'a.txt'), 'before');
    captureChangeSet(f.db, f.input);
    f.db.prepare('DROP TRIGGER change_entry_update').run();
    f.db.prepare("UPDATE change_entry SET canonical_realpath='corrupt' WHERE change_set_id='set'").run();
    expect(() => captureChangeSet(f.db, f.input)).toThrow('change_set_replay_mismatch');
  });

  it('rejects replay after native-binding scalars diverge from the hashed payload', () => {
    const f = fixture([{ targetId: 'one', relativePath: 'a.txt', maxBackupBytes: 8 }]);
    writeFileSync(join(f.work, 'a.txt'), 'before');
    captureChangeSet(f.db, f.input);
    f.db.prepare('PRAGMA foreign_keys=OFF').run();
    f.db.prepare('DROP TRIGGER change_native_binding_update').run();
    f.db.prepare("UPDATE change_native_binding SET volume_serial='0000000000000000' WHERE change_set_id='set'").run();
    expect(() => captureChangeSet(f.db, f.input)).toThrow('change_set_replay_mismatch');
  });
});
