import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { readSelectionPreference, saveSelectionPreference, type SelectionMode } from '../src/selection/preferences.js';

const databases: Ledger[] = [], roots: string[] = [];
const open = (file?: string) => { const db = openLedger(file); databases.push(db); return db; };
afterEach(() => { for (const db of databases.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
describe('user selection preference is persisted intent, not execution authority', () => {
  it('defaults without mutating the ledger and returns immutable data', () => {
    const db = open(); const result = readSelectionPreference(db);
    expect(result).toEqual({ mode: 'efficiency', revision: 0 }); expect(Object.isFrozen(result)).toBe(true);
    expect(db.prepare('SELECT count(*) AS n FROM selection_preference').get()).toEqual({ n: 0 });
  });
  it('persists all four modes across close and migration replay', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-selection-pref-')); roots.push(root); const file = join(root, 'state.sqlite');
    let revision = 0;
    for (const mode of ['performance', 'value', 'speed', 'efficiency'] as const) {
      const db = open(file); expect(readSelectionPreference(db).revision).toBe(revision);
      expect(saveSelectionPreference(db, { mode, expectedRevision: revision++ })).toEqual({ mode, revision }); db.close();
      const reopened = open(file); expect(readSelectionPreference(reopened)).toEqual({ mode, revision }); reopened.close();
    }
  });
  it('rejects stale saves from another connection without losing newer intent', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-selection-cas-')); roots.push(root); const file = join(root, 'state.sqlite');
    const first = open(file), second = open(file); const stale = readSelectionPreference(second);
    saveSelectionPreference(first, { mode: 'value', expectedRevision: 0 });
    expect(() => saveSelectionPreference(second, { mode: 'speed', expectedRevision: stale.revision })).toThrow('selection_preference_conflict');
    expect(readSelectionPreference(first)).toEqual({ mode: 'value', revision: 1 });
    expect(saveSelectionPreference(second, { mode: 'performance', expectedRevision: 1 })).toEqual({ mode: 'performance', revision: 2 });
  });
  it('rejects malformed mode/revision without writes or policy/run creation', () => {
    const db = open();
    for (const mode of ['', 'fast', '__proto__', null, 1]) expect(() => saveSelectionPreference(db, { mode: mode as SelectionMode, expectedRevision: 0 })).toThrow();
    for (const expectedRevision of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) expect(() => saveSelectionPreference(db, { mode: 'speed', expectedRevision })).toThrow();
    expect(readSelectionPreference(db)).toEqual({ mode: 'efficiency', revision: 0 });
    saveSelectionPreference(db, { mode: 'performance', expectedRevision: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM selection_policy_snapshot').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM run').get()).toEqual({ n: 0 });
  });
});
