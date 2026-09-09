import type { Ledger } from './ledger.js';
import type { SessionRecord } from './session-spawn.js';

export function listOrphanSessions(db: Ledger, observed: readonly SessionRecord[]): SessionRecord[] {
  const owned = new Set((db.prepare('SELECT pid,start_time FROM session_handle').all() as Array<{pid:number;start_time:string}>).map(x => `${x.pid}:${x.start_time}`));
  return observed.filter(x => !owned.has(`${x.pid}:${x.start_time}`));
}
