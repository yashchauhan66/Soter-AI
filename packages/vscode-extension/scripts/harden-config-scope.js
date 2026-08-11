/**
 * One-shot manifest hardening for the config-scope vulnerability.
 *
 * Every `soterai.*` setting was declared with no `scope`, which means VS Code's
 * default `window` scope: a repository's own `.vscode/settings.json` can
 * override it. For a security extension that means a hostile repo can turn the
 * guard off, or repoint `broker.*ProviderUrl` at an attacker endpoint that then
 * receives the user's real provider API key.
 *
 * Two changes, both additive:
 *   1. `scope: "machine"` on every safety-relevant key, so only user/machine
 *      settings apply and a workspace override is ignored outright.
 *   2. `capabilities.untrustedWorkspaces.restrictedConfigurations` listing the
 *      same keys, so VS Code also refuses them in Restricted Mode.
 *
 * Keys deliberately left workspace-scoped are per-project preferences with no
 * protection-disabling power (scan budgets, exclude globs, palette visibility).
 */
const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "package.json");
const raw = fs.readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(raw);

// Safety-relevant: disabling protection, changing where data goes, or relaxing
// a confirmation. A hostile repo must not be able to set any of these.
const MACHINE_SCOPED = [
    "soterai.cloud.enabled",
    "soterai.cloud.baseUrl",
    "soterai.policy.mode",
    "soterai.scan.remoteEscalation",
    "soterai.privacyMode",
    "soterai.sensitiveContext.defaultAction",
    "soterai.sensitiveContext.allowRawReveal",
    "soterai.sensitiveContext.requireApproval",
    "soterai.sensitiveContext.ttlMinutes",
    "soterai.audit.storeRawPrompts",
    "soterai.telemetry.redactedEvents",
    "soterai.broker.port",
    "soterai.broker.openAIProviderUrl",
    "soterai.broker.anthropicProviderUrl",
    "soterai.terminal.protectionMode",
    "soterai.terminal.warnOnRawTerminalOpen",
    "soterai.sentinel.enabled",
    "soterai.sentinel.retentionDays",
    "soterai.protectedWorkspace.enabled",
    "soterai.mcpFirewall.strictMode",
    "soterai.liveScan.enabled",
    "soterai.protection.enabled",
    "soterai.dependencyGuard.osvMode",
];

const props = manifest.contributes.configuration.properties;
const missing = MACHINE_SCOPED.filter((k) => !props[k]);
if (missing.length) {
    console.error("Refusing to write: unknown setting key(s):", missing.join(", "));
    process.exit(1);
}

let scoped = 0;
for (const key of MACHINE_SCOPED) {
    if (props[key].scope !== "machine") {
        props[key].scope = "machine";
        scoped++;
    }
}

manifest.capabilities = manifest.capabilities || {};
manifest.capabilities.untrustedWorkspaces = manifest.capabilities.untrustedWorkspaces || {};
manifest.capabilities.untrustedWorkspaces.restrictedConfigurations = [...MACHINE_SCOPED];

// Preserve the file's existing indentation and trailing newline.
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + "\n", "utf8");

const left = Object.keys(props).filter((k) => props[k].scope !== "machine");
console.log(`scoped to machine: ${scoped} newly set, ${MACHINE_SCOPED.length} total`);
console.log(`restrictedConfigurations: ${MACHINE_SCOPED.length} keys`);
console.log(`intentionally workspace-scoped (${left.length}): ${left.join(", ")}`);
