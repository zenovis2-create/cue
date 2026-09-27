import type { Ledger } from '../ledger.js';

export type SelectionMode = 'efficiency' | 'performance' | 'value' | 'speed';
export interface SelectionPreference { readonly mode: SelectionMode; readonly revision: number }
export function validateSelectionMode(mode: unknown): SelectionMode {
  if (typeof mode !== 'string' || !['efficiency', 'performance', 'value', 'speed'].includes(mode)) throw Error('invalid_selection_mode');
  return mode as SelectionMode;
}
/** Preferences select a requested mode, never candidates, capabilities or budget. */
export function readSelectionPreference(db: Ledger): SelectionPreference {
  const row = db.prepare('SELECT mode,revision FROM selection_preference WHERE singleton=1').get() as SelectionPreference | undefined;
  if (!row) return Object.freeze({ mode: 'efficiency', revision: 0 });
  const mode = validateSelectionMode(row.mode);
  if (!Number.isSafeInteger(row.revision) || row.revision < 1) throw Error('invalid_selection_preference_revision');
  return Object.freeze({ mode, revision: row.revision });
}
export function saveSelectionPreference(db: Ledger, input: { mode: SelectionMode; expectedRevision: number }): SelectionPreference {
  const mode = validateSelectionMode(input?.mode), expected = input?.expectedRevision;
  if (!Number.isSafeInteger(expected) || expected < 0 || expected >= Number.MAX_SAFE_INTEGER - 1) throw Error('invalid_selection_preference_revision');
  return db.transaction(() => {
    const previous = readSelectionPreference(db);
    if (previous.revision !== expected) throw Error('selection_preference_conflict');
    const revision = expected + 1;
    if (expected === 0) db.prepare('INSERT INTO selection_preference VALUES(1,?,?)').run(mode, revision);
    else if (db.prepare('UPDATE selection_preference SET mode=?,revision=? WHERE singleton=1 AND revision=?').run(mode, revision, expected).changes !== 1) throw Error('selection_preference_conflict');
    return Object.freeze({ mode, revision });
  }).immediate();
}
