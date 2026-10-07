import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'flatted';

const file = path.resolve('.tmp', 'n8n-v080-live', 'live-execution-result.json');
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log('Execution ID:', raw.id);
console.log('Workflow ID:', raw.workflowId);
console.log('Finished:', raw.finished);
console.log('Status:', raw.status);
console.log('Duration:', (new Date(raw.stoppedAt).getTime() - new Date(raw.startedAt).getTime()) + 'ms');

const decoded = parse(raw.data);
const runData = decoded.resultData.runData;
console.log('\n--- EXECUTED NODES BREAKDOWN ---');

const summaryRows = [];

for (const [nodeName, runs] of Object.entries(runData)) {
  const run = runs[0];
  const out = run.data?.main || [];
  const safeItems = out[0] || [];
  const flaggedItems = out[1] || [];
  const totalItems = safeItems.length + flaggedItems.length;

  const item = (safeItems[0] || flaggedItems[0])?.json || {};
  const branch = flaggedItems.length > 0 ? 'FLAGGED (Branch 1)' : safeItems.length > 0 ? 'SAFE (Branch 0)' : 'NONE';

  summaryRows.push({
    Node: nodeName,
    Status: run.executionStatus,
    TimeMs: run.executionTime,
    Branch: branch,
    Operation: item.operation || 'n/a',
    Verdict: item.verdictCode || item.decision || item.action || item.status || (item.blocked ? 'BLOCKED' : 'ALLOWED'),
    Engine: item.engine || 'n/a',
    Score: item.riskScore !== undefined ? item.riskScore : (item.securityScore !== undefined ? item.securityScore : 'n/a')
  });
}

console.table(summaryRows);

// Print specific details of key test nodes
console.log('\n--- DEEP DIVE AUDIT CHECKS ---');

const n1 = (runData['1. Guard Input - Threat Block']?.[0]?.data?.main?.[1]?.[0])?.json;
console.log('\n1. Guard Input - Threat Block:');
console.log('  - Blocked:', n1?.blocked);
console.log('  - Action:', n1?.action);
console.log('  - Categories:', n1?.categories);
console.log('  - UserMessage (Custom):', n1?.userMessage);
console.log('  - EnforceOnSensitiveData:', n1?.enforceOnSensitiveData);
console.log('  - Ignored Entities:', n1?.ignoredIdentifiers);
console.log('  - Ignored Words:', n1?.ignoredWords);

const n2 = (runData['2. Guard Input - PII Redact & Ignored']?.[0]?.data?.main?.[0]?.[0])?.json;
console.log('\n2. Guard Input - PII Redact & Ignored:');
console.log('  - Blocked:', n2?.blocked);
console.log('  - SafeText:', n2?.safeText);
console.log('  - Ignored Entities Applied:', n2?.ignoredIdentifiers?.effect);
console.log('  - Ignored Words Applied:', n2?.ignoredWords?.effect);
console.log('  - UserMessage (Custom Redacted):', n2?.userMessage);

const n3 = (runData['3. Guard Output - Credential Leak Prevention']?.[0]?.data?.main?.[1]?.[0])?.json;
console.log('\n3. Guard Output - Credential Leak:');
console.log('  - Blocked:', n3?.blocked);
console.log('  - Action:', n3?.action);
console.log('  - SensitiveDataEnforced:', n3?.sensitiveDataEnforced);
console.log('  - Categories:', n3?.categories);

const n4 = (runData['4. Universal AI Firewall']?.[0]?.data?.main?.[0]?.[0])?.json;
console.log('\n4. Universal AI Firewall:');
console.log('  - FinalDecision:', n4?.finalDecision);
console.log('  - Profile:', n4?.protectionProfile);
console.log('  - Layers checked:', Object.keys(n4?.checks || {}));

const n6 = (runData['6. Redact PII & Secrets']?.[0]?.data?.main?.[0]?.[0])?.json;
console.log('\n6. Redact PII & Secrets:');
console.log('  - SafeText:', n6?.safeText);
console.log('  - Detected Types:', n6?.clientSideRedactedTypes);
console.log('  - Ignored Words kept:', n6?.ignoredWords?.words);

const n7 = (runData['7. Scan Document - Poisoning Defense']?.[0]?.data?.main?.[1]?.[0])?.json;
console.log('\n7. RAG Scan Document:');
console.log('  - RecommendedAction:', n7?.recommendedAction);
console.log('  - TrustScore:', n7?.trustScore);
console.log('  - Findings:', n7?.findings);

const n8 = (runData['8. Audit Workflow - Security Auditor']?.[0]?.data?.main?.[1]?.[0])?.json;
console.log('\n8. Workflow Security Auditor:');
console.log('  - SecurityScore:', n8?.securityScore);
console.log('  - ReadyForProduction:', n8?.readyForProduction);
console.log('  - QuickWins:', n8?.quickWins);

const n9 = (runData['9. Agent Passport: Enroll Identity']?.[0]?.data?.main?.[0]?.[0])?.json;
console.log('\n9. Agent Passport - Enroll:');
console.log('  - AgentIdentityId:', n9?.agentIdentityId);
console.log('  - VerdictCode:', n9?.verdictCode);

const n10 = (runData['10. Agent Passport: Issue Passport']?.[0]?.data?.main?.[0]?.[0])?.json;
console.log('\n10. Agent Passport - Issue:');
console.log('  - PassportId:', n10?.passportId);
console.log('  - PassportToken:', n10?.passportToken ? '*** (MASKED/PROTECTED)' : 'MISSING');
console.log('  - Status:', n10?.status);

const n11 = (runData['11. Agent Passport: Validate Passport']?.[0]?.data?.main?.[0]?.[0])?.json;
console.log('\n11. Agent Passport - Validate:');
console.log('  - Decision:', n11?.decision);
console.log('  - VerdictCode:', n11?.verdictCode);

const n12 = (runData['12. Agent Passport: Check Tool Call']?.[0]?.data?.main?.[1]?.[0])?.json;
console.log('\n12. Agent Passport - Check Tool Call:');
console.log('  - Decision:', n12?.decision);
console.log('  - Blocked:', n12?.blocked);
console.log('  - Reason:', n12?.reason);

const n13 = (runData['13. Agent Passport: Revoke Passport']?.[0]?.data?.main?.[0]?.[0])?.json;
console.log('\n13. Agent Passport - Revoke:');
console.log('  - Status:', n13?.status);
console.log('  - VerdictCode:', n13?.verdictCode);

const scorecard = (runData['Ultra Test Audit Scorecard']?.[0]?.data?.main?.[0]?.[0])?.json;
console.log('\n=== ULTRA TEST SCORECARD ===');
console.log(JSON.stringify(scorecard, null, 2));
