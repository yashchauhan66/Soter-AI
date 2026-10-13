import path from 'node:path';
import { ControllerError, canonical, digest } from './SignedJournal.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
export const WINDOWS_BACKEND = Object.freeze({
  version: '7.2.20', filename: 'VirtualBox-7.2.20-175154-Win.exe',
  url: 'https://download.virtualbox.org/virtualbox/7.2.20/VirtualBox-7.2.20-175154-Win.exe',
  sha256: 'a81777d2b36380ce042a29e9c554cf032eb46a793f62e3cc82e7411e535c2c26',
  features: ['VBoxApplication'], optionalDrivers: 'USB, bridged, host-only and Python components excluded',
});

/** Produces a review document, never installs, starts, imports or changes a VM. */
export function fullModePlan({ root, agentId, gatewayId, agentImageSha256, gatewayImageSha256, controllerSha256 }) {
  if (!path.win32.isAbsolute(root) || !UUID.test(agentId) || !UUID.test(gatewayId) || agentId === gatewayId
    || ![agentImageSha256, gatewayImageSha256, controllerSha256].every(v => HASH.test(v)))
    throw new ControllerError('PINNED_FULL_MODE_INPUTS_REQUIRED');
  const network = 'soterai-' + agentId;
  const plan = {
    format: 'soterai-enforced-runtime-plan-v1', root, backend: WINDOWS_BACKEND, network,
    agent: { id: agentId, imageSha256: agentImageSha256, memoryMiB: 4096, cpus: 2,
      networkAdapters: ['internal', 'none', 'none', 'none', 'none', 'none', 'none', 'none'],
      sharedFolders: [], clipboard: 'disabled', dragAndDrop: 'disabled', usb: false, remoteDesktop: false },
    gateway: { id: gatewayId, imageSha256: gatewayImageSha256, memoryMiB: 768, cpus: 1,
      networkAdapters: ['internal', 'nat', 'none', 'none', 'none', 'none', 'none', 'none'],
      sharedFolders: [], clipboard: 'disabled', dragAndDrop: 'disabled', usb: false,
      ipForwarding: false, egress: 'fixed authenticated proxy only; no CONNECT/raw relay' },
    controller: { sha256: controllerSha256, custody: 'outside both agent and gateway guest authority',
      bootstrap: 'independent operator and presence enrollment required' },
    publication: 'approved manifest-listed public bytes only; no original project/history/credential mounts',
    minimumStorageBytes: 32 * 1024 ** 3, maximumVirtualDiskBytes: 64 * 1024 ** 3,
    startup: 'refuse native fallback or active claim if any prerequisite is missing',
    fullClaim: 'BLOCKED', evidence: 'design and parser checks are not deployed OS evidence',
  };
  return Object.freeze({ plan: JSON.parse(canonical(plan)), planSha256: digest(plan) });
}

/** Expected normalized inspection data from a trusted hypervisor adapter, not agent assertions. */
export function validateAgentMeasurement(expected, actual, now) {
  const denied = reason => ({ status: 'UNVERIFIED', reason, fullClaim: 'BLOCKED' });
  if (!actual || !Number.isFinite(now) || !Number.isFinite(actual.observedAt) || actual.observedAt > now || now - actual.observedAt > 5000)
    return denied('STALE_MEASUREMENT');
  if (actual.machineId !== expected.agent.id || actual.state !== 'running' || actual.imageSha256 !== expected.agent.imageSha256
    || actual.backendVersion !== WINDOWS_BACKEND.version) return denied('IDENTITY_OR_ARTIFACT_MISMATCH');
  if (actual.clipboard !== 'disabled' || actual.dragAndDrop !== 'disabled' || actual.usb !== false || actual.remoteDesktop !== false
    || !Array.isArray(actual.sharedFolders) || actual.sharedFolders.length) return denied('HOST_BRIDGE_PRESENT');
  if (!Array.isArray(actual.networkAdapters) || actual.networkAdapters.length !== 8
    || actual.networkAdapters.some((v, i) => v !== expected.agent.networkAdapters[i]) || actual.internalNetwork !== expected.network)
    return denied('UNMEDIATED_NETWORK');
  // Passing this one shape check cannot prove clipboard denial, confinement, gateway enforcement or G1-G6.
  return { status: 'CONFIGURATION_MATCHED', fullClaim: 'BLOCKED', scope: 'Normalized configuration only; functional OS tests required.' };
}

export function runtimeReadiness({ installedBackend, destinationFreeBytes, availableMemoryBytes, controllerVerified,
  gatewayVerified, ownerPresenceEnrolled, publicManifestVerified, agentMeasurementVerified }) {
  const missing = [];
  if (installedBackend !== WINDOWS_BACKEND.version) missing.push('VERIFIED_BACKEND');
  if (!Number.isSafeInteger(destinationFreeBytes) || destinationFreeBytes < 32 * 1024 ** 3) missing.push('STORAGE');
  if (!Number.isSafeInteger(availableMemoryBytes) || availableMemoryBytes < 6 * 1024 ** 3) missing.push('AVAILABLE_MEMORY');
  for (const [name, value] of Object.entries({ CONTROLLER: controllerVerified, GATEWAY: gatewayVerified,
    OWNER_PRESENCE: ownerPresenceEnrolled, PUBLIC_MANIFEST: publicManifestVerified, AGENT_MEASUREMENT: agentMeasurementVerified }))
    if (value !== true) missing.push(name);
  return { status: missing.length ? 'SETUP_REQUIRED' : 'READY_FOR_AUTHORIZED_VERIFICATION', missing,
    fullClaim: 'BLOCKED', nativeFallback: false };
}
