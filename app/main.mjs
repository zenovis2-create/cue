import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import { join, resolve } from 'node:path';
import { mkdir, writeFile, lstat, open, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AppDaemon, createCueCore } from './core.mjs';
import { isInstallationGeneration } from './installation-identity.mjs';
import { createStartupOrchestrationFactory, createStartupGoalPlanningFactory } from './protected-installation.mjs';
import { createDeploymentStagingOrchestrationFactory } from './deployment-staging-host.mjs';
import { createNativeRecoveryHost } from './native-recovery-host.mjs';
import { createGeneratedJsonHandoffAuthority } from './generated-json-handoff-authority.mjs';
import { initializeFirstRunConfig } from './first-run.mjs';
import { registerIpcHandlers } from './ipc.mjs';
import { createWorkspaceManagement, activateProjectConfig } from './workspace-management.mjs';
import { createProjectSwitchCoordinator } from './project-switch.mjs';
import { applyNavigationGuards } from './electron-security.mjs';
import { registerQuitGuard } from './quit-guard.mjs';
import { openReportWindow } from './report-window.mjs';

const appDir = fileURLToPath(new URL('.', import.meta.url));
let mainWindow;
let core;

// RESOURCE DIALOG: only the host chooses paths; the renderer submits no filename.
async function chooseResourcePackage() {
  const choice = await dialog.showOpenDialog(mainWindow, { title: '읽기 전용 리소스 패키지 폴더', properties: ['openDirectory'] });
  if (choice.canceled || choice.filePaths.length !== 1) return null;
  const root = choice.filePaths[0], rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw Error('resource_directory_denied');
  const canonicalRoot = await realpath(root), path = join(root, 'manifest.json'), before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > 32768 || await realpath(path) !== join(canonicalRoot, 'manifest.json')) throw Error('resource_manifest_denied');
  const file = await open(path, 'r');
  try {
    const opened = await file.stat();
    if (opened.dev !== before.dev || opened.ino !== before.ino || !opened.isFile()) throw Error('resource_manifest_drift');
    const bytes = Buffer.alloc(32769); let length = 0;
    while (length < bytes.length) { const result = await file.read(bytes, length, bytes.length-length, null); if (!result.bytesRead) break; length += result.bytesRead; }
    const after = await file.stat(), current = await lstat(path), currentRoot = await lstat(root);
    if (length !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs
      || current.isSymbolicLink() || current.dev !== before.dev || current.ino !== before.ino || currentRoot.isSymbolicLink()
      || currentRoot.dev !== rootInfo.dev || currentRoot.ino !== rootInfo.ino || await realpath(root) !== canonicalRoot) throw Error('resource_manifest_drift');
    return { root, manifestSha256: createHash('sha256').update(bytes.subarray(0,length)).digest('hex') };
  } finally { await file.close(); }
}
// END RESOURCE DIALOG

