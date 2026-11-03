'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const own = name => path.join(__dirname, name);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(fs.readFileSync(own('ADVISORY-DETAIL-PROPOSAL01.md'))), '3cb1423835b721964b3a9c3de38aadff4f4e0865da87ac134c81baf03c4182c4');
assert.equal(sha(fs.readFileSync(own('advisory-detail-runner-01.cjs'))), '7380af14affb0383d3881d942a0e1b08ffda0e6febabe4d34e78ecfbc9d06d64');
const api = require('./advisory-detail-runner-01.cjs');
const prepared = api.validateInputs();
assert.equal(prepared.idListSha256, '2cc11d838a8f17ef69cf67d93771b5f3a208ac93059b6fb6f1f4eace7d9afaba');
const now = new Date();
const reference = 'call_5160afa54e6842a3900607a280932f53';
const answer = 'Ek bounded 42-advisory OSV detail run allow karo';
assert.equal(api.ANSWER, answer);
const approval = api.approvalTemplate(prepared.pins, prepared.idListSha256, reference,
  now.toISOString(), new Date(now.getTime() + 3600000).toISOString());
api.admitApproval(approval, prepared.pins, prepared.idListSha256, now.getTime());
const decision = { status: 'EXPLICIT_ONE_BOUNDED_OSV_DETAIL_RUN_APPROVED_NOT_CONSUMED',
  observedAt: now.toISOString(), reference, answer, pins: prepared.pins, idListSha256: prepared.idListSha256,
  source: 'Actual user reply to request_user_input_async; earlier8 permission and generic continue supply no authority.',
  scope: api.scope(prepared.idListSha256), releaseReady: false };
fs.writeFileSync(own('advisory-detail-owner-decision-01.json'), JSON.stringify(decision, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(own('advisory-detail-runner-01-user-approval.json'), JSON.stringify(approval, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: decision.status, reference, maxRequests: 42,
  approvalSha256: sha(fs.readFileSync(own('advisory-detail-runner-01-user-approval.json'))) }));
