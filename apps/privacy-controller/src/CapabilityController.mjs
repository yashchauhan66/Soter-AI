import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ControllerError, canonical, digest, signedEnvelope, verifiedEnvelope } from './SignedJournal.mjs';
import { redactAIContext } from '@soterai/guard-core';

const bindingKeys = ['recipient', 'projectId', 'itemId', 'contentRevision', 'policyRevision', 'operation', 'action', 'outputClass', 'destinationId'];
const identityKeys = ['principalId', 'workloadId', 'launchId', 'sessionId'];
const OPERATIONS = Object.freeze({
  'project.schema.read': { action: 'READ_PUBLIC_SCHEMA', outputClass: 'PUBLIC_SCHEMA' },
  'project.contract.read': { action: 'READ_PUBLIC_CONTRACT', outputClass: 'PUBLIC_CONTRACT' },
  'development.synthetic.check': { action: 'CHECK_SYNTHETIC_RUNTIME', outputClass: 'SYNTHETIC_STATUS' },
  'project.reviewed-file.read': { action: 'READ_REVIEWED_FILE', outputClass: 'OWNER_REVIEWED_TEXT' },
});
const id = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(v);
const exact = (v, keys) => v && Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const copy = v => JSON.parse(canonical(v));
function bindingValid(b) {
  return exact(b, bindingKeys) && exact(b.recipient, identityKeys) && identityKeys.every(k => id(b.recipient[k]))
    && bindingKeys.filter(k => k !== 'recipient').every(k => id(b[k]))
    && Object.hasOwn(OPERATIONS, b.operation) && b.action === OPERATIONS[b.operation].action
    && b.outputClass === OPERATIONS[b.operation].outputClass;
}
const denied = reason => ({ status: 'DENIED', reason });
const identityEqual = (a, b) => identityKeys.every(k => a[k] === b[k]);

/** Output construction is fixed; a callback cannot inject values, URLs, paths, SQL or arbitrary content. */
export function publicOutput(operation, projection) {
  if (operation === 'project.reviewed-file.read') {
    if (!exact(projection, ['text', 'contentSha256']) || typeof projection.text !== 'string'
      || Buffer.byteLength(projection.text) > 4096 || projection.text.includes('\0')
      || Buffer.from(projection.text).toString('utf8') !== projection.text
      || projection.contentSha256 !== createHash('sha256').update(projection.text).digest('hex'))
      throw new ControllerError('INVALID_PUBLIC_PROJECTION');
    return { text: redactAIContext(projection.text), treatment: 'explicit-owner-reviewed-redacted-view' };
  }
  if (operation === 'development.synthetic.check') {
    if (!exact(projection, ['state']) || !['READY', 'STOPPED', 'UNAVAILABLE'].includes(projection.state))
      throw new ControllerError('INVALID_PUBLIC_PROJECTION');
    return { state: projection.state, syntheticOnly: true };
  }
  const names = operation === 'project.schema.read' ? projection?.variables : projection?.fields?.map(f => f.name);
  if (!Array.isArray(names) || names.length > 128 || names.some(n => typeof n !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(n))
    || new Set(names).size !== names.length) throw new ControllerError('INVALID_PUBLIC_PROJECTION');
  if (operation === 'project.schema.read') {
    if (!exact(projection, ['variables'])) throw new ControllerError('INVALID_PUBLIC_PROJECTION');
    return { variables: names.map(name => ({ name, value: '[MASKED]' })) };
  }
  const defaults = { text: 'synthetic-example', integer: '3000', 'loopback-url': 'http://127.0.0.1:3000',
    'loopback-database': 'postgresql://example:example@127.0.0.1:5432/example' };
  if (operation !== 'project.contract.read' || !exact(projection, ['fields']) || projection.fields.some(f => !exact(f, ['name', 'preset'])
    || !Object.hasOwn(defaults, f.preset))) throw new ControllerError('INVALID_PUBLIC_PROJECTION');
  return { syntheticOnly: true, fields: projection.fields.map(f => ({ name: f.name, value: defaults[f.preset] })) };
}

