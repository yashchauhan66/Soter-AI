const BASE = 'http://localhost:5678';
const CRED_ID = 'jp7mO4AKCUhn0TY2';
let cookies = '';

async function req(path, opts={}) {
  const h = {...(opts.headers||{})};
  if (cookies) h.cookie = cookies;
  if (opts.body && typeof opts.body === 'object') { h['content-type']='application/json'; opts.body=JSON.stringify(opts.body); }
  const res = await fetch(BASE+path, {...opts, headers:h});
  const sc = res.headers.get('set-cookie');
  if (sc) cookies = sc.split(',').map(c=>c.split(';')[0].trim()).join('; ');
  const txt = await res.text();
  let data; try { data = txt ? JSON.parse(txt) : {}; } catch { data = {raw:txt}; }
  return {status:res.status, data};
}

async function main() {
  const login = await req('/rest/login', {method:'POST', body:{emailOrLdapLoginId:'admin@example.com',password:'Password123!'}});
  console.log('Login:', login.status);
  
  const body = {
    name: 'dbg-outguard-'+Date.now(),
    active: false,
    nodes: [
      {id:'inj', name:'Inject', type:'n8n-nodes-base.code', typeVersion:2, position:[0,0],
       parameters:{mode:'runOnceForAllItems', jsCode:'return [{json:{text:"AWS Key AKIAIOSFODNN7EXAMPLE and email test@test.com"}}];'}},
      {id:'og', name:'OutputGuard', type:'n8n-nodes-soterai.soterGuard', typeVersion:3, position:[200,0],
       parameters:{operation:'outputGuard', outputText:'={{ .text }}', onThreat:'REDACT', sensitivity:'BALANCED', options:{detectionEngine:'AUTO'}},
       credentials:{soterApi:{id:CRED_ID, name:'SoterAI Production Cloud'}}},
    ],
    connections:{Inject:{main:[[{node:'OutputGuard',type:'main',index:0}]]}},
    settings:{executionOrder:'v1'},
  };
  
  const cr = await req('/rest/workflows', {method:'POST', body});
  console.log('Create:', cr.status, 'ID:', cr.data?.data?.id);
  const twId = cr.data?.data?.id;
  if (!twId) { console.error('Create failed:', JSON.stringify(cr.data).slice(0,300)); return; }
  
  const rr = await req('/rest/workflows/'+twId+'/run', {method:'POST', body:{workflowData:cr.data?.data, runData:{}}});
  console.log('Run:', rr.status, 'execId:', rr.data?.data?.executionId);
  const execId = rr.data?.data?.executionId;
  if (!execId) { console.error('Run failed:', JSON.stringify(rr.data).slice(0,300)); await req('/rest/workflows/'+twId, {method:'DELETE'}); return; }
  
  await new Promise(r=>setTimeout(r, 8000));
  const poll = await req('/rest/executions/'+execId);
  console.log('Exec status:', poll.data?.data?.status, 'finished:', poll.data?.data?.finished);
  const rd = poll.data?.data?.data?.resultData?.runData;
  console.log('runData keys:', Object.keys(rd||{}));
  if (rd) {
    for (const [k,v] of Object.entries(rd)) {
      const item0 = v?.[0]?.data?.main?.[0]?.[0]?.json;
      const item1 = v?.[0]?.data?.main?.[1]?.[0]?.json;
      console.log('NODE:', k);
      if (item0) console.log('  Safe(0):', JSON.stringify(item0).slice(0,200));
      if (item1) console.log('  Flagged(1):', JSON.stringify(item1).slice(0,200));
    }
  }
  
  await req('/rest/workflows/'+twId, {method:'DELETE'});
  console.log('Done.');
}
main().catch(e => console.error('FATAL:', e.message));
