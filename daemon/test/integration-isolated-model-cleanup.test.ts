import { measureModelControlBundle } from '../src/model-control-bundle.js';
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { createIsolatedModelCleanup } from '../src/adapters/isolated-model-cleanup.js';
import { createIsolatedLocalModelExecutor } from '../src/adapters/isolated-local-model.js';
import type { LocalModelEvent, LocalModelRequest } from '../src/adapters/local-model.js';
import type { IsolatedModelExecution } from '../src/adapters/isolated-local-model.js';
import { createIntegrationRuntime, type RuntimeContext } from '../src/integration-runtime.js';
import { MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';

describe.skipIf(process.platform !== 'win32')('independent isolated model cleanup', () => {
  it.each([false, true])('real SQLite/native broker cancellation=%s, exact binding and persisted OS observations', async cancel => {
    const db = openLedger();
    try {
      const envelope = normalizeEnvelope({ run_id: 'cleanup-attempt', worktree_realpath: process.cwd(), allowed_actions: [], egress: [], expires_at: '2030-01-01T00:00:00Z', autonomy_level: 'bounded' });
      db.prepare("INSERT INTO task VALUES('cleanup-task','running',NULL,'now')").run();
      db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(envelopeHash(envelope), process.cwd());
      db.prepare("INSERT INTO run VALUES('cleanup-attempt','cleanup-task',?,0,'now')").run(envelopeHash(envelope));
      let received!: () => void;
      const started = new Promise<void>(done => { received = done; });
      const transport = async function* (request: LocalModelRequest): AsyncGenerator<LocalModelEvent> {
        received();
        if (cancel) await new Promise<void>((_, reject) => request.signal!.addEventListener('abort', () => reject(Error('fixture abort')), { once: true }));
        yield { type: 'text', text: 'fixed offline reply' };
        yield { type: 'terminal', status: 'completed', reason: 'stop', providerStopped: 'unknown' };
      };
      const writes: Readonly<Record<string, unknown>>[] = [];
      let persist = true;
      const observer = createIsolatedModelCleanup({ db, taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA!, 'Packages'),
        launch: createIsolatedLocalModelExecutor({ db, taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA!, 'Packages'), controlBundle: measureModelControlBundle({controlRoot: join(process.cwd(),'src'), nodeExecutable: process.execPath, clientKind: 'model'}), nodeExecutable: process.execPath, nodeSha256: createHash('sha256').update(readFileSync(process.execPath)).digest('hex'), timeoutMs: 15000, transport,
          resolveBinding: () => ({ owner: { cwd: process.cwd(), task_id: 'cleanup-task', run_id: 'cleanup-attempt' }, envelope, prompt: 'fixed fixture' }) }),
        persistObservation: async observation => {
          if (!persist) throw Error('fixture storage unavailable');
          writes.push(observation);
          const result = db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES('cleanup-task','cleanup-attempt','cleanup-observation',?,?)").run(JSON.stringify(observation), new Date().toISOString());
          return `ledger-artifact:${result.lastInsertRowid}`;
        } });
      // Synthetic admission bytes exercise the runtime seam only; these are not
      // actual M measurements and are never registered in a production store.
      const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
      const bytes = new Map(MODEL_PROBES.map(probe => [probe, Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject), measuredAt: new Date(999).toISOString(), kind: 'live', status: 'pass' }))]));
      const refs = Object.fromEntries([...bytes].map(([id, value]) => [id, { id, sha256: createHash('sha256').update(value).digest('hex') }]));
      let context!: RuntimeContext, execution!: IsolatedModelExecution;
      const runtime = createIntegrationRuntime({ evidence: { now: () => 1000, maxAgeMs: 100, resolveEvidence: ref => bytes.get(ref.id as typeof MODEL_PROBES[number]) }, authorizeRun: () => true,
        resolveCandidate: () => ({ kind: 'model', supportedRoles: ['model'], cancellation: 'supported', usage: 'unsupported', availability: 'ready', evidenceReferences: () => refs, buildCurrentSubject: () => subject,
          launch: async value => { context = value; execution = await observer.launch(value); return execution; } }), verifyCleanup: observer.verifyCleanup });
      const activated = await runtime.start('cleanup-attempt', 'fixed-qwen', 'model');
      if (!activated.ok) throw Error(activated.reason);
      await started;
      if (cancel) await execution.cancel();
      const result = await execution.result;
      await Promise.resolve();
      persist = false;
      expect(await activated.handle.inspectCleanup()).toBe('unknown');
      expect(activated.handle.snapshot().phase).not.toBe('settled');
      persist = true;
      expect(result.cleanup).toBe('unknown'); expect(result.providerStopped).toBe('unknown');
      expect((await observer.verifyCleanup(context, { ...execution })).result).toBe('unknown');
      expect((await observer.verifyCleanup({ ...context }, execution)).result).toBe('unknown');
      const deadline = Date.now() + 10000;
      let receipt = await observer.verifyCleanup(context, execution);
      while (receipt.result === 'residual' && Date.now() < deadline) { await new Promise(done => setTimeout(done, 50)); receipt = await observer.verifyCleanup(context, execution); }
      expect(receipt, JSON.stringify(writes.at(-1))).toMatchObject({ runId: context.runId, subjectDigest: context.subjectDigest, result: 'verified-clean' });
      expect(writes.at(-1)).toMatchObject({ processes: { launcher: 'absent', client: 'absent', guardian: 'absent' }, paths: { taskRoot: 'absent', profile: 'absent' }, billing: 'unknown', providerStopped: 'unknown' });
      expect(JSON.parse((db.prepare('SELECT content FROM artifact ORDER BY id DESC LIMIT 1').get() as { content: string }).content).result).toBe('verified-clean');
      expect(await activated.handle.inspectCleanup()).toBe('verified-clean');
      expect(activated.handle.snapshot().phase).toBe('settled');
      expect((await observer.verifyCleanup({ ...context, subjectDigest: 'b'.repeat(64) }, execution)).result).toBe('unknown');
      const mutableContext = { ...context };
      const delayed = createIsolatedModelCleanup({ db, taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA!, 'Packages'),
        launch: async () => execution, persistObservation: async observation => {
          expect(observation.result).toBe('verified-clean');
          await Promise.resolve(); mutableContext.subjectDigest = 'b'.repeat(64); return 'fixture-drift';
        } });
      await delayed.launch(mutableContext);
      await expect(delayed.verifyCleanup(mutableContext, execution)).rejects.toThrow('cleanup_context_drift');
      db.prepare("UPDATE session_handle SET start_time='fixture-ledger-drift' WHERE handle=?").run(execution.session.handle);
      expect((await observer.verifyCleanup(context, execution)).result).toBe('unknown');
    } finally { db.close(); }
  }, 30000);

  it('missing execution identity cannot clean and evidence persistence failure yields no receipt', async () => {
    const db = openLedger();
    try {
      const context = { runId: 'missing', candidateId: 'fixture', role: 'model' as const, subjectDigest: 'a'.repeat(64), signal: new AbortController().signal };
      const fake = { completion: Promise.resolve('failed' as const), cancel: async () => {} };
      const observer = createIsolatedModelCleanup({ db, taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA!, 'Packages'), launch: async () => { throw Error('missing start'); }, persistObservation: async () => '' });
      await expect(observer.launch(context)).rejects.toThrow('missing start');
      await expect(observer.verifyCleanup(context, fake)).rejects.toThrow('cleanup_evidence_not_persisted');
    } finally { db.close(); }
  });
});
