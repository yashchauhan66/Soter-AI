import test from 'node:test';
import assert from 'node:assert/strict';
import { fullModePlan, runtimeReadiness, validateAgentMeasurement } from '../FullModePlan.mjs';
const plan = () => fullModePlan({ root: 'D:\\SoterAI-FullMode', agentId: '11111111-1111-4111-8111-111111111111',
  gatewayId: '22222222-2222-4222-8222-222222222222', agentImageSha256: 'a'.repeat(64),
  gatewayImageSha256: 'b'.repeat(64), controllerSha256: 'c'.repeat(64) }).plan;
const measurement = p => ({ observedAt: 100, machineId: p.agent.id, state: 'running', imageSha256: p.agent.imageSha256,
  backendVersion: '7.2.20', clipboard: 'disabled', dragAndDrop: 'disabled', usb: false, remoteDesktop: false,
  sharedFolders: [], networkAdapters: [...p.agent.networkAdapters], internalNetwork: p.network });
test('valid pinned configuration remains blocked before real OS verification', () => {
  const p = plan(); assert.equal(validateAgentMeasurement(p, measurement(p), 100).status, 'CONFIGURATION_MATCHED');
  assert.equal(validateAgentMeasurement(p, measurement(p), 100).fullClaim, 'BLOCKED');
});
test('extra host bridge, direct network, shared mount and alternate runtime are rejected', () => {
  const p = plan();
  for (const change of [{ clipboard: 'bidirectional' }, { sharedFolders: ['originals'] }, { usb: true },
    { remoteDesktop: true }, { networkAdapters: ['nat', ...p.agent.networkAdapters.slice(1)] },
    { networkAdapters: [...p.agent.networkAdapters, 'nat'] }, { internalNetwork: 'other' }, { backendVersion: 'other' }])
    assert.equal(validateAgentMeasurement(p, { ...measurement(p), ...change }, 100).status, 'UNVERIFIED');
});
test('stale/future measurements and another image/instance never enable a launch claim', () => {
  const p = plan();
  for (const change of [{ observedAt: 101 }, { observedAt: -10000 }, { machineId: p.gateway.id }, { imageSha256: 'd'.repeat(64) }])
    assert.equal(validateAgentMeasurement(p, { ...measurement(p), ...change }, 100).status, 'UNVERIFIED');
});
test('readiness has no native fallback and cannot silently ignore storage or physical enrollment', () => {
  const r = runtimeReadiness({ installedBackend: '7.2.20', destinationFreeBytes: 230_000_000_000,
    availableMemoryBytes: 4_000_000_000, controllerVerified: true, gatewayVerified: true,
    ownerPresenceEnrolled: false, publicManifestVerified: true, agentMeasurementVerified: true });
  assert.equal(r.status, 'SETUP_REQUIRED'); assert.deepEqual(r.missing, ['AVAILABLE_MEMORY', 'OWNER_PRESENCE']);
  assert.equal(r.nativeFallback, false); assert.equal(r.fullClaim, 'BLOCKED');
});
test('no unpinned image or ambiguous identity is accepted into a deployment plan', () => {
  assert.throws(() => fullModePlan({ root: 'relative', agentId: 'x' }));
});
