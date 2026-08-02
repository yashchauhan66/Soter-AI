#!/usr/bin/env node
/**
 * Validate the BUILT store manifest against Microsoft Edge Add-ons / Chrome Web Store
 * certification blockers. Fails the build if any store-unsafe pattern is present.
 *
 * Usage: node scripts/validate-store-manifest.mjs [path-to-dist/extension]
 * Default target: dist/extension (the folder that gets zipped for submission).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(extensionRoot, process.argv[2] ?? "dist/extension");
const manifestPath = resolve(distDir, "manifest.json");

const errors = [];
const warnings = [];

if (!existsSync(manifestPath)) {
  console.error(`❌ No built manifest at ${manifestPath}. Run \`npm run build\` first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// --- Permissions that must never appear unless actually used ---------------
// SS-9 uses `declarativeNetRequestWithHostAccess`, NOT the broad `declarativeNetRequest`:
// the narrow variant can only act where a host permission already exists, so it adds no
// new install-time warning and cannot block traffic on a site this extension never sees.
// The broad variant stays outside this set, which makes requesting it a build failure.
const ALLOWED_PERMISSIONS = new Set([
  "contextMenus",
  "sidePanel",
  "storage",
  "alarms",
  "declarativeNetRequestWithHostAccess",
]);
for (const perm of manifest.permissions ?? []) {
  if (!ALLOWED_PERMISSIONS.has(perm)) {
    errors.push(`Unexpected/unjustified permission "${perm}". Only ${[...ALLOWED_PERMISSIONS].join(", ")} are declared as used.`);
  }
}
if (Array.isArray(manifest.optional_permissions) && manifest.optional_permissions.length) {
  errors.push(`optional_permissions must be empty in the store build (found: ${manifest.optional_permissions.join(", ")}).`);
}
// SS-9 installs *session* rules at runtime, scoped to one tab for a few seconds. A static
// ruleset would be a permanent, package-shipped block list that no scan verdict gates, so
// declaring one is refused rather than reviewed.
if (manifest.declarative_net_request) {
  errors.push("declarative_net_request static rulesets must not be declared: SS-9 uses short-lived, tab-scoped session rules only.");
}

// --- Host permission hygiene ------------------------------------------------
const hostLists = [];
for (const host of manifest.host_permissions ?? []) hostLists.push(["host_permissions", host]);
for (const cs of manifest.content_scripts ?? []) {
  for (const m of cs.matches ?? []) hostLists.push(["content_scripts", m]);
}
for (const [where, host] of hostLists) {
  if (host === "<all_urls>" || host === "*://*/*") errors.push(`Broad match "${host}" in ${where}.`);
  if (host.startsWith("http://")) errors.push(`Insecure http:// host "${host}" in ${where} (store build must be https only).`);
  if (host.startsWith("*://")) errors.push(`Wildcard scheme "${host}" in ${where} allows http:// — use https://.`);
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(host)) errors.push(`Dev-only host "${host}" in ${where} must not ship in the store build.`);
  if (/bard\.google\.com/.test(host)) warnings.push(`Deprecated host "${host}" in ${where} (bard redirects to gemini).`);
}

// --- Required MV3 / listing fields -----------------------------------------
if (manifest.manifest_version !== 3) errors.push(`manifest_version must be 3 (found ${manifest.manifest_version}).`);
if (!manifest.name) errors.push("Missing name.");
if (!manifest.description || manifest.description.length > 132) errors.push("description missing or >132 chars.");
if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(manifest.version ?? "")) errors.push(`Invalid version "${manifest.version}".`);
if (!manifest.action?.default_popup) errors.push("action.default_popup missing.");
for (const size of ["16", "48", "128"]) {
  const icon = manifest.icons?.[size];
  if (!icon) errors.push(`Missing ${size}px icon.`);
  else if (!existsSync(resolve(distDir, icon))) errors.push(`Icon file not found in build: ${icon}`);
}

