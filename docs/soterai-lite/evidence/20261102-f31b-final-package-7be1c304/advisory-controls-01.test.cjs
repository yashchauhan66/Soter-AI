'use strict';
// Pure admission/response controls; injected request callbacks never use a network API.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const api = require('./advisory-runner-01.cjs');
const now = Date.parse('2026-11-03T00:00:00.000Z');
const pins = { metadata: { path: 'metadata.json', sha256: 'a'.repeat(64) },
    proposal: { path: 'proposal.md', sha256: 'b'.repeat(64) }, runner: { path: 'runner.cjs', sha256: 'c'.repeat(64) } };
const approval = () => api.approvalTemplate(pins, 'call_actual_explicit_owner_reply', new Date(now - 1000).toISOString(), new Date(now + 60000).toISOString());
const transport = () => ({ statusCode: 200, responseEnd: true, responseComplete: true,
    timedOut: false, overflow: false, error: null, aborted: false, contentType: 'application/json; charset=utf-8',
    contentEncoding: '', requestClose: true, responseClose: true });
const raw = value => Buffer.from(JSON.stringify(value));
async function refusesWithoutRequests(value) {
    let consumed = 0, requests = 0;
    await assert.rejects(api.guardedStart({ approval: value, pins, now,
        consume: () => { consumed++; }, request: () => { requests++; } }));
    assert.equal(consumed, 0); assert.equal(requests, 0);
}
test('missing approval cannot consume or request', () => refusesWithoutRequests(undefined));
test('generic continue cannot consume or request', () => { const a = approval(); a.decision.answer = 'continue kro'; return refusesWithoutRequests(a); });
for (const [label, change] of [
    ['unapproved status', a => { a.status = 'PREPARED'; }],
    ['multiple runs', a => { a.runCount = 2; }],
    ['missing decision reference', a => { a.decision.reference = ''; }],
    ['expired approval', a => { a.expiresAt = new Date(now - 1).toISOString(); }],
    ['future approval', a => { a.approvedAt = new Date(now + 1).toISOString(); }],
    ['more than one hour', a => { a.expiresAt = new Date(now + 3600000).toISOString(); }],
    ['wrong metadata', a => { a.metadata = { ...a.metadata, sha256: 'd'.repeat(64) }; }],
    ['wrong proposal', a => { a.proposal = { ...a.proposal, sha256: 'd'.repeat(64) }; }],
    ['wrong runner', a => { a.runner = { ...a.runner, sha256: 'd'.repeat(64) }; }],
    ['changed endpoint', a => { a.scope.endpoint = 'https://example.invalid/query'; }],
    ['ninth request', a => { a.scope.maxInitialRequests = 9; }],
    ['retry permission', a => { a.scope.retries = 1; }],
    ['redirect permission', a => { a.scope.redirects = true; }],
    ['detail/pagination permission', a => { a.scope.followups = true; }],
    ['authentication', a => { a.scope.authentication = true; }],
    ['extra approval field', a => { a.arbitraryUrl = 'https://example.invalid'; }]
]) test('authority refuses ' + label + ' before consume/request', () => { const a = approval(); change(a); return refusesWithoutRequests(a); });
test('one valid exact approval consumes before injected request', async () => {
    const events = []; const result = await api.guardedStart({ approval: approval(), pins, now,
        consume: () => { events.push('consume'); }, request: () => { events.push('synthetic-callback-no-network'); return 'bounded'; } });
    assert.deepEqual(events, ['consume', 'synthetic-callback-no-network']); assert.equal(result, 'bounded');
});
test('exclusive consumption refusal makes zero requests', async () => {
    let requests = 0; await assert.rejects(api.guardedStart({ approval: approval(), pins, now,
        consume: () => { throw Object.assign(Error('Existing consumption'), { code: 'EEXIST' }); }, request: () => { requests++; } }), /consumption/);
    assert.equal(requests, 0);
});
test('canonical public identities deduplicate nested same-version copies without sending paths', () => {
    const values = api.canonicalQueries([{ name: 'fixture', version: '1.2.3', metadata: { path: 'private/path' } }, { name: 'fixture', version: '1.2.3' }, { name: 'fixture', version: '2.0.0' }]);
    assert.equal(values.length, 2); assert.deepEqual(values[0], { package: { name: 'fixture', ecosystem: 'npm' }, version: '1.2.3' }); assert(!JSON.stringify(values).includes('private'));
});
test('non-package names cannot become outbound public identities', () => assert.throws(() => api.canonicalQueries([{ name: '../private', version: '1.0.0' }]), /Public/));
test('prepared exact284 batch bodies match hashes; changed body or count refuses', () => {
    const meta = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, 'advisory-preparation-01.json'), 'utf8'));
    const schedule = api.prepareSchedule(meta); assert.equal(schedule.length, 8); assert.equal(schedule.reduce((s, b) => s + b.queryCount, 0), 284);
    for (const mutate of [m => { m.proposedRequest.batches[0].body.queries[0].version = '0.0.0'; }, m => { m.proposedRequest.batches[0].bodySha256 = '0'.repeat(64); }, m => { m.proposedRequest.initialBatchRequestCount = 9; }]) {
        const changed = structuredClone(meta); mutate(changed); assert.throws(() => api.prepareSchedule(changed), /mismatch/);
    }
});
test('wrong result count remains incomplete', () => assert.equal(api.parseBatch(raw({ results: [{}] }), 2, transport()).status, 'INCOMPLETE'));
test('pagination remains incomplete with no invented missing results', () => {
    const result = api.parseBatch(raw({ results: [{ vulns: [{ id: 'TEST-ADVISORY' }], next_page_token: 'more' }] }), 1, transport());
    assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.reason, 'PAGINATION_NOT_AUTHORIZED');
});
test('returned advisory IDs require review; no severity/remediation invented', () => {
    const result = api.parseBatch(raw({ results: [{ vulns: [{ id: 'GHSA-public-fixture', modified: '2026-11-02T00:00:00Z' }] }] }), 1, transport());
    assert.equal(result.status, 'ADVISORY_IDS_FOUND_REVIEW_REQUIRED'); assert.deepEqual(result.advisoryIds, ['GHSA-public-fixture']); assert.equal(result.noCleanAuditClaim, true); assert.equal(result.severity, undefined);
});
test('valid empty result is scoped no-IDs evidence, not a global clean assertion', () => {
    const result = api.parseBatch(raw({ results: [{}, { vulns: [] }] }), 2, transport());
    assert.equal(result.status, 'NO_ADVISORY_IDS_REPORTED_SCOPE_ONLY_NOT_A_CLEAN_AUDIT'); assert.deepEqual(result.advisoryIds, []); assert.equal(result.resultCount, 2); assert.equal(result.noCleanAuditClaim, true);
});
for (const [label, change] of [
    ['redirect', t => { t.statusCode = 302; }], ['HTTP failure', t => { t.statusCode = 503; }],
    ['deadline', t => { t.timedOut = true; }], ['oversize', t => { t.overflow = true; }],
    ['no response end', t => { t.responseEnd = false; }], ['incomplete response', t => { t.responseComplete = false; }],
    ['abort', t => { t.aborted = true; }], ['stream error', t => { t.error = 'REQUEST_ERROR'; }],
    ['non-JSON type', t => { t.contentType = 'text/html'; }], ['unexpected compression', t => { t.contentEncoding = 'gzip'; }],
    ['missing request close', t => { t.requestClose = false; }], ['missing response close', t => { t.responseClose = false; }]
]) test('response refuses ' + label, () => { const t = transport(); change(t); assert.equal(api.parseBatch(raw({ results: [{}] }), 1, t).status, 'INCOMPLETE'); });
test('malformed JSON, invalid UTF8 and non-object result refuse', () => {
    for (const value of [Buffer.from('{'), Buffer.from([0xff]), raw({ results: [null] }), raw({ results: [{ vulns: [{ id: '../invalid' }] }] })]) assert.equal(api.parseBatch(value, 1, transport()).status, 'INCOMPLETE');
});
test('oversize raw response refuses even without overflow metadata', () => assert.equal(api.parseBatch(Buffer.alloc(2097153), 1, transport()).status, 'INCOMPLETE'));
test('missing batch or incomplete batch remains incomplete in aggregation', () => {
    const valid = api.parseBatch(raw({ results: [{}] }), 1, transport());
    assert.equal(api.aggregate([valid]).status, 'INCOMPLETE'); assert.equal(api.aggregate([...Array(7).fill(valid), { status: 'INCOMPLETE' }]).status, 'INCOMPLETE');
});
test('valid full empty set gets precise current declared-scope status and retains global limits', () => {
    const valid = api.parseBatch(raw({ results: [{}] }), 1, transport()), result = api.aggregate(Array(8).fill(valid));
    assert.equal(result.status, 'CURRENT_ADVISORY_QUERY_COMPLETE_NO_MATCHES_IN_DECLARED_SCOPE');
    assert.equal(result.advisoryGate, result.status); assert.equal(result.releaseReady, false); assert.equal(result.otherLockfileVersionRecordsUnaudited, 745); assert.equal(result.noCleanAuditClaim, true);
});
test('one advisory batch prevents no-match aggregate and requires findings review', () => {
    const valid = api.parseBatch(raw({ results: [{}] }), 1, transport()), found = api.parseBatch(raw({ results: [{ vulns: [{ id: 'TEST-ADVISORY' }] }] }), 1, transport());
    const result = api.aggregate([...Array(7).fill(valid), found]); assert.equal(result.status, 'REVIEW_REQUIRED_ADVISORY_IDS_FOUND'); assert.equal(result.advisoryGate, 'REVIEW_REQUIRED_ADVISORY_IDS_FOUND'); assert.deepEqual(result.advisoryIds, ['TEST-ADVISORY']);
});
