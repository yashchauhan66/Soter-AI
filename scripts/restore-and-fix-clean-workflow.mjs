import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read pristine original backup
const originalRaw = fs.readFileSync(path.join(__dirname, '../target_workflow_clean.json'), 'utf8').replace(/^\uFEFF/, '');
const originalWfList = JSON.parse(originalRaw);
const wf = originalWfList[0];

console.log(`Original Workflow to restore: "${wf.name}" (${wf.nodes.length} nodes)`);

// Ensure exact node names and ONLY upgrade Soter nodes to v0.8.2 (typeVersion: 3)
for (const node of wf.nodes) {
  // Fix Node 1: Guard Input for Threats
  if (node.id === 'c33f0ef6-fb17-47aa-b59d-7993b975099c' || node.name.includes('Guard Input')) {
    node.name = 'Guard Input for Threats';
    node.type = 'n8n-nodes-soterai.soterGuard';
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
    console.log('✅ Guard Input for Threats restored and upgraded to v0.8.2');
  }

  // Fix Node 2: Verify Output for Safety
  if (node.id === 'f7e8761e-25e2-41c5-935e-d998ddf54f3d' || node.name.includes('Verify Output')) {
    node.name = 'Verify Output for Safety';
    node.type = 'n8n-nodes-soterai.soterGuard';
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
    console.log('✅ Verify Output for Safety restored and upgraded to v0.8.2');
  }

  // Ensure Generate Handoff Ticket has proper name and code
  if (node.id === 'b5b5a3db-b818-4bd1-a8f1-5261db68ee94') {
    node.name = 'Generate Handoff Ticket';
  }
}

// Make sure connections reference the clean names
wf.connections['Verify Output for Safety'] = {
  main: [
    [{ node: 'Reply Success Message', type: 'main', index: 0 }]
  ]
};
delete wf.connections['$json.output }}'];
delete wf.connections['{{ $json.output }}'];

wf.connections['Generate Handoff Ticket'] = {
  main: [
    [{ node: 'Verify Output for Safety', type: 'main', index: 0 }]
  ]
};
delete wf.connections['do I reset my password?'];

// Save clean workflow JSON
const cleanPath = path.join(__dirname, '../.tmp/clean_restored_wf.json');
fs.writeFileSync(cleanPath, JSON.stringify(wf, null, 2), 'utf8');

execSync(`docker cp ${cleanPath} ai-agent-security-guard-n8n-1:/home/node/clean_restored_wf.json`);
const res = execSync(`docker exec ai-agent-security-guard-n8n-1 n8n import:workflow --input=/home/node/clean_restored_wf.json`);
console.log('n8n Import Output:\n', res.toString());

console.log('🎉 Clean workflow restored perfectly with SoterAI v0.8.2!');
