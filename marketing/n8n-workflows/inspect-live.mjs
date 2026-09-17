import { login, api, WF_ID } from './ultra-common.mjs';

const cookie = await login();
const wf = await api(cookie, `/rest/workflows/${WF_ID}`);
const d = wf.data?.data;
console.log('NAME:', d.name, '| active:', d.active);
for (const n of d.nodes ?? []) {
  console.log('\n###', n.name, '|', n.type, '| v' + n.typeVersion, '| creds:', JSON.stringify(n.credentials ?? {}));
  console.log(JSON.stringify(n.parameters ?? {}).slice(0, 900));
}

// inspect a few error executions of THIS workflow
const ex = await api(cookie, '/rest/executions?limit=20');
const raw = ex.data?.data ?? ex.data ?? {};
const items = Array.isArray(raw) ? raw : (raw.results ?? raw.executions ?? []);
const mine = items.filter((e) => String(e.workflowId) === WF_ID).slice(0, 3);
console.log('\n=== MY-WF EXECS ===', mine.map((e) => e.id + ':' + e.status).join(' '));
for (const e of mine) {
  const det = await api(cookie, `/rest/executions/${e.id}`);
  const dd = det.data?.data ?? det.data ?? {};
  const rd = dd.data?.resultData ?? {};
  console.log('\n--- exec', e.id, 'finished:', dd.finished);
  if (rd.error) console.log('EXEC ERROR:', JSON.stringify(rd.error).slice(0, 900));
  const runs = rd.runData ?? {};
  for (const name of Object.keys(runs)) {
    const task = runs[name]?.[0];
    if (task?.error) console.log('  [ERROR]', name, '->', String(task.error.message ?? JSON.stringify(task.error)).slice(0, 400));
    else {
      const outs = task?.data?.main ?? [];
      console.log('  [ok]', name, 'outputs:', outs.length, JSON.stringify(outs)?.slice(0, 200));
    }
  }
}

