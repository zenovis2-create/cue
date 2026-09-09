import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve(import.meta.dirname, '..', '..');

class FakeWebContents extends EventEmitter {
  windowOpenHandler?: (details: { url: string }) => { action: string };
  setWindowOpenHandler(handler: (details: { url: string }) => { action: string }): void {
    this.windowOpenHandler = handler;
  }
}

describe('Electron renderer defense in depth', () => {
  it('ships a restrictive CSP that allows only packaged scripts and styles', () => {
    const html = readFileSync(resolve(repo, 'app', 'renderer', 'index.html'), 'utf8');
    expect(html).toMatch(/Content-Security-Policy/iu);
    expect(html).toMatch(/default-src 'none'/u);
    expect(html).toMatch(/script-src 'self'/u);
    expect(html).toMatch(/style-src 'self'/u);
    expect(html).toMatch(/connect-src 'none'/u);
    expect(html).not.toMatch(/unsafe-inline|unsafe-eval/iu);
  });

  it('allows only the packaged renderer URL and denies every new window', async () => {
    const moduleUrl = pathToFileURL(resolve(repo, 'app', 'electron-security.mjs')).href;
    const { applyNavigationGuards } = await import(moduleUrl) as { applyNavigationGuards(contents: FakeWebContents, allowedUrl: string): void };
    const contents = new FakeWebContents();
    const allowed = 'file:///C:/cue/app/renderer/index.html';
    applyNavigationGuards(contents, allowed);

    const accepted = { preventDefault: vi.fn() };
    const denied = { preventDefault: vi.fn() };
    contents.emit('will-navigate', accepted, allowed);
    contents.emit('will-navigate', denied, 'https://example.invalid/phish');

    expect(accepted.preventDefault).not.toHaveBeenCalled();
    expect(denied.preventDefault).toHaveBeenCalledOnce();
    expect(contents.windowOpenHandler?.({ url: allowed })).toEqual({ action: 'deny' });
    expect(contents.windowOpenHandler?.({ url: 'https://example.invalid' })).toEqual({ action: 'deny' });
  });
});
