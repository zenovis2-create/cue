import { app, BrowserWindow, ipcMain } from 'electron';
import { join, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCueCore, initializeConfig } from './core.mjs';
import { registerIpcHandlers } from './ipc.mjs';

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
  mainWindow.loadFile(join(appDir, 'renderer', 'index.html'));
  return mainWindow;
}

async function runLiveCanary() {
  await new Promise(resolveReady => mainWindow.webContents.once('did-finish-load', resolveReady));
  const rendered = await mainWindow.webContents.executeJavaScript(`(async () => {
    document.querySelector('#goal').value = 'worktree 안 검증 파일 하나 생성';
    document.querySelector('#goal-form').requestSubmit();
    while (document.querySelector('#approve').disabled) await new Promise(done => setTimeout(done, 20));
    document.querySelector('#approve').click();
    while (document.querySelector('#result').hidden) await new Promise(done => setTimeout(done, 20));
    return {
      approvalSummary: document.querySelector('#approval-summary').textContent,
      autonomySummary: document.querySelector('#autonomy-summary').textContent,
    };
  })()`);
  const latest = core.daemon.db.prepare('SELECT id,state FROM task ORDER BY created_at DESC LIMIT 1').get();
  mainWindow.webContents.debugger.attach('1.3');
  const capture = await mainWindow.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png' });
  mainWindow.webContents.debugger.detach();
  await writeFile(resolve('evidence/P9/p9_live_window.png'), Buffer.from(capture.data, 'base64'));
  const record = {
    pid: process.pid,
    windowCreated: Boolean(mainWindow && !mainWindow.isDestroyed()),
    adapterMode: process.env.CUE_ADAPTER_MODE || 'none',
    task: 'worktree 안 목표별 산출물 생성 후 원장 완료 검증',
    taskId: latest.id,
    state: latest.state,
    approvalSummary: rendered.approvalSummary,
    autonomySummary: rendered.autonomySummary,
  };
  await writeFile(resolve('evidence/P9/p9_live_run.json'), `${JSON.stringify(record, null, 2)}\n`);
  app.quit();
}

app.whenReady().then(async () => {
  const userData = process.env.CUE_USER_DATA || app.getPath('userData');
  core = createCueCore(initializeConfig(userData));
  registerIpcHandlers(ipcMain, core);
  createWindow();
  if (process.env.CUE_LIVE_RUN === '1') await runLiveCanary();
});

app.on('before-quit', () => { core?.close(); });
app.on('window-all-closed', () => app.quit());
