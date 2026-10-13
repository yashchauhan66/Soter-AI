import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { SignedJournal, FileCheckpoint, signedEnvelope } from '../SignedJournal.mjs';
import { CapabilityController, publicOutput } from '../CapabilityController.mjs';

const pair = () => generateKeyPairSync('ed25519');
function fixture() {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'soterai-owner-controller-'));
  fs.mkdirSync(path.join(directory, 'journal')); fs.mkdirSync(path.join(directory, 'checkpoint'));
  const issuer = pair(), owner = pair(), presence = pair();
  const filename = path.join(directory, 'journal', 'events.jsonl');
  const checkpoint = new FileCheckpoint(path.join(directory, 'checkpoint', 'latest.json'));
  let journal = new SignedJournal({ filename, checkpoint, ...issuer, bootstrap: true });
  let now = 100, enabled = true, deployment = true, projection, authority = true, presenceValid = true;
  let itemClass = 'PUBLIC_SCHEMA', itemRevision = 'c1', originalTreatment = 'ORDINARY';
  const identity = { principalId: 'guest', workloadId: 'vm1', launchId: 'launch1', sessionId: 'session1' };
  const connection = {};
  const options = () => ({ journal, issuerPrivateKey: issuer.privateKey, issuerPublicKey: issuer.publicKey,
    ownerPublicKey: owner.publicKey, presencePublicKey: presence.publicKey, now: () => now,
    enabled: () => enabled, deploymentVerified: () => deployment,
    authenticateTransport: c => c === connection && authority ? { identity, validUntil: 100000 } : undefined,
    resolveItem: (projectId, itemId) => ({ projectId, itemId, contentRevision: itemRevision, outputClass: itemClass, originalTreatment }),
    projectAllowed: (_identity, projectId) => projectId === 'p1',
    destinationAllowed: () => true, verifyPresence: () => presenceValid,
    projectPublic: () => projection ?? { variables: ['DATABASE_URL', 'PORT'] } });
  let controller = new CapabilityController(options());
  const install = (revision, sequence, deniedItems = []) => controller.installPolicy(signedEnvelope({ projectId: 'p1', revision, sequence, deniedItems }, owner.privateKey));
  install('r1', 1);
  const binding = { recipient: identity, projectId: 'p1', itemId: 'public-schema', contentRevision: 'c1', policyRevision: 'r1',
    operation: 'project.schema.read', action: 'READ_PUBLIC_SCHEMA', outputClass: 'PUBLIC_SCHEMA', destinationId: 'approved-provider' };
  const peer = () => controller.authenticate(connection).peer;
  const review = () => controller.beginOwnerReview(controller.request(peer(), binding).requestId);
  const issue = payload => controller.finishOwnerReview(signedEnvelope(payload, owner.privateKey), signedEnvelope(payload, presence.privateKey));
  const reopen = () => {
    controller.close(); journal = new SignedJournal({ filename, checkpoint, ...issuer });
    controller = new CapabilityController(options()); return controller;
  };
  const close = () => {
    controller.close(); const absolute = path.resolve(directory);
    assert.equal(path.dirname(absolute), path.resolve(tmpdir())); assert.ok(path.basename(absolute).startsWith('soterai-owner-controller-'));
    fs.rmSync(absolute, { recursive: true, force: true });
  };
  return { directory, filename, checkpoint, issuer, owner, presence, binding, install, peer, review, issue, reopen, close,
    get controller() { return controller; }, get journal() { return journal; },
    clock: n => { now = n; }, enabled: v => { enabled = v; }, deployment: v => { deployment = v; },
    authority: v => { authority = v; }, projection: v => { projection = v; }, presenceValid: v => { presenceValid = v; },
    item: (kind, revision, treatment = 'ORDINARY') => { itemClass = kind; itemRevision = revision; originalTreatment = treatment; } };
}
async function withFixture(fn) { const f = fixture(); try { await fn(f); } finally { f.close(); } }

