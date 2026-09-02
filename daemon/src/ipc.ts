import { createServer, type Server } from 'node:http';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { healthVector, type ComponentName } from './health.js';

export const IPC_HOST = '127.0.0.1';
export function createBearerFile(path: string): string {
  const token = randomBytes(32).toString('hex');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, token, { mode: 0o600 });
  if (process.platform === 'win32') {
    const principal = process.env.USERNAME;
    if (!principal) throw new Error('missing process principal');
    execFileSync('icacls', [path, '/inheritance:r', '/grant:r', `${principal}:(R,W)`], { stdio: 'ignore' });
  } else chmodSync(path, 0o600);
  return token;
}
function validToken(header: string | undefined, token: string): boolean {
  const candidate = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(candidate); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createIpcServer(token: string, readHealth: () => Record<ComponentName, boolean>): Server {
  return createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (!validToken(request.headers.authorization, token)) { response.statusCode = 401; response.end('{"error":"unauthorized"}'); return; }
    if (request.method === 'GET' && request.url === '/health') { response.end(JSON.stringify(healthVector(readHealth()))); return; }
    if (request.method === 'POST' && request.url === '/echo') {
      let body = '';
      request.on('data', chunk => { body += String(chunk); });
      request.on('end', () => {
        try {
          const parsed = JSON.parse(body) as unknown;
          if (!parsed || typeof parsed !== 'object' || typeof (parsed as { message?: unknown }).message !== 'string') throw new Error();
          response.end(JSON.stringify(parsed));
        } catch { response.statusCode = 400; response.end('{"error":"invalid_schema"}'); }
      });
      return;
    }
    response.statusCode = 404; response.end('{"error":"not_found"}');
  });
}
export async function listenLoopback(server: Server, port = 0): Promise<number> {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, IPC_HOST, resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing address'); return address.port;
}
