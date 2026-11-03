'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const own = name => path.join(__dirname, name);
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(hash(fs.readFileSync(own('advisory-runner-01.cjs'))), 'f51e6296db100c644e78b310881e8c6a06a00e322f775881e7bb9821194628d6');
assert.equal(hash(fs.readFileSync(own('ADVISORY-PROPOSAL01.md'))), '8aaee73d8e1d4533bdab0c0f5756a3eae6a83a9ca43be7f855be126c6a589cb1');
const api = require('./advisory-runner-01.cjs');
const prepared = api.validateInputs();
const now = new Date();
const reference = 'call_f74ee63d4c374ee3ae6b552a3b847b42';
const answer = 'Ek bounded 8-request OSV metadata run allow karo';
assert.equal(api.ANSWER, answer);
const approval = api.approvalTemplate(prepared.pins, reference, now.toISOString(), new Date(now.getTime() + 3600000).toISOString());
api.admitApproval(approval, prepared.pins, now.getTime());
const decision = { status: 'EXPLICIT_ONE_BOUNDED_OSV_RUN_APPROVED_NOT_CONSUMED', observedAt: now.toISOString(), reference, answer,
    proposalSha256: prepared.pins.proposal.sha256, runnerSha256: prepared.pins.runner.sha256,
    source: 'Actual user reply to request_user_input_async; generic continue was not treated as permission.',
    scope: 'At most8 fixed-host HTTPS POST requests for284 public npm name/version pairs only. Original proposal limits, no retries/redirects/detail calls/auth/source/credentials/publish.' };
fs.writeFileSync(own('advisory-owner-decision-01.json'), JSON.stringify(decision, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(own('advisory-runner-01-user-approval.json'), JSON.stringify(approval, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: decision.status, reference, requests: 8, queries: 284, approvalSha256: hash(fs.readFileSync(own('advisory-runner-01-user-approval.json'))) }));
