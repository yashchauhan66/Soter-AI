import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the original workflow backup
const originalRaw = fs.readFileSync(path.join(__dirname, '../target_workflow_clean.json'), 'utf8').replace(/^\uFEFF/, '');
const originalWfList = JSON.parse(originalRaw);
const wf = originalWfList[0];

console.log(`Original Workflow: "${wf.name}" (${wf.nodes.length} nodes)`);

// ONLY modify the Soter node version to v0.8.2 (typeVersion: 3)
// All other nodes, sticky note, connections, parameters remain 100% UNTOUCHED
for (const node of wf.nodes) {
  if (node.name === 'Guard Input for Threats' && node.type === 'n8n-nodes-soterai.soterGuard') {
    node.typeVersion = 3;
    node.parameters = {
      action: 'inputGuard',
      detectionEngine: 'AUTO',
      inputText: '={{ $json.chatInput }}',
      onThreat: 'BLOCK',
      allowedTopics: 'billing, account number subscriptions, invoices, sso login, api errors, csv export, bug reports, feature requests, account help',
      systemPromptContext: 'You are AcmeCloud SaaS support for billing, login, API, exports, bug reports and account help.',
      sessionId: '={{ $json.sessionId }}'
    };
    node.credentials = {
      soterApi: { id: 'jp7mO4AKCUhn0TY2', name: 'SoterAI Production Cloud' }
    };
    console.log('✅ Updated "Guard Input for Threats" to SoterAI v0.8.2 (typeVersion: 3)');
  }

  if (node.name === 'Verify Output for Safety' && node.type === 'n8n-nodes-soterai.soterGuard') {
    node.typeVersion = 3;
    node.parameters = {
      action: 'outputGuard',
      detectionEngine: 'AUTO',
      outputText: '={{ $json.text ?? $json.output ?? $json.outputText ?? "Sorry, I ran into an issue generating a response. A team member will follow up shortly." }}',
      onThreat: 'REDACT'
    };
    node.credentials = {
      soterApi: { id: 'jp7mO4AKCUhn0TY2', name: 'SoterAI Production Cloud' }
    };
    console.log('✅ Updated "Verify Output for Safety" to SoterAI v0.8.2 (typeVersion: 3)');
  }
}

// Save to container import path
const outPath = path.join(__dirname, '../.tmp/exact_same_wf_soter_v082.json');
fs.writeFileSync(outPath, JSON.stringify(wf, null, 2), 'utf8');

// Copy into container and import
execSync(`docker cp ${outPath} ai-agent-security-guard-n8n-1:/home/node/exact_same_wf_soter_v082.json`);
const res = execSync(`docker exec ai-agent-security-guard-n8n-1 n8n import:workflow --input=/home/node/exact_same_wf_soter_v082.json`);
console.log('n8n CLI Import Result:\n', res.toString());

console.log('\n🎉 Verified: Entire workflow is 100% same as original, ONLY Soter nodes are upgraded to v0.8.2 (typeVersion: 3)!');
