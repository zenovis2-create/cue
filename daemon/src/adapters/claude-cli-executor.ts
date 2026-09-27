import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {types} from 'node:util';
import type {Ledger} from '../ledger.js';
import type {Envelope} from '../envelope.js';
import type {SessionOwner, SessionRecord} from '../session-spawn.js';
import {spawnOwned} from '../process-launch.js';
import type {AdapterExecution, ExecutionOutcome, RuntimeContext} from '../integration-runtime.js';
import {createClaudeCliDecoder, type ClaudeProjection, type ClaudeTerminal} from './claude-cli-protocol.js';
import {assertCurrentProviderInstallation} from '../../../app/provider-installation.mjs';
import type {ProviderInstallationDescriptor} from '../../../app/provider-installation.mjs';
import {consumeClaudeConfiguration, type ClaudeConfigurationResolver} from '../../../app/claude-configuration.mjs';

export type ClaudeAuthorizedLaunch = Readonly<{
  owner: SessionOwner; envelope: Envelope; candidateId: string; subjectDigest: string;
  accountIdentity: Readonly<{reference:string;digest:string}>;
  model: string; prompt: string;
}>;
export type ClaudeCliExecution = AdapterExecution & Readonly<{
  session: SessionRecord; providerTerminal: Promise<ClaudeTerminal | null>;
}>;
export type ClaudeOwnedProcessIdentity = Readonly<{pid:number; createdAt:string}>;
export type ClaudeCliExecutorHost = Readonly<{
  db: Ledger; installation: ProviderInstallationDescriptor;
  resolveLaunch(context: RuntimeContext): ClaudeAuthorizedLaunch | null | Promise<ClaudeAuthorizedLaunch | null>;
  resolveAuthorizedConfig?: ClaudeConfigurationResolver;
  captureOwnedIdentity(session: SessionRecord): ClaudeOwnedProcessIdentity;
  stopOwnedTree(identity: ClaudeOwnedProcessIdentity, session: SessionRecord): Promise<void>;
  onActivity?: (event: Readonly<{attemptId:string; ordinal:number; projection:ClaudeProjection}>) => void | Promise<void>;
  activityTimeoutMs?: number; runTimeoutMs?: number;
}>;

function boundedText(v: unknown, max = 4096): string {
  if (typeof v !== 'string' || !v || v.length > max || v.includes('\0')) throw Error('claude_executor_binding');
  return v;
}
function plain(value: unknown): void {
  if (!value || typeof value!=='object' || types.isProxy(value) || Object.getPrototypeOf(value)!==Object.prototype ||
      Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value'))) throw Error('claude_executor_binding');
}
function boundMs(value: number | undefined, fallback: number): number {
  if (value===undefined) return fallback;
  if (!Number.isSafeInteger(value) || value<1 || value>900000) throw Error('claude_executor_timeout');
  return value;
}
function stringArray(input: unknown): string[] {
  if (!Array.isArray(input) || types.isProxy(input) || Object.getPrototypeOf(input)!==Array.prototype || input.length>64
      || Reflect.ownKeys(input).length!==input.length+1) throw Error('claude_executor_binding');
  const result: string[]=[];
  for (let i=0;i<input.length;i++) {
    const descriptor=Object.getOwnPropertyDescriptor(input,String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor,'value')) throw Error('claude_executor_binding');
    result.push(boundedText(descriptor.value));
  }
  return Object.freeze(result) as unknown as string[];
}
function snapshotLaunch(launch: ClaudeAuthorizedLaunch): ClaudeAuthorizedLaunch {
  plain(launch); plain(launch.owner); plain(launch.envelope); plain(launch.accountIdentity);
  if (Object.hasOwn(launch,'env')) throw Error('claude_executor_env_from_launch');
  return Object.freeze({
    owner:Object.freeze({run_id:boundedText(launch.owner.run_id),task_id:boundedText(launch.owner.task_id),cwd:boundedText(launch.owner.cwd)}),
    envelope:Object.freeze({run_id:boundedText(launch.envelope.run_id),worktree_realpath:boundedText(launch.envelope.worktree_realpath),
      allowed_actions:stringArray(launch.envelope.allowed_actions),egress:stringArray(launch.envelope.egress),
      expires_at:boundedText(launch.envelope.expires_at),autonomy_level:boundedText(launch.envelope.autonomy_level) as Envelope['autonomy_level']}),
    candidateId:boundedText(launch.candidateId),subjectDigest:boundedText(launch.subjectDigest),
    accountIdentity:Object.freeze({reference:boundedText(launch.accountIdentity.reference),digest:boundedText(launch.accountIdentity.digest)}),
    model:boundedText(launch.model,128),prompt:boundedText(launch.prompt,1024*1024),
  });
}
function validate(host: ClaudeCliExecutorHost, context: RuntimeContext, launch: ClaudeAuthorizedLaunch): void {
  plain(launch); plain(launch.owner); plain(launch.envelope); plain(launch.accountIdentity);
  if (context.role !== 'implementation' || !context.accountIdentity) throw Error('claude_executor_role_or_account');
  if (launch.candidateId !== context.candidateId || launch.subjectDigest !== context.subjectDigest ||
      launch.accountIdentity.reference !== context.accountIdentity.reference || launch.accountIdentity.digest !== context.accountIdentity.digest ||
      launch.owner.run_id !== context.runId || launch.envelope.run_id !== context.runId ||
      launch.owner.cwd !== launch.envelope.worktree_realpath || !isAbsolute(launch.owner.cwd) ||
      !launch.owner.task_id || launch.model.length > 128 || !launch.model) throw Error('claude_executor_binding');
  if (realpathSync.native(launch.owner.cwd)!==launch.owner.cwd ||
      !Number.isFinite(Date.parse(launch.envelope.expires_at)) || Date.parse(launch.envelope.expires_at)<=Date.now()) throw Error('claude_executor_envelope');
  if (host.installation.provider !== 'claude' || host.installation.version.value !== '2.1.274' ||
      !isAbsolute(host.installation.executablePath)) throw Error('claude_executor_installation');
  boundedText(launch.prompt, 1024 * 1024);
  if (!Array.isArray(launch.envelope.allowed_actions) || launch.envelope.allowed_actions.length!==1 ||
      launch.envelope.allowed_actions[0]!=='file_change') throw Error('claude_executor_actions');
  if (!['bounded','supervised'].includes(launch.envelope.autonomy_level)) throw Error('claude_executor_envelope');
}

