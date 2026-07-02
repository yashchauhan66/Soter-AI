#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "apps/extension/manifest.json");
const docsDir = path.join(root, "docs/extension-store");
const docFiles = [
  "permission-justification.md",
  "review-notes.md",
  "privacy-policy.md",
  "chrome-private-listing.md",
  "edge-hidden-listing.md",
].map((file) => path.join(docsDir, file));

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const requiredPermissions = manifest.permissions ?? [];
const optionalPermissions = manifest.optional_permissions ?? [];
const hostPermissions = manifest.host_permissions ?? [];
const optionalHostPermissions = manifest.optional_host_permissions ?? [];
const docs = docFiles
  .filter((file) => fs.existsSync(file))
  .map((file) => `${path.basename(file)}\n${fs.readFileSync(file, "utf8")}`)
  .join("\n\n");

let failed = false;
function fail(message) {
  failed = true;
  console.error(`ERROR: ${message}`);
}

for (const forbidden of ["tabs", "webNavigation"]) {
  if (![...requiredPermissions, ...optionalPermissions].includes(forbidden) && new RegExp(`\`${forbidden}\`|\\b${forbidden}\\b`, "i").test(docs)) {
    fail(`Docs mention ${forbidden}, but manifest does not request it.`);
  }
}

for (const permission of requiredPermissions) {
  if (!docs.includes(`\`${permission}\``)) fail(`Required permission ${permission} is not documented.`);
}

for (const permission of optionalPermissions) {
  if (!docs.includes(`\`${permission}\``)) fail(`Optional permission ${permission} is not documented.`);
}

for (const host of hostPermissions) {
  if (!docs.includes(`\`${host}\``)) fail(`Host permission ${host} is not documented exactly.`);
}

for (const host of optionalHostPermissions) {
  if (!docs.includes(`\`${host}\``)) fail(`Optional host permission ${host} is not documented exactly.`);
}

console.log("Manifest permissions:", requiredPermissions.join(", "));
console.log("Optional permissions:", optionalPermissions.join(", ") || "none");
console.log("Host permissions:", hostPermissions.length);
console.log("Optional host permissions:", optionalHostPermissions.join(", ") || "none");

if (failed) process.exit(1);
console.log("PASS: manifest permissions and store docs match.");
