import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { isInstallationGeneration } from './installation-identity.mjs';
import { runProcessSync } from '../daemon/dist/src/process-launch.js';
import { readLatestLocalHostSettings } from '../daemon/dist/src/selection/local-host-settings.js';
import { createDefaultGeneratedJsonBootstrap, DEFAULT_GENERATED_JSON_SETTINGS_ID } from './default-generated-json-bootstrap.mjs';
import { createDefaultGoalPlanningBootstrap, DEFAULT_GOAL_PLANNING_SETTINGS_ID } from './default-goal-planning-bootstrap.mjs';
import { readNativeProposalExecutionCatalog } from './native-existing-file-authorities.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dependencyRoot = join(root, 'daemon', 'node_modules');
const require = createRequire(join(root, 'daemon', 'package.json'));
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const MAX_HEALTH_AGE_MS = 600000;
function canonical(path, directory = false) {
  if (typeof path !== 'string' || !isAbsolute(path) || path.length > 32768 || path.includes('\0')) throw Error('startup_path_invalid');
  const absolute = resolve(path); let current = parse(absolute).root;
  for (const part of absolute.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink() || !same(realpathSync(current), current)) throw Error('startup_path_reparse');
  }
  const stat = lstatSync(absolute);
  if (directory ? !stat.isDirectory() : !stat.isFile()) throw Error('startup_path_type');
  return absolute;
}
function assertGeneration(guard) {
  if (!isInstallationGeneration(guard) || !same(guard.snapshot.root, root) || !same(guard.snapshot.dependencyRoot, dependencyRoot)) throw Error('startup_generation_invalid');
  guard.assertCurrent();
}
/** Protected installed paths only; caller must already have opened AppDaemon's
 * real SQLite connection after guarded import. This never loads another addon. */
export function discoverGeneratedJsonInstallation(guard) {
  assertGeneration(guard);
  if (process.platform !== 'win32') throw Error('startup_windows_required');
  const packageRoot = canonical(join(dependencyRoot, 'better-sqlite3'), true);
  if (!same(canonical(dirname(require.resolve('better-sqlite3/package.json')), true), packageRoot)) throw Error('startup_sqlite_package');
  const natives = Object.keys(require.cache).filter(path => path.endsWith('.node')).map(path => canonical(path)).filter(path => {
    const rel = relative(packageRoot, path); return rel && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
  });
  const unique = [...new Set(natives)];
  if (unique.length !== 1) throw Error('startup_sqlite_native_ambiguous');
  const nativeLabel = 'dependency/better-sqlite3/' + relative(packageRoot, unique[0]).split(sep).join('/');
  if (!guard.snapshot.files.some(file => file.label === nativeLabel && /^[a-f0-9]{64}$/.test(file.sha256 ?? ''))) throw Error('startup_sqlite_not_captured');
  const powershellExecutable = canonical(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'));
  const result = runProcessSync(powershellExecutable, ['-NoProfile', '-NonInteractive', '-Command',
    '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); @{programFiles=[Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles);localAppData=[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData);temp=[IO.Path]::GetTempPath()} | ConvertTo-Json -Compress'],
  { encoding: 'utf8', timeout: 5000, maxBuffer: 8192, windowsHide: true });
  if (result.status !== 0 || result.error || Buffer.byteLength(result.stdout ?? '') > 8192) throw Error('startup_knownfolders_unavailable');
  const folders = JSON.parse(result.stdout);
  const nodeExecutable = canonical(join(canonical(folders.programFiles, true), 'nodejs', 'node.exe'));
  const installation = Object.freeze({
    measurement: Object.freeze({ installRoot: root, nodeExecutable, powershellExecutable, sqliteNativePath: unique[0], dependencyRoot }),
    controlRoot: canonical(join(root, 'daemon', 'dist', 'src'), true),
    taskRootBase: canonical(folders.temp, true), profileRootBase: canonical(join(canonical(folders.localAppData, true), 'Packages'), true),
    loadedHost: Object.freeze({ executable: canonical(process.execPath), runtime: process.versions.electron ? 'electron' : 'node', version: process.versions.electron ?? process.versions.node }),
  });
  assertGeneration(guard);
  return installation;
}

/** A bounded GET observes fixed model presence, not capacity, qualification,
 * provider quotas, billing, or a promise that a later inference will succeed. */
async function observeModelHealth() {
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 2000);
  let reader;
  try {
    const response = await fetch('http://127.0.0.1:8085/v1/models', { method: 'GET', redirect: 'error', signal: abort.signal });
    if (!response.ok || !response.body) return null;
    reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 32768) return null; chunks.push(Buffer.from(chunk.value)); }
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    if (!Array.isArray(value.data) || value.data.length > 256 || !value.data.some(item => item?.id === 'qwen38-27b-unc')) return null;
    return Object.freeze({ observedAtMs: Date.now(), modelId: 'qwen38-27b-unc' });
  } catch { return null; }
  finally { clearTimeout(timer); abort.abort(); await reader?.cancel().catch(() => {}); }
}