/**
 * Owner-side controller with a real durable signed ledger and fixed output dispatcher.
 * Transport/OS measurement, protected key/checkpoint custody and physical-presence
 * signer are required deployment adapters, not provided by a feature flag.
 */
export class CapabilityController {
  #options;
  #peers = new WeakMap(); #pending = new Map(); #reviews = new Map(); #grants = new Map();
  #usedApprovals = new Set(); #policies = new Map(); #epoch = randomUUID(); #generation = 0;
  #lastTime = -1; #clockInvalid = false; #closed = false;
  constructor(options) {
    this.#options = options;
    if (!options.journal || !options.issuerPrivateKey || !options.issuerPublicKey || !options.ownerPublicKey || !options.presencePublicKey
      || options.ownerPublicKey.export({ type: 'spki', format: 'der' }).equals(options.presencePublicKey.export({ type: 'spki', format: 'der' })))
      throw new ControllerError('INDEPENDENT_KEYS_REQUIRED');
    for (const event of options.journal.events()) {
      if (event.type === 'POLICY') this.#policies.set(event.projectId, event);
      else if (event.type === 'ISSUED') this.#usedApprovals.add(event.approvalId);
      else if (!['BOOT', 'CONSUMED', 'REVOKED'].includes(event.type)) throw new ControllerError('RECOVERY_LOCKED');
    }
    // Reopening retains policy and consumed approvals, but never restores old grants.
    options.journal.append({ type: 'BOOT', epoch: this.#epoch });
  }
  #clock() {
    let now;
    try { now = (this.#options.now ?? (() => performance.now()))(); } catch { now = NaN; }
    if (this.#clockInvalid || !Number.isFinite(now) || now < 0 || now < this.#lastTime || now > Number.MAX_SAFE_INTEGER - 60_000) {
      this.#clockInvalid = true; this.#generation++; throw new ControllerError('INVALID_CLOCK');
    }
    this.#lastTime = now; return now;
  }
  #check() {
    if (this.#closed || this.#options.enabled?.() !== true) throw new ControllerError('DISABLED');
    if (this.#options.deploymentVerified?.() !== true) throw new ControllerError('DEPLOYMENT_UNVERIFIED');
    return this.#clock();
  }
  #pruneReviews(now) {
    for (const [key, review] of this.#reviews) if (review.expiresAt <= now) this.#reviews.delete(key);
  }
  #identity(peer, now) {
    const held = this.#peers.get(peer);
    if (!held) throw new ControllerError('IDENTITY_UNVERIFIED');
    const current = this.#options.authenticateTransport?.(held.connection);
    if (!current || !exact(current.identity, identityKeys) || !identityEqual(current.identity, held.identity)
      || !identityKeys.every(k => id(current.identity[k])) || !Number.isFinite(current.validUntil) || current.validUntil <= now)
      throw new ControllerError('IDENTITY_UNVERIFIED');
    return current.identity;
  }
  authenticate(connection) {
    try {
      const now = this.#check(); const result = this.#options.authenticateTransport?.(connection);
      if (!result || !exact(result.identity, identityKeys) || !identityKeys.every(k => id(result.identity[k]))
        || !Number.isFinite(result.validUntil) || result.validUntil <= now) return denied('IDENTITY_UNVERIFIED');
      const peer = Object.freeze({}); this.#peers.set(peer, { connection, identity: copy(result.identity) });
      return { status: 'AUTHENTICATED', peer };
    } catch (e) { return denied(e instanceof ControllerError ? e.code : 'AUTHORITY_UNAVAILABLE'); }
  }
  #state(binding) {
    const policy = this.#policies.get(binding.projectId);
    const item = this.#options.resolveItem?.(binding.projectId, binding.itemId);
    if (!policy || policy.revision !== binding.policyRevision || policy.deniedItems.includes(binding.itemId)
      || !item || item.projectId !== binding.projectId || item.itemId !== binding.itemId
      || item.contentRevision !== binding.contentRevision || item.outputClass !== binding.outputClass)
      throw new ControllerError('REVISION_OR_POLICY_DENIED');
    if (binding.operation === 'project.reviewed-file.read' && item.originalTreatment !== 'ORDINARY')
      throw new ControllerError('SENSITIVE_OR_ENVIRONMENT_TEXT_DENIED');
    return item;
  }
  /** Only the trusted operator/control plane may call this. Agent requests have no policy endpoint. */
  installPolicy(envelope) {
    if (!verifiedEnvelope(envelope, this.#options.ownerPublicKey)) throw new ControllerError('POLICY_SIGNATURE_INVALID');
    const p = envelope.payload;
    if (!exact(p, ['projectId', 'revision', 'sequence', 'deniedItems']) || !id(p.projectId) || !id(p.revision)
      || !Number.isSafeInteger(p.sequence) || p.sequence <= 0 || !Array.isArray(p.deniedItems) || p.deniedItems.length > 256
      || p.deniedItems.some(v => !id(v)) || new Set(p.deniedItems).size !== p.deniedItems.length) throw new ControllerError('POLICY_INVALID');
    const old = this.#policies.get(p.projectId);
    if (p.sequence !== (old?.sequence ?? 0) + 1 || old?.revision === p.revision) throw new ControllerError('POLICY_ROLLBACK');
    if (old?.deniedItems.some(item => !p.deniedItems.includes(item))) throw new ControllerError('DENY_RELAXATION_REQUIRES_SEPARATE_REVIEW');
    const event = { type: 'POLICY', ...copy(p) };
    this.#options.journal.append(event); this.#policies.set(p.projectId, event); this.#generation++;
  }
  request(peer, binding, durationMs = 60_000) {
    try {
      const now = this.#check(); const identity = this.#identity(peer, now);
      if (!bindingValid(binding) || !identityEqual(identity, binding.recipient) || !Number.isSafeInteger(durationMs)
        || durationMs < 1 || durationMs > 60_000) return denied('INVALID_REQUEST');
      if (this.#options.projectAllowed?.(identity, binding.projectId) !== true) return denied('PROJECT_DENIED');
      this.#state(binding);
      if (this.#options.destinationAllowed?.(identity, binding.destinationId) !== true) return denied('DESTINATION_DENIED');
      for (const [key, pending] of this.#pending) if (pending.expiresAt <= now) this.#pending.delete(key);
      if (this.#pending.size >= 32) return denied('PENDING_CAPACITY');
      const requestId = randomUUID(); this.#pending.set(requestId, { binding: copy(binding), durationMs, expiresAt: now + 60_000 });
      // A request does not launch a window, invoke a signer or create an approval.
      return { status: 'PENDING', requestId };
    } catch (e) { return denied(e instanceof ControllerError ? e.code : 'AUTHORITY_UNAVAILABLE'); }
  }
  /** Independently user-opened control surface begins this review; never expose it on the agent data plane. */
  beginOwnerReview(requestId) {
    const now = this.#check(); const pending = this.#pending.get(requestId);
    this.#pruneReviews(now);
    if (!pending || pending.expiresAt <= now) throw new ControllerError('REQUEST_EXPIRED');
    this.#state(pending.binding);
    if (this.#reviews.size >= 32) throw new ControllerError('REVIEW_CAPACITY');
    const approvalId = randomUUID();
    const payload = { approvalId, epoch: this.#epoch, nonce: randomUUID(), binding: pending.binding,
      durationMs: pending.durationMs, maximumUses: 1 };
    this.#reviews.set(approvalId, { payload: copy(payload), expiresAt: Math.min(pending.expiresAt, now + 60_000) });
    this.#pending.delete(requestId); return copy(payload);
  }
  finishOwnerReview(ownerEnvelope, presenceEnvelope) {
    const now = this.#check();
    if (!verifiedEnvelope(ownerEnvelope, this.#options.ownerPublicKey) || !verifiedEnvelope(presenceEnvelope, this.#options.presencePublicKey)
      || canonical(ownerEnvelope.payload) !== canonical(presenceEnvelope.payload)) throw new ControllerError('APPROVAL_SIGNATURE_INVALID');
    const held = this.#reviews.get(ownerEnvelope.payload.approvalId);
    if (!held || held.expiresAt <= now || this.#usedApprovals.has(ownerEnvelope.payload.approvalId)
      || canonical(held.payload) !== canonical(ownerEnvelope.payload)) throw new ControllerError('APPROVAL_SCOPE_OR_REPLAY');
    this.#state(held.payload.binding);
    // Two signatures alone do not prove a physical ceremony. Require the deployment's independent verifier too.
    if (this.#options.verifyPresence?.(presenceEnvelope, held.payload) !== true) throw new ControllerError('PRESENCE_UNVERIFIED');
    const grantId = randomUUID(); const payload = { grantId, epoch: this.#epoch, binding: held.payload.binding, validUntil: now + held.payload.durationMs };
    const token = signedEnvelope(payload, this.#options.issuerPrivateKey);
    this.#options.journal.append({ type: 'ISSUED', grantId, approvalId: held.payload.approvalId, epoch: this.#epoch,
      bindingDigest: digest(held.payload.binding) });
    this.#usedApprovals.add(held.payload.approvalId); this.#reviews.delete(held.payload.approvalId);
    this.#grants.set(grantId, { payload: copy(payload), state: 'ACTIVE' }); return token;
  }
  async consume(peer, token) {
    try {
      const now = this.#check(); const identity = this.#identity(peer, now);
      if (!verifiedEnvelope(token, this.#options.issuerPublicKey)) return denied('GRANT_SIGNATURE_INVALID');
      const record = this.#grants.get(token.payload.grantId);
      if (!record || record.state !== 'ACTIVE' || token.payload.epoch !== this.#epoch
        || canonical(record.payload) !== canonical(token.payload)) return denied('UNKNOWN_OR_USED_GRANT');
      const b = record.payload.binding;
      if (!identityEqual(identity, b.recipient)) return denied('WRONG_RECIPIENT');
      if (this.#options.projectAllowed?.(identity, b.projectId) !== true) return denied('PROJECT_DENIED');
      if (record.payload.validUntil <= now) return denied('EXPIRED');
      this.#state(b);
      if (this.#options.destinationAllowed?.(identity, b.destinationId) !== true) return denied('DESTINATION_DENIED');
      this.#options.journal.append({ type: 'CONSUMED', grantId: record.payload.grantId, epoch: this.#epoch });
      record.state = 'CONSUMED'; const generation = this.#generation;
      const projection = await this.#options.projectPublic?.(copy(b));
      const output = publicOutput(b.operation, projection);
      if (b.operation === 'project.reviewed-file.read' && projection.contentSha256 !== b.contentRevision)
        return denied('CONTENT_REVISION_CHANGED');
      const finish = this.#check(); this.#identity(peer, finish); this.#state(b);
      if (this.#generation !== generation || finish >= record.payload.validUntil
        || this.#options.projectAllowed?.(identity, b.projectId) !== true
        || this.#options.destinationAllowed?.(identity, b.destinationId) !== true) return denied('REVOKED_DURING_OPERATION');
      if (Buffer.byteLength(JSON.stringify(output)) > 8192) return denied('OUTPUT_TOO_LARGE');
      return { status: 'ALLOWED_ONCE', output };
    } catch (e) { return denied(e instanceof ControllerError ? e.code : 'OPERATION_UNAVAILABLE'); }
  }
  revokeAll() {
    this.#options.journal.append({ type: 'REVOKED', epoch: this.#epoch }); this.#generation++;
    for (const grant of this.#grants.values()) grant.state = 'REVOKED';
    this.#pending.clear(); this.#reviews.clear();
  }
  close() { this.#closed = true; this.#generation++; this.#options.journal.close(); }
  status() { return { enabled: !this.#closed && this.#options.enabled?.() === true,
    fullClaim: 'BLOCKED', scope: 'Durable controller source; independent deployment and physical presence must be verified separately.' }; }
}
