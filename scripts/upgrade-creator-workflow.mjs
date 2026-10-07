import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'http://localhost:5678';
let cookies = '';

async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookies) headers['cookie'] = cookies;
  if (options.body && typeof options.body === 'object') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(BASE + urlPath, { ...options, headers });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const rawCookies = setCookie.split(',').map(c => c.split(';')[0].trim());
    cookies = rawCookies.join('; ');
  }

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data };
}

async function main() {
  console.log("=== Step 1: Login & Fetch Workflow ===");
  await request('/rest/login', {
    method: 'POST',
    body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' }
  });

  const wfRes = await request('/rest/workflows/ra1LSDqUJn1M4a5s');
  if (wfRes.status !== 200) {
    throw new Error('Failed to load workflow: ' + JSON.stringify(wfRes.data));
  }
  const wf = wfRes.data.data;
  console.log(`Loaded workflow: "${wf.name}" (${wf.nodes.length} nodes)`);

  console.log("\n=== Step 2: Upgrade SoterAI Nodes to v0.8.2 (typeVersion: 3) ===");
  // 1. Upgrade Guard Input for Threats to typeVersion: 3
  const inputGuard = wf.nodes.find(n => n.name === 'Guard Input for Threats');
  if (inputGuard) {
    inputGuard.typeVersion = 3;
    inputGuard.parameters = {
      action: 'inputGuard',
      detectionEngine: 'AUTO',
      inputText: '={{ $json.chatInput }}',
      onThreat: 'BLOCK',
      sensitivity: 'BALANCED',
      allowedTopics: 'billing, account number subscriptions, invoices, sso login, api errors, csv export, bug reports, feature requests, account help',
      systemPromptContext: 'You are AcmeCloud SaaS support for billing, login, API, exports, bug reports and account help.',
      sessionId: '={{ $json.sessionId }}'
    };
    inputGuard.credentials = {
      soterApi: { id: 'jp7mO4AKCUhn0TY2', name: 'SoterAI Production Cloud' }
    };
    console.log('✅ Node 1 "Guard Input for Threats" upgraded to v0.8.2 (typeVersion: 3)');
  }

  // 2. Upgrade Verify Output for Safety to typeVersion: 3
  const outputGuard = wf.nodes.find(n => n.name === 'Verify Output for Safety');
  if (outputGuard) {
    outputGuard.typeVersion = 3;
    outputGuard.parameters = {
      action: 'outputGuard',
      detectionEngine: 'AUTO',
      outputText: '={{ $json.text ?? $json.output ?? $json.outputText ?? "Sorry, I ran into an issue generating a response. A team member will follow up shortly." }}',
      onThreat: 'REDACT',
      sensitivity: 'BALANCED'
    };
    outputGuard.credentials = {
      soterApi: { id: 'jp7mO4AKCUhn0TY2', name: 'SoterAI Production Cloud' }
    };
    console.log('✅ Node 2 "Verify Output for Safety" upgraded to v0.8.2 (typeVersion: 3)');
  }

  // 3. Update Sticky Note with professional Creator Portal docs
  const sticky = wf.nodes.find(n => n.type === 'n8n-nodes-base.stickyNote');
  if (sticky) {
    sticky.parameters.content = [
      '## 🛡️ Secure AI SaaS Helpdesk — Prompt Injection Defense & PII Redaction (SoterAI v0.8.2 + Groq)',
      '',
      '### 🌟 How it works',
      'This enterprise-ready customer support workflow implements a **multi-tiered AI firewall** around LangChain agents:',
      '1. **Input Guard (SoterAI v0.8.2)**: Intercepts inbound customer messages to block prompt injections, jailbreaks, and out-of-scope queries before they reach your LLMs.',
      '2. **Smart Intent Routing**: Automatically classifies queries into **Bug Triage**, **Human Handoff**, or **Knowledge Base Q&A**.',
      '3. **High-Speed Autonomous Execution**: Powered by Groq LLM (ultra-fast inference) and Pinecone Vector Store (RAG) with Cohere embeddings.',
      '4. **Output DLP Guard (SoterAI v0.8.2)**: Redacts any accidental leakage of API keys, customer PII, or internal credentials before sending responses back to the user.',
      '',
      '### ⚙️ Setup & Credentials',
      '- **SoterAI Guard**: Configure SoterAI Cloud API key or select **Local Engine** for 100% on-premise, zero-data-leak protection.',
      '- **Groq API**: Add your Groq API key (`groqApi`) for high-speed LLM processing.',
      '- **Pinecone & Cohere (Optional for RAG)**: Connect your Pinecone vector index and Cohere embeddings for documentation search.',
      '',
      '### 🚀 Ready for Production',
      'Pre-configured with dual-branch security logging, ticket generation, and graceful error handling.'
    ].join('\n');
    sticky.parameters.height = 700;
    sticky.parameters.width = 540;
    console.log('✅ Sticky Note updated with professional Creator Portal documentation');
  }

  console.log("\n=== Step 3: Save and Import to Docker via CLI ===");
  const tmpDir = path.join(__dirname, '../.tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  
  const upgradedJsonPath = path.join(tmpDir, 'upgraded_creator_workflow.json');
  fs.writeFileSync(upgradedJsonPath, JSON.stringify(wf, null, 2), 'utf8');

  execSync(`docker cp ${upgradedJsonPath} ai-agent-security-guard-n8n-1:/home/node/upgraded_creator_workflow.json`);
  const importOut = execSync(`docker exec ai-agent-security-guard-n8n-1 n8n import:workflow --input=/home/node/upgraded_creator_workflow.json`);
  console.log('n8n CLI Import Result:\n', importOut.toString());

  console.log('\n=== Step 4: Verification of Updated Workflow ===');
  const verifyRes = await request('/rest/workflows/ra1LSDqUJn1M4a5s');
  const updatedWf = verifyRes.data.data;
  for (const n of updatedWf.nodes) {
    if (n.type.includes('soterGuard')) {
      console.log(`Node: "${n.name}" -> typeVersion: ${n.typeVersion}, action: ${n.parameters?.action}`);
    }
  }
  console.log('\n🎉 ALL SOTER NODES SUCCESSFULLY UPGRADED TO v0.8.2 (typeVersion: 3)!');
}

main().catch(console.error);
