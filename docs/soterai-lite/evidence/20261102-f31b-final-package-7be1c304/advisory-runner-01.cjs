'use strict';
// Inert unless invoked with --run AND an exact fresh ONE-run owner approval.
// No npm/config/auth/environment reads, package payload imports, redirects or retries.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { TextDecoder } = require('node:util');
const { performance } = require('node:perf_hooks');
const BASE = 'docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304';
const REPO = path.resolve(__dirname, '../../../..');
const META = BASE + '/advisory-preparation-01.json';
const PROPOSAL = BASE + '/ADVISORY-PROPOSAL01.md';
const RUNNER = BASE + '/advisory-runner-01.cjs';
const APPROVAL = BASE + '/advisory-runner-01-user-approval.json';
const CONSUMPTION = BASE + '/advisory-runner-01-consumption.json';
const OUTPUT = BASE + '/advisory-runner-01-results';
const META_SHA = '619dd0ae81cd10c8276e417b00b96f9731fd1f5ea29318e0d381cdad28236a77';
const PROPOSAL_SHA = '8aaee73d8e1d4533bdab0c0f5756a3eae6a83a9ca43be7f855be126c6a589cb1';
const PROOF_SHA = '221bd5c7b0ad1753365b6ae3526c77db2b02f0192a3be41bfe0bfed9240c5e99';
const ARTIFACT_SHA = '6231159d484a70b284945a61cd8d341b13f809336427c5a57debd807759c688c';
const ENDPOINT = 'https://api.osv.dev/v1/querybatch';
const ANSWER = 'Ek bounded 8-request OSV metadata run allow karo';
const SCOPE = Object.freeze({ endpoint: ENDPOINT, method: 'POST', maxInitialRequests: 8,
    totalUniqueQueries: 284, maxQueriesPerBatch: 40, maxBodyBytes: 65536,
    requestDeadlineMs: 20000, chainDeadlineMs: 180000, maxResponseBytes: 2097152,
    retries: 0, redirects: false, followups: false, authentication: false, cookies: false });
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const demand = (ok, message) => { if (!ok) throw Error(message); };
const json = raw => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw).replace(/^\uFEFF/, ''));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
    && same(Object.keys(value).sort(), [...expected].sort());
const publicName = value => typeof value === 'string' && /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(value);
const publicVersion = value => typeof value === 'string' && /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.+_-]+)?$/.test(value);
const relative = value => typeof value === 'string' && value.length <= 2048
    && !/[\\:\x00-\x1f\x7f]/.test(value) && value.split('/').every(p => p && p !== '.' && p !== '..');
