import { login, api, WF_ID } from './ultra-common.mjs';
const cookie = await login();
const ex = await api(cookie, '/rest/executions?limit=10');
const raw = ex.data?.data ?? ex.data ?? {};
const items = Array.isArray(raw) ? raw : (raw.results ?? raw.executions ?? []);
console.log('TOTAL execs:', items.length);
for (const e of items.slice(0,5)) {
  console.log('\n==== EXEC', e.id, 'wf=', e.workflowId, 'status=', e.status, 'mode=', e.mode, 'started=', e.startedAt);
  const det = await api(cookie, `/rest/executions/${e.id}`);
  const dd = det.data?.data ?? det.data ?? {};
  console.log('finished:', dd.finished, 'stoppedAt:', dd.stoppedAt);
  const rd = dd.data?.resultData ?? {};
  if (rd.error) console.log('RESULT ERROR:', JSON.stringify(rd.error).slice(0,2000));
  if (rd.lastNodeExecuted) console.log('lastNode:', rd.lastNodeExecuted);
  const runs = rd.runData ?? {};
  const names = Object.keys(runs);
  console.log('nodes ran:', names.join(', ') || '(none)');
  for (const name of names) {
    const tasks = runs[name] ?? [];
    for (let i=0;i<tasks.length;i++) {
      const t = tasks[i];
      if (t.error) console.log(`  [ERR] ${name}[${i}]:`, JSON.stringify(t.error).slice(0,1500));
      else {
        const out = t.data?.main?.[0]?.[0]?.json;
        console.log(`  [OK] ${name}[${i}]:`, JSON.stringify(out).slice(0,500));
      }
    }
  }
}
