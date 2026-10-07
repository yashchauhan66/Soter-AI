import fs from 'node:fs';
import path from 'node:path';

export const BASE = 'http://localhost:5678';
export const LIVE_KEY = 'ck_live_StixoRmSwRXeJrW7Y9VA5LlmAbfUhZ06';
export const LIVE_BASE = 'https://soterai.in';
export const SNAPSHOT = '.tmp_wf.json';
export const STATE = '.tmp/rt5678-state.json';

let cookieJar = '';
export async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookieJar) headers.cookie = cookieJar;
  if (options.body && typeof options.body === 'object') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(BASE + urlPath, { ...options, headers });
  // undici: use getSetCookie() (one entry per cookie). Fallback to single header.
  const jar = [];
  try {
    const arr = res.headers.getSetCookie ? res.headers.getSetCookie() : null;
    if (arr && arr.length) {
      for (const c of arr) jar.push(String(c).split(';')[0].trim());
    } else {
      const sc = res.headers.get('set-cookie');
      if (sc) jar.push(...sc.split(/,(?=[^;,]+=[^;,]*;)/).map((c) => c.split(';')[0].trim()));
    }
  } catch { /* keep old jar */ }
  if (jar.length) cookieJar = jar.join('; ');
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data };
}

export function branch(runData, nodeName, index) {
  const e = runData && runData[nodeName];
  if (!e || !e[0]) return { items: [] };
  const out = e[0].data && e[0].data.main;
  if (!out || !out[index]) return { items: [] };
  return { items: out[index].map((i) => i.json) };
}

export function firstVerdict(runData, nodeName) {
  const s = branch(runData, nodeName, 0);
  if (s.items.length) return { ...s.items[0], branch: 'Safe(0)' };
  const f = branch(runData, nodeName, 1);
  if (f.items.length) return { ...f.items[0], branch: 'Flagged(1)' };
  return null;
}

export async function waitExecution(executionId, tries = 90) {
  let execData;
  for (let a = 1; a <= tries; a++) {
    await new Promise((r) => setTimeout(r, 800));
    const poll = await request('/rest/executions/' + executionId);
    execData = poll.data && poll.data.data;
    if (execData && (execData.finished || execData.status === 'success' || execData.status === 'error')) break;
  }
  // n8n 2.x returns execution payload as a FLATTED string, not plain JSON.
  // Parse it; fall back to plain object shape for older payloads.
  let rd = {};
  let err = null;
  try {
    const raw = execData && execData.data;
    if (typeof raw === 'string') {
      const { parse } = await import('flatted');
      const root = parse(raw);
      const holder = Array.isArray(root) ? root.find((x) => x && x.resultData) : root;
      rd = (holder && holder.resultData && holder.resultData.runData) || {};
      err = (holder && holder.resultData && holder.resultData.error) || null;
    } else if (raw && raw.resultData) {
      rd = raw.resultData.runData || {};
      err = raw.resultData.error || null;
    }
  } catch (e) {
    err = { message: 'runData parse failed: ' + e.message };
  }
  return { status: execData && execData.status, runData: rd, error: err };
}

export async function runAdHoc(wfObj, destNode, pinData = null) {
  const create = await request('/rest/workflows', { method: 'POST', body: wfObj });
  const twf = create.data && create.data.data;
  if (!twf || !twf.id) throw new Error('Create failed: ' + JSON.stringify(create.data).slice(0, 300));
  try {
    // pinData lets single-node ad-hoc workflows receive real input without a
    // feeder node (n8n expressions like {{ $json.text }} resolve against it).
    const body = { workflowData: { ...twf }, runData: {}, destinationNode: { nodeName: destNode, mode: 'inclusive' } };
    if (pinData) body.workflowData.pinData = pinData;
    const rr = await request('/rest/workflows/' + twf.id + '/run', {
      method: 'POST',
      body,
    });
    const eid = rr.data && rr.data.data && rr.data.data.executionId;
    if (!eid) throw new Error('Run failed: ' + JSON.stringify(rr.data).slice(0, 300));
    return await waitExecution(eid);
  } finally {
    await request('/rest/workflows/' + twf.id, { method: 'DELETE' }).catch(() => {});
  }
}

export const INPUT_V3 = {
  operation: 'inputGuard',
  inputText: '={{ $json.chatInput }}',
  onThreat: 'BLOCK',
  sensitivity: 'BALANCED',
  options: {
    detectionEngine: 'AUTO',
    allowedTopics: 'billing, account number subscriptions, invoices, sso login, api errors, csv export, bug reports, feature requests, account help',
    systemPromptContext: 'You are AcmeCloud SaaS support for billing, login, API, exports, bug reports and account help.',
    sessionId: '={{ $json.sessionId }}',
  },
};

export const OUTPUT_V3 = {
  operation: 'outputGuard',
  outputText: '={{ $json.text }}',
  onThreat: 'REDACT',
  sensitivity: 'BALANCED',
  options: { detectionEngine: 'AUTO' },
};

export function saveState(s) {
  fs.mkdirSync(path.resolve('.tmp'), { recursive: true });
  fs.writeFileSync(path.resolve(STATE), JSON.stringify(s), 'utf8');
}
export function loadState() {
  return JSON.parse(fs.readFileSync(path.resolve(STATE), 'utf8'));
}
export const engineOf = (v) => String((v && (v.engine || v.detectionEngine || v.engineUsed || (v.rawResponse && (v.rawResponse.engine || v.rawResponse.engineUsed)))) || 'unknown');
export const verdictOf = (v) => String((v && (v.verdictCode || v.action || v.rawAction)) || '');
