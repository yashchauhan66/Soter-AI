import { execSync } from 'node:child_process';

try {
  const out = execSync("docker exec ai-agent-security-guard-n8n-1 sqlite3 /home/node/.n8n/database.sqlite \"SELECT id, email, password FROM user;\"", { encoding: 'utf8' });
  console.log("SQLITE OUT:", out);
} catch (e) {
  console.error("ERR:", e.message);
  // try finding sqlite CLI or using n8n module
  try {
    const out2 = execSync("docker exec ai-agent-security-guard-n8n-1 /usr/local/lib/node_modules/n8n/node_modules/.bin/sqlite3 /home/node/.n8n/database.sqlite \"SELECT id, email FROM user;\"", { encoding: 'utf8' });
    console.log("SQLITE2:", out2);
  } catch (e2) {
    console.error("ERR2:", e2.message);
  }
}
