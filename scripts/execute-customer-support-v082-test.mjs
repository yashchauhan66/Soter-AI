import fs from 'node:fs';
import path from 'node:path';
import { buildCustomerSupportV082Workflow } from './generate-customer-support-v082-workflow.mjs';

const BASE = 'http://localhost:5678';
let cookies = '';

async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookies) headers['cookie'] = cookies;
  if (options.body && typeof options.body === 'object') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE}${urlPath}`, { ...options, headers });
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
  console.log('========================================================================');
  console.log('🚀 SoterAI v0.8.2 Ultra Best Customer Support System — Live Docker Execution');
  console.log('========================================================================\n');

  console.log('=== Step 1: Authentication & Session Verification ===');
  const loginRes = await request('/rest/login', {
    method: 'POST',
    body: {
      emailOrLdapLoginId: 'admin@soterai.local',
      password: 'Password1234!'
    }
  });
  if (loginRes.status !== 200) {
    throw new Error('Login failed: ' + JSON.stringify(loginRes.data));
  }
  console.log('✅ Logged in successfully as:', loginRes.data.data?.user?.email || 'admin@soterai.local');

  console.log('\n=== Step 2: SoterAI API Credential Check ===');
  const credsRes = await request('/rest/credentials');
  let credId = credsRes.data.data?.find(c => c.type === 'soterApi')?.id;

  if (!credId) {
    console.log('Creating SoterAI credential...');
    const credRes = await request('/rest/credentials', {
      method: 'POST',
      body: {
        name: 'SoterAI Live API v082',
        type: 'soterApi',
        data: {
          apiKey: 'soter_live_test_key_v082',
          baseUrl: 'http://host.docker.internal:3000',
          projectId: 'proj_support_v082'
        }
      }
    });
    credId = credRes.data.data?.id;
  }
  console.log('✅ Active Credential ID:', credId);

  console.log('\n=== Step 3: Generate & Deploy Customer Support Workflow ===');
  const wfObj = buildCustomerSupportV082Workflow(credId);
  const outWfPath = path.resolve('workflows', 'soterai-v082-customer-support.workflow.json');
  fs.mkdirSync(path.dirname(outWfPath), { recursive: true });
  fs.writeFileSync(outWfPath, JSON.stringify(wfObj, null, 2), 'utf8');

  const createWfRes = await request('/rest/workflows', {
    method: 'POST',
    body: wfObj
  });
  const workflowId = createWfRes.data.data?.id;
  if (!workflowId) {
    throw new Error('Failed to create workflow: ' + JSON.stringify(createWfRes.data));
  }
  console.log(`✅ Deployed Workflow: "${createWfRes.data.data?.name}" (ID: ${workflowId})`);

  console.log('\n=== Step 4: Trigger Live Execution ===');
  const runPayload = {
    workflowData: createWfRes.data.data,
    destinationNode: {
      nodeName: '14. Customer Support Security Scorecard',
      mode: 'inclusive'
    }
  };

  const runRes = await request(`/rest/workflows/${workflowId}/run`, {
    method: 'POST',
    body: runPayload
  });
  const executionId = runRes.data.data?.executionId;
  if (!executionId) {
    throw new Error('Failed to start execution: ' + JSON.stringify(runRes.data));
  }
  console.log(`✅ Execution started with ID: ${executionId}`);

  console.log('\n=== Step 5: Polling Execution Completion ===');
  let execution;
  for (let attempt = 1; attempt <= 30; attempt++) {
    await new Promise(r => setTimeout(r, 800));
    const pollRes = await request(`/rest/executions/${executionId}`);
    execution = pollRes.data.data;
    console.log(`  Poll ${attempt}: status = ${execution?.status}, finished = ${execution?.finished}`);
    if (execution?.finished || execution?.status === 'success' || execution?.status === 'error') {
      break;
    }
  }

  console.log('\n=== Step 6: Detailed Node Execution Breakdown ===');
  let resultData = execution?.data?.resultData;
  if (!resultData && typeof execution?.data === 'string') {
    try {
      const { parse } = await import('flatted');
      const parsed = parse(execution.data);
      resultData = parsed.resultData;
    } catch (e) {
      console.error('Failed to parse flatted data:', e);
    }
  }

  const runData = resultData?.runData || {};
  const executedNodes = Object.keys(runData);
  console.log(`Total executed nodes in execution: ${executedNodes.length} / 15`);

  if (execution?.status === 'error') {
    const error = resultData?.error;
    console.error('⚠️ Execution encountered error:', error?.message || error);
  }

  const report = [];

  for (const nodeName of executedNodes) {
    const nodeRuns = runData[nodeName];
    const firstRun = nodeRuns[0];
    const outMain = firstRun?.data?.main || [];
    const safeItems = outMain[0] || [];
    const flaggedItems = outMain[1] || [];

    const item = (flaggedItems[0] || safeItems[0])?.json || {};
    const routedTo = flaggedItems.length > 0 ? 'Flagged/Redacted (Branch 1)' : safeItems.length > 0 ? 'Safe (Branch 0)' : 'None';

    report.push({
      nodeName,
      status: firstRun?.executionStatus || 'success',
      executionTimeMs: firstRun?.executionTime,
      routedTo,
      operation: item.operation || 'n/a',
      engine: item.engine || item.detectionEngine || 'n/a',
      allowed: item.allowed,
      blocked: item.blocked,
      riskScore: item.riskScore,
      action: item.action || item.decision || item.verdictCode,
      userMessage: item.userMessage ? item.userMessage.slice(0, 40) + '...' : undefined
    });
  }

  console.table(report);

  const scorecardData = runData['14. Customer Support Security Scorecard']?.[0]?.data?.main?.[0]?.[0]?.json;
  console.log('\n=== Step 7: Scorecard Audit Summary ===');
  console.log(JSON.stringify(scorecardData, null, 2));

  // Save full execution artifact
  const outDir = path.resolve('.tmp', 'n8n-v082-live');
  fs.mkdirSync(outDir, { recursive: true });
  const artifactPath = path.join(outDir, 'live-customer-support-v082-result.json');
  fs.writeFileSync(artifactPath, JSON.stringify({
    workflowId,
    executionId,
    scorecard: scorecardData,
    nodesExecuted: executedNodes.length,
    execution
  }, null, 2), 'utf8');

  console.log(`\n✅ Full execution artifact saved to: ${artifactPath}`);

  return { workflowId, executionId, scorecardData };
}

main().catch(err => {
  console.error('❌ Execution Error:', err);
  process.exit(1);
});
