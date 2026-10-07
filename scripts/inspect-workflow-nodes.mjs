import fs from 'node:fs';

async function main() {
  const loginRes = await fetch('http://localhost:5678/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(',').map(c => c.split(';')[0].trim()).join('; ');
  const res = await fetch('http://localhost:5678/rest/workflows/ra1LSDqUJn1M4a5s', { headers: { cookie } });
  const json = await res.json();
  const wf = json.data;

  console.log('Workflow Name:', wf.name);
  console.log('Total nodes:', wf.nodes.length);
  console.log('--- NODES LIST ---');
  wf.nodes.forEach((n, i) => {
    console.log(`${i + 1}. [${n.name}] type: ${n.type} pos: [${n.position}]`);
    if (n.type.includes('stickyNote')) {
      console.log('   Content:\n', n.parameters.content);
      console.log('   Dimensions:', n.parameters.width, 'x', n.parameters.height);
    }
  });
}

main().catch(console.error);
