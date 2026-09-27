import { types } from 'node:util';
import { compareWriteExistingNative, snapshotRelativeNative } from '../daemon/dist/src/change-snapshot-host.js';
import { stagedPublicationContractId } from './staged-publication-contract.mjs';

const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$/u.test(value);
const safePath = value => typeof value === 'string' && value.length > 0 && value.length <= 32768 && !/[\0\r\n]/u.test(value);
function plain(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const fields = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(fields).length === keys.length && keys.every(key => fields[key]?.enumerable && Object.hasOwn(fields[key], 'value'));
}
function exactTargets(value) {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), lengthDescriptor = descriptors.length;
  if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, 'value') || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 1 || lengthDescriptor.value > 64 || Reflect.ownKeys(descriptors).length !== lengthDescriptor.value + 1) return null;
  const length = lengthDescriptor.value;
  const copy = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)]; if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
    const target = descriptor.value;
    if (!plain(target, ['relativePath', 'maxBytes']) || !safePath(target.relativePath) || !Number.isSafeInteger(target.maxBytes) || target.maxBytes < 1 || target.maxBytes > 16 * 1024 * 1024) return null;
    copy.push(Object.freeze({ relativePath: target.relativePath, maxBytes: target.maxBytes }));
  }
  if (new Set(copy.map(target => target.relativePath.toLocaleLowerCase('en-US'))).size !== copy.length) return null;
  return Object.freeze(copy);
}

