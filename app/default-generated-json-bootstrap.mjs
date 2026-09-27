import { types } from 'node:util';
import { realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { createGeneratedJsonHost } from './generated-json-host.mjs';
import { readLatestLocalHostSettings } from '../daemon/dist/src/selection/local-host-settings.js';
import { readLocalSelectionPolicy } from '../daemon/dist/src/selection/local-policy-store.js';
import { createModelMeasurementSubject } from '../daemon/dist/src/model-measurement-subject.js';
import { measureModelControlBundle } from '../daemon/dist/src/model-control-bundle.js';
import { createCapabilityEvidenceStore } from '../daemon/dist/src/capability-store.js';
import { createCapabilityAdmission } from '../daemon/dist/src/capability-admission.js';
import { ISOLATED_LOCAL_ENDPOINT, ISOLATED_LOCAL_MODEL } from '../daemon/dist/src/adapters/isolated-local-model.js';

export const DEFAULT_GENERATED_JSON_SETTINGS_ID = 'generated-json-default';
const modes = ['efficiency', 'performance', 'value', 'speed'];
const unavailable = code => Object.freeze({ available: false, reasons: Object.freeze([code]) });
function record(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('default-host-invalid-authority-data');
  const d = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) throw Error('default-host-invalid-authority-data');
  return Object.fromEntries(keys.map(k => [k, d[k].value]));
}
function synchronousBoolean(value) {
  if (value instanceof Promise) void value.catch(() => {});
  return value === true;
}
const equalPath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

/** Read-only startup assembly. Protected callbacks are host authority and are
 * never renderer/settings data. In particular validateLoadedInstallation must
 * independently verify the process-start loaded closure; a disk rescan alone is
 * not that proof. No default validator, qualification, launch or fallback exists. */
