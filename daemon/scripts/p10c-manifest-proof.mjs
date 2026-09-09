import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { HostCodexRpcSession } from '../dist/src/host-codex-controller.js';
import { stopProcessTree } from './process-lifecycle.mjs';
import { CLEAN_CONFIG, vendorCodexLaunchSpec } from '../dist/src/tool-home.js';

const args = process.argv.slice(2);
const outputAt = args.indexOf('--output');
const output = outputAt >= 0 ? resolve(args[outputAt + 1]) : resolve('..', 'evidence', 'P10C', 'p10c_manifest_proof.json');
const expectedSha256 = 'cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4';
// The pin is the hash, never the path. CUE_VENDOR_CODEX only says WHERE to look,
// so a side-by-side toolchain can be measured without touching the shared global
// install; the hash check below still decides whether it is the pinned artifact.
const binary = process.env.CUE_VENDOR_CODEX
  || join(process.env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
if (!existsSync(binary)) throw new Error('pinned Codex binary is unavailable');
const binarySha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
if (binarySha256 !== expectedSha256) throw new Error('pinned Codex binary hash mismatch');

const root = mkdtempSync(join(tmpdir(), 'cue-manifest-proof-'));
const codexHome = join(root, 'codex-home-manifest');
const controllerCwd = join(codexHome, 'controller-workspace');
const workspace = join(root, 'workspace');
mkdirSync(controllerCwd, { recursive: true });
mkdirSync(workspace, { recursive: true });

let captureResolve;
let captureReject;
const captured = new Promise((resolvePromise, rejectPromise) => {
  captureResolve = resolvePromise;
  captureReject = rejectPromise;
});

const server = createServer((request, response) => {
  const chunks = [];
  let total = 0;
  request.on('data', chunk => {
    total += chunk.length;
    if (total > 5_000_000) {
      request.destroy(new Error('manifest request exceeded limit'));
      return;
    }
    chunks.push(chunk);
  });
  request.on('error', captureReject);
  request.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (request.method === 'POST' && Array.isArray(body.tools)) {
        captureResolve({ endpoint: request.url, body });
      }
    } catch { /* non-model request */ }
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'Cue manifest probe captured the request', type: 'probe_complete' } }));
  });
});

let child;
let rpc;
try {
  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('manifest probe server did not bind TCP');
  const config = [
    'model = "cue-manifest-model"',
    'model_provider = "cue_probe"',
    CLEAN_CONFIG.trimEnd(),
    '[model_providers.cue_probe]',
    'name = "Cue Manifest Probe"',
    `base_url = "http://127.0.0.1:${address.port}/v1"`,
    'wire_api = "responses"',
    'requires_openai_auth = false',
    'request_max_retries = 0',
    'stream_max_retries = 0',
    '',
  ].join('\n');
  writeFileSync(join(codexHome, 'config.toml'), config, { mode: 0o600 });
  const spec = vendorCodexLaunchSpec(binary, ['-a', 'on-request', 'app-server'], codexHome);
  child = spawn(spec.command, spec.args, { cwd: controllerCwd, env: spec.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  if (!child.stdin || !child.stdout) throw new Error('manifest probe requires app-server stdio');
  rpc = new HostCodexRpcSession({ readable: child.stdout, writable: child.stdin }, async () => {
    throw new Error('the manifest probe must not execute a tool');
  }, { requestTimeoutMs: 10_000, runTimeoutMs: 30_000 });
  void rpc.run({ cwd: controllerCwd, workspaceCwd: workspace, goal: 'Reply with one short sentence without calling tools.', model: 'cue-manifest-model' }).catch(() => undefined);
  let captureTimer;
  let capture;
  try {
    capture = await Promise.race([
      captured,
      new Promise((_, rejectPromise) => {
        captureTimer = setTimeout(() => rejectPromise(new Error('timed out waiting for effective model request')), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(captureTimer);
  }
  const tools = capture.body.tools;
  const toolNames = tools.map(tool => tool?.name ?? tool?.function?.name ?? tool?.type ?? '').filter(Boolean);
  const hostExecutionTools = toolNames.filter(name => /(?:shell|apply[_-]?patch|exec|command|terminal|code_mode|local_shell)/iu.test(name));
  const verdict = toolNames.length === 1 && toolNames[0] === 'cue_workspace' && hostExecutionTools.length === 0 ? 'PASS' : 'FAIL';
  const proof = {
    generatedAt: new Date().toISOString(),
    verdict,
    binarySha256,
    requestEndpoint: capture.endpoint,
    model: capture.body.model,
    toolNames,
    hostExecutionTools,
    toolManifest: tools,
    toolManifestSha256: createHash('sha256').update(JSON.stringify(tools)).digest('hex'),
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(proof, null, 2)}\n`);
  if (verdict !== 'PASS') process.exitCode = 2;
} finally {
  rpc?.close();
  await stopProcessTree(child);
  await new Promise(resolvePromise => {
    server.close(() => resolvePromise());
    server.closeAllConnections?.();
  });
  rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
}