/** Inactive transport only. A separately qualified host must own authorization and cleanup. */
export function createClaudeCliExecutor(host: ClaudeCliExecutorHost): (context: RuntimeContext) => Promise<ClaudeCliExecution> {
  const activityTimeout=boundMs(host.activityTimeoutMs,1000), runTimeout=boundMs(host.runTimeoutMs,300000);
  return async context => {
    context.signal.throwIfAborted();
    if (typeof host.resolveAuthorizedConfig !== 'function') throw Error('claude_executor_configuration_unavailable');
    const resolved = await host.resolveLaunch(context);
    if (!resolved) throw Error('claude_executor_launch_unavailable');
    context.signal.throwIfAborted();
    const launch = snapshotLaunch(resolved);
    validate(host,context,launch);
    assertCurrentProviderInstallation(host.installation);
    const request = Object.freeze({attemptId:context.runId,candidateId:context.candidateId,subjectDigest:context.subjectDigest,
      accountIdentity:launch.accountIdentity,model:launch.model,worktreePath:launch.owner.cwd});
    const configuration = await host.resolveAuthorizedConfig(request);
    context.signal.throwIfAborted();
    if (!configuration) throw Error('claude_executor_configuration_unavailable');
    const env = consumeClaudeConfiguration(configuration,request,host.installation);
    context.signal.throwIfAborted();
    validate(host,context,launch);
    const tools = 'Read,Edit';
    const args = ['-p','--output-format','stream-json','--verbose','--include-partial-messages',
      '--permission-prompts','none','--restricted','--safe-mode','--tools',tools,'--allowedTools',tools,
      '--disallowedTools','mcp__*','--no-session-persistence','--model',launch.model];
    const {child,session} = spawnOwned(host.db,launch.owner,host.installation.executablePath,args,
      {env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    const decoder = createClaudeCliDecoder();
    let initSeen=false, cancelled=false, failed=false, closed=false, activityOrdinal=0;
    let identity: ClaudeOwnedProcessIdentity | undefined, stopUnverified=false;
    let terminal: ClaudeTerminal | null = null;
    const pending = new Set<Promise<void>>();
    let stopping: Promise<void> | undefined;
    let resolveExit!: (value:{code:number|null; observed:boolean})=>void;
    let exitSettled=false;
    const exited = new Promise<{code:number|null; observed:boolean}>(resolve=>{resolveExit=resolve;});
    const settleExit=(code:number|null,observed:boolean)=>{
      if (exitSettled) return;
      exitSettled=true;resolveExit({code,observed});
    };
    let stopGrace: ReturnType<typeof setTimeout> | undefined;
    let closeGrace: ReturnType<typeof setTimeout> | undefined;
    let rejectStopTimeout: ((reason: Error)=>void) | undefined;
    const cancel = (): Promise<void> => {
      cancelled=true; decoder.abort();
      if (!stopping) {
        closeGrace=setTimeout(()=>{stopUnverified=true;settleExit(null,false);},1000);
        const timeout=new Promise<void>((_,reject)=>{rejectStopTimeout=reject;});
        stopGrace=setTimeout(()=>{
          stopUnverified=true;
          rejectStopTimeout?.(Error('claude_executor_stop_timeout'));
        },1000);
        const request = identity
          ? Promise.resolve().then(()=>host.stopOwnedTree(identity!,session)).catch(()=>{stopUnverified=true;settleExit(null,false);throw Error('claude_executor_stop_unverified');})
          : Promise.reject(Error('claude_executor_process_identity_unavailable'));
        stopping=Promise.race([request,timeout]).finally(()=>{if(stopGrace)clearTimeout(stopGrace);});
      }
      return stopping;
    };
    const fail = () => { failed=true; void cancel().catch(()=>{}); };
    const track = (projection: ClaudeProjection) => {
      if (cancelled || failed) return;
      if (pending.size >= 256) {fail();return;}
      let timer: ReturnType<typeof setTimeout> | undefined;
      const ordinal=++activityOrdinal;
      const activity=projection.kind==='tool' ? {kind:'tool' as const,data:{toolId:projection.toolUseId,toolName:projection.toolName}} :
        projection.kind==='delta'||projection.kind==='assistant'||projection.kind==='subagent' ? {kind:'output' as const,data:{sha256:createHash('sha256').update(projection.text??'').digest('hex'),byteLength:Buffer.byteLength(projection.text??''),provisional:projection.kind==='delta'}} :
        projection.kind==='error' ? {kind:'terminal' as const,data:{status:'provider-assistant-error'}} :
        {kind:'progress' as const,data:{status:'provider-init'}};
      const work = Promise.resolve().then(async()=>{
        await host.onActivity?.({attemptId:context.runId,ordinal,projection});
        await context.emitActivity?.(activity.kind,activity.data);
      });
      const limit = new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('claude_executor_activity_timeout')),activityTimeout);});
      const observed=Promise.race([work,limit]).then(()=>undefined,fail).finally(()=>{if(timer)clearTimeout(timer);});
      pending.add(observed); void observed.finally(()=>pending.delete(observed));
    };
    child.once('close',(code)=>{closed=true;settleExit(code,true);});
    child.once('error',fail);
    child.stdin?.on('error',fail);
    child.stdout?.on('error',fail);
    child.stderr?.on('error',fail);
    child.stdout?.on('data',(chunk:Buffer)=>{
      if (cancelled || failed || closed) return;
      try {
        for (const projection of decoder.push(chunk)) {
          if (projection.kind==='init') {
            if (initSeen || projection.model!==launch.model || projection.claudeCodeVersion!=='2.1.274' ||
                projection.cwd!==launch.owner.cwd || projection.tools?.some(tool=>!['Read','Edit','EndConversation'].includes(tool)) ||
                projection.mcpServers?.length) {fail();return;}
            initSeen=true;
          }
          track(projection);
        }
      } catch {fail();}
    });
    let stderrBytes=0;
    child.stderr?.on('data',(chunk:Buffer)=>{stderrBytes+=chunk.byteLength;if(stderrBytes>256*1024)fail();});
    const onAbort=()=>{void cancel().catch(()=>{});};
    context.signal.addEventListener('abort',onAbort,{once:true});
    const deadline=setTimeout(()=>{fail();},runTimeout);
    try {
      identity=host.captureOwnedIdentity(session);
      if (identity.pid!==session.pid || !identity.createdAt) throw Error('claude_executor_process_identity');
    } catch {identity=undefined;failed=true;stopUnverified=true;decoder.abort();settleExit(null,false);}
    if (!child.stdin || !child.stdout || !child.stderr || !session.handle) fail();
    const providerTerminal=exited.then(({code,observed})=>{
      clearTimeout(deadline);
      if (cancelled || failed || !observed || code!==0 || !initSeen) return null;
      try {terminal=decoder.finish(); return terminal;} catch {return null;}
    });
    const completion=providerTerminal.then<ExecutionOutcome>(async value=>{
      await Promise.allSettled([...pending]);
      // Local close can precede the owned-tree stop result. Keep that bounded
      // uncertainty in the outcome instead of settling before rejection/timeout.
      if (stopping) { try { await stopping; } catch { stopUnverified=true; } }
      return stopUnverified ? 'unknown' : !cancelled && !failed && value?.outcome==='success' ? 'succeeded' : 'failed';
    }).finally(()=>{context.signal.removeEventListener('abort',onAbort);clearTimeout(deadline);if(closeGrace)clearTimeout(closeGrace);});
    try { if (!failed) child.stdin?.end(launch.prompt); } catch {fail();}
    if (context.signal.aborted) void cancel().catch(()=>{});
    return Object.freeze({session,providerTerminal,completion,cancel,durableRef:`session:${session.handle}`});
  };
}
