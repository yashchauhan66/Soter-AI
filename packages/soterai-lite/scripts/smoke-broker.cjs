'use strict';
// Explicit packaged-runtime test. Synthetic credentials and loopback only.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { resolveRelease } = require('./release-artifact.cjs');
const yauzl = require('../../../tools/soterai-lite-packager/node_modules/yauzl');
const root = path.resolve(__dirname, '../../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const diagnostic = { stage: 'arguments' };

async function brokerBytes(vsix) {
    return new Promise((resolve, reject) => yauzl.fromBuffer(vsix, { lazyEntries: true }, (error, zip) => {
        if (error) return reject(error);
        zip.on('error', reject);
        zip.on('end', () => reject(Error('Broker missing from VSIX')));
        zip.on('entry', entry => {
            if (entry.fileName !== 'extension/dist/local-ai-broker.js') return zip.readEntry();
            if (entry.uncompressedSize > 8 * 1024 * 1024) { zip.close(); return reject(Error('Broker size refused')); }
            zip.openReadStream(entry, (error, stream) => {
                if (error) { zip.close(); return reject(error); }
                const chunks = []; stream.on('data', bytes => chunks.push(bytes)); stream.on('error', reject);
                stream.on('end', () => { zip.close(); resolve(Buffer.concat(chunks)); });
            });
        });
        zip.readEntry();
    }));
}

async function main() {
    const args = process.argv.slice(2);
    assert.equal(args.length, 4); assert.equal(args[0], '--pointer'); assert.equal(args[2], '--evidence-out');
    const evidence = path.resolve(root, args[3]);
    assert.ok(evidence.startsWith(root + path.sep));
    await fs.mkdir(evidence); // create-only; preserve every earlier run
    diagnostic.stage = 'resolve-artifact';
    const release = await resolveRelease({ repoRoot: root, pointerPath: path.resolve(root, args[1]) });
    const bytes = await brokerBytes(await fs.readFile(path.resolve(root, release.artifactPath)));
    diagnostic.stage = 'extract-broker';
    const build = JSON.parse(await fs.readFile(path.resolve(root, release.buildReceiptPath), 'utf8'));
    assert.equal(sha(bytes), build.inventory.find(item => item.name === 'local-ai-broker.js').sha256);
    const runtime = path.join(evidence, 'local-ai-broker.js'); await fs.writeFile(runtime, bytes, { flag: 'wx' });
    const client = 'synthetic-smoke-client-' + 'c'.repeat(40), control = 'synthetic-smoke-control-' + 'd'.repeat(40);
    const providerKey = 'synthetic-smoke-provider-private', password = 'BlueMango7!', session = crypto.randomUUID();
    const wires = [], results = [];
    let providerReply = 'Useful public answer';
    const provider = createServer((req, res) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            wires.push({ body: Buffer.concat(chunks).toString(), authorization: req.headers.authorization });
            res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: providerReply } }] }));
        });
    });
    await new Promise((resolve, reject) => { provider.once('error', reject); provider.listen(0, '127.0.0.1', resolve); });
    const environment = { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
        SOTERAI_BROKER_TOKEN: client, SOTERAI_BROKER_CONTROL_TOKEN: control, SOTERAI_PROVIDER_API_KEY: providerKey,
        SOTERAI_OPENAI_PROVIDER_URL: 'http://127.0.0.1:' + provider.address().port,
        SOTERAI_BROKER_SESSION: session, SOTERAI_BROKER_PORT: '0', SOTERAI_BROKER_STORAGE: path.join(evidence, 'synthetic-storage') };
    for (const key of Object.keys(environment)) if (environment[key] === undefined) delete environment[key];
    const child = spawn(process.execPath, [runtime], { env: environment, cwd: evidence, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    diagnostic.stage = 'broker-startup';
    let output = '', errorOutput = '', closed = false;
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errorOutput += chunk; });
    const closure = new Promise(resolve => child.once('close', code => { closed = true; resolve(code); }));
    try {
        const port = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(Error('Packaged broker startup timeout')), 15000);
            child.once('error', reject);
            child.on('message', message => {
                if (message?.session !== session) return;
                if (message.type === 'SOTERAI_GATEWAY_GUARD_REQUEST') child.send({ type: 'SOTERAI_GATEWAY_GUARD_RESPONSE', version: 1, session, id: message.id, allowed: true });
                if (message.type === 'SOTERAI_BROKER_READY') { clearTimeout(timer); resolve(message.port); }
            });
            child.once('close', () => { clearTimeout(timer); reject(Error('Packaged broker exited before readiness')); });
        });
        const url = 'http://127.0.0.1:' + port;
        const post = async (route, body, owner = false, extra = {}) => {
            const res = await fetch(url + route, { method: 'POST', headers: { authorization: 'Bearer ' + (owner ? control : client),
                ...(owner ? { 'x-soterai-session': session } : {}), 'content-type': 'application/json', ...extra }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
            return { status: res.status, text: await res.text(), decision: res.headers.get('x-soterai-request-decision') };
        };
        const route = '/v1/ai/openai-compatible/chat/completions';
        const chat = content => ({ model: 'synthetic', messages: [{ role: 'user', content }] });
        const scenario = async (name, body, expected, owner = false, endpoint = route, headers = {}) => {
            diagnostic.stage = name;
            const before = wires.length, response = await post(endpoint, body, owner, headers);
            diagnostic.providerObservation = {
                calls: wires.length - before,
                rawPasswordPresent: wires.slice(before).some(wire => wire.body.includes(password)),
                redactionMarkerPresent: wires.slice(before).some(wire => wire.body.includes('REDACTED_')),
                responseRawPasswordPresent: response.text.includes(password),
            };
            assert.equal(response.status, expected);
            assert.ok(wires.slice(before).every(wire => !wire.body.includes(password)));
            assert.ok(!response.text.includes(password));
            results.push({ name, status: response.status, providerCalls: wires.length - before, decision: response.decision });
            return response;
        };
        await scenario('public-control', chat('Useful public arithmetic'), 200);
        assert.equal(wires[0].authorization, 'Bearer ' + providerKey);
        await scenario('default-prefixed-password-redacted', chat('DB_PASSWORD=' + password), 200);
        await scenario('nested-metadata-withheld', { ...chat('Public'), metadata: { DB_PASSWORD: password } }, 422);
        const toolResult = content => ({ model: 'synthetic', messages: [
            { role: 'user', content: 'Explain the tool result' },
            { role: 'assistant', content: null, tool_calls: [{ id: 'synthetic-read', type: 'function', function: { name: 'read_file', arguments: '{"path":"public.txt"}' } }] },
            { role: 'tool', tool_call_id: 'synthetic-read', content },
        ] });
        const publicTool = await scenario('public-tool-result-useful-response', toolResult('Public status HTTP 503'), 200);
        assert.ok(publicTool.text.includes('Useful public answer'));
        assert.ok(wires.at(-1).body.includes('Public status HTTP 503'));
        await scenario('tool-result-password-redacted', toolResult('HTTP 503\nDB_PASSWORD=' + password), 200);
        const escapedPassword = [...password].map(char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
        await scenario('embedded-escaped-tool-argument-redacted', { model: 'synthetic', messages: [{ role: 'assistant', content: null,
            tool_calls: [{ id: 'synthetic-argument', type: 'function', function: { name: 'public_tool', arguments: '{"DB_PASSWORD":"' + escapedPassword + '"}' } }] }] }, 200);
        const safeArguments = JSON.parse(JSON.parse(wires.at(-1).body).messages[0].tool_calls[0].function.arguments);
        assert.ok(typeof safeArguments.DB_PASSWORD === 'string' && safeArguments.DB_PASSWORD.includes('REDACTED_'));
        await scenario('text-content-password-redacted', { model: 'synthetic', messages: [{ role: 'user', content: [{ type: 'text', text: 'DB_PASSWORD=' + password }] }] }, 200);
        await scenario('unsupported-image-attachment-withheld', { model: 'synthetic', messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: 'data:image/png;base64,U1lOVEhFVElD' } },
        ] }] }, 415);
        providerReply = 'DB_PASSWORD=' + password;
        await scenario('provider-output-password-withheld', chat('Public response check'), 422);
        providerReply = 'Useful public answer';
        for (const level of ['strict', 'enterprise']) {
            diagnostic.stage = level + '-configuration';
            assert.equal((await post('/v1/safe-mode/enable', { level }, true)).status, 200);
            assert.equal((await post('/v1/gateway/sync', { version: 1, generation: crypto.randomUUID(), mode: { enabled: true, level }, values: [] }, true)).status, 200);
            const content = 'DB_PASSWORD=' + password;
            await scenario(level + '-prefixed-password', chat(content), level === 'enterprise' ? 403 : 200);
            if (level === 'enterprise') {
                diagnostic.stage = 'enterprise-approval';
                const scan = JSON.parse((await post('/v1/scan', { content }, true)).text);
                assert.equal((await post('/v1/approvals', { sessionId: 'synthetic-smoke-approved', contentHash: scan.contentHash, scope: 'once' }, true)).status, 201);
                await scenario('enterprise-approved-still-redacted', chat(content), 200, false, route, { 'x-soterai-session-id': 'synthetic-smoke-approved' });
            }
        }
        assert.ok(![password, client, control, providerKey].some(value => (output + errorOutput).includes(value)));
    } finally {
        if (child.connected) child.send({ type: 'SOTERAI_BROKER_STOP', version: 1, session });
        const timer = setTimeout(() => { if (!closed) child.kill(); }, 5000);
        const code = await closure; clearTimeout(timer);
        await new Promise(resolve => { provider.close(resolve); provider.closeIdleConnections(); });
        if (code !== 0) throw Error('Packaged broker did not close cleanly');
    }
    const report = { status: 'PASS_PACKAGED_BROKER_LOOPBACK', artifactSha256: release.sha256, brokerSha256: sha(bytes), results,
        hostUiTested: false, realProviderTested: false, secretsUsed: 'synthetic-only', childClosed: closed };
    await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report));
}
main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', stage: diagnostic.stage,
    providerObservation: diagnostic.providerObservation,
    code: /^[A-Z0-9_]+$/.test(error?.code) ? error.code : 'SMOKE_FAILURE',
    ...(typeof error?.actual === 'number' ? { actual: error.actual } : {}),
    ...(typeof error?.expected === 'number' ? { expected: error.expected } : {}) })); process.exitCode = 1; });