export function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    show: true,
    webPreferences: {
      preload: join(appDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const rendererPath = join(appDir, 'renderer', 'index.html');
  applyNavigationGuards(mainWindow.webContents, pathToFileURL(rendererPath).href);
  mainWindow.loadFile(rendererPath);
  return mainWindow;
}

async function runLiveCanary() {
  await new Promise(resolveReady => mainWindow.webContents.once('did-finish-load', resolveReady));
  const rendered = await mainWindow.webContents.executeJavaScript(`(async () => {
    document.querySelector('#goal').value = 'Create electron-live.txt in the approved workspace with exactly this UTF-8 text and no extra characters: electron-from-cue';
    document.querySelector('#goal-form').requestSubmit();
    const deadline = Date.now() + 660000;
    while (document.querySelector('#approve').disabled) {
      if (Date.now() > deadline) throw new Error('prepare timeout');
      await new Promise(done => setTimeout(done, 50));
    }
    document.querySelector('#approve').click();
    while (!document.querySelector('#result').dataset.state || document.querySelector('#result').dataset.state === 'running') {
      if (Date.now() > deadline) throw new Error('execution timeout');
      await new Promise(done => setTimeout(done, 100));
    }
    return {
      state: document.querySelector('#result').dataset.state,
      stateTitle: document.querySelector('#state-title').textContent,
      stage: document.querySelector('#stage').textContent,
      approvalSummary: document.querySelector('#approval-summary').textContent,
      autonomySummary: document.querySelector('#autonomy-summary').textContent,
      toolSummary: document.querySelector('#tool-summary').textContent,
      resultSummary: document.querySelector('#result-summary').textContent,
    };
  })()`);
  const latest = core.daemon.db.prepare('SELECT id,state,blocked_reason AS blockedReason FROM task ORDER BY created_at DESC LIMIT 1').get();
  const sessions = core.daemon.db.prepare(`SELECT s.pid,r.role,r.boundary
    FROM session_handle s JOIN session_runtime r ON r.handle=s.handle
    WHERE s.task_id=? ORDER BY s.rowid`).all(latest.id);
  const binaryIntegrityPinned = Boolean(core.daemon.db.prepare("SELECT 1 FROM artifact WHERE task_id=? AND kind='binary_integrity' AND content='sha256:PASS'").get(latest.id));
  mainWindow.webContents.debugger.attach('1.3');
  const capture = await mainWindow.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png' });
  mainWindow.webContents.debugger.detach();
  const evidenceDir = resolve('evidence/P10C');
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(join(evidenceDir, 'p10c_electron_window.png'), Buffer.from(capture.data, 'base64'));
  const record = {
    generatedAt: new Date().toISOString(),
    pid: process.pid,
    windowCreated: Boolean(mainWindow && !mainWindow.isDestroyed()),
    adapterMode: process.env.CUE_ADAPTER_MODE || 'none',
    task: 'standalone Electron approval to host model controller to AppContainer worker',
    taskId: latest.id,
    state: latest.state,
    blockedReason: latest.blockedReason,
    rendered,
    sessions,
    binaryIntegrityPinned,
  };
  await writeFile(join(evidenceDir, 'p10c_electron_run.json'), `${JSON.stringify(record, null, 2)}\n`);
  if (latest.state !== 'completed' || !binaryIntegrityPinned) process.exitCode = 2;
  app.quit();
}

let startupAttempted = false;
// Importing this module defines the application; guarded entry must finish its
// post-import assertion before calling this initializer.
export async function startCueApplication({ guard }) {
  if (startupAttempted) throw Error('cue_startup_already_attempted');
  startupAttempted = true;
  if (!isInstallationGeneration(guard)) throw Error('cue_startup_generation_invalid');
  guard.assertCurrent();
  registerQuitGuard(app, () => core);
  app.on('window-all-closed', () => app.quit());
  await app.whenReady();
  guard.assertCurrent();
  let daemon;
  try {
  const userData = process.env.CUE_USER_DATA || app.getPath('userData');
  const config = await initializeFirstRunConfig(userData, {
    worktreeOverride: process.env.CUE_WORKTREE_ROOT,
    defaultRoot: process.cwd(),
    chooseDirectory: async () => {
      const selection = await dialog.showOpenDialog({
        title: 'Cue에서 작업할 프로젝트 폴더를 선택하세요',
        buttonLabel: '이 폴더 사용',
        properties: ['openDirectory', 'createDirectory'],
      });
      return selection.canceled ? undefined : selection.filePaths[0];
    },
  });
  guard.assertCurrent();
  daemon = new AppDaemon(config);
  const nativeConfiguration=process.env.CUE_NATIVE_WORKFLOW_CONFIG;
  let rawOrchestrationFactory;
  const orchestrationFactory = await createDeploymentStagingOrchestrationFactory({
    configuration: process.env.CUE_GIT_STAGING_CONFIG,
    createOrchestrationFactory: async()=>{
      rawOrchestrationFactory=await createStartupOrchestrationFactory({guard,daemon,nativeConfiguration});
      return rawOrchestrationFactory;
    },
  });
  const planningOrchestrationFactory=await createStartupGoalPlanningFactory({guard,daemon,config,nativeConfiguration,executionFactory:rawOrchestrationFactory});
  guard.assertCurrent();
  core = createCueCore(config, daemon, { orchestrationFactory,planningOrchestrationFactory, nativeRecoveryFactory({ db, worktree }) {
    if (db !== daemon.db) throw Error('native_recovery_ledger_mismatch');
    return createNativeRecoveryHost({ guard, daemon, worktree, handoffAuthority:createGeneratedJsonHandoffAuthority({db}) });
  } });
  const sourceHome=process.env.CODEX_HOME??(process.env.USERPROFILE?join(process.env.USERPROFILE,'.codex'):null);
  const protectedRoots=[appDir,join(appDir,'..','daemon'),userData,...(sourceHome?[sourceHome]:[])];
  const workspaceManagement=createWorkspaceManagement(daemon.db,config.worktreeRoot,protectedRoots);
  let ipcRuntime;
  const projectSwitch=createProjectSwitchCoordinator({core,catalog:workspaceManagement,assertCurrent:()=>guard.assertCurrent(),
    pendingRequests:()=>ipcRuntime?.pendingRequests()??0,persist:root=>activateProjectConfig(userData,config,root),
    restart:()=>{app.relaunch();app.quit();},
    onFatal:()=>dialog.showErrorBox('프로젝트 전환 중단','Core 종료 이후 전환을 완료하지 못했습니다. Cue를 수동으로 다시 시작하고 프로젝트 설정을 확인하세요.'),
    async confirm(target){
      const owner=mainWindow;if(!owner||owner.isDestroyed())return false;
      const choice=await dialog.showMessageBox(owner,{type:'question',title:'프로젝트 전환',message:`${target.name} 프로젝트로 전환하시겠습니까?`,
        detail:'진행 중인 작업이나 승인 대기는 자동으로 중단하지 않습니다. 현재 Core를 안전하게 닫은 뒤 앱을 재시작합니다. 기록을 열어도 실행은 재개되지 않습니다.',
        buttons:['취소','전환'],defaultId:0,cancelId:0,noLink:true});
      return owner===mainWindow&&!owner.isDestroyed()&&choice.response===1;
    },
  });
  ipcRuntime=registerIpcHandlers(ipcMain, core, {
    projectManagement:workspaceManagement,sessionManagement:workspaceManagement,
    async chooseProjectDirectory(){
      guard.assertCurrent();
      const result=await dialog.showOpenDialog(mainWindow,{title:'기존 프로젝트 폴더 추가',buttonLabel:'프로젝트 추가',properties:['openDirectory']});
      guard.assertCurrent();return result.canceled?null:result.filePaths[0];
    },
    switchProject:projectId=>projectSwitch.switchProject(projectId),
    isTrustedSender: event => Boolean(projectSwitch.state==='idle' && mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame),
    openReport: artifact => openReportWindow({ BrowserWindow, session }, artifact),
    chooseResourcePackage,
    async confirmManualBaseline(view){
      guard.assertCurrent();
      const owner=mainWindow;if(!owner||owner.isDestroyed())return false;
      const r=view.request;
      const detail=[`작업공간: ${config.worktreeRoot}`,`실행: ${r.runId}`,`기준선: ${r.baselineId} / 등록: ${r.enrollmentId}`,
        `데이터셋: ${r.dataset.id} / ${r.dataset.revision} / ${r.dataset.digest}`,`케이스: ${r.caseId} (${r.dataset.cases.find(c=>c.id===r.caseId)?.split})`,
        `정책: ${r.policy.policyId}:${r.policy.revision} / ${r.policy.digest}`,`고정 작업 계획: ${r.planDigest}`,
        ...view.tasks.map(t=>`${t.taskId} [${t.role}] → ${t.candidateId} (담당: ${t.ownerId})`),
        ...['metric','environment','accountLimits'].map(key=>`${key}: ${r[key].id} / ${r[key].revision} / ${r[key].digest}`),
        '이 조합을 수동 비교 기준선으로 등록합니다. 실행 승인은 별도이며 입력 일치·실측·성능 개선·공급자 자격을 인증하지 않습니다.'].join('\n');
      const choice=await dialog.showMessageBox(owner,{type:'question',title:'수동 기준선 조합 확인',message:'이 고정 구현·독립 검증 조합을 기준선으로 선택하시겠습니까?',detail,
        buttons:['취소','이 조합을 기준선으로 등록'],defaultId:0,cancelId:0,noLink:true,checkboxLabel:'위 작업별 후보 조합과 데이터셋을 확인했습니다',checkboxChecked:false});
      guard.assertCurrent();
      return owner===mainWindow&&!owner.isDestroyed()&&choice.response===1&&choice.checkboxChecked===true;
    },
  });
  createWindow();
  return core;
  } catch (error) {
    if (core) await core.close(); else await daemon?.close();
    throw error;
  }
}
