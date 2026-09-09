import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type ProcessIdentity = { pid: number; start_time: string };
export type Heartbeat = ProcessIdentity & { written_at: string };

export function writeHeartbeat(path: string, identity: ProcessIdentity, now = new Date()): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${identity.pid}.tmp`;
  writeFileSync(temp, JSON.stringify({ ...identity, written_at: now.toISOString() } satisfies Heartbeat));
  renameSync(temp, path);
}
export function readHeartbeat(path: string): Heartbeat { return JSON.parse(readFileSync(path, 'utf8')) as Heartbeat; }
export function heartbeatAgeMs(path: string, nowMs = Date.now()): number { return nowMs - statSync(path).mtimeMs; }
export function heartbeatExpired(path: string, maxAgeMs: number, nowMs = Date.now()): boolean { return heartbeatAgeMs(path, nowMs) > maxAgeMs; }
