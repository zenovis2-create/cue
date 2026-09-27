import type { Ledger } from '../daemon/src/ledger.js';
import type { FinalPublicationAuthority, FinalPublicationHost } from './orchestration-driver.mjs';
export function createStagedExistingFilePublicationHost(options: Readonly<{
  db: Ledger;
  authorizePublication(authority: FinalPublicationAuthority): boolean;
}>): FinalPublicationHost;
