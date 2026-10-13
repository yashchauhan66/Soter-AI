import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { request } from 'node:https';
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, X509Certificate } from 'node:crypto';
import { SignedJournal, FileCheckpoint, signedEnvelope } from '../SignedJournal.mjs';
import { CapabilityController } from '../CapabilityController.mjs';
import { createControllerServer, certificateIdentity } from '../DataPlane.mjs';
const openssl = process.platform === 'win32' ? 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe' : '/usr/bin/openssl';
const available = fs.existsSync(openssl);
const pair = () => generateKeyPairSync('ed25519');

async function fixture(run) {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'soterai-controller-tls-'));
  const file = n => path.join(root, n), read = n => fs.readFileSync(file(n));
  const env = {};
  for (const n of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[n]) env[n] = process.env[n];
  const invoke = args => execFileSync(openssl, args, { cwd: root, env, stdio: 'pipe', timeout: 15000 });
  fs.writeFileSync(file('req.conf'), '[req]\ndistinguished_name=dn\n[dn]\n');
  fs.writeFileSync(file('ca.ext'), 'basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n');
  fs.writeFileSync(file('server.ext'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n');
  fs.writeFileSync(file('client.ext'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=clientAuth\n');
  let controller, server;
  try {
    invoke(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.csr', '-subj', '/CN=SoterAI synthetic CA', '-config', 'req.conf']);
    invoke(['x509', '-req', '-in', 'ca.csr', '-signkey', 'ca.key', '-out', 'ca.crt', '-days', '1', '-extfile', 'ca.ext', '-set_serial', '1']);
    for (const [index, name] of ['server', 'agent', 'operator', 'unknown'].entries()) {
      invoke(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', name + '.key', '-out', name + '.csr', '-subj', '/CN=' + name, '-config', 'req.conf']);
      invoke(['x509', '-req', '-in', name + '.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-out', name + '.crt', '-days', '1', '-extfile', name === 'server' ? 'server.ext' : 'client.ext', '-set_serial', String(index + 2)]);
    }
    fs.mkdirSync(file('journal')); fs.mkdirSync(file('checkpoint'));
    const issuer = pair(), owner = pair(), presence = pair();
    const journal = new SignedJournal({ filename: file('journal/events.jsonl'), ...issuer,
      checkpoint: new FileCheckpoint(file('checkpoint/latest.json')), bootstrap: true });
    const identity = { principalId: 'guest', workloadId: 'vm', launchId: 'launch', sessionId: 'session' };
    const fingerprint = name => createHash('sha256').update(new X509Certificate(read(name + '.crt')).raw).digest('hex');
    const peers = new Map([[fingerprint('agent'), { role: 'agent', identity, measurement: { validUntil: 100000 } }],
      [fingerprint('operator'), { role: 'operator' }]]);
    controller = new CapabilityController({ journal, issuerPrivateKey: issuer.privateKey, issuerPublicKey: issuer.publicKey,
      ownerPublicKey: owner.publicKey, presencePublicKey: presence.publicKey, now: () => 100,
      enabled: () => true, deploymentVerified: () => true,
      authenticateTransport: socket => certificateIdentity(socket, peers, 100),
      resolveItem: (projectId, itemId) => ({ projectId, itemId, contentRevision: 'c1', outputClass: 'PUBLIC_SCHEMA' }),
      projectAllowed: (_identity, projectId) => projectId === 'p1', destinationAllowed: () => true,
      verifyPresence: () => true, projectPublic: () => ({ variables: ['DATABASE_URL', 'PORT'] }) });
    controller.installPolicy(signedEnvelope({ projectId: 'p1', revision: 'r1', sequence: 1, deniedItems: [] }, owner.privateKey));
    server = createControllerServer({ key: read('server.key'), cert: read('server.crt'), ca: read('ca.crt'), controller, peers, enabled: () => true });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const call = (name, pathname, body) => new Promise((resolve, reject) => {
      const text = body === undefined ? undefined : JSON.stringify(body);
      const req = request({ hostname: '127.0.0.1', port: server.address().port, path: pathname, method: text ? 'POST' : 'GET',
        ca: read('ca.crt'), ...(name ? { key: read(name + '.key'), cert: read(name + '.crt') } : {}), agent: false,
        headers: text ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) } : {} }, res => {
        let data = ''; res.on('data', c => { data += c; }); res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(data) }));
      }); req.on('error', reject); req.setTimeout(5000, () => req.destroy(Error('synthetic request timeout')));
      if (text) req.write(text); req.end();
    });
    await run({ call, owner, presence, identity });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    controller?.close(); const absolute = path.resolve(root);
    assert.equal(path.dirname(absolute), path.resolve(tmpdir())); assert.ok(path.basename(absolute).startsWith('soterai-controller-tls-'));
    fs.rmSync(absolute, { recursive: true, force: true });
  }
}

test('real TLS client authentication denies absent/unpinned certificates and agent owner-route calls', { skip: !available }, () => fixture(async ({ call }) => {
  await assert.rejects(call(undefined, '/v1/status'));
  assert.equal((await call('unknown', '/v1/status')).code, 403);
  assert.equal((await call('agent', '/owner/review/begin', { requestId: 'none' })).code, 403);
  assert.equal((await call('agent', '/v1/arbitrary-file', { path: 'SYNTHETIC_PRIVATE' })).code, 404);
}));
test('actual mTLS request/owner review/consume pipeline releases only masked names once', { skip: !available }, () => fixture(async ({ call, owner, presence, identity }) => {
  const binding = { recipient: identity, projectId: 'p1', itemId: 'schema', contentRevision: 'c1', policyRevision: 'r1',
    operation: 'project.schema.read', action: 'READ_PUBLIC_SCHEMA', outputClass: 'PUBLIC_SCHEMA', destinationId: 'provider' };
  const pending = await call('agent', '/v1/requests', { binding, durationMs: 60000 });
  assert.equal(pending.body.status, 'PENDING');
  const review = await call('operator', '/owner/review/begin', { requestId: pending.body.requestId });
  const ownerEnvelope = signedEnvelope(review.body.payload, owner.privateKey), presenceEnvelope = signedEnvelope(review.body.payload, presence.privateKey);
  const issued = await call('operator', '/owner/review/finish', { ownerEnvelope, presenceEnvelope });
  assert.equal(issued.body.status, 'ISSUED');
  const result = await call('agent', '/v1/consume', { token: issued.body.token });
  assert.equal(result.body.status, 'ALLOWED_ONCE');
  assert.deepEqual(result.body.output, { variables: [{ name: 'DATABASE_URL', value: '[MASKED]' }, { name: 'PORT', value: '[MASKED]' }] });
  assert.equal((await call('agent', '/v1/consume', { token: issued.body.token })).body.status, 'DENIED');
}));
