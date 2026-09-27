import type { CatalogRecord } from '../daemon/src/integration-catalog.js';
import type { MeasurementSubject } from '../daemon/src/measurement-subject.js';
import type { ProviderInstallationDescriptor } from './provider-installation.mjs';

export function bindProviderInstallationCandidate(input: Readonly<{
  installation: ProviderInstallationDescriptor;
  provider: ProviderInstallationDescriptor['provider'];
  executablePath: string;
  record: CatalogRecord;
  currentSubject(): MeasurementSubject;
  evidenceReferences(): unknown;
}>): Readonly<{ currentSubject(): MeasurementSubject; evidenceReferences(): unknown }>;
