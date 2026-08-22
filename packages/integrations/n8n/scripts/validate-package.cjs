const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageJson = readJson(path.join(root, "package.json"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const readiness = fs.readFileSync(path.resolve(root, "..", "..", "..", "docs", "integrations", "n8n-marketplace-readiness.md"), "utf8");
const nodeDir = path.join(root, "nodes", "SoterGuard");
const entrySource = fs.readFileSync(path.join(nodeDir, "SoterGuard.node.ts"), "utf8");
const runtimeSource = fs.readFileSync(path.join(nodeDir, "shared", "execute.ts"), "utf8");
const localEngineSource = fs.readFileSync(path.join(nodeDir, "shared", "localEngine.ts"), "utf8");
const propertiesSource = fs.readFileSync(path.join(nodeDir, "shared", "properties.ts"), "utf8");
const baseSource = fs.readFileSync(path.join(nodeDir, "shared", "description.ts"), "utf8");
const v1Source = fs.readFileSync(path.join(nodeDir, "v1", "SoterGuardV1.node.ts"), "utf8");
const v2Source = fs.readFileSync(path.join(nodeDir, "v2", "SoterGuardV2.node.ts"), "utf8");

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
  "soterai-local-offline-engine.workflow.json",
];

assert(packageJson.name === "n8n-nodes-soterai", "Package name must be n8n-nodes-soterai.");
assert(readme.includes(`Version: \`${packageJson.version}\``), "README compatibility version must match package.json.");
assert(runtimeSource.includes(`export const PACKAGE_VERSION = "${packageJson.version}"`), "Node User-Agent version must match package.json.");
assert(packageJson.n8n?.nodes?.includes("dist/nodes/SoterGuard/SoterGuard.node.js"), "n8n node dist path is missing.");
assert(
  packageJson.n8n?.credentials?.includes("dist/credentials/SoterApi.credentials.js"),
  "n8n credential dist path is missing.",
);
assert(packageJson.files?.includes("examples"), "Published package must include example workflows.");
assert(runtimeSource.includes("sanitizeOutputObject(raw)"), "rawResponse output must be sanitized before workflow output.");
assert(!runtimeSource.includes("rawResponse: raw as IDataObject"), "rawResponse must not expose unsanitized API objects.");
assert(runtimeSource.includes("validateBaseUrl("), "Base URL must be validated before API requests.");
assert(runtimeSource.includes("sanitizeRequestMetadata("), "Metadata must be sanitized before API requests.");
assert(runtimeSource.includes('result.outputText = result.safeText'), "Analyze Text must not echo raw input as outputText.");
assert(runtimeSource.includes('result.operation = "inputGuard"'), "Input Guard output must include operation.");
assert(runtimeSource.includes('result.operation = "outputGuard"'), "Output Guard output must include operation.");
assert(runtimeSource.includes('result.operation = "piiRedactor"'), "PII Redactor output must include operation.");
assert(runtimeSource.includes('result.operation = "ragScanner"'), "RAG Scanner output must include operation.");

// Versioning invariants. A saved workflow stores only `typeVersion`, so version 1
// must keep the single output it was published with; if it ever gained a second
// output, n8n would route items to a branch those workflows never connected.
assert(entrySource.includes("extends VersionedNodeType"), "Node must be registered as a VersionedNodeType.");
assert(/1:\s*new SoterGuardV1\(/.test(entrySource), "Version 1 must stay registered for existing workflows.");
assert(/2:\s*new SoterGuardV2\(/.test(entrySource), "Version 2 must be registered.");
assert(baseSource.includes("defaultVersion: 2"), "New nodes must default to version 2.");
assert(v1Source.includes("outputs: [NodeConnectionTypes.Main]"), "Version 1 must keep exactly one output.");
assert(v1Source.includes("version: 1"), "Version 1 class must declare version 1.");
assert(v2Source.includes("version: 2"), "Version 2 class must declare version 2.");
assert(v2Source.includes('displayName: "Flagged"'), "Version 2 must expose the Flagged output.");
assert(v2Source.includes('displayName: "Safe"'), "Version 2 must expose the Safe output.");

// Fail-closed routing. An item whose check never completed has not been cleared
// by anything, so continueOnFail must send it to Flagged, not Safe.
assert(
  /continueOnFail\(\)[\s\S]{0,600}?message: sanitizeErrorMessage[\s\S]{0,200}?\n\s*flagged: true,/.test(runtimeSource),
  "continueOnFail errors must be routed to the Flagged output, not Safe.",
);
assert(
  /SINGLE_OUTPUT_ACTIONS\s*=\s*\["piiRedactor"\]/.test(runtimeSource),
  "Only the redactor may collapse to a single output; every other action must branch.",
);
// The guided Security Context replaced hand-written JSON on v2, but v1's JSON
// field has to stay for the workflows already using it.
assert(propertiesSource.includes('name: "securityContextJson"'), "Version 1 Security Context JSON field must be preserved.");
assert(propertiesSource.includes('name: "securityContext"'), "Version 2 guided Security Context must exist.");
assert(propertiesSource.includes('name: "sessionId"'), "Session ID must be a first-class field.");
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

// Local-engine honesty. The offline engine is deliberately weaker than the cloud
// engine, so every promise the package makes about that has to be checkable here
// and not only in the README.
assert(propertiesSource.includes('name: "detectionEngine"'), "The engine selector must be a first-class field.");
assert(/LOCAL_ENGINE_LIMITATIONS = \[/.test(localEngineSource), "The local engine must publish what it cannot do.");
assert(
  runtimeSource.includes("limitations: LOCAL_ENGINE_LIMITATIONS"),
  "Every local result must carry the limitation list, so the run output says what protection actually ran.",
);
assert(
  runtimeSource.includes("result.engineDegraded = fallbackReason !== null"),
  "A local answer produced by fallback must be marked degraded, so it cannot read as a clean cloud pass.",
);
assert(
  runtimeSource.includes(
    'if (options.engine !== "AUTO" || !isTransientApiError(error)) throw asNodeError(node, error)',
  ),
  "Auto may only fall back when the cloud could not be asked — an authoritative refusal must surface.",
);
assert(
  localEngineSource.includes("unresolvedSourceIds"),
  "A protected source the local engine cannot resolve must be reported as unresolved, never as compared and clean.",
);
assert(
  /riskTypes|primaryRiskType/.test(localEngineSource) && localEngineSource.includes("matches: number"),
  "Local findings must be type/label/severity/count only — never the matched text.",
);
assert(readme.includes("Local mode"), "README must document the offline engine.");
assert(readme.includes("Items in Parallel"), "README must document the batch concurrency option.");
assert(changelog.includes("engine: \"local\"") || changelog.includes("`engine`"), "CHANGELOG must document the engine field.");

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

// The offline example is the one place a reader can check the central local-mode
// claim for themselves: a working guard with no credential attached. If someone
// "fixes" the example by adding a credential, the claim stops being verifiable.
{
  const offlineExample = readJson(path.join(root, "examples", "soterai-local-offline-engine.workflow.json"));
  const localNode = offlineExample.nodes.find((node) => node.parameters?.detectionEngine === "LOCAL");
  assert(localNode, "The offline example must configure a node with Detection Engine set to Local.");
  assert(!localNode.credentials, "The offline example must run Local mode with no credential attached.");
  assert(
    offlineExample.nodes.some((node) => node.parameters?.detectionEngine === "AUTO"),
    "The offline example must also show Auto, so the fallback rules have a runnable reference.",
  );
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