// --- CSP must be explicit and must not weaken the default MV3 sandbox -------
// SS-5: relying on Chrome's *implicit* default is not an enforced control — a later
// manifest edit can silently relax it. The hardened policy is declared and required.
const csp = JSON.stringify(manifest.content_security_policy ?? {});
if (/unsafe-eval|'unsafe-inline'|\bhttp:|wasm-unsafe-eval/.test(csp)) {
  errors.push(`content_security_policy weakens the MV3 default: ${csp}`);
}
const extensionPagesCsp = manifest.content_security_policy?.extension_pages;
if (typeof extensionPagesCsp !== "string" || !extensionPagesCsp.trim()) {
  errors.push("content_security_policy.extension_pages must be declared explicitly (SS-5).");
} else {
  const directives = new Map(
    extensionPagesCsp
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name.toLowerCase(), values.join(" ")];
      }),
  );
  const REQUIRED_CSP = [
    ["script-src", ["'self'"]],
    ["object-src", ["'self'", "'none'"]],
    ["base-uri", ["'none'", "'self'"]],
    ["form-action", ["'none'", "'self'"]],
  ];
  for (const [directive, accepted] of REQUIRED_CSP) {
    const value = directives.get(directive);
    if (value === undefined) {
      errors.push(`content_security_policy.extension_pages is missing "${directive}".`);
    } else if (!accepted.includes(value.trim())) {
      errors.push(`content_security_policy.extension_pages "${directive} ${value}" must be one of: ${accepted.join(", ")}.`);
    }
  }
}
if (manifest.sandbox) {
  errors.push("A sandbox CSP section is not used by this extension and must not be declared.");
}

// --- No remotely reachable or page-reachable extension surface ---------------
// The runtime message guard's threat model depends on web pages being unable to reach
// chrome.runtime.sendMessage at all, which is true only while externally_connectable is
// absent. Likewise every web-accessible resource is a page-reachable attack surface.
if (manifest.externally_connectable) {
  errors.push("externally_connectable must not be declared: it makes the message boundary reachable from web pages.");
}
for (const entry of manifest.web_accessible_resources ?? []) {
  const matches = entry?.matches ?? [];
  if (matches.length === 0) errors.push("web_accessible_resources entry has no matches (exposed to every site).");
  for (const m of matches) {
    if (m === "<all_urls>" || m === "*://*/*") errors.push(`web_accessible_resources exposed to "${m}".`);
  }
  if (entry?.use_dynamic_url !== true) {
    errors.push("web_accessible_resources entries must set use_dynamic_url:true so the extension id is not probeable.");
  }
}

// --- Packaged files must not include dev/secret artifacts -------------------
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = resolve(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const BAD_FILE = /(^|[\\/])(\.env|\.env\.[^\\/]*|.*\.map|.*\.(test|spec)\.[jt]sx?|manifest\.dev\.json)$/i;
for (const f of walk(distDir)) {
  if (BAD_FILE.test(f)) errors.push(`Store package must not contain: ${f.replace(distDir, "dist/extension")}`);
}

// --- Scan built JS for remote-code / secret-leak patterns -------------------
const CODE_SMELLS = [
  [/\beval\s*\(/, "eval("],
  [/new\s+Function\s*\(/, "new Function("],
  [/import\s*\(\s*[`"']https?:/, "remote dynamic import"],
  [/console\.(log|info|debug|warn|error)\([^)]*\b(deviceToken|apiKey|api_key|authorization|x-soter-extension-token)\b/i, "token/secret logged to console"],
];
for (const f of walk(distDir).filter((p) => extname(p) === ".js")) {
  const src = readFileSync(f, "utf8");
  for (const [re, label] of CODE_SMELLS) {
    if (re.test(src)) errors.push(`Prohibited pattern "${label}" in ${f.replace(distDir, "dist/extension")}`);
  }
}

// --- Report -----------------------------------------------------------------
for (const w of warnings) console.warn(`⚠️  ${w}`);
if (errors.length) {
  console.error("\n❌ Store manifest validation FAILED:");
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ Store manifest validation PASSED (${manifest.name} v${manifest.version})`);
console.log(`   permissions: ${(manifest.permissions ?? []).join(", ")}`);
console.log(`   host_permissions: ${(manifest.host_permissions ?? []).length} hosts, all https, no localhost`);
