import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { observeProcessTree } from '../../dist/src/process-termination.js';

const [expectedCwd, relativePath] = process.argv.slice(2);
if (!expectedCwd || !relativePath || resolve(process.cwd()) !== resolve(expectedCwd)) throw Error('owned_writer_cwd_mismatch');
const self = observeProcessTree(process.pid).descendants.find(value => value.pid === process.pid);
if (!self?.createdAt) throw Error('owned_writer_identity_missing');

writeFileSync(resolve(expectedCwd, relativePath), 'replacement\n', { encoding: 'utf8', flag: 'w' });
process.stdout.write(`${JSON.stringify({ kind: 'ready', pid: self.pid, createdAt: self.createdAt, cwd: resolve(process.cwd()) })}\n`);

const input = createInterface({ input: process.stdin });
let timer;
const [command] = await Promise.race([
  once(input, 'line'),
  once(input, 'close').then(() => { throw Error('owned_writer_control_eof'); }),
  new Promise((_, reject) => { timer = setTimeout(() => reject(Error('owned_writer_control_timeout')), 30_000); }),
]).finally(() => clearTimeout(timer));
input.close();
if (command !== 'release') throw Error('owned_writer_control_invalid');
process.stdout.write(`${JSON.stringify({ kind: 'released', pid: self.pid, createdAt: self.createdAt })}\n`);
