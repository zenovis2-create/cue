import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCueCore } from './core.mjs';
import { initializeFirstRunConfig } from './first-run.mjs';
import { registerIpcHandlers } from './ipc.mjs';
import { applyNavigationGuards } from './electron-security.mjs';

const appDir = fileURLToPath(new URL('.', import.meta.url));
let mainWindow;
let core;

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

app.whenReady().then(async () => {
  const userData = process.env.CUE_USER_DATA || app.getPath('userData');
  const config = await initializeFirstRunConfig(userData, {
    worktreeOverride: process.env.CUE_WORKTREE_ROOT,
    defaultRoot: process.cwd(),
    chooseDirectory: process.env.CUE_LIVE_RUN === '1' ? undefined : async () => {
      const selection = await dialog.showOpenDialog({
        title: 'Cue에서 작업할 프로젝트 폴더를 선택하세요',
        buttonLabel: '이 폴더 사용',
        properties: ['openDirectory', 'createDirectory'],
      });
      return selection.canceled ? undefined : selection.filePaths[0];
    },
  });
  core = createCueCore(config);
  registerIpcHandlers(ipcMain, core);
  createWindow();
  if (process.env.CUE_LIVE_RUN === '1') await runLiveCanary();
}).catch(error => {
  console.error('Cue startup failed:', error);
  dialog.showErrorBox('Cue 시작 실패', error instanceof Error ? error.message : '알 수 없는 오류');
  app.exit(1);
});

app.on('before-quit', () => { core?.close(); });
app.on('window-all-closed', () => app.quit());
