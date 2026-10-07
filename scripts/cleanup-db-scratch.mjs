import { execSync } from 'node:child_process';

const code = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
const del = db.prepare(\`
  DELETE FROM workflow_entity 
  WHERE name LIKE 'test-%' 
     OR name LIKE 'exhaustive-%' 
     OR name LIKE 'QA Test%' 
     OR name LIKE 'Pipeline Test%' 
     OR name LIKE 'Concurrent Test%' 
     OR name LIKE 'Investigate%' 
     OR name LIKE 'Hindi Local Test%'
     OR name LIKE 'soter-%' 
     OR name LIKE 'fp-test%' 
     OR name LIKE '%(test copy)%' 
     OR name LIKE '%(cloud-test)%' 
     OR name LIKE '%(t5-dlp-test)%'
     OR name LIKE '%(t5-dlp)%'
     OR name LIKE '%(t7-hindi)%'
     OR name in ('tcopy', 'probe', 't5', 't5probe', 't5one', 't5dbg', 'dlp-test', 'Patched Test')
\`);
const res = del.run();
console.log('Cleaned temp workflows:', res.changes);
const remaining = db.prepare('SELECT id, name FROM workflow_entity').all();
console.log('Workflows remaining in DB:');
for (const w of remaining) {
  console.log('  -', w.id, ':', w.name);
}
db.close();
`;

execSync(`docker exec ai-agent-security-guard-n8n-1 node -e "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { stdio: 'inherit' });
