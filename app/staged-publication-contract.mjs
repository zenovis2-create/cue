import { createHash } from 'node:crypto';

export function stagedPublicationContractId(attemptId, changeSetId) {
  if (typeof attemptId !== 'string' || typeof changeSetId !== 'string') throw Error('staged_publication_contract_id_invalid');
  return `stage-${createHash('sha256').update(`${attemptId}\0${changeSetId}`).digest('hex').slice(0,48)}`;
}