test('real signed approval and durable consumption release names only once', () => withFixture(async f => {
  const token = f.issue(f.review()); const result = await f.controller.consume(f.peer(), token);
  assert.deepEqual(result, { status: 'ALLOWED_ONCE', output: { variables: [{ name: 'DATABASE_URL', value: '[MASKED]' }, { name: 'PORT', value: '[MASKED]' }] } });
  assert.equal((await f.controller.consume(f.peer(), token)).status, 'DENIED');
  assert.ok(f.journal.events().some(e => e.type === 'CONSUMED'));
}));
test('controller startup retains denies but invalidates old grants and approval references', () => withFixture(async f => {
  const review = f.review(), token = f.issue(review); f.install('r2', 2, ['protected']);
  f.reopen();
  assert.equal((await f.controller.consume(f.peer(), token)).status, 'DENIED');
  assert.throws(() => f.issue(review));
  assert.throws(() => f.install('r3', 3, []), /DENY_RELAXATION/);
}));
test('metadata edits do not preserve signatures or broaden destinations', () => withFixture(async f => {
  const token = f.issue(f.review()); token.payload.binding.destinationId = 'other';
  assert.equal((await f.controller.consume(f.peer(), token)).reason, 'GRANT_SIGNATURE_INVALID');
}));
test('unsigned, old and deny-relaxing policy updates are rejected', () => withFixture(f => {
  f.install('r2', 2, ['protected']);
  assert.throws(() => f.install('old', 1, []), /POLICY_ROLLBACK/);
  assert.throws(() => f.install('r3', 3, []), /DENY_RELAXATION/);
  assert.throws(() => f.controller.installPolicy({ payload: {}, signature: 'x' }), /POLICY_SIGNATURE/);
}));
test('request alone never issues or starts a review; forged peer references deny', () => withFixture(f => {
  assert.equal(f.controller.request({}, f.binding).status, 'DENIED');
  const result = f.controller.request(f.peer(), f.binding); assert.equal(result.status, 'PENDING');
  assert.ok(!f.journal.events().some(e => e.type === 'ISSUED'));
}));
test('two distinct signatures are required and signed review scope cannot be substituted', () => withFixture(f => {
  const review = f.review(); const owner = signedEnvelope(review, f.owner.privateKey);
  assert.throws(() => f.controller.finishOwnerReview(owner, owner), /APPROVAL_SIGNATURE/);
  const changed = { ...review, durationMs: 60001 };
  assert.throws(() => f.issue(changed), /APPROVAL_SCOPE/);
}));
test('disabled mode, missing deployment and transport outage deny without content', () => withFixture(async f => {
  const token = f.issue(f.review());
  f.deployment(false); assert.equal((await f.controller.consume(f.peer(), token)).reason, 'DEPLOYMENT_UNVERIFIED');
  f.deployment(true); f.enabled(false); assert.equal(f.controller.authenticate({}).status, 'DENIED');
  f.enabled(true); const peer = f.peer(); f.authority(false);
  assert.equal((await f.controller.consume(peer, token)).reason, 'IDENTITY_UNVERIFIED');
}));
test('expiry and regressing monotonic clock permanently withhold a grant', () => withFixture(async f => {
  const token = f.issue(f.review()), peer = f.peer(); f.clock(60100);
  assert.equal((await f.controller.consume(peer, token)).reason, 'EXPIRED');
  f.clock(99); assert.equal((await f.controller.consume(peer, token)).reason, 'INVALID_CLOCK');
  f.clock(70000); assert.equal((await f.controller.consume(peer, token)).reason, 'INVALID_CLOCK');
}));
test('revision change and revocation while an async projection waits release no output', () => withFixture(async f => {
  let finish; f.projection(new Promise(done => { finish = done; }));
  const token = f.issue(f.review()); const pending = f.controller.consume(f.peer(), token);
  f.controller.revokeAll(); finish({ variables: ['PORT'] });
  assert.equal((await pending).reason, 'REVOKED_DURING_OPERATION');
}));
test('projection errors and unexpected private values never enter a response', () => withFixture(async f => {
  f.projection({ variables: ['PORT'], original: 'SYNTHETIC_PRIVATE_VALUE' });
  const result = await f.controller.consume(f.peer(), f.issue(f.review()));
  assert.equal(result.status, 'DENIED'); assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_VALUE'));
}));
test('journal modification while active locks further durable commits', () => withFixture(f => {
  const text = fs.readFileSync(f.filename, 'utf8'); fs.writeFileSync(f.filename, text.replace('BOOT', 'B00T'));
  assert.throws(() => f.install('r2', 2), /RECOVERY_LOCKED/);
}));
test('missing checkpoint and acknowledged journal never bootstrap automatically', () => withFixture(f => {
  f.controller.close(); fs.unlinkSync(f.checkpoint.filename);
  assert.throws(() => new SignedJournal({ filename: f.filename, checkpoint: f.checkpoint, ...f.issuer }), /RECOVERY_LOCKED/);
}));
test('durable append failure withholds issuance; restart detects checkpoint mismatch', () => withFixture(f => {
  const review = f.review(), write = f.checkpoint.write.bind(f.checkpoint);
  f.checkpoint.write = () => { throw Error('SYNTHETIC disk failure'); };
  assert.throws(() => f.issue(review), /RECOVERY_LOCKED/);
  f.checkpoint.write = write; f.controller.close();
  assert.throws(() => new SignedJournal({ filename: f.filename, checkpoint: f.checkpoint, ...f.issuer }), /RECOVERY_LOCKED/);
}));
test('second journal writer cannot race single-use records', () => withFixture(f => {
  assert.throws(() => new SignedJournal({ filename: f.filename, checkpoint: f.checkpoint, ...f.issuer }), /EEXIST/);
}));
test('schema and synthetic contract output constructors accept no real values', () => {
  assert.deepEqual(publicOutput('project.contract.read', { fields: [{ name: 'DATABASE_URL', preset: 'loopback-database' }] }),
    { syntheticOnly: true, fields: [{ name: 'DATABASE_URL', value: 'postgresql://example:example@127.0.0.1:5432/example' }] });
  assert.throws(() => publicOutput('project.contract.read', { fields: [{ name: 'PORT', preset: 'text', value: 'SYNTHETIC_PRIVATE' }] }));
  assert.throws(() => publicOutput('project.schema.read', { variables: ['A', 'A'] }));
});

