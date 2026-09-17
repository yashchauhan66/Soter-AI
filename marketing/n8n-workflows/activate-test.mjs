import { login, api } from './ultra-common.mjs';
const WF = 'tPx0UyZaEqcay8cA';
const cookie = await login();

// 1. Activate ultra workflow (live UI me Active toggle ON dikhega)
const wf0 = await api(cookie, `/rest/workflows/${WF}`);
const act = await api(cookie, `/rest/workflows/${WF}/activate`, { method: 'POST', body: JSON.stringify({ versionId: wf0.data.data.versionId }) });
console.log('ACTIVATE', act.status, JSON.stringify(act.data).slice(0, 300));

// 2. Trigger a MANUAL execution so UI > Executions me live test dikhe
// chatTrigger manual run needs sessionId+chatInput via startNodes? Use workflow run endpoint.
const run = await api(cookie, `/rest/workflows/${WF}/run`, { method: 'POST', body: JSON.stringify({}) });
console.log('RUN', run.status, JSON.stringify(run.data).slice(0, 800));

// 3. Poll executions
await new Promise((r) => setTimeout(r, 12000));
const ex = await api(cookie, '/rest/executions?limit=3');
console.log('EXEC LIST', JSON.stringify(ex.data).slice(0, 1000));
