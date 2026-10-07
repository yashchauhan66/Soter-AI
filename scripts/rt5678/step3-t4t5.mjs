import { request } from './helpers.mjs';
const relog = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
if (relog.status !== 200) throw new Error('Login failed for T4/T5');

import { loadState, runAdHoc, firstVerdict, engineOf, verdictOf, INPUT_V3 } from './helpers.mjs';

// T4 + T5 on isolated ad-hoc workflows with the exact saved config.
const st = loadState();
const CREF = st.CREF;
const out = [];

const leaky = 'Here is your key: AKIAIOSFODNN7EXAMPLE and secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
const wf4 = {
  name: 'soter-t4',
  nodes: [
    { parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { text: ' + JSON.stringify(leaky) + ' } }];' }, id: 'n1', name: 'MakeLeak', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0] },
    { parameters: { operation: 'outputGuard', outputText: '={{ $json.text }}', onThreat: 'REDACT', sensitivity: 'BALANCED', options: { detectionEngine: 'AUTO' } }, id: 'n2', name: 'Verify Output for Safety', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0], credentials: CREF },
  ],
  connections: { MakeLeak: { main: [[{ node: 'Verify Output for Safety', type: 'main', index: 0 }]] } },
  settings: { executionOrder: 'v1' },
};
try {
  const r4 = await runAdHoc(wf4, 'Verify Output for Safety');
  const v4 = firstVerdict(r4.runData, 'Verify Output for Safety');
  const txt = JSON.stringify((v4 && (v4.safeText || v4.redactedText || v4.outputText)) || v4 || {});
  const leaked = txt.includes('AKIAIOSFODNN7EXAMPLE');
  out.push({ name: 'T4 output redacts secret', pass: !leaked && r4.status !== 'error' && !!v4, detail: 'verdict=' + verdictOf(v4) + ' engine=' + engineOf(v4) + ' leaked=' + leaked, raw: v4 });
} catch (e) {
  out.push({ name: 'T4 output redacts secret', pass: false, detail: 'error ' + e.message });
}

const batch = ['How do I reset my password?', 'Where can I download my invoice?', 'The CSV export button shows a 500 error?', 'How do I enable SSO for my team?', 'Can I change the account owner email?', 'My API returns 401 after regenerating the key', 'Do you support two-factor auth?', 'How do I upgrade to enterprise plan?'];
let fp = 0;
let errs = 0;
let cloud = 0;
for (const text of batch) {
  const p = JSON.parse(JSON.stringify(INPUT_V3));
  p.inputText = '={{ $json.text }}';
  delete p.options.sessionId;
  // Feeder Code node supplies {{ $json.text }} — verified: without it the guard
  // sees EMPTY_INPUT (engine=none); with it we get real cloud verdicts.
  const wb = {
    name: 't5',
    nodes: [
      { parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { text: ' + JSON.stringify(text) + ' } }];' }, id: 'n0', name: 'FeedText', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0] },
      { parameters: p, id: 'n1', name: 'Guard Input for Threats', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0], credentials: CREF },
    ],
    connections: { FeedText: { main: [[{ node: 'Guard Input for Threats', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' },
  };
  try {
    const rr = await runAdHoc(wb, 'Guard Input for Threats');
    const vv = firstVerdict(rr.runData, 'Guard Input for Threats');
    // A verdict whose engine is "none" with EMPTY_INPUT means the feed didn't bind — count as error, not clean
    if (!vv || (vv.engine === 'none' && vv.verdictCode === 'EMPTY_INPUT')) { errs++; continue; }
    if (engineOf(vv).toLowerCase().includes('cloud')) cloud++;
    if (verdictOf(vv).includes('BLOCK')) fp++;
  } catch { errs++; }
}
out.push({ name: 'T5 battery 8 benign', pass: fp === 0 && errs === 0, detail: 'FP=' + fp + ' errs=' + errs + ' cloud=' + cloud + '/8' });

for (const r of out) console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + ' :: ' + r.detail);
const fs = await import('node:fs');
const path = await import('node:path');
const prev = st.results || [];
st.results = prev.concat(out);
fs.writeFileSync(path.resolve('.tmp/rt5678-state.json'), JSON.stringify(st), 'utf8');
console.log('T4-T5 SAVED');
