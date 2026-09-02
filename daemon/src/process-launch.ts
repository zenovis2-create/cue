import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess, type SpawnOptions, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from 'node:child_process';
import type { Ledger } from './ledger.js';
import type { SessionOwner, SessionRecord } from './session-spawn.js';

function launchProcess(command: string, args: readonly string[], options: SpawnOptions = {}): ChildProcess {
  return spawn(command, [...args], { ...options, shell: false });
}

export function runProcessSync(command: string, args: readonly string[], options: SpawnSyncOptionsWithStringEncoding): SpawnSyncReturns<string> {
  return spawnSync(command, [...args], { ...options, shell: false });
}

export function spawnOwned(db: Ledger, owner: SessionOwner, command: string, args: readonly string[], options: SpawnOptions = {}): { child: ChildProcess; session: SessionRecord } {
  if (!owner.task_id || !owner.run_id || !owner.cwd) throw new Error('session owner required');
  const child = launchProcess(command, args, { ...options, cwd: owner.cwd });
  if (!child.pid) throw new Error('spawn returned no pid');
  const session = { ...owner, pid: child.pid, start_time: new Date().toISOString(), handle: randomUUID() };
  try {
    db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)')
      .run(session.handle, session.pid, session.start_time, session.cwd, session.task_id, session.run_id);
  } catch (error) { child.kill(); throw error; }
  return { child, session };
}