export function createDefaultGeneratedJsonBootstrap(authority) {
  const descriptors = authority && !types.isProxy(authority) ? Object.getOwnPropertyDescriptors(authority) : {};
  const required = ['now', 'discoverInstallation', 'validateLoadedInstallation', 'observeReadiness'];
  const functions = Object.fromEntries(required.map(key => [key, descriptors[key]?.value]));
  const maxEvidenceAgeMs = descriptors.maxEvidenceAgeMs?.value;
  const valid = required.every(key => typeof functions[key] === 'function') && Number.isSafeInteger(maxEvidenceAgeMs) && maxEvidenceAgeMs >= 1 && maxEvidenceAgeMs <= 600000;
  return context => {
    if (!valid) return unavailable('default-host-missing-authority');
    try {
      const { db, config, worktree } = context;
      const saved = readLatestLocalHostSettings(db, DEFAULT_GENERATED_JSON_SETTINGS_ID);
      if (!saved) return unavailable('default-host-settings-missing');
      if (saved.settings.version !== 'cue-local-host-settings-v2') return unavailable('default-host-settings-v2-required');
      const settings = saved.settings;
      if(settings.templateId!=='generated-json-v1')return unavailable('default-host-template-mismatch');
      if (!settings.enabled) return unavailable('default-host-disabled');
      const policies = {};
      let producerId, checkerId;
      for (const mode of modes) {
        const ref = settings.policies[mode], policy = readLocalSelectionPolicy(db, ref.policyId, ref.revision);
        if (!policy || policy.digest !== ref.digest || policy.policy.mode !== mode
          || settings.limits.maxInvocations !== policy.policy.limitAttempts || settings.limits.timeoutMs !== policy.policy.timeoutMs) return unavailable('default-host-policy-limits-mismatch');
        if (producerId && (producerId !== policy.policy.producerCandidateId || checkerId !== policy.policy.checkerCandidateId)) return unavailable('default-host-policy-pair-mismatch');
        producerId = policy.policy.producerCandidateId; checkerId = policy.policy.checkerCandidateId; policies[mode] = ref;
      }
      const discovered = functions.discoverInstallation(Object.freeze({ db, config, worktree }));
      if (discovered instanceof Promise) { void discovered.catch(() => {}); return unavailable('default-host-discovery-must-be-synchronous'); }
      if (!discovered) return unavailable('default-host-installation-missing');
      const install = record(discovered, ['measurement', 'controlRoot', 'taskRootBase', 'profileRootBase', 'loadedHost']);
      const measurement = Object.freeze(record(install.measurement, ['installRoot', 'nodeExecutable', 'powershellExecutable', 'sqliteNativePath', 'dependencyRoot']));
      const loaded = Object.freeze(record(install.loadedHost, ['executable', 'runtime', 'version']));
      for (const path of [...Object.values(measurement), install.controlRoot, install.taskRootBase, install.profileRootBase, loaded.executable]) {
        if (typeof path !== 'string' || path.length > 32768 || !isAbsolute(path) || path.includes('\0')) return unavailable('default-host-installation-path');
      }
      const hostExecutable = realpathSync(process.execPath), hostRuntime = process.versions.electron ? 'electron' : 'node';
      const hostVersion = process.versions.electron ?? process.versions.node;
      if (!equalPath(realpathSync(loaded.executable), hostExecutable) || loaded.runtime !== hostRuntime || loaded.version !== hostVersion) return unavailable('default-host-loaded-runtime-mismatch');
      const now = () => { const value = functions.now(); if (!Number.isSafeInteger(value) || value < 0) throw Error('default-host-clock'); return value; };
      const measured = {}, bundles = {};
      for (const kind of ['model', 'json-checker']) {
        measured[kind] = createModelMeasurementSubject({ ...measurement, kind });
        bundles[kind] = measureModelControlBundle({ controlRoot: install.controlRoot, nodeExecutable: measurement.nodeExecutable, clientKind: kind });
      }
      const installationIdentity = Object.freeze({ measurement, controlRoot: install.controlRoot, taskRootBase: install.taskRootBase, profileRootBase: install.profileRootBase, loadedHost: loaded });
      const loadedContext = Object.freeze({ hostExecutable, hostRuntime, hostVersion, installation: installationIdentity,
        model: measured.model, checker: measured['json-checker'] });
      function current(kind) {
        if (!synchronousBoolean(functions.validateLoadedInstallation(loadedContext))) throw Error('default-host-loaded-installation-unverified');
        const value = createModelMeasurementSubject({ ...measurement, kind });
        if (value.subjectDigest !== measured[kind].subjectDigest) throw Error('default-host-installation-drift');
        if (!synchronousBoolean(functions.validateLoadedInstallation(loadedContext))) throw Error('default-host-loaded-installation-unverified');
        return value.subject;
      }
      const evidence = createCapabilityEvidenceStore(db, now), evidencePolicy = { now, maxAgeMs: maxEvidenceAgeMs, resolveEvidence: ref => evidence.resolveEvidence(ref) };
      const admit = createCapabilityAdmission(evidencePolicy);
      const ids = { model: producerId, checker: checkerId }, observedAt = new Date(now()).toISOString();
      const candidates = Object.fromEntries(['model', 'checker'].map(catalogKind => {
        const kind = catalogKind === 'model' ? 'model' : 'json-checker';
        const observe = () => {
          const subject = current(kind), refs = evidence.referencesFor(measured[kind].subjectDigest);
          const raw = functions.observeReadiness(catalogKind, Object.freeze({ db, subjectDigest: measured[kind].subjectDigest }));
          if (raw instanceof Promise) { void raw.catch(() => {}); throw Error('default-host-readiness-must-be-synchronous'); }
          const state = record(raw, ['authenticated', 'dataAllowed', 'resourceAvailable', 'quotaAvailable']);
          if (Object.values(state).some(value => typeof value !== 'boolean')) throw Error('default-host-readiness-unknown');
          return Object.freeze({ candidateId: ids[catalogKind], eligible: admit(subject, refs).modelOnlyEligible, compatible: true, ...state });
        };
        const checks = observe();
        if (!checks.authenticated) throw Error('default-host-authentication-unavailable');
        return [catalogKind, { record: { canonicalId: ids[catalogKind], toolId: kind === 'model' ? 'cue-isolated-local-model' : 'cue-isolated-json-checker', kind: catalogKind,
          aliases: [], installation: 'installed', protocol: 'verified', authReference: null, authAvailable: checks.authenticated,
          sourceVersion: bundles[kind].sha256, observedAt, subjectDigest: measured[kind].subjectDigest,
          binding: kind === 'model' ? { endpointId: 'fixed-localhost-8085', modelId: ISOLATED_LOCAL_MODEL } : null },
        currentSubject: () => current(kind), evidenceReferences: () => evidence.referencesFor(measured[kind].subjectDigest), observeCandidate: observe }];
      }));
      const source = `settings:${saved.settingsId}:${saved.revision}:${saved.digest}`;
      if (source.length > 256 || ISOLATED_LOCAL_ENDPOINT !== 'http://127.0.0.1:8085/v1') return unavailable('default-host-template-identity');
      const assembled = createGeneratedJsonHost({ db, now, inputForRun(run) {
        current('model'); current('json-checker');
        const template = record(run.template, ['id', 'inputText']);
        if (template.id !== 'generated-json-v1' || typeof template.inputText !== 'string') throw Error('default-host-explicit-template-required');
        return template.inputText;
      }, installation: { nodeExecutable: measurement.nodeExecutable, nodeSha256: bundles.model.nodeSha256, modelControlBundle: bundles.model,
        checkerControlBundle: bundles['json-checker'], taskRootBase: install.taskRootBase, profileRootBase: install.profileRootBase },
      candidates, evidence: evidencePolicy, policies, maxOutputBytes: settings.limits.maxOutputBytes, maxOutputTokens: settings.limits.maxOutputTokens,
      accounting: { kind: 'local-invocation', source, observedAtMs: now() } });
      return assembled.available ? Object.freeze({ ...assembled.host, requiresExplicitTemplate: true }) : assembled;
    } catch (error) {
      const code = error instanceof Error && /^default-host-[a-z-]{1,100}$/.test(error.message) ? error.message : 'default-host-installation-or-settings-unavailable';
      return unavailable(code);
    }
  };
}
