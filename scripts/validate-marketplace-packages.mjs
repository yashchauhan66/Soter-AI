import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const failures = [];
const warnings = [];

function path(...parts) {
  return join(root, ...parts);
}

function rel(...parts) {
  return parts.join("/");
}

function requireFile(parts, label = rel(...parts)) {
  const file = path(...parts);
  if (!existsSync(file) || !statSync(file).isFile()) {
    failures.push(`Missing ${label}`);
    return false;
  }
  return true;
}

function requireDir(parts, label = rel(...parts)) {
  const dir = path(...parts);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    failures.push(`Missing ${label}`);
    return false;
  }
  return true;
}

function readJson(parts) {
  const file = path(...parts);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    failures.push(`Invalid JSON in ${rel(...parts)}: ${error.message}`);
    return null;
  }
}

function requireValue(value, message) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    failures.push(message);
  }
}

function warnValue(value, message) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    warnings.push(message);
  }
}

function validateRootAssets() {
  requireFile(["public", "marketplace", "soterai-icon.svg"]);
  requireFile(["public", "marketplace", "soterai-icon-128.png"]);
  requireFile(["public", "marketplace", "soterai-icon-192.png"]);
  requireFile(["public", "marketplace", "soterai-icon-256.png"]);
  requireFile(["public", "marketplace", "soterai-icon-512.png"]);

  const docs = [
    "soterai-short-description.md",
    "soterai-long-description.md",
    "platform-listing-copy.md",
    "privacy-summary.md",
    "security-summary.md",
    "support-info.md",
    "screenshots-checklist.md",
    "demo-video-script.md",
  ];

  for (const doc of docs) {
    requireFile(["docs", "marketplace-assets", doc]);
  }
}

function validateN8n() {
  const pkg = readJson(["packages", "integrations", "n8n", "package.json"]);
  if (!pkg) return;

  requireValue(pkg.name?.startsWith("n8n-nodes-"), "n8n package name should start with n8n-nodes-");
  requireValue(pkg.version, "n8n package version is required");
  requireValue(pkg.description, "n8n package description is required");
  requireValue(pkg.license, "n8n package license is required");
  requireValue(pkg.repository?.url, "n8n repository URL is required");
  requireValue(pkg.keywords?.includes("n8n-community-node-package"), "n8n keyword n8n-community-node-package is required");
  requireValue(pkg.n8n?.nodes, "n8n nodes manifest is required");
  requireValue(pkg.n8n?.credentials, "n8n credentials manifest is required");
  requireValue(pkg.scripts?.build, "n8n build script is required");

  requireFile(["packages", "integrations", "n8n", "README.md"]);
  requireFile(["packages", "integrations", "n8n", "LICENSE"]);
  requireFile(["packages", "integrations", "n8n", "CHANGELOG.md"]);
  requireFile(["packages", "integrations", "n8n", "NPM_PUBLISH_CHECKLIST.md"]);
  requireFile(["packages", "integrations", "n8n", "nodes", "SoterGuard.node.ts"]);
  requireFile(["packages", "integrations", "n8n", "credentials", "SoterApi.credentials.ts"]);
}

function validateZapier() {
  const pkg = readJson(["packages", "integrations", "zapier", "package.json"]);
  if (!pkg) return;

  requireValue(pkg.version && pkg.version !== "0.0.0", "Zapier package version must be release-ready, not 0.0.0");
  requireValue(pkg.description, "Zapier description is required");
  requireValue(pkg.homepage, "Zapier homepage is required");
  requireValue(pkg.repository?.url, "Zapier repository URL is required");
  requireValue(pkg.keywords?.includes("zapier"), "Zapier keyword is required");
  requireValue(pkg.scripts?.build, "Zapier build script is required");
  requireValue(pkg.scripts?.validate, "Zapier validate script is required");
  requireValue(pkg.scripts?.push, "Zapier push script is required");

  requireFile(["packages", "integrations", "zapier", "README.md"]);
  requireFile(["packages", "integrations", "zapier", "PUBLISHING_CHECKLIST.md"]);
  requireFile(["packages", "integrations", "zapier", ".zapierapprc"]);
  requireFile(["packages", "integrations", "zapier", "authentication.ts"]);
  requireFile(["packages", "integrations", "zapier", "index.ts"]);
  requireFile(["packages", "integrations", "zapier", "creates", "guardActions.ts"]);
}

function validateMake() {
  const app = readJson(["packages", "integrations", "make", "app.json"]);
  const actions = readJson(["packages", "integrations", "make", "modules", "actions.json"]);
  if (!app || !actions) return;

  requireValue(app.name, "Make app name is required");
  requireValue(app.label, "Make app label is required");
  requireValue(app.description, "Make app description is required");
  requireValue(app.version, "Make app version is required");
  requireValue(app.connections, "Make connection definition is required");
  requireValue(Array.isArray(actions) && actions.length >= 4, "Make should expose at least four core security actions");

  for (const action of actions) {
    requireValue(action.name, "Every Make action needs a name");
    requireValue(action.label, `Make action ${action.name ?? "(unknown)"} needs a label`);
    requireValue(action.connection, `Make action ${action.name ?? "(unknown)"} needs a connection`);
    requireValue(action.url, `Make action ${action.name ?? "(unknown)"} needs a URL`);
    requireValue(action.method, `Make action ${action.name ?? "(unknown)"} needs a method`);
    requireValue(action.response?.output, `Make action ${action.name ?? "(unknown)"} needs response output mapping`);
  }

  requireFile(["packages", "integrations", "make", "README.md"]);
  requireFile(["packages", "integrations", "make", "PUBLISHING_CHECKLIST.md"]);
  requireFile(["packages", "integrations", "make", "SETUP_GUIDE.md"]);
  requireFile(["packages", "integrations", "make", "MAKE_BLUEPRINT.md"]);
  requireDir(["packages", "integrations", "make", "scenarios"]);
}

function validateAdjacentPackages() {
  const packages = [
    ["botpress", "package.json", "README.md"],
    ["dify", "manifest.yaml", "README.md"],
    ["flowise", "package.json", "README.md"],
    ["langflow", "README.md"],
    ["voiceflow", "README.md"],
  ];

  for (const [name, ...files] of packages) {
    requireDir(["packages", "integrations", name], `${name} integration directory`);
    for (const file of files) {
      requireFile(["packages", "integrations", name, file], `${name} ${file}`);
    }
  }

  warnValue(existsSync(path("integrations", "wordpress-plugin", "soter-guard")), "WordPress plugin directory is missing");
}

validateRootAssets();
validateN8n();
validateZapier();
validateMake();
validateAdjacentPackages();

if (warnings.length) {
  console.log("Marketplace package warnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
  console.log("");
}

if (failures.length) {
  console.error("Marketplace package validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Marketplace package validation passed.");