function absolute(file) {
    demand(relative(file), 'Ordinary relative evidence path required');
    const target = path.resolve(REPO, file); demand(target.startsWith(REPO + path.sep), 'Workspace path required'); return target;
}
function parents(file) {
    for (let at = path.dirname(file); ; at = path.dirname(at)) {
        const s = fs.lstatSync(at); demand(s.isDirectory() && !s.isSymbolicLink(), 'Ordinary evidence parents required');
        if (at === REPO) break; demand(at.startsWith(REPO + path.sep), 'Evidence parent escaped');
    }
}
function read(file, cap = 1024 * 1024) {
    const target = absolute(file); parents(target); const before = fs.lstatSync(target);
    demand(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= cap, 'Bounded ordinary pinned input required');
    const raw = fs.readFileSync(target), after = fs.lstatSync(target);
    demand(after.isFile() && !after.isSymbolicLink() && after.nlink === 1 && before.ino === after.ino
        && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs
        && raw.length === before.size, 'Pinned input changed while reading'); return raw;
}
function pin(row, cap) {
    demand(row && Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[a-f0-9]{64}$/.test(row.sha256), 'Valid input pin required');
    const raw = read(row.path, cap); demand(raw.length === row.bytes && sha(raw) === row.sha256, 'Pinned input mismatch: ' + row.path); return raw;
}
function newJson(file, value) {
    const target = absolute(file); parents(target); fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
function absent(file) {
    try { fs.lstatSync(absolute(file)); throw Error('Existing evidence or consumed approval refuses a new run'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function canonicalQueries(rows) {
    demand(Array.isArray(rows) && rows.length <= 2048, 'Bounded installed metadata graph required');
    const unique = new Map();
    for (const row of rows) {
        demand(publicName(row.name) && publicVersion(row.version), 'Public npm name/version required');
        unique.set(row.name + '@' + row.version, { package: { name: row.name, ecosystem: 'npm' }, version: row.version });
    }
    return [...unique.values()].sort((a, b) => (a.package.name + '@' + a.version).localeCompare(b.package.name + '@' + b.version));
}
function prepareSchedule(meta) {
    demand(meta?.installedGraph?.packageInstanceCount === 298 && meta.installedGraph.packages.length === 298
        && meta.installedGraph.missingRequiredCount === 0 && meta.installedGraph.lockMismatchCount === 0, 'Exact admitted graph required');
    const queries = canonicalQueries(meta.installedGraph.packages); demand(queries.length === 284, 'Exact 284 public identities required');
    const supplied = meta.proposedRequest; demand(supplied?.destination === ENDPOINT && supplied.method === 'POST'
        && supplied.totalUniqueQueries === 284 && supplied.initialBatchRequestCount === 8
        && supplied.networkAttemptsSoFar === 0 && supplied.batches.length === 8, 'Frozen request scope mismatch');
    const schedule = [];
    for (let i = 0; i < 8; i++) {
        const body = Buffer.from(JSON.stringify({ queries: queries.slice(i * 40, (i + 1) * 40) })), row = supplied.batches[i];
        demand(row.batch === i + 1 && row.queryCount === Math.min(40, queries.length - i * 40)
            && row.bodyBytes === body.length && row.bodySha256 === sha(body)
            && same(row.body, json(body)) && body.length <= SCOPE.maxBodyBytes, 'Frozen batch body mismatch');
        schedule.push({ batch: i + 1, queryCount: row.queryCount, bodySha256: sha(body), body });
    }
    demand(schedule.reduce((sum, b) => sum + b.body.length, 0) === 20758, 'Frozen total request bytes mismatch'); return schedule;
}
function validateInputs() {
    demand(path.resolve(__filename) === absolute(RUNNER), 'Reviewed runner path required');
    const runnerRaw = read(RUNNER, 128 * 1024), proposalRaw = read(PROPOSAL, 64 * 1024), metaRaw = read(META);
    demand(sha(proposalRaw) === PROPOSAL_SHA && sha(metaRaw) === META_SHA, 'Exact proposal/preparation bytes required');
    const meta = json(metaRaw); demand(meta.status === 'PREPARED_PUBLIC_METADATA_ONLY_NO_ADVISORY_REQUESTS_NOT_A_PASS', 'Preparation status mismatch');
    demand(meta.artifact.sha256 === ARTIFACT_SHA && meta.artifact.bytes === 1735938, 'Exact candidate required');
    pin({ path: 'packages/soterai-lite/' + meta.artifact.name, bytes: meta.artifact.bytes, sha256: ARTIFACT_SHA }, 16 * 1024 * 1024);
    demand(meta.sourceProof.sha256 === PROOF_SHA && meta.sourceProof.fileCount === 1098, 'Current frozen source proof required');
    const proof = json(pin(meta.sourceProof)); demand(proof.fileCount === 1098 && proof.files.length === 1098, 'Frozen source count mismatch');
    const seen = new Set(); for (const row of proof.files) { demand(!seen.has(row.path), 'Duplicate frozen source pin'); seen.add(row.path); pin(row, 8 * 1024 * 1024); }
    const lock = json(pin(meta.lockfile)); demand(lock.lockfileVersion === 3, 'Pinned lockfile v3 required'); pin(meta.sourceInventory, 2 * 1024 * 1024);
    const paths = new Set(); for (const row of meta.installedGraph.packages) {
        demand(!paths.has(row.metadata.path), 'Duplicate package metadata pin'); paths.add(row.metadata.path);
        const p = json(pin(row.metadata)); demand(p.name === row.name && p.version === row.version, 'Installed package identity mismatch');
        demand(row.lockfile.present && row.lockfile.versionMatches && lock.packages[row.lockfile.path]?.version === row.version, 'Installed lock-version mismatch');
    }
    demand(paths.size === 298 && meta.lockfile.otherVersionRecordsNotInThisInstalledScope === 745, 'Declared scope count mismatch');
    for (const edge of meta.installedGraph.edges) demand(paths.has(edge.from) && paths.has(edge.to), 'Unbound metadata edge');
    const schedule = prepareSchedule(meta);
    return { meta, schedule, pins: { metadata: { path: META, sha256: sha(metaRaw) }, proposal: { path: PROPOSAL, sha256: sha(proposalRaw) }, runner: { path: RUNNER, sha256: sha(runnerRaw) } } };
}
function approvalTemplate(pins, decisionReference, approvedAt, expiresAt) {
    return { schemaVersion: 1, status: 'USER_APPROVED_ONE_BOUNDED_OSV_RUN', runCount: 1,
        decision: { reference: decisionReference, answer: ANSWER }, approvedAt, expiresAt,
        metadata: pins.metadata, proposal: pins.proposal, runner: pins.runner, scope: { ...SCOPE } };
}
function admitApproval(approval, pins, now = Date.now()) {
    demand(keys(approval, ['schemaVersion', 'status', 'runCount', 'decision', 'approvedAt', 'expiresAt', 'metadata', 'proposal', 'runner', 'scope']), 'Fresh explicit user approval required');
    demand(approval.schemaVersion === 1 && approval.status === 'USER_APPROVED_ONE_BOUNDED_OSV_RUN' && approval.runCount === 1, 'ONE-run OSV approval required');
    demand(keys(approval.decision, ['reference', 'answer']) && typeof approval.decision.reference === 'string'
        && /^[A-Za-z0-9_\[\],:.-]{1,256}$/.test(approval.decision.reference)
        && approval.decision.answer === ANSWER, 'Exact explicit OSV owner decision required; generic continue refuses');
    const issued = Date.parse(approval.approvedAt), expires = Date.parse(approval.expiresAt);
    demand(typeof approval.approvedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(approval.approvedAt)
        && typeof approval.expiresAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(approval.expiresAt)
        && Number.isFinite(issued) && Number.isFinite(expires) && issued <= now && expires > now
        && expires > issued && expires - issued <= 3600000 && now - issued <= 3600000, 'Fresh bounded approval timestamps required');
    for (const name of ['metadata', 'proposal', 'runner']) demand(keys(approval[name], ['path', 'sha256'])
        && approval[name].path === pins[name].path && approval[name].sha256 === pins[name].sha256, 'Approval pin mismatch: ' + name);
    demand(keys(approval.scope, Object.keys(SCOPE)) && Object.keys(SCOPE).every(key => approval.scope[key] === SCOPE[key]), 'Exact bounded network scope required');
    return true;
}
async function guardedStart({ approval, pins, now, consume, request }) {
    admitApproval(approval, pins, now); await consume(); return request();
}
function parseBatch(raw, expectedCount, transport) {
    const incomplete = reason => ({ status: 'INCOMPLETE', reason, advisoryIds: [], noCleanAuditClaim: true });
    if (!transport || transport.statusCode !== 200 || transport.responseEnd !== true || transport.responseComplete !== true
        || transport.requestClose !== true || transport.responseClose !== true
        || transport.timedOut || transport.overflow || transport.error || transport.aborted
        || !/^application\/json(?:\s*;[^\r\n]*)?$/i.test(transport.contentType || '')
        || !['', 'identity'].includes(transport.contentEncoding || '')) return incomplete('TRANSPORT_OR_CONTENT_TYPE_NOT_ACCEPTED');
    if (!Buffer.isBuffer(raw) || raw.length > SCOPE.maxResponseBytes || !Number.isSafeInteger(expectedCount) || expectedCount < 1 || expectedCount > 40) return incomplete('RESPONSE_BOUNDS');
    let data; try { data = json(raw); } catch { return incomplete('MALFORMED_UTF8_OR_JSON'); }
    if (!keys(data, ['results']) || !Array.isArray(data.results) || data.results.length !== expectedCount) return incomplete('WRONG_RESULT_COUNT_OR_ROOT');
    const advisoryIds = new Set();
    for (const row of data.results) {
        if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(k => !['vulns', 'next_page_token'].includes(k))) return incomplete('UNSUPPORTED_RESULT');
        if (Object.hasOwn(row, 'next_page_token') && (typeof row.next_page_token !== 'string' || row.next_page_token !== '')) return incomplete('PAGINATION_NOT_AUTHORIZED');
        if (row.vulns === undefined) continue;
        if (!Array.isArray(row.vulns) || row.vulns.length > 16384) return incomplete('INVALID_ADVISORY_LIST');
        for (const vuln of row.vulns) {
            if (!vuln || typeof vuln !== 'object' || Array.isArray(vuln) || typeof vuln.id !== 'string'
                || !/^[A-Za-z0-9_.:-]{1,128}$/.test(vuln.id)
                || (vuln.modified !== undefined && (typeof vuln.modified !== 'string' || !Number.isFinite(Date.parse(vuln.modified))))) return incomplete('INVALID_ADVISORY_ID');
            advisoryIds.add(vuln.id);
        }
    }
    return { status: advisoryIds.size ? 'ADVISORY_IDS_FOUND_REVIEW_REQUIRED' : 'NO_ADVISORY_IDS_REPORTED_SCOPE_ONLY_NOT_A_CLEAN_AUDIT',
        advisoryIds: [...advisoryIds].sort(), resultCount: data.results.length, noCleanAuditClaim: true };
}
function aggregate(rows, planned = 8) {
    const incomplete = rows.length !== planned || rows.some(row => row.status === 'INCOMPLETE');
    const ids = [...new Set(rows.flatMap(row => row.advisoryIds || []))].sort();
    const status = incomplete ? 'INCOMPLETE' : ids.length ? 'REVIEW_REQUIRED_ADVISORY_IDS_FOUND' : 'CURRENT_ADVISORY_QUERY_COMPLETE_NO_MATCHES_IN_DECLARED_SCOPE';
    return { status, advisoryGate: status, completedBatches: rows.length, plannedBatches: planned,
        advisoryIds: ids, otherLockfileVersionRecordsUnaudited: 745, releaseReady: false, noCleanAuditClaim: true,
        detailRequests: 0, paginationRequests: 0, retryRequests: 0 };
}
function requestBatch(batch, remainingMs) {
    // Required lazily only after approval, exact pins and exclusive consumption.
    const https = require('node:https'), start = Date.now(), monotonicStart = performance.now(), number = String(batch.batch).padStart(2, '0');
    const rawPath = OUTPUT + '/batch-' + number + '-response.bin', target = absolute(rawPath); parents(target);
    const fd = fs.openSync(target, 'wx'); let retained = 0, observed = 0, req, response, timer;
    const transport = { endpoint: ENDPOINT, method: 'POST', startedAt: new Date(start).toISOString(), statusCode: null,
        contentType: '', contentEncoding: '', responseEnd: false, responseComplete: false, aborted: false,
        timedOut: false, overflow: false, error: null, requestClose: false, responseClose: false };
    return new Promise(resolve => {
        let done = false;
        function finish() {
            if (done) return; done = true; clearTimeout(timer);
            try { fs.closeSync(fd); } catch { transport.error ||= 'RESPONSE_FILE_CLOSE_FAILED'; }
            transport.elapsedMs = performance.now() - monotonicStart; transport.retainedBytes = retained; transport.observedBytes = observed;
            transport.finishedAt = new Date().toISOString();
            const raw = fs.readFileSync(target); const parsed = parseBatch(raw, batch.queryCount, transport);
            newJson(OUTPUT + '/batch-' + number + '-transport.json', { ...transport, rawResponse: { path: rawPath, bytes: raw.length, sha256: sha(raw) }, interpretation: parsed });
            resolve(parsed);
        }
        newJson(OUTPUT + '/batch-' + number + '-start.json', { batch: batch.batch, endpoint: ENDPOINT, method: 'POST',
            queryCount: batch.queryCount, bodyBytes: batch.body.length, bodySha256: batch.bodySha256, startedAt: transport.startedAt });
        const budget = Math.min(SCOPE.requestDeadlineMs, remainingMs) - (performance.now() - monotonicStart);
        if (budget <= 0) { transport.timedOut = true; transport.error = 'ABSOLUTE_REQUEST_DEADLINE_BEFORE_REQUEST'; finish(); return; }
        timer = setTimeout(() => { transport.timedOut = true; transport.error ||= 'ABSOLUTE_REQUEST_DEADLINE';
            req?.destroy(); response?.destroy(); }, budget);
        try {
            req = https.request(ENDPOINT, { method: 'POST', agent: false, minVersion: 'TLSv1.2', rejectUnauthorized: true,
                headers: { 'content-type': 'application/json', accept: 'application/json', 'content-length': String(batch.body.length) } }, res => {
                response = res; transport.statusCode = res.statusCode ?? null;
                transport.contentType = typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : '';
                transport.contentEncoding = typeof res.headers['content-encoding'] === 'string' ? res.headers['content-encoding'] : '';
                res.on('data', chunk => {
                    observed += chunk.length; const keep = Math.max(0, Math.min(chunk.length, SCOPE.maxResponseBytes - retained));
                    try { if (keep) { let offset = 0; while (offset < keep) offset += fs.writeSync(fd, chunk, offset, keep - offset); retained += keep; } }
                    catch { transport.error ||= 'RESPONSE_FILE_WRITE_FAILED'; req.destroy(); res.destroy(); return; }
                    if (observed > SCOPE.maxResponseBytes) { transport.overflow = true; req.destroy(); res.destroy(); }
                });
                res.once('end', () => { transport.responseEnd = true; transport.responseComplete = res.complete === true; });
                res.once('aborted', () => { transport.aborted = true; });
                res.once('error', () => { transport.error ||= 'RESPONSE_ERROR'; });
                res.once('close', () => { transport.responseClose = true; transport.responseComplete = res.complete === true; if (transport.requestClose) finish(); });
            });
            req.once('error', () => { transport.error ||= 'REQUEST_ERROR'; });
            req.once('close', () => { transport.requestClose = true; if (!response || transport.responseClose) finish(); });
            req.end(batch.body);
        } catch { transport.error ||= 'REQUEST_SETUP_FAILED'; if (req) req.destroy(); else finish(); }
    });
}
async function main(args) {
    demand(args.length === 1 && ['--validate', '--run'].includes(args[0]), 'Use only --validate or --run');
    const prepared = validateInputs();
    if (args[0] === '--validate') {
        console.log(JSON.stringify({ status: 'PASS_READ_ONLY_ADMISSION_NOT_AUTHORIZED_NOT_RUN', pins: prepared.pins,
            sourceRecords: 1098, installedMetadataRecords: 298, queryCount: 284, requestCount: 8, networkAttempts: 0,
            currentAdvisoryGate: 'INCOMPLETE_NOT_RUN_NETWORK_NOT_AUTHORIZED', releaseReady: false })); return;
    }
    const approvalRaw = read(APPROVAL, 32 * 1024), approval = json(approvalRaw);
    admitApproval(approval, prepared.pins); absent(CONSUMPTION); absent(OUTPUT);
    const fresh = validateInputs(); demand(same(fresh.pins, prepared.pins), 'Admission changed');
    demand(sha(read(APPROVAL, 32 * 1024)) === sha(approvalRaw), 'Approval changed during admission');
    const rows = [];
    await guardedStart({ approval, pins: fresh.pins, now: Date.now(), consume: () => {
        absent(OUTPUT); newJson(CONSUMPTION, { status: 'ONE_USER_APPROVED_RUN_CONSUMED_NO_RETRY', consumedAt: new Date().toISOString(),
            approval: { path: APPROVAL, bytes: approvalRaw.length, sha256: sha(approvalRaw) }, pins: fresh.pins, scope: SCOPE });
        fs.mkdirSync(absolute(OUTPUT));
    }, request: async () => {
        const started = performance.now();
        for (const batch of fresh.schedule) {
            const remaining = SCOPE.chainDeadlineMs - (performance.now() - started); if (remaining <= 0) break;
            const row = await requestBatch(batch, remaining); rows.push(row); if (row.status === 'INCOMPLETE') break;
        }
    } });
    const summary = { ...aggregate(rows), observedAt: new Date().toISOString(), pins: fresh.pins,
        artifactSha256: ARTIFACT_SHA, requestAttempts: rows.length, remainingBatches: fresh.schedule.slice(rows.length).map(b => ({ batch: b.batch, status: 'NOT_RUN' })), batches: rows };
    newJson(OUTPUT + '/summary.json', summary); console.log(JSON.stringify(summary));
}
module.exports = { SCOPE, ANSWER, canonicalQueries, prepareSchedule, approvalTemplate, admitApproval, guardedStart, parseBatch, aggregate, validateInputs };
if (require.main === module) main(process.argv.slice(2)).catch(() => { console.error('Advisory admission/run incomplete; retained evidence is not a clean audit. No retry is authorized.'); process.exitCode = 1; });
