const BASE='http://localhost:5678';
const wfId='zC0IhnQkfnj0gPlU';
const lr=await fetch(BASE+'/rest/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emailOrLdapLoginId:'admin@soterai.in',password:'Soterai123!'})});
const ck=lr.headers.get('set-cookie').split(';')[0];
const gw=await fetch(BASE+'/rest/workflows/'+wfId,{headers:{Cookie:ck}});
const gj=await gw.json();
const d=gj.data;
d.nodes.forEach(n=>console.log(n.name,'| creds=',JSON.stringify(n.credentials||null).slice(0,300),'| params=',JSON.stringify(n.parameters).slice(0,400)));
