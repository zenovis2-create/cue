import { writeFileSync } from 'node:fs';
export const SENTINEL_ALERT = 'CUE DAEMON UNREACHABLE: heartbeat expired and connection failed';
export type SentinelInput = { heartbeatExpired: boolean; connectionFailed: boolean; relayAvailable: boolean; deadMarkerPath: string };
export function evaluateSentinel(input: SentinelInput): string | undefined {
  if (!(input.heartbeatExpired && input.connectionFailed)) return undefined;
  if (!input.relayAvailable) writeFileSync(input.deadMarkerPath, 'cue.dead\n');
  return SENTINEL_ALERT;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  const raw = process.argv[2]; if (!raw) throw new Error('input required');
  const output = evaluateSentinel(JSON.parse(raw) as SentinelInput); if (output) process.stdout.write(`${output}\n`);
}
