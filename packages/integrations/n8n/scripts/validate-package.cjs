const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageJson = readJson(path.join(root, "package.json"));

const requiredKeywords = [
  "n8n-community-node-package",
  "n8n",
  "soterai",
  "ai-security",
  "prompt-injection",
  "ai-guardrails",
  "pii",
  "secrets",
  "security",
];

const requiredWorkflows = [
  "soterai-basic-analyze.workflow.json",
  "soterai-guard-input-webhook.workflow.json",
  "soterai-guard-output.workflow.json",
  "soterai-secret-pii-redaction.workflow.json",
  "soterai-error-handling.workflow.json",
];

assert(packageJson.name === "n8n-nodes-soterai", "Package name must be n8n-nodes-soterai.");
assert(packageJson.n8n?.nodes?.includes("dist/nodes/SoterGuard.node.js"), "n8n node dist path is missing.");
assert(
  packageJson.n8n?.credentials?.includes("dist/credentials/SoterApi.credentials.js"),
  "n8n credential dist path is missing.",
);
assert(packageJson.files?.includes("examples"), "Published package must include example workflows.");

for (const keyword of requiredKeywords) {
  assert(packageJson.keywords.includes(keyword), `Missing keyword: ${keyword}`);
}

for (const fileName of requiredWorkflows) {
  const workflowPath = path.join(root, "examples", fileName);
  const raw = fs.readFileSync(workflowPath, "utf8");
  const workflow = JSON.parse(raw);
  assert(Array.isArray(workflow.nodes), `${fileName} must contain nodes.`);
  assert(workflow.nodes.some((node) => node.type === "n8n-nodes-soterai.soterGuard"), `${fileName} must use SoterAI.`);
  assert(!/sk_(live|prod)|sk-(live|prod)|admin token|customer data/i.test(raw), `${fileName} contains unsafe secret text.`);
}

console.log("n8n package validation OK");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
