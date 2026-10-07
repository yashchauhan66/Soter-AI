const BASE    = 'http://localhost:5678';
let cookies   = '';

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
  if (login.status!==200) throw new Error('Login failed');
  
  // Get recent executions 
  const execs = await req('/rest/executions?limit=10&includeData=false');
  const execList = execs.data?.data?.results || [];
  console.log('Recent executions count:', execList.length);
  
  // Find executions for our workflow
  for (const e of execList) {
    if (e.workflowId === 'ra1LSDqUJn1M4a5s' || e.workflowData?.name?.includes('Helpdesk')) {
      console.log('  Exec #'+e.id+': '+e.status+' | '+e.startedAt+' | '+e.workflowData?.name?.slice(0,50));
    }
  }
  
  // Get the most recent execution data to check engine field
  if (execList.length > 0) {
    const latestId = execList[0].id;
    const execDetail = await req('/rest/executions/'+latestId);
    const exec = execDetail.data?.data;
    console.log('\nLatest exec ID:', latestId);
    console.log('Status:', exec?.status);
    console.log('Workflow:', exec?.workflowData?.name?.slice(0,60));
    
    let rd = exec?.data?.resultData?.runData;
    if (!rd && typeof exec?.data==='string') {
      try { const {parse} = await import('flatted'); rd=parse(exec.data)?.resultData?.runData; } catch {}
    }
    
    if (rd) {
      for (const [k,v] of Object.entries(rd)) {
        const item0 = v?.[0]?.data?.main?.[0]?.[0]?.json;
        const item1 = v?.[0]?.data?.main?.[1]?.[0]?.json;
        const item = item0 || item1;
        if (item?.engine || item?.verdictCode) {
          console.log('  Node "'+k+'": engine='+item.engine+' verdict='+item.verdictCode+' risk='+item.riskScore+' branch='+(item0?'Safe':'Flagged'));
        }
      }
    }
  }
}
main().catch(e=>console.error('ERR:',e.message));
