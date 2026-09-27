import assert from 'node:assert/strict';
import test from 'node:test';
import { inferReadonlyWfpPackageDrop } from './readonly-wfp-event-evidence.mjs';

const requiredFlags = [
  'FWPM_NET_EVENT_FLAG_PACKAGE_ID_SET', 'FWPM_NET_EVENT_FLAG_APP_ID_SET',
  'FWPM_NET_EVENT_FLAG_IP_VERSION_SET', 'FWPM_NET_EVENT_FLAG_IP_PROTOCOL_SET',
  'FWPM_NET_EVENT_FLAG_REMOTE_ADDR_SET', 'FWPM_NET_EVENT_FLAG_REMOTE_PORT_SET',
];

function fixture() {
  const context = {
    collectionEnabled: true,
    subscriptionActiveBeforeResume: true,
    subscriptionHeldThroughVerifiedDeath: true,
    lostEventCount: 0,
    bufferOverflow: false,
    protectedProfileCount: 1,
    sealedExecutableCount: 1,
    jobProcessCount: 1,
    subscriptionActivatedAt: '100',
    workerResumedAt: '110',
    verifiedJobDeathAt: '200',
    packageSid: 'S-1-15-2-123-456',
    appIdBytes: [0, 65, 0, 58, 0, 92],
    target: { ipVersion: 'FWP_IP_VERSION_V4', ipProtocol: 6, remoteAddrV4: 0x7f000001, remotePort: 48193 },
    expectedMissingCapability: 'FWPM_APPC_NETWORK_CAPABILITY_INTERNET_CLIENT',
  };
  const event = {
    type: 'FWPM_NET_EVENT_TYPE_CAPABILITY_DROP',
    header: {
      timeStamp: '150', flags: [...requiredFlags], ipVersion: 'FWP_IP_VERSION_V4', ipProtocol: 6,
      remoteAddrV4: 0x7f000001, remotePort: 48193, appIdBytes: [...context.appIdBytes], packageSid: context.packageSid,
    },
    capabilityDrop: {
      networkCapabilityId: context.expectedMissingCapability, filterId: '18446744073709551615', isLoopback: true,
    },
  };
  return { context, events: [event] };
}

const unknown = (input) => assert.deepEqual(inferReadonlyWfpPackageDrop(input), { kind: 'unknown' });

test('returns only a diagnostic package-drop inference for one exact protected interval match', () => {
  assert.deepEqual(inferReadonlyWfpPackageDrop(fixture()), {
    kind: 'package-drop-inference',
    association: 'unique-package-app-exclusive-one-process-interval',
    networkCapabilityId: 'FWPM_APPC_NETWORK_CAPABILITY_INTERNET_CLIENT',
    filterId: '18446744073709551615',
    eventTimeStamp: '150',
  });
});

test('collection, subscription, loss, overflow, and exclusive cardinality ambiguity is unknown', () => {
  for (const [field, value] of [
    ['collectionEnabled', false], ['subscriptionActiveBeforeResume', false],
    ['subscriptionHeldThroughVerifiedDeath', false], ['lostEventCount', 1], ['bufferOverflow', true],
    ['protectedProfileCount', 2], ['sealedExecutableCount', 2], ['jobProcessCount', 2],
  ]) {
    const input = fixture(); input.context[field] = value; unknown(input);
  }
});

test('every documented header presence flag and exact event tuple is required', () => {
  for (const flag of requiredFlags) {
    const input = fixture(); input.events[0].header.flags = requiredFlags.filter((candidate) => candidate !== flag); unknown(input);
  }
  const mutations = [
    ['type', 'FWPM_NET_EVENT_TYPE_CLASSIFY_DROP'],
    ['header.ipVersion', 'FWP_IP_VERSION_V6'], ['header.ipProtocol', 17],
    ['header.remoteAddrV4', 0x0100007f], ['header.remotePort', 48194],
    ['header.packageSid', 'S-1-15-2-else'], ['header.appIdBytes', [0, 65, 0, 59, 0, 92]],
    ['capabilityDrop.networkCapabilityId', 'FWPM_APPC_NETWORK_CAPABILITY_PRIVATE_NETWORK_CLIENT_SERVER'],
    ['capabilityDrop.filterId', '0'], ['capabilityDrop.isLoopback', false],
  ];
  for (const [path, value] of mutations) {
    const input = fixture(); const parts = path.split('.');
    if (parts.length === 1) input.events[0][parts[0]] = value;
    else input.events[0][parts[0]][parts[1]] = value;
    unknown(input);
  }
});

test('outside or ambiguous timestamps and zero or multiple matches are unknown', () => {
  for (const stamp of ['99', '201']) { const input = fixture(); input.events[0].header.timeStamp = stamp; unknown(input); }
  const reversed = fixture(); reversed.context.workerResumedAt = '99'; unknown(reversed);
  const none = fixture(); none.events = []; unknown(none);
  const multiple = fixture(); multiple.events.push(structuredClone(multiple.events[0])); unknown(multiple);
  for (const path of ['subscriptionActivatedAt', 'workerResumedAt', 'verifiedJobDeathAt']) {
    const input = fixture(); input.context[path] = '18446744073709551616'; unknown(input);
  }
  const impossibleEventTime = fixture(); impossibleEventTime.events[0].header.timeStamp = '18446744073709551616'; unknown(impossibleEventTime);
});

test('malformed, oversized, accessor, and proxy inputs fail closed without invoking getters', () => {
  unknown(null);
  const extra = fixture(); extra.context.untrusted = true; unknown(extra);
  const tooMany = fixture(); tooMany.events = Array.from({ length: 65 }, () => structuredClone(tooMany.events[0])); unknown(tooMany);
  const hugeBlob = fixture(); hugeBlob.events[0].header.appIdBytes = Array(4097).fill(0); unknown(hugeBlob);
  const sparse = fixture(); sparse.events[0].header.appIdBytes = new Array(3); unknown(sparse);
  let getterCalled = false;
  const accessor = fixture(); Object.defineProperty(accessor.context, 'packageSid', { enumerable: true, get() { getterCalled = true; throw new Error('must not run'); } });
  unknown(accessor); assert.equal(getterCalled, false);
  for (const location of ['input', 'context', 'events', 'event', 'header', 'appIdBytes']) {
    const input = fixture(); let traps = 0;
    const hostile = new Proxy(location === 'events' || location === 'appIdBytes' ? [] : {}, {
      getPrototypeOf() { traps += 1; throw new Error('hostile'); },
      ownKeys() { traps += 1; throw new Error('hostile'); },
      get() { traps += 1; throw new Error('hostile'); },
    });
    if (location === 'input') unknown(hostile);
    else if (location === 'context') { input.context = hostile; unknown(input); }
    else if (location === 'events') { input.events = hostile; unknown(input); }
    else if (location === 'event') { input.events[0] = hostile; unknown(input); }
    else if (location === 'header') { input.events[0].header = hostile; unknown(input); }
    else { input.events[0].header.appIdBytes = hostile; unknown(input); }
    assert.equal(traps, 0, `${location} proxy traps must not run`);
  }
});

test('result vocabulary cannot be mistaken for PID or admission authority', () => {
  const result = inferReadonlyWfpPackageDrop(fixture());
  assert.deepEqual(Object.keys(result).sort(), ['association', 'eventTimeStamp', 'filterId', 'kind', 'networkCapabilityId']);
  assert.equal(JSON.stringify(result).includes('pid'), false);
  for (const forbidden of ['ready', 'permissionVerified', 'accepted', 'qualified']) assert.equal(forbidden in result, false);
});
