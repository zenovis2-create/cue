import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { createStagedExistingFilePublicationHost } from '../../app/staged-existing-file-publication-host.mjs';
import { stagedPublicationContractId } from '../../app/staged-publication-contract.mjs';
import { fixture } from './fixtures/git-staging-driver-fixture.js';

describe.runIf(process.platform === 'win32')('production publication host through public staged driver', () => {
  test('opens the ledger-bound execution root, publishes native bytes, reconciles and does not revive registration', async () => {
    let authorizations = 0;
    const f = fixture('unchanged', ({ host, db }) => {
      host.finalPublication = createStagedExistingFilePublicationHost({ db, authorizePublication: () => { authorizations++; return true; } });
    });
    await f.driver.start(f.run);
    expect(authorizations).toBe(1);
    expect(readFileSync(`${f.publication}/target.txt`, 'utf8')).toBe('replacement\n');
    expect(f.executionRoot).not.toBe(f.publication); expect(existsSync(f.executionRoot)).toBe(false);
    expect(f.db.prepare('SELECT state FROM change_publication_result').get()).toEqual({ state: 'committed' });
    expect(f.db.prepare('SELECT result FROM attempt_staging_cleanup').get()).toEqual({ result: 'active_cleanup_verified' });
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });

    const attempt = f.db.prepare('SELECT attempt_id,task_id FROM orchestration_attempt WHERE run_id=? AND task_id=?').get('workflow','make') as any;
    const set = f.db.prepare('SELECT change_set_id FROM change_set WHERE attempt_id=?').get(attempt.attempt_id) as any;
    const reopened = createStagedExistingFilePublicationHost({ db: f.db, authorizePublication: () => true });
    await expect(reopened.readStagedReplacement({ contractId: stagedPublicationContractId(attempt.attempt_id,set.change_set_id), runId:'workflow',taskId:attempt.task_id,
      attemptId:attempt.attempt_id,changeSetId:set.change_set_id,relativePath:'target.txt',maxBytes:1024,stagingOnly:true })).rejects.toThrow('staged_publication_read_unbound');
  }, 60_000);
});
