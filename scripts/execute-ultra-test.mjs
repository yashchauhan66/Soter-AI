import fs from 'node:fs';
import path from 'node:path';
import { buildWorkflow } from './generate-ultra-workflow.mjs';

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
  console.log('=== Step 1: Owner Setup & Login ===');
  const setupRes = await request('/rest/owner/setup', {
    method: 'POST',
    body: {
      email: 'admin@soterai.local',
      firstName: 'Admin',
      lastName: 'Soter',
      password: 'Password1234!'
    }
  });
  console.log('Owner setup status:', setupRes.status);

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
  console.log('Login successful! User ID:', loginRes.data.data?.user?.id);

  console.log('\n=== Step 2: Create SoterAI API Credential ===');
  const credRes = await request('/rest/credentials', {
    method: 'POST',
    body: {
      name: 'SoterAI API Live v081',
      type: 'soterApi',
      data: {
        apiKey: 'soter_live_test_key_v081',
        baseUrl: 'http://host.docker.internal:3000',
        projectId: 'proj_live_v081'
      }
    }
  });
  const credId = credRes.data.data?.id;
  console.log('Created Credential ID:', credId);

  console.log('\n=== Step 3: Prepare & Import Master Ultra Workflow ===');
  const wfObj = buildWorkflow(credId);
  const outWfPath = path.resolve('workflows', 'soterai-v081-ultra-master.workflow.json');
  fs.writeFileSync(outWfPath, JSON.stringify(wfObj, null, 2), 'utf8');

  const createWfRes = await request('/rest/workflows', {
    method: 'POST',
    body: wfObj
  });
  const workflowId = createWfRes.data.data?.id;
  console.log('Created Workflow in n8n:', createWfRes.data.data?.name, `(ID: ${workflowId})`);

  console.log('\n=== Step 4: Trigger Live Execution ===');
  const runPayload = {
    workflowData: createWfRes.data.data,
    destinationNode: {
      nodeName: 'Ultra Test Audit Scorecard',
      mode: 'inclusive'
    }
  };

  const runRes = await request(`/rest/workflows/${workflowId}/run`, {
    method: 'POST',
    body: runPayload
  });
  const executionId = runRes.data.data?.executionId;
  console.log('Execution started with ID:', executionId);

  console.log('\n=== Step 5: Wait for Execution to Complete ===');
  let execution;
  for (let attempt = 1; attempt <= 30; attempt++) {
    await new Promise(r => setTimeout(r, 1000));
    const pollRes = await request(`/rest/executions/${executionId}`);
    execution = pollRes.data.data;
    console.log(`Poll ${attempt}: status = ${execution?.status}, finished = ${execution?.finished}`);
    if (execution?.finished || execution?.status === 'success' || execution?.status === 'error') {
      break;
    }
  }

  console.log('\n=== Step 6: Detailed Verification for All 12 Actions ===');
  const runData = execution?.data?.resultData?.runData || {};
  const executedNodes = Object.keys(runData);
  console.log(`Total executed nodes in execution: ${executedNodes.length}`);

  if (execution?.status === 'error') {
    const error = execution?.data?.resultData?.error;
    console.error('Execution encountered error:', error?.message || error);
  }

  const report = [];

  for (const nodeName of executedNodes) {
    const nodeRuns = runData[nodeName];
    const firstRun = nodeRuns[0];
    const outMain = firstRun?.data?.main || [];
    const safeItems = outMain[0] || [];
    const flaggedItems = outMain[1] || [];

    const item = (safeItems[0] || flaggedItems[0])?.json || {};
    const routedTo = flaggedItems.length > 0 ? 'Flagged (Branch 1)' : safeItems.length > 0 ? 'Safe (Branch 0)' : 'None';

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
      userMessage: item.userMessage,
      safeTextPreview: item.safeText ? item.safeText.slice(0, 50) + '...' : undefined,
      outputTextPreview: item.outputText ? String(item.outputText).slice(0, 50) + '...' : undefined
    });
  }

  console.table(report);

  // Save full execution artifact for inspection
  const artifactPath = path.resolve('.tmp', 'n8n-v081-live', 'live-execution-result.json');
  fs.writeFileSync(artifactPath, JSON.stringify(execution, null, 2), 'utf8');
  console.log(`\nFull execution data written to: ${artifactPath}`);

  return { workflowId, executionId, report };
}

main().catch(err => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
