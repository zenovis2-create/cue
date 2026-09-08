import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('P12 live evidence harness contract', () => {
  it('keeps the committed verdict tracked while excluding supervisor output dumps', () => {
    const ignore = readFileSync(join(process.cwd(), '..', '.gitignore'), 'utf8');
    expect(ignore).not.toContain('/evidence/P12/v01_verdict.json');
    expect(ignore).toContain('/evidence/p*_codex_last_message.md');
  });

  it('supports a tracked P12 stop receipt with disposable fixture paths outside the checkout', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'p10c-stop-canary.mjs'), 'utf8');
    expect(source).toContain("['P10C', 'P11', 'P12']");
    expect(source).toContain('CUE_STOP_ROOT');
    expect(source).toContain('CUE_STOP_WORKTREE');
    expect(source).toContain("phase === 'P12' ? 'p12_stop_result.json'");
  });

  it('supports P12 Electron window and cancellation receipts without overwriting P11 evidence', () => {
    const source = readFileSync(join(process.cwd(), '..', 'scripts', 'p11-electron-proof.mjs'), 'utf8');
    expect(source).toContain("['P11', 'P12']");
    expect(source).toContain('CUE_EVIDENCE_PHASE');
    expect(source).toContain('`${prefix}_electron_window_result.json`');
    expect(source).toContain('`${prefix}_electron_cancel_result.json`');
  });

  it('closes a failed Electron child and its log before the proof returns', () => {
    const source = readFileSync(join(process.cwd(), '..', 'scripts', 'p11-electron-proof.mjs'), 'utf8');
    expect(source).toContain("from '../daemon/scripts/process-lifecycle.mjs'");
    expect(source).toContain('const childClose = new Promise');
    expect(source).toContain('await stopProcessTree(child)');
    expect(source).toContain('await Promise.race([childClose');
    expect(source).toContain('await logClose');
  });

  it('captures Electron evidence through the renderer DevTools protocol rather than the failing Viz path', () => {
    const source = readFileSync(join(process.cwd(), '..', 'scripts', 'p11-electron-proof.mjs'), 'utf8');
    expect(source).toContain("sendCommand('Page.captureScreenshot'");
    expect(source).not.toContain('wc.capturePage()');
  });

  it('supports an external approved workspace and ordered fail-fast tool provenance', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'p10c-live.mjs'), 'utf8');
    expect(source).toContain("['P10C', 'P11', 'P12']");
    expect(source).toContain('CUE_LIVE_WORKTREE');
    expect(source).toContain("kind='tool_execution'");
    expect(source).toContain('orderedToolProvenance');
    expect(source).toContain('noPostViolationExecution');
    expect(source).toContain("phase === 'P12' ? 'p12_live_result.json'");
  });
});