export function createStagedExistingFilePublicationHost(options) {
  if (!plain(options, ['db', 'authorizePublication']) || !options.db?.open || typeof options.authorizePublication !== 'function') throw Error('staged_publication_options_invalid');
  const db = options.db, authorizePublication = options.authorizePublication, opened = new Map();
  function derive(contract) {
    if (!plain(contract, ['version','contractId','runId','taskId','attemptId','changeSetId','worktreeRealpath','stagingOnly','targets'])
      || contract.version !== 'cue-staged-existing-files-v1' || contract.stagingOnly !== true || ![contract.contractId,contract.runId,contract.taskId,contract.attemptId,contract.changeSetId].every(safeId)
      || !safePath(contract.worktreeRealpath)) throw Error('staged_publication_contract_invalid');
    const targets = exactTargets(contract.targets); if (!targets) throw Error('staged_publication_contract_invalid');
    const expectedContractId = stagedPublicationContractId(contract.attemptId, contract.changeSetId);
    if (contract.contractId !== expectedContractId) throw Error('staged_publication_contract_invalid');
    const row = db.prepare(`SELECT ss.run_id,ss.task_id,ss.publication_worktree_realpath,a.execution_worktree_realpath,a.execution_volume_serial,a.execution_file_id,
      a.stage_envelope_hash,a.parent_envelope_hash,a.plan_digest,cs.change_set_id,cs.approved_targets_json
      FROM attempt_staging_setup ss JOIN attempt_staging_authority a USING(attempt_id)
      JOIN orchestration_attempt oa ON oa.attempt_id=ss.attempt_id AND oa.run_id=ss.run_id AND oa.task_id=ss.task_id AND oa.state='running'
      JOIN orchestration_step os ON os.run_id=ss.run_id AND os.task_id=ss.task_id AND os.state='running'
      JOIN change_set cs ON cs.attempt_id=ss.attempt_id AND cs.run_id=ss.run_id AND cs.task_id=ss.task_id AND cs.stage_envelope_hash=a.stage_envelope_hash
      JOIN run r ON r.id=ss.run_id AND r.envelope_hash=a.parent_envelope_hash
      JOIN orchestration_plan p ON p.run_id=ss.run_id AND p.digest=a.plan_digest
      WHERE ss.attempt_id=? AND cs.change_set_id=? AND NOT EXISTS(SELECT 1 FROM attempt_staging_cleanup c WHERE c.attempt_id=ss.attempt_id)`).get(contract.attemptId, contract.changeSetId);
    if (!row || row.run_id !== contract.runId || row.task_id !== contract.taskId || row.publication_worktree_realpath !== contract.worktreeRealpath) throw Error('staged_publication_contract_unbound');
    let approved; try { approved = JSON.parse(row.approved_targets_json); } catch { throw Error('staged_publication_contract_unbound'); }
    if (!Array.isArray(approved) || approved.length !== targets.length || targets.some((target, index) => approved[index] !== target.relativePath)) throw Error('staged_publication_contract_unbound');
    for (const target of targets) {
      const bound = db.prepare('SELECT max_backup_bytes FROM change_target_contract WHERE run_id=? AND task_id=? AND relative_path=?').get(contract.runId, contract.taskId, target.relativePath);
      if (!bound || bound.max_backup_bytes !== target.maxBytes) throw Error('staged_publication_contract_unbound');
    }
    const rootIdentity = Object.freeze({ volumeSerial: row.execution_volume_serial, fileId: row.execution_file_id });
    const root = snapshotRelativeNative({ root: row.execution_worktree_realpath, expectedRoot: rootIdentity, targets: [targets[0].relativePath], maxBytes: targets[0].maxBytes });
    if (root.state !== 'ok') throw Error('staged_publication_execution_untrusted');
    return Object.freeze({ contractId: contract.contractId, runId: contract.runId, taskId: contract.taskId, attemptId: contract.attemptId, changeSetId: contract.changeSetId,
      publicationWorktreeRealpath: contract.worktreeRealpath, executionWorktreeRealpath: row.execution_worktree_realpath, rootIdentity, targets });
  }
  async function openStagedAttempt(contract) {
    const registration = derive(contract), prior = opened.get(registration.contractId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(registration)) throw Error('staged_publication_contract_conflict');
    opened.set(registration.contractId, registration);
    return Object.freeze({ contractId: registration.contractId });
  }
  async function readStagedReplacement(input) {
    if (!plain(input, ['contractId','runId','taskId','attemptId','changeSetId','relativePath','maxBytes','stagingOnly']) || input.stagingOnly !== true) throw Error('staged_publication_read_invalid');
    const registration = opened.get(input.contractId), target = registration?.targets.find(value => value.relativePath === input.relativePath);
    if (!registration || !target || registration.runId !== input.runId || registration.taskId !== input.taskId || registration.attemptId !== input.attemptId || registration.changeSetId !== input.changeSetId || target.maxBytes !== input.maxBytes) throw Error('staged_publication_read_unbound');
    const current = db.prepare(`SELECT 1 FROM attempt_staging_authority a JOIN attempt_staging_setup s USING(attempt_id)
      JOIN orchestration_attempt oa ON oa.attempt_id=s.attempt_id AND oa.state='running' JOIN orchestration_step os ON os.run_id=s.run_id AND os.task_id=s.task_id AND os.state='running'
      JOIN change_set cs ON cs.change_set_id=? AND cs.attempt_id=s.attempt_id
      WHERE a.attempt_id=? AND a.execution_worktree_realpath=? AND a.execution_volume_serial=? AND a.execution_file_id=?
      AND NOT EXISTS(SELECT 1 FROM attempt_staging_cleanup c WHERE c.attempt_id=a.attempt_id)`).get(input.changeSetId,input.attemptId,registration.executionWorktreeRealpath,registration.rootIdentity.volumeSerial,registration.rootIdentity.fileId);
    if (!current) throw Error('staged_publication_read_expired');
    const snapshot = snapshotRelativeNative({ root: registration.executionWorktreeRealpath, expectedRoot: registration.rootIdentity, targets: [target.relativePath], maxBytes: target.maxBytes });
    const result = snapshot.state === 'ok' ? snapshot.results[0] : null;
    if (!result || result.state !== 'ok' || result.path !== target.relativePath || !Buffer.isBuffer(result.bytes) || result.bytes.length !== result.byteLength || result.bytes.length > target.maxBytes) throw Error('staged_publication_read_untrusted');
    return Buffer.from(result.bytes);
  }
  return Object.freeze({ authorize: authority => authorizePublication(authority) === true, openStagedAttempt, readStagedReplacement, execute: compareWriteExistingNative });
}
