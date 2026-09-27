import { lstat } from 'node:fs/promises';
import { waitNativeResult } from './native-identity-commit.js';
import { win32 } from 'node:path';
import type { Ledger } from '../ledger.js';
import type { AdapterExecution, CleanupReceipt, RuntimeContext } from '../integration-runtime.js';
import type { IsolatedModelExecution } from './isolated-local-model.js';

type Presence = 'absent' | 'present' | 'unknown';
type Identity = Pick<RuntimeContext, 'runId' | 'candidateId' | 'role' | 'subjectDigest'>;
const identity = (c: RuntimeContext): Identity => ({ runId: c.runId, candidateId: c.candidateId, role: c.role, subjectDigest: c.subjectDigest });
const pid = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const samePath = (a: string, b: string) => win32.normalize(a).toLowerCase() === win32.normalize(b).toLowerCase();
function processPresence(value: number): Presence {
  try { process.kill(value, 0); return 'present'; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH' ? 'absent' : 'unknown'; }
}
async function pathPresence(value: string): Promise<Presence> {
  try { await lstat(value); return 'present'; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'absent' : 'unknown'; }
}

/** Host composition only. The configured launcher, bases and durable evidence writer
 * are trusted host authority; none may originate in a model request or manifest.
 * This observer never terminates processes, removes paths, or trusts cleanup claims. */
export function createIsolatedModelCleanup(host: {
  db: Ledger;
  launch(context: RuntimeContext): Promise<IsolatedModelExecution>;
  taskRootBase: string;
  profileRootBase: string;
  persistObservation(observation: Readonly<Record<string, unknown>>): Promise<string>;
}) {
  const taskBase = host.taskRootBase, profileBase = host.profileRootBase;
  if (!win32.isAbsolute(taskBase) || !win32.isAbsolute(profileBase)) throw Error('cleanup_invalid_host_bases');
  const registered = new WeakMap<AdapterExecution, { context: RuntimeContext; identity: Identity; session: IsolatedModelExecution['session']; execution: IsolatedModelExecution }>();
  return Object.freeze({
    async launch(context: RuntimeContext): Promise<IsolatedModelExecution> {
      const snapshot = Object.freeze(identity(context));
      const execution = await host.launch(context);
      registered.set(execution, { context, identity: snapshot, session: Object.freeze({ ...execution.session }), execution });
      return execution;
    },
    async verifyCleanup(context: RuntimeContext, execution: AdapterExecution): Promise<CleanupReceipt> {
      const requestedIdentity = Object.freeze(identity(context));
      const assertUnchanged = () => { if (JSON.stringify(identity(context)) !== JSON.stringify(requestedIdentity)) throw Error('cleanup_context_drift'); };
      const binding = registered.get(execution);
      const observation: Record<string, unknown> = { ...requestedIdentity, measuredAt: new Date().toISOString(),
        providerStopped: 'unknown', billing: 'unknown', result: 'unknown', reason: 'unregistered-or-drifted' };
      if (binding && binding.context === context && JSON.stringify(binding.identity) === JSON.stringify(identity(context))) {
        try {
          const s = binding.session;
          const row = host.db.prepare('SELECT s.* FROM session_handle s JOIN run r ON r.id=s.run_id AND r.task_id=s.task_id WHERE s.handle=?').get(s.handle) as Record<string, unknown> | undefined;
          if (!row || !pid(s.pid) || s.run_id !== context.runId || Object.entries(s).some(([key, value]) => row[key] !== value)) throw Error('ledger-identity');
          const result = await waitNativeResult(binding.execution.result);
          const frames = result.observations, boundary = frames.CUE_MODEL_BOUNDARY, native = frames.CUE_MODEL_OBSERVATION;
          const clientPid = typeof frames.CUE_MODEL_PID === 'string' && /^[1-9]\d*$/.test(frames.CUE_MODEL_PID) ? Number(frames.CUE_MODEL_PID) : null;
          const guardianPid = typeof frames.CUE_MODEL_GUARDIAN_PID === 'string' && /^[1-9]\d*$/.test(frames.CUE_MODEL_GUARDIAN_PID) ? Number(frames.CUE_MODEL_GUARDIAN_PID) : null;
          if (result.attemptId !== context.runId || !object(boundary) || !object(native) || !pid(clientPid) || !pid(guardianPid)
            || new Set([s.pid, clientPid, guardianPid]).size !== 3 || native.pid !== clientPid || native.status !== 'observed'
            || native.phase !== 'suspended-before-resume' || typeof native.createdFileTime !== 'string' || !/^[1-9]\d{10,19}$/.test(native.createdFileTime)
            || native.appContainer !== true || native.appContainerSid !== boundary.sid || typeof boundary.sid !== 'string' || !/^S-1-15-2-\d+(?:-\d+)+$/.test(boundary.sid)
            || boundary.clientOnly !== true || typeof boundary.profile !== 'string' || !/^Cue\.Model\.[a-f0-9]{32}$/.test(boundary.profile)
            || typeof boundary.taskRoot !== 'string' || typeof boundary.profilePath !== 'string'
            || !samePath(boundary.taskRoot, win32.join(taskBase, boundary.profile)) || !samePath(boundary.profilePath, win32.join(profileBase, boundary.profile, 'AC'))) throw Error('native-identity');
          const processes = { launcher: processPresence(s.pid), client: processPresence(clientPid), guardian: processPresence(guardianPid) };
          const paths = { taskRoot: await pathPresence(boundary.taskRoot), profile: await pathPresence(boundary.profilePath), profileRoot: await pathPresence(win32.join(profileBase, boundary.profile)) };
          const states = [...Object.values(processes), ...Object.values(paths)];
          Object.assign(observation, { session: s, nativeIdentity: { clientPid, guardianPid, createdFileTime: native.createdFileTime, ...boundary }, processes, paths,
            result: states.includes('present') ? 'residual' : states.every(v => v === 'absent') ? 'verified-clean' : 'unknown', reason: 'independent-os-observation' });
        } catch { observation.reason = 'identity-or-observation-unavailable'; }
      }
      assertUnchanged();
      const evidenceRef = await host.persistObservation(Object.freeze(observation));
      assertUnchanged();
      if (typeof evidenceRef !== 'string' || !evidenceRef.trim() || evidenceRef.length > 1024) throw Error('cleanup_evidence_not_persisted');
      return Object.freeze({ runId: requestedIdentity.runId, subjectDigest: requestedIdentity.subjectDigest, result: observation.result as CleanupReceipt['result'], evidenceRef });
    },
  });
}
