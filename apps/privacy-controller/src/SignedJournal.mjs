import * as fs from 'node:fs';
import path from 'node:path';
import { createHash, sign, verify, randomUUID } from 'node:crypto';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_RECORDS = 4096;
const ZERO = '0'.repeat(64);
export class ControllerError extends Error {
  constructor(code) { super(code); this.name = 'ControllerError'; this.code = code; }
}
export function canonical(value, depth = 0) {
  if (depth > 12) throw new ControllerError('INVALID_METADATA');
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) return JSON.stringify(value);
  if (typeof value === 'string' && value.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(value)) return JSON.stringify(value);
  if (Array.isArray(value) && value.length <= 256) return '[' + value.map(v => canonical(v, depth + 1)).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Reflect.ownKeys(value);
    if (keys.length > 32 || keys.some(k => typeof k !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(k)
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, k), 'value'))) throw new ControllerError('INVALID_METADATA');
    return '{' + keys.sort().map(k => JSON.stringify(k) + ':' + canonical(value[k], depth + 1)).join(',') + '}';
  }
  throw new ControllerError('INVALID_METADATA');
}
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
export function signedEnvelope(payload, privateKey) {
  if (privateKey?.asymmetricKeyType !== 'ed25519') throw new ControllerError('ED25519_KEY_REQUIRED');
  const body = canonical(payload);
  if (Buffer.byteLength(body) > 16 * 1024) throw new ControllerError('METADATA_TOO_LARGE');
  return Object.freeze({ payload: JSON.parse(body), signature: sign(null, Buffer.from(body), privateKey).toString('base64url') });
}
export function verifiedEnvelope(envelope, publicKey) {
  if (!envelope || Object.keys(envelope).sort().join(',') !== 'payload,signature'
    || typeof envelope.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature)) return false;
  try {
    const body = canonical(envelope.payload);
    return Buffer.byteLength(body) <= 16 * 1024 && verify(null, Buffer.from(body), publicKey, Buffer.from(envelope.signature, 'base64url'));
  } catch { return false; }
}
function regularFile(name, maximum) {
  const before = fs.lstatSync(name, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > BigInt(maximum))
    throw new ControllerError('UNSAFE_STORE');
  const fd = fs.openSync(name, 'r');
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (opened.ino !== before.ino || (before.dev !== 0n && opened.dev !== before.dev) || opened.size !== before.size)
      throw new ControllerError('UNSAFE_STORE');
    const allocation = Buffer.alloc(Number(opened.size) + 1);
    let read = 0;
    while (read < allocation.length) {
      const count = fs.readSync(fd, allocation, read, allocation.length - read, null);
      if (!count) break; read += count;
    }
    const bytes = allocation.subarray(0, read);
    const after = fs.fstatSync(fd, { bigint: true });
    const named = fs.lstatSync(name, { bigint: true });
    if (bytes.length > maximum || after.ino !== opened.ino || after.size !== opened.size || after.mtimeNs !== opened.mtimeNs
      || named.ino !== before.ino || named.size !== before.size || named.mtimeNs !== before.mtimeNs || named.nlink !== 1n)
      throw new ControllerError('UNSAFE_STORE');
    return bytes.toString('utf8');
  } finally { fs.closeSync(fd); }
}

