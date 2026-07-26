import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const specPath = join(root, "docs/api/openapi.v1.json");
const sdkClientPath = join(root, "packages/sdk/src/client.ts");
const sdkContractPath = join(root, "packages/sdk/src/contract.ts");
const serverContractPath = join(root, "lib/apiContract.ts");

const spec = JSON.parse(readFileSync(specPath, "utf8"));
const sdkClientSource = readFileSync(sdkClientPath, "utf8");
const sdkContractSource = readFileSync(sdkContractPath, "utf8");
const serverContractSource = readFileSync(serverContractPath, "utf8");

function fail(message) {
  console.error(`[api-contract] ${message}`);
  process.exitCode = 1;
}

function literalConst(source, name) {
  const match = source.match(new RegExp(`export const ${name} = "([^"]+)"`));
  return match?.[1];
}

function normalizeSdkPath(path) {
  return path
    .replace(/\$\{query\}/g, "")
    .replace(/\$\{[^}]+\}/g, "{param}");
}

function pathMatches(openapiPath, sdkPath) {
  const openapiParts = openapiPath.split("/");
  const sdkParts = sdkPath.split("/");
  if (openapiParts.length !== sdkParts.length) return false;
  return openapiParts.every((part, index) => {
    const sdkPart = sdkParts[index];
    return part === sdkPart || (part.startsWith("{") && part.endsWith("}") && sdkPart === "{param}");
  });
}

function hasOperation(method, sdkPath) {
  return Object.entries(spec.paths ?? {}).some(([openapiPath, pathItem]) => {
    if (!pathMatches(openapiPath, sdkPath)) return false;
    return Boolean(pathItem?.[method.toLowerCase()]);
  });
}

const apiVersion = literalConst(sdkContractSource, "SOTERAI_API_VERSION");
const serverApiVersion = literalConst(serverContractSource, "SOTERAI_API_VERSION");
const contractVersion = literalConst(sdkContractSource, "SOTERAI_CONTRACT_VERSION");
const serverContractVersion = literalConst(serverContractSource, "SOTERAI_CONTRACT_VERSION");

if (spec.openapi !== "3.1.0") fail("OpenAPI spec must use version 3.1.0.");
if (spec.info?.version !== apiVersion) fail(`Spec info.version ${spec.info?.version} does not match SDK ${apiVersion}.`);
if (apiVersion !== serverApiVersion) fail(`SDK API version ${apiVersion} does not match server ${serverApiVersion}.`);
if (spec.info?.["x-contract-version"] !== contractVersion) fail("Spec contract version does not match SDK contract version.");
if (contractVersion !== serverContractVersion) fail(`SDK contract version ${contractVersion} does not match server ${serverContractVersion}.`);
if (!spec.components?.securitySchemes?.ApiKeyAuth) fail("Spec must define ApiKeyAuth security scheme.");
if (!spec.components?.parameters?.SoterApiVersionHeader) fail("Spec must document X-SoterAI-API-Version.");
if (!spec.components?.responses?.GuardResult?.headers?.["X-SoterAI-API-Version"]) {
  fail("GuardResult response must document X-SoterAI-API-Version.");
}
if (!spec.components?.responses?.GuardResult?.headers?.["X-SoterAI-Contract-Version"]) {
  fail("GuardResult response must document X-SoterAI-Contract-Version.");
}

const calls = [];
const callPattern = /this\.(post|get)<[\s\S]*?>\((["`])([^"`]+)\2/g;
for (const match of sdkClientSource.matchAll(callPattern)) {
  const method = match[1]?.toUpperCase();
  const path = normalizeSdkPath(match[3]);
  if (method && path.startsWith("/api/")) calls.push({ method, path });
}

const missing = [];
for (const call of calls) {
  if (!hasOperation(call.method, call.path)) missing.push(`${call.method} ${call.path}`);
}

if (missing.length) {
  fail(`OpenAPI spec is missing SDK endpoints:\n- ${missing.join("\n- ")}`);
}

if (!process.exitCode) {
  console.log(JSON.stringify({
    ok: true,
    apiVersion,
    contractVersion,
    sdkEndpointCount: calls.length,
    openApiPathCount: Object.keys(spec.paths ?? {}).length,
  }, null, 2));
}
