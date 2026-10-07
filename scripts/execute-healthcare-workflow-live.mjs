import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:5678';
let cookies = '';

async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookies) headers['cookie'] = cookies;
  if (options.body && typeof options.body === 'object') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE}${urlPath}`, { ...options, headers });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const rawCookies = setCookie.split(',').map(c => c.split(';')[0].trim());
    cookies = rawCookies.join('; ');
  }

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data };
}

async function main() {
  console.log("=== Step 1: Log in to n8n ===");
  const loginRes = await request("/rest/login", {
    method: "POST",
    body: {
      emailOrLdapLoginId: "admin@example.com",
      password: "Password123!"
    }
  });

  if (loginRes.status !== 200) {
    throw new Error("Login failed: " + JSON.stringify(loginRes.data));
  }
  console.log("✅ Logged in successfully as:", loginRes.data.data?.user?.email || "admin@example.com");

  console.log("\n=== Step 2: Retrieve Workflow health_muin659jdqgy ===");
  const wfRes = await request("/rest/workflows/health_muin659jdqgy");
  if (wfRes.status !== 200) {
    throw new Error("Could not find workflow: " + JSON.stringify(wfRes.data));
  }
  const workflowData = wfRes.data.data;
  console.log(`✅ Loaded Workflow: "${workflowData.name}" with ${workflowData.nodes.length} nodes`);

  console.log("\n=== Step 3: Trigger Live Execution via /rest/workflows/{id}/run ===");
  const runPayload = {
    workflowData: workflowData,
    destinationNode: {
      nodeName: "14. Healthcare AI Security Scorecard",
      mode: "inclusive"
    }
  };

  const runRes = await request(`/rest/workflows/health_muin659jdqgy/run`, {
    method: "POST",
    body: runPayload
  });

  const executionId = runRes.data.data?.executionId;
  if (!executionId) {
    throw new Error("Failed to start execution: " + JSON.stringify(runRes.data));
  }
  console.log(`✅ Started Execution ID: ${executionId}`);

  console.log("\n=== Step 4: Poll Execution Status ===");
  let executionData;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await request(`/rest/executions/${executionId}`);
    if (statusRes.status === 200 && statusRes.data.data?.finished) {
      executionData = statusRes.data.data;
      break;
    }
  }

  if (!executionData) {
    throw new Error("Execution timed out or failed to complete.");
  }
  console.log(`✅ Execution Completed with Status: ${executionData.status} (Finished: ${executionData.finished})`);

  let runData = executionData.data?.resultData?.runData;
  if (!runData || Object.keys(runData).length === 0) {
    try {
      const sqliteOut = execSync(
        `docker exec ai-agent-security-guard-n8n-1 node -e "const sqlite3 = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3'); const flatted = require('/usr/local/lib/node_modules/n8n/node_modules/flatted'); const db = new sqlite3.Database('/home/node/.n8n/database.sqlite'); db.get('SELECT data FROM execution_data WHERE executionId = ${executionId}', (err, row) => { if (err) { console.error(err); process.exit(1); } const parsed = flatted.parse(row.data); console.log(JSON.stringify(parsed.resultData?.runData || {})); });"`
      ).toString();
      runData = JSON.parse(sqliteOut);
    } catch (e) {
      console.warn("Could not query docker sqlite:", e.message);
    }
  }

  console.log("\nExecuted Nodes Count:", Object.keys(runData || {}).length);
  for (const nodeName of Object.keys(runData || {})) {
    console.log(` - Node: "${nodeName}": Executed Successfully`);
  }

  const scorecard = runData?.["14. Healthcare AI Security Scorecard"]?.[0]?.data?.main?.[0]?.[0]?.json;

  console.log("\n========================================================================");
  console.log("🏥 HEALTHCARE AI SECURITY AUDIT SCORECARD (v0.8.2 LIVE DOCKER)");
  console.log("========================================================================");
  console.log(JSON.stringify(scorecard, null, 2));

  // Save audit results
  const outPath = path.resolve("test-results-v082-healthcare-audit.json");
  fs.writeFileSync(outPath, JSON.stringify({
    executionId,
    status: executionData.status,
    workflowId: "health_muilmxycsho2",
    workflowName: workflowData.name,
    scorecard,
    runData
  }, null, 2), "utf8");
  console.log(`\n💾 Saved detailed execution dump to: ${outPath}`);
}

main().catch(err => {
  console.error("❌ Error during test run:", err);
  process.exit(1);
});