/** Separate checkpoint adapter. Its directory/key need actual independent deployment custody. */
export class FileCheckpoint {
  constructor(filename) { this.filename = path.resolve(filename); }
  exists() { return fs.existsSync(this.filename); }
  read() { return JSON.parse(regularFile(this.filename, 8192)); }
  write(value) {
    const parent = path.dirname(this.filename);
    if (fs.realpathSync(parent) !== parent) throw new ControllerError('UNSAFE_STORE');
    const temporary = this.filename + '.new-' + randomUUID();
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try { fs.writeFileSync(fd, canonical(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.renameSync(temporary, this.filename); }
    catch { fs.unlinkSync(temporary); throw new ControllerError('CHECKPOINT_UNAVAILABLE'); }
  }
}

/** Single-writer signed, fsynced metadata journal. Never auto-recreates missing acknowledged state. */
export class SignedJournal {
  #fd; #lock; #last; #sequence = 0; #events = []; #locked = false; #text = '';
  constructor({ filename, privateKey, publicKey, checkpoint, bootstrap = false }) {
    if (!verifiedEnvelope(signedEnvelope({ purpose: 'key-correspondence' }, privateKey), publicKey))
      throw new ControllerError('KEY_MISMATCH');
    this.filename = path.resolve(filename); this.privateKey = privateKey; this.publicKey = publicKey; this.checkpoint = checkpoint;
    if (!checkpoint || path.dirname(path.resolve(checkpoint.filename)) === path.dirname(this.filename))
      throw new ControllerError('SEPARATE_CHECKPOINT_REQUIRED');
    const parent = path.dirname(this.filename);
    if (fs.realpathSync(parent) !== parent) throw new ControllerError('UNSAFE_STORE');
    const existed = fs.existsSync(this.filename);
    if ((!existed || !checkpoint.exists()) && !bootstrap) throw new ControllerError('RECOVERY_LOCKED');
    if (bootstrap && (existed || checkpoint.exists())) throw new ControllerError('BOOTSTRAP_REFUSED');
    this.#lock = fs.openSync(this.filename + '.lock', 'wx', 0o600);
    try {
      if (!existed) {
        this.#fd = fs.openSync(this.filename, 'wx+', 0o600); fs.fsyncSync(this.#fd);
        this.#last = ZERO;
        checkpoint.write(signedEnvelope({ sequence: 0, hash: ZERO }, privateKey));
      } else {
        const text = regularFile(this.filename, MAX_BYTES);
        this.#text = text;
        if (text && !text.endsWith('\n')) throw new ControllerError('RECOVERY_LOCKED');
        let previous = ZERO;
        for (const line of text.trimEnd().split('\n').filter(Boolean)) {
          if (++this.#sequence > MAX_RECORDS) throw new ControllerError('CAPACITY_REACHED');
          const entry = JSON.parse(line);
          if (canonical(entry) !== line || !verifiedEnvelope(entry, publicKey)
            || entry.payload.sequence !== this.#sequence || entry.payload.previous !== previous
            || Object.keys(entry.payload).sort().join(',') !== 'event,previous,sequence') throw new ControllerError('RECOVERY_LOCKED');
          this.#events.push(entry.payload.event); previous = digest(entry);
        }
        const receipt = checkpoint.read();
        if (!verifiedEnvelope(receipt, publicKey) || receipt.payload.sequence !== this.#sequence || receipt.payload.hash !== previous)
          throw new ControllerError('RECOVERY_LOCKED');
        this.#last = previous;
        this.#fd = fs.openSync(this.filename, 'a+');
      }
    } catch (error) { this.close(); throw error; }
  }
  events() { return structuredClone(this.#events); }
  append(event) {
    if (this.#locked || this.#fd === undefined) throw new ControllerError('RECOVERY_LOCKED');
    if (this.#sequence >= MAX_RECORDS) throw new ControllerError('CAPACITY_REACHED');
    const envelope = signedEnvelope({ sequence: this.#sequence + 1, previous: this.#last, event }, this.privateKey);
    const bytes = Buffer.from(canonical(envelope) + '\n');
    if (fs.fstatSync(this.#fd).size + bytes.length > MAX_BYTES) throw new ControllerError('CAPACITY_REACHED');
    const current = fs.lstatSync(this.filename, { bigint: true });
    const opened = fs.fstatSync(this.#fd, { bigint: true });
    if (current.ino !== opened.ino || current.nlink !== 1n || (current.dev !== 0n && current.dev !== opened.dev))
      throw new ControllerError('UNSAFE_STORE');
    try {
      if (regularFile(this.filename, MAX_BYTES) !== this.#text) throw new ControllerError('RECOVERY_LOCKED');
      let offset = 0; while (offset < bytes.length) {
        const written = fs.writeSync(this.#fd, bytes, offset, bytes.length - offset);
        if (!written) throw new ControllerError('RECOVERY_LOCKED'); offset += written;
      }
      fs.fsyncSync(this.#fd);
      this.checkpoint.write(signedEnvelope({ sequence: this.#sequence + 1, hash: digest(envelope) }, this.privateKey));
      this.#sequence++; this.#last = digest(envelope); this.#events.push(envelope.payload.event); this.#text += bytes.toString('utf8');
    } catch { this.#locked = true; throw new ControllerError('RECOVERY_LOCKED'); }
  }
  close() {
    if (this.#fd !== undefined) { fs.closeSync(this.#fd); this.#fd = undefined; }
    if (this.#lock !== undefined) {
      const opened = fs.fstatSync(this.#lock, { bigint: true }); fs.closeSync(this.#lock); this.#lock = undefined;
      const named = fs.lstatSync(this.filename + '.lock', { bigint: true });
      if (named.ino === opened.ino && named.nlink === 1n) fs.unlinkSync(this.filename + '.lock');
    }
  }
}
