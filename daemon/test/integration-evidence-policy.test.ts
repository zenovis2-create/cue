import { createHash } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import { evaluateEvidence,type EvidenceObservation,type EvidencePolicyDescriptor } from '../src/verification/evidence-policy.js';
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const target={targetId:'file',kind:'filesystem' as const,byteLength:3,digest:sha('abc')};
const policy:EvidencePolicyDescriptor={requirementId:'r',kind:'code',producerTaskIds:['make'],sourceRevision:'approved-source',targetIds:['file'],checkerId:'checker',checkerRevision:'v1',parametersDigest:sha('p'),hostileCheckIds:['negative'],requiredSectionIds:[],claimIds:[],requiresRender:false};
const observation:EvidenceObservation={origin:'host-observation',checkerId:'checker',checkerRevision:'v1',checkerPrincipal:'reviewer',producerAttemptPrincipal:'maker',parametersDigest:sha('p'),observedAtMs:10,sourceRevision:'source',exitStatus:0,targetManifestDigest:sha(JSON.stringify([target])),verdict:'pass',hostileChecks:['negative'],claimSourceMap:{},requirementSections:[],renderVerified:false,targets:[target]};
describe('S4 evidence policy',()=>{
  it('accepts exact independent code evidence and fails closed on model or missing target evidence',()=>{
    expect(evaluateEvidence(policy,observation,20,20).verdict).toBe('pass');
    expect(evaluateEvidence(policy,{...observation,origin:'model-report'},20,20).verdict).toBe('unknown');
    expect(evaluateEvidence(policy,{...observation,targets:[]},20,20).verdict).toBe('unknown');
  });
  it('requires research claim mapping, document render evidence, and authoritative external state',()=>{
    const research={...policy,kind:'research' as const,targetIds:['source'],claimIds:['claim'],hostileCheckIds:[]};
    const source={targetId:'source',kind:'retrieved-source' as const,byteLength:3,digest:sha('src'),sourceIdentity:'source-id',retrievedAtMs:10};
    expect(evaluateEvidence(research,{...observation,targets:[source],targetManifestDigest:sha(JSON.stringify([source])),claimSourceMap:{}},20,20).verdict).toBe('unknown');
    const document={...policy,kind:'document' as const,hostileCheckIds:[],requiredSectionIds:['one'],requiresRender:true};
    expect(evaluateEvidence(document,{...observation,hostileChecks:[],requirementSections:['one'],renderVerified:false},20,20).verdict).toBe('unknown');
    const external={...policy,kind:'external' as const,targetIds:['remote'],hostileCheckIds:[],remote:{accountId:'a',resourceId:'r',operationId:'op',idempotencyKey:'k',expectedTransition:'created',observerId:'remote-reader',observerRevision:'v1'}};
    const remote={targetId:'remote',kind:'remote-state' as const,byteLength:3,digest:sha('remote'),accountId:'a',resourceId:'r',operationId:'op',idempotencyKey:'k',transition:'created',observerId:'remote-reader',observerRevision:'v1',observedAtMs:10};
    expect(evaluateEvidence(external,{...observation,targets:[remote],targetManifestDigest:sha(JSON.stringify([remote]))},20,20).verdict).toBe('pass');
    expect(evaluateEvidence(external,{...observation,targets:[{...remote,observerRevision:'caller'}],targetManifestDigest:sha(JSON.stringify([{...remote,observerRevision:'caller'}]))},20,20).verdict).toBe('unknown');
  });
});
