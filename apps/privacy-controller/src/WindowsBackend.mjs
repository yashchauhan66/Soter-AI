import fs from 'node:fs/promises';
import childProcess from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ControllerError } from './SignedJournal.mjs';

export const INSTALLED_BACKEND = Object.freeze({
  executable: 'C:\\Program Files\\Oracle\\VirtualBox\\VBoxManage.exe',
  sha256: '6852390a57d454d3b7c9ae27e66e45c367699faf2807b450de084b1f7d0203c1',
  version: '7.2.20r175154',
});
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SCALAR = /^(?:"([A-Za-z0-9._-]{0,128})"|([0-9]+))$/;
const KEYS = new Set(['UUID', 'VMState', 'clipboard', 'clipboard_file_transfers', 'draganddrop', 'vrde', 'usb', 'ehci', 'xhci',
  ...Array.from({ length: 8 }, (_, i) => `nic${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `intnet${i + 1}`)]);

/** Parse only non-secret configuration fields; discard names, paths and other metadata. */
export function parseVmConfiguration(text, expectedId) {
  if (!UUID.test(expectedId) || typeof text !== 'string' || Buffer.byteLength(text) > 128 * 1024
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new ControllerError('INVALID_BACKEND_OUTPUT');
  const values = new Map(); let shared = false;
  for (const line of text.split(/\r?\n/)) {
    const equals = line.indexOf('='); if (equals < 1) continue;
    const key = line.slice(0, equals);
    if (/^SharedFolder(?:Name|Path)/.test(key)) shared = true;
    if (!KEYS.has(key)) continue;
    const value = line.slice(equals + 1).match(SCALAR);
    if (!value || values.has(key)) throw new ControllerError('INVALID_BACKEND_OUTPUT');
    values.set(key, value[1] ?? value[2]);
  }
  for (const key of ['UUID', 'VMState', 'clipboard', 'clipboard_file_transfers', 'draganddrop', 'vrde', 'usb', 'ehci', 'xhci',
    ...Array.from({ length: 8 }, (_, i) => `nic${i + 1}`)])
    if (!values.has(key)) throw new ControllerError('INCOMPLETE_BACKEND_OUTPUT');
  if (values.get('UUID') !== expectedId) throw new ControllerError('VM_IDENTITY_MISMATCH');
  if (!['poweroff', 'running', 'paused', 'saved', 'aborted'].includes(values.get('VMState')))
    throw new ControllerError('UNKNOWN_VM_STATE');
  const adapters = Array.from({ length: 8 }, (_, i) => ({ type: values.get(`nic${i + 1}`), internalNetwork: values.get(`intnet${i + 1}`) }));
  for (const adapter of adapters) {
    if (!['none', 'intnet', 'nat', 'bridged', 'hostonly', 'natnetwork', 'generic', 'cloud', 'hostonlynet'].includes(adapter.type))
      throw new ControllerError('UNKNOWN_NETWORK_MODE');
    if (adapter.type === 'intnet' && !adapter.internalNetwork) throw new ControllerError('INCOMPLETE_BACKEND_OUTPUT');
  }
  return Object.freeze({ machineId: expectedId, state: values.get('VMState'),
    networkAdapters: adapters, hostBridgePresent: shared || values.get('clipboard') !== 'disabled'
      || values.get('clipboard_file_transfers') !== 'off' || values.get('draganddrop') !== 'disabled'
      || values.get('vrde') !== 'off' || ['usb', 'ehci', 'xhci'].some(key => values.get(key) !== 'off'),
    fullClaim: 'BLOCKED', artifactBinding: 'UNVERIFIED', scope: 'Configuration observation only; not guest confinement or physical presence.' });
}

async function executablePinned() {
  const before = await fs.lstat(INSTALLED_BACKEND.executable, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > 32n * 1024n ** 2n)
    throw new ControllerError('BACKEND_BINARY_UNVERIFIED');
  const file = await fs.open(INSTALLED_BACKEND.executable, 'r');
  try {
    const opened = await file.stat({ bigint: true });
    if (opened.ino !== before.ino || opened.size !== before.size || opened.mtimeNs !== before.mtimeNs)
      throw new ControllerError('BACKEND_BINARY_UNVERIFIED');
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(64 * 1024); let total = 0;
    for (;;) {
      const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break; total += bytesRead;
      if (total > 32 * 1024 ** 2) throw new ControllerError('BACKEND_BINARY_UNVERIFIED');
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = await file.stat({ bigint: true }); const named = await fs.lstat(INSTALLED_BACKEND.executable, { bigint: true });
    if (hash.digest('hex') !== INSTALLED_BACKEND.sha256 || after.ino !== opened.ino || after.size !== opened.size
      || after.mtimeNs !== opened.mtimeNs || named.ino !== opened.ino || named.nlink !== 1n || named.mtimeNs !== opened.mtimeNs)
      throw new ControllerError('BACKEND_BINARY_UNVERIFIED');
  } finally { await file.close(); }
}

/** Owner-side, opt-in, read-only adapter. It never creates, imports, starts or edits a VM. */
export class WindowsBackendInspector {
  #enabled; #settingsDirectory;
  constructor({ enabled = () => false, settingsDirectory }) {
    if (typeof settingsDirectory !== 'string' || !path.win32.isAbsolute(settingsDirectory))
      throw new ControllerError('OWNER_SETTINGS_DIRECTORY_REQUIRED');
    this.#enabled = enabled; this.#settingsDirectory = settingsDirectory;
  }
  #check() {
    if (this.#enabled() !== true) throw new ControllerError('DISABLED');
    if (process.platform !== 'win32') throw new ControllerError('UNSUPPORTED_PLATFORM');
  }
  async #run(args) {
    this.#check(); await executablePinned(); this.#check();
    const env = { VBOX_USER_HOME: this.#settingsDirectory };
    for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
    const text = await new Promise((resolve, reject) => childProcess.execFile(INSTALLED_BACKEND.executable, args,
      { env, windowsHide: true, timeout: 5000, maxBuffer: 128 * 1024, encoding: 'utf8', shell: false },
      (error, stdout) => error ? reject(new ControllerError('BACKEND_UNAVAILABLE')) : resolve(stdout)));
    this.#check(); return text;
  }
  async inspectConfiguration(machineId) {
    const started = performance.now();
    try {
      this.#check();
      if (!UUID.test(machineId)) throw new ControllerError('INVALID_VM_ID');
      const version = (await this.#run(['--version'])).trim();
      if (version !== INSTALLED_BACKEND.version) throw new ControllerError('BACKEND_VERSION_MISMATCH');
      const parsed = parseVmConfiguration(await this.#run(['showvminfo', machineId, '--machinereadable']), machineId);
      if (performance.now() - started > 5000) throw new ControllerError('STALE_MEASUREMENT');
      return { status: 'CONFIGURATION_OBSERVED', ...parsed, observedAt: started };
    } catch (error) {
      return { status: 'UNVERIFIED', reason: error instanceof ControllerError ? error.code : 'BACKEND_UNAVAILABLE', fullClaim: 'BLOCKED' };
    }
  }
}
