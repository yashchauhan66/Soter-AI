import fs from 'node:fs';
import path from 'node:path';

const N8N_URL = 'http://localhost:5678';
let cookies = '';

async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookies) headers['cookie'] = cookies;
  if (options.body && typeof options.body === 'object') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${N8N_URL}${urlPath}`, { ...options, headers });
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

async function login() {
  const res = await request('/rest/login', {
    method: 'POST',
    body: {
      emailOrLdapLoginId: 'admin@example.com',
      password: 'Password1234!'
    }
  });
  if (res.status !== 200) throw new Error('Login failed: ' + JSON.stringify(res.data));
  console.log('✅ Authenticated successfully to n8n');
}

/**
 * Executes a single ad-hoc node or workflow configuration and captures full execution details.
 */
async function executeWorkflow(workflowObj, destinationNodeName) {
  const createRes = await request('/rest/workflows', {
    method: 'POST',
    body: workflowObj
  });
  const wf = createRes.data?.data;
  if (!wf?.id) throw new Error('Failed to create workflow: ' + JSON.stringify(createRes.data));

  const start = Date.now();
  const runRes = await request(`/rest/workflows/${wf.id}/run`, {
    method: 'POST',
    body: {
      workflowData: wf,
      destinationNode: { nodeName: destinationNodeName, mode: 'inclusive' }
    }
  });

  const executionId = runRes.data?.data?.executionId;
  if (!executionId) {
    // Delete workflow
    await request(`/rest/workflows/${wf.id}`, { method: 'DELETE' });
    throw new Error('Run failed: ' + JSON.stringify(runRes.data));
  }

  // Poll
  let execData;
  for (let attempt = 1; attempt <= 40; attempt++) {
    await new Promise(r => setTimeout(r, 600));
    const poll = await request(`/rest/executions/${executionId}`);
    execData = poll.data?.data;
    if (execData?.finished || execData?.status === 'success' || execData?.status === 'error') break;
  }

  const duration = Date.now() - start;

  // Cleanup workflow
  try {
    await request(`/rest/workflows/${wf.id}`, { method: 'DELETE' });
  } catch {}

  let resultData = execData?.data?.resultData;
  if (!resultData && typeof execData?.data === 'string') {
    try {
      const { parse } = await import('flatted');
      resultData = parse(execData.data).resultData;
    } catch {}
  }

  return {
    executionId,
    status: execData?.status,
    finished: execData?.finished,
    durationMs: duration,
    runData: resultData?.runData || {},
    error: resultData?.error
  };
}

export { login, request, executeWorkflow };
