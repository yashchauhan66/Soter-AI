import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';

const CONTAINER = 'ai-agent-security-guard-n8n-1';
const CRED_ID = 'jp7mO4AKCUhn0TY2';

// 1. Export
execSync(`docker exec ${CONTAINER} n8n export:credentials --id=${CRED_ID} --decrypted --output=/home/node/cred-export.json`);
execSync(`docker cp ${CONTAINER}:/home/node/cred-export.json .tmp_cred.json`);

// 2. Modify
const exported = JSON.parse(readFileSync('.tmp_cred.json', 'utf8'));
const cred = Array.isArray(exported) ? exported[0] : exported;
cred.data.baseUrl = 'http://host.docker.internal:3000';
writeFileSync('.tmp_cred.json', JSON.stringify([cred], null, 2));

// 3. Import
execSync(`docker cp .tmp_cred.json ${CONTAINER}:/home/node/cred-import.json`);
const out = execSync(`docker exec ${CONTAINER} n8n import:credentials --input=/home/node/cred-import.json`, { encoding: 'utf8' });
console.log('Import output:\n', out);
console.log('✅ Credential updated to baseUrl: http://host.docker.internal:3000');
