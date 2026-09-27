import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Host-only artifact input; never registered as a renderer path/HTML API. */
export async function openReportWindow({ BrowserWindow, session }, artifact) {
  const bytes = readFileSync(artifact.path);
  if (bytes.length > 33554432 || bytes.length !== artifact.receipt.artifactBytes || createHash('sha256').update(bytes).digest('hex') !== artifact.receipt.artifactSha256) throw Error('report integrity mismatch');
  // Load the exact verified bytes, not the mutable report filename a second time.
  const url = `data:text/html;base64,${bytes.toString('base64')}`;
  const isolated = session.fromPartition(`cue-report-${randomUUID()}`, { cache: false });
  isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  isolated.setPermissionCheckHandler(() => false);
  isolated.on('will-download', event => event.preventDefault());
  isolated.webRequest.onBeforeRequest((details, callback) => callback({ cancel: details.url !== url || details.resourceType !== 'mainFrame' }));
  const win = new BrowserWindow({ width: 1100, height: 800, show: false, title: 'Cue 원장 보고서',
    webPreferences: { session: isolated, contextIsolation: true, nodeIntegration: false, sandbox: true, javascript: false, webSecurity: true, devTools: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  for (const event of ['will-navigate', 'will-redirect', 'will-attach-webview']) win.webContents.on(event, e => e.preventDefault());
  try { await win.loadURL(url); win.show(); return win; }
  catch (error) { win.destroy(); throw error; }
}
