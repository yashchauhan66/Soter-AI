const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageJson = readJson(path.join(root, "package.json"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const readiness = fs.readFileSync(path.resolve(root, "..", "..", "..", "docs", "integrations", "n8n-marketplace-readiness.md"), "utf8");
const nodeSource = fs.readFileSync(path.join(root, "nodes", "SoterGuard", "SoterGuard.node.ts"), "utf8");

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
  "soterai-universal-ai-firewall.workflow.json",
  "soterai-security-context-templates.workflow.json",
  "soterai-workflow-security-audit.workflow.json",
];

assert(packageJson.name === "n8n-nodes-soterai", "Package name must be n8n-nodes-soterai.");
assert(readme.includes(`Version: \`${packageJson.version}\``), "README compatibility version must match package.json.");
assert(nodeSource.includes(`const PACKAGE_VERSION = "${packageJson.version}"`), "Node User-Agent version must match package.json.");
assert(packageJson.n8n?.nodes?.includes("dist/nodes/SoterGuard/SoterGuard.node.js"), "n8n node dist path is missing.");
assert(
  packageJson.n8n?.credentials?.includes("dist/credentials/SoterApi.credentials.js"),
  "n8n credential dist path is missing.",
);
assert(packageJson.files?.includes("examples"), "Published package must include example workflows.");
assert(nodeSource.includes("sanitizeOutputObject(raw)"), "rawResponse output must be sanitized before workflow output.");
assert(!nodeSource.includes("rawResponse: raw as IDataObject"), "rawResponse must not expose unsanitized API objects.");
assert(nodeSource.includes("validateBaseUrl("), "Base URL must be validated before API requests.");
assert(nodeSource.includes("sanitizeRequestMetadata("), "Metadata must be sanitized before API requests.");
assert(nodeSource.includes('result.outputText = result.safeText'), "Analyze Text must not echo raw input as outputText.");
assert(nodeSource.includes('result.operation = "inputGuard"'), "Input Guard output must include operation.");
assert(nodeSource.includes('result.operation = "outputGuard"'), "Output Guard output must include operation.");
assert(nodeSource.includes('result.operation = "piiRedactor"'), "PII Redactor output must include operation.");
assert(nodeSource.includes('result.operation = "ragScanner"'), "RAG Scanner output must include operation.");
assert(readme.includes("Advanced `rawResponse` output is recursively sanitized"), "README must document sanitized rawResponse output.");
assert(readme.includes("Metadata JSON is sanitized before it is sent"), "README must document metadata sanitization.");
assert(readme.includes("Base URL validation requires HTTPS"), "README must document Base URL validation.");
assert(changelog.includes("Recursively sanitize `rawResponse`"), "CHANGELOG must document rawResponse sanitization.");
assert(changelog.includes("does not collect telemetry"), "CHANGELOG must document the privacy/no-telemetry contract.");
assert(changelog.includes("Added Base URL validation"), "CHANGELOG must document Base URL validation.");
assert(changelog.includes("Sanitized Metadata JSON"), "CHANGELOG must document metadata sanitization.");
assert(readiness.includes("n8n Marketplace Readiness Checklist"), "n8n marketplace readiness doc is missing.");
assert(readiness.includes("API key | Stored in n8n credentials"), "n8n readiness doc must document credential handling.");
assert(readiness.includes("`rawResponse` | Recursively sanitized"), "n8n readiness doc must document sanitized rawResponse.");

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