/** Same protected daemon DB supplies settings, policy, evidence and execution.
 * Missing/disabled setup does not even request model metadata. No inference or
 * qualification is performed, and no policy/evidence records are written. */
export async function createStartupOrchestrationFactory({ guard, daemon, nativeConfiguration }) {
  assertGeneration(guard);
  const db = daemon.db;
  const unavailable = reason => () => Object.freeze({ available: false, reasons: Object.freeze([reason]) });
  // Explicit native selection never falls through to the local-model bootstrap.
  // Configuration names inputs; only the fixed composer can establish readiness.
  if (nativeConfiguration !== undefined) {
    let configuration;
    try {
      if (typeof nativeConfiguration !== 'string' || Buffer.byteLength(nativeConfiguration) > 65536) throw Error('invalid');
      configuration = JSON.parse(nativeConfiguration);
      if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) throw Error('invalid');
    } catch { return unavailable('native-startup-config-invalid'); }
    if (daemon.status !== 'ready') return unavailable('native-startup-daemon-unavailable');
    try {
      const { createNativeExistingFileAuthorities } = await import('./native-existing-file-authorities.mjs');
      assertGeneration(guard);
      const factory = await createNativeExistingFileAuthorities({ db, now: Date.now, configuration });
      assertGeneration(guard);
      if (typeof factory !== 'function') return unavailable('native-startup-composer-unavailable');
      return context => {
        assertGeneration(guard);
        if (context?.db !== db) return Object.freeze({ available: false, reasons: Object.freeze(['native-startup-ledger-mismatch']) });
        if (daemon.status !== 'ready') return Object.freeze({ available: false, reasons: Object.freeze(['native-startup-daemon-unavailable']) });
        const readiness = factory(context);
        assertGeneration(guard);
        return readiness;
      };
    } catch { return unavailable('native-startup-composer-unavailable'); }
  }
  const saved = readLatestLocalHostSettings(db, DEFAULT_GENERATED_JSON_SETTINGS_ID);
  if (!saved || saved.settings.version !== 'cue-local-host-settings-v2' || !saved.settings.enabled) return unavailable('default-host-settings-missing-or-disabled');
  let installation;
  try { installation = discoverGeneratedJsonInstallation(guard); } catch { return unavailable('default-host-installation-unavailable'); }
  const health = await observeModelHealth(); assertGeneration(guard);
  if (!health) return unavailable('default-host-model-health-unavailable');
  const fresh = () => { const age = Date.now() - health.observedAtMs; return age >= 0 && age <= MAX_HEALTH_AGE_MS && daemon.status === 'ready'; };
  const bootstrap = createDefaultGeneratedJsonBootstrap({
    now: Date.now, maxEvidenceAgeMs: MAX_HEALTH_AGE_MS,
    discoverInstallation(context) { return context.db === db ? installation : null; },
    validateLoadedInstallation(value) {
      try {
        assertGeneration(guard);
        return Object.entries(installation.measurement).every(([key, path]) => value.installation.measurement[key] === path)
          && value.installation.controlRoot === installation.controlRoot
          && value.installation.taskRootBase === installation.taskRootBase && value.installation.profileRootBase === installation.profileRootBase
          && value.hostExecutable === installation.loadedHost.executable && value.hostRuntime === installation.loadedHost.runtime && value.hostVersion === installation.loadedHost.version
          && Boolean(require.cache[installation.measurement.sqliteNativePath]);
      } catch { return false; }
    },
    observeReadiness(kind, context) {
      assertGeneration(guard);
      const ready = context.db === db && fresh();
      // Explicitly enabled local-only setup authorizes this data route. Local
      // reservation accounting enforces remaining invocations; there is no
      // additional host quota. This makes no claim about provider-side quotas.
      return Object.freeze({ authenticated: ready, dataAllowed: ready, resourceAvailable: ready, quotaAvailable: true });
    },
  });
  return context => context.db === db ? bootstrap(context) : Object.freeze({ available: false, reasons: Object.freeze(['default-host-ledger-mismatch']) });
}

