import Database from 'better-sqlite3';
import { mkdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openLedger, type Ledger } from './ledger.js';
import { fenceInterruptedSessions, reconcileInterruptedWrites } from './recovery.js';
import { cleanupInterruptedAppContainerProfiles } from './worker-enforcement.js';

const localOwners = new Map<string, Ledger>();
function live(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}

/** Refuse a second daemon before it can fence or launch work in an owned tree. */
export function ownDaemonWorktree(worktree: string, ledgerPath: string, ledger: Ledger): () => void {
  const root = realpathSync.native(worktree);
  const guardRoot = join(process.env.LOCALAPPDATA ?? homedir(), 'Cue', 'writer-ownership');
  mkdirSync(guardRoot, { recursive: true });
  const guard = realpathSync.native(guardRoot);
  const rel = relative(root, guard);
  if (rel === '' || (rel.split(/[\\/]/u)[0] !== '..' && !isAbsolute(rel))) throw new Error('worktree contains daemon ownership storage');
  const db = new Database(join(guard, 'ownership.sqlite'), { timeout: 15000 });
  db.exec('CREATE TABLE IF NOT EXISTS owner(worktree TEXT PRIMARY KEY, identity TEXT NOT NULL, pid INTEGER NOT NULL, ledger_path TEXT NOT NULL)');
  const key = process.platform === 'win32' ? root.toLowerCase() : root;
  const contains = (parent: string, child: string): boolean => {
    const path = relative(parent, child);
    return path === '' || (path.split(/[\\/]/u)[0] !== '..' && !isAbsolute(path));
  };
  const identity = randomUUID();
  const staleLocalIdentities: string[] = [];
  try {
    db.transaction(() => {
      const overlapping = (db.prepare('SELECT worktree,identity,pid,ledger_path FROM owner').all() as Array<{ worktree: string; identity: string; pid: number; ledger_path: string }>)
        .filter(previous => contains(previous.worktree, key) || contains(key, previous.worktree));
      for (const previous of overlapping) {
        const local = localOwners.get(previous.identity);
        // A reused PID is conservatively treated as live; never kill an unrelated owner.
        if (live(previous.pid) && !(previous.pid === process.pid && local && !local.open)) throw new Error('worktree already owned by a live daemon');
      }
      for (const previous of overlapping) {
        const interrupted = previous.ledger_path === ledgerPath ? ledger : openLedger(previous.ledger_path);
        try {
          fenceInterruptedSessions(interrupted);
          cleanupInterruptedAppContainerProfiles(interrupted, previous.worktree);
          reconcileInterruptedWrites(interrupted, previous.worktree);
        } finally { if (interrupted !== ledger) interrupted.close(); }
        db.prepare('DELETE FROM owner WHERE worktree=? AND identity=?').run(previous.worktree, previous.identity);
        staleLocalIdentities.push(previous.identity);
      }
      // Startup recovery is part of ownership acquisition: a failed fence cannot
      // publish a live owner or permit a replacement daemon to start writing.
      fenceInterruptedSessions(ledger);
      cleanupInterruptedAppContainerProfiles(ledger, root);
      reconcileInterruptedWrites(ledger, root);
      db.prepare('INSERT OR REPLACE INTO owner VALUES(?,?,?,?)').run(key, identity, process.pid, ledgerPath);
    }).immediate();
    for (const staleIdentity of staleLocalIdentities) localOwners.delete(staleIdentity);
    localOwners.set(identity, ledger);
  } finally { db.close(); }
  return () => {
    const release = new Database(join(guard, 'ownership.sqlite'), { timeout: 15000 });
    try { release.prepare('DELETE FROM owner WHERE worktree=? AND identity=?').run(key, identity); }
    finally { release.close(); localOwners.delete(identity); }
  };
}