test('a valid pair of signatures without verified physical presence cannot issue a grant', () => withFixture(f => {
  const review = f.review(); f.presenceValid(false);
  assert.throws(() => f.issue(review), /PRESENCE_UNVERIFIED/);
}));
test('an approved ordinary projection is content-bound and never authorizes sensitive or env plaintext', () => withFixture(async f => {
  const text = 'Owner-approved ordinary content'; const sha = createHash('sha256').update(text).digest('hex');
  f.item('OWNER_REVIEWED_TEXT', sha); f.binding.contentRevision = sha;
  f.binding.operation = 'project.reviewed-file.read'; f.binding.action = 'READ_REVIEWED_FILE'; f.binding.outputClass = 'OWNER_REVIEWED_TEXT';
  f.projection({ text, contentSha256: sha });
  const allowed = await f.controller.consume(f.peer(), f.issue(f.review()));
  assert.equal(allowed.output.text, text);
  f.item('OWNER_REVIEWED_TEXT', sha, 'ENVIRONMENT');
  assert.equal(f.controller.request(f.peer(), f.binding).reason, 'SENSITIVE_OR_ENVIRONMENT_TEXT_DENIED');
  f.item('OWNER_REVIEWED_TEXT', sha, 'SENSITIVE');
  assert.equal(f.controller.request(f.peer(), f.binding).reason, 'SENSITIVE_OR_ENVIRONMENT_TEXT_DENIED');
}));
test('changed ordinary projection cannot be released under the previous reviewed content digest', () => withFixture(async f => {
  const sha = createHash('sha256').update('approved').digest('hex'); f.item('OWNER_REVIEWED_TEXT', sha);
  Object.assign(f.binding, { contentRevision: sha, operation: 'project.reviewed-file.read', action: 'READ_REVIEWED_FILE', outputClass: 'OWNER_REVIEWED_TEXT' });
  const token = f.issue(f.review()); const text = 'changed';
  f.projection({ text, contentSha256: createHash('sha256').update(text).digest('hex') });
  assert.equal((await f.controller.consume(f.peer(), token)).reason, 'CONTENT_REVISION_CHANGED');
}));
test('ordinary release still redacts recognized credentials after content approval', () => {
  const text = 'DATABASE_URL=postgresql://example:synthetic-password@db.example.test:5432/example';
  const result = publicOutput('project.reviewed-file.read', { text, contentSha256: createHash('sha256').update(text).digest('hex') });
  assert.ok(!result.text.includes('synthetic-password')); assert.ok(result.text.includes('REDACTED') || result.text.includes('MASKED'));
});

test('retained deny blocks its item before and after restart while a public control can request review', () => withFixture(f => {
  f.install('r2', 2, ['protected']); f.binding.policyRevision = 'r2';
  const protectedBinding = { ...f.binding, itemId: 'protected' };
  assert.equal(f.controller.request(f.peer(), protectedBinding).reason, 'REVISION_OR_POLICY_DENIED');
  assert.equal(f.controller.request(f.peer(), f.binding).status, 'PENDING');
  f.reopen();
  assert.equal(f.controller.request(f.peer(), protectedBinding).reason, 'REVISION_OR_POLICY_DENIED');
  assert.equal(f.controller.request(f.peer(), f.binding).status, 'PENDING');
}));

test('live reviews remain bounded, expired reviews cannot approve and stop occupying the queue', () => withFixture(f => {
  const first = f.review();
  for (let i = 1; i < 32; i++) f.review();
  assert.throws(() => f.review(), /REVIEW_CAPACITY/);
  f.clock(60101);
  assert.throws(() => f.issue(first), /APPROVAL_SCOPE_OR_REPLAY/);
  const fresh = f.review();
  assert.ok(f.issue(fresh).signature);
}));