/** Planning is a separately configured local model stage. It is only exposed
 * when the protected native execution factory is ready for this same ledger
 * and worktree. Neither settings nor environment JSON may issue callbacks. */
export async function createStartupGoalPlanningFactory({guard,daemon,config,nativeConfiguration,executionFactory}) {
  assertGeneration(guard);
  const db=daemon.db, unavailable=reason=>()=>Object.freeze({available:false,reasons:Object.freeze([reason])});
  const saved=readLatestLocalHostSettings(db,DEFAULT_GOAL_PLANNING_SETTINGS_ID);
  if(!saved||saved.settings.version!=='cue-local-host-settings-v2'||saved.settings.templateId!=='goal-planning-v1'||!saved.settings.enabled)
    return unavailable('planning-startup-settings-missing-or-disabled');
  if(daemon.status!=='ready'||typeof executionFactory!=='function'||nativeConfiguration===undefined)
    return unavailable('planning-startup-execution-unavailable');
  let nativeConfig,worktree,contract;
  try{
    if(typeof nativeConfiguration!=='string'||Buffer.byteLength(nativeConfiguration)>65536)throw Error('invalid');
    nativeConfig=JSON.parse(nativeConfiguration);
    worktree=realpathSync(config.worktreeRoot);
    const ready=executionFactory(Object.freeze({db,config,worktree}));
    if(!ready||ready.available===false||ready.executionStagingSupport!=='git-worktree-v1'||ready.supportsGoalProposals!==true)
      return unavailable('planning-startup-native-unqualified');
    contract=readNativeProposalExecutionCatalog({db,configuration:nativeConfig});
    assertGeneration(guard);
  }catch{return unavailable('planning-startup-native-contract-unavailable');}
  let installation;
  try{installation=discoverGeneratedJsonInstallation(guard);}catch{return unavailable('planning-startup-installation-unavailable');}
  const health=await observeModelHealth();assertGeneration(guard);
  if(!health)return unavailable('planning-startup-model-health-unavailable');
  const fresh=()=>{const age=Date.now()-health.observedAtMs;return age>=0&&age<=MAX_HEALTH_AGE_MS&&daemon.status==='ready';};
  const bootstrap=createDefaultGoalPlanningBootstrap({
    now:Date.now,maxEvidenceAgeMs:MAX_HEALTH_AGE_MS,
    discoverInstallation(context){return context.db===db&&context.worktree===worktree?installation:null;},
    validateLoadedInstallation(value){
      try{assertGeneration(guard);return Object.entries(installation.measurement).every(([key,path])=>value.installation.measurement[key]===path)
        &&value.installation.controlRoot===installation.controlRoot&&value.installation.taskRootBase===installation.taskRootBase
        &&value.installation.profileRootBase===installation.profileRootBase&&value.hostExecutable===installation.loadedHost.executable
        &&value.hostRuntime===installation.loadedHost.runtime&&value.hostVersion===installation.loadedHost.version
        &&Boolean(require.cache[installation.measurement.sqliteNativePath]);}catch{return false;}
    },
    observeReadiness(_kind,context){
      assertGeneration(guard);const ready=context.db===db&&fresh();
      return Object.freeze({authenticated:ready,dataAllowed:ready,resourceAvailable:ready,quotaAvailable:true});
    },
    readExecutionContract(context){
      assertGeneration(guard);
      if(context.db!==db||context.worktree!==worktree||daemon.status!=='ready')throw Error('planning-startup-ledger-or-worktree');
      const ready=executionFactory(Object.freeze({db,config,worktree}));
      if(!ready||ready.available===false||ready.executionStagingSupport!=='git-worktree-v1'||ready.supportsGoalProposals!==true)
        throw Error('planning-startup-native-unqualified');
      const current=readNativeProposalExecutionCatalog({db,configuration:nativeConfig});
      if(JSON.stringify(current)!==JSON.stringify(contract))throw Error('planning-startup-contract-drift');
      return current;
    },
  });
  return context=>{
    assertGeneration(guard);
    if(context?.db!==db||context.worktree!==worktree)return Object.freeze({available:false,reasons:Object.freeze(['planning-startup-context-mismatch'])});
    return bootstrap(context);
  };
}
