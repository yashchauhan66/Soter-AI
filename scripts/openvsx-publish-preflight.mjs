#!/usr/bin/env node
/**
 * Open VSX publish preflight for SoterAI IDE Guard.
 *
 * One Open VSX publish is what makes the extension installable by search in
 * Cursor, Windsurf, VSCodium, Kiro, and Antigravity — every one of those hosts
 * resolves Open VSX directly or through a branded proxy/mirror (verified from
 * each host's own resources/app/product.json). This script refuses the publish
 * unless the artifact and the registry state are both actually ready.
 *
 * Usage:
 *   node scripts/openvsx-publish-preflight.mjs [--require-token] [--offline]
 *
 * Exit 0 = safe to publish. Exit 1 = blocked (reasons printed).
 */

import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import semver from "semver";

const repoRoot = resolve(import.meta.dirname, "..");
const extensionRoot = join(repoRoot, "packages", "vscode-extension");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const vsixPath = join(extensionRoot, `${manifest.name}-${manifest.version}.vsix`);
const evidencePath = join(repoRoot, "artifacts", "openvsx", "publish-preflight.json");
const requireToken = process.argv.includes("--require-token");
const offline = process.argv.includes("--offline");

const failures = [];
const warnings = [];
const checks = [];

function record(name, ok, detail, { soft = false } = {}) {
  checks.push({ name, ok, detail, soft });
  if (ok) return;
  (soft ? warnings : failures).push(`${name}: ${detail}`);
}

// ── Minimal ZIP reader ──────────────────────────────────────────────────────
// A VSIX is a ZIP. Reading its central directory is the only way to assert what
// actually ships to the registry, rather than what .vscodeignore intends to
// ship. Kept dependency-free on purpose: no new supply-chain surface in the
// release path.

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;

function locateEndOfCentralDirectory(buffer) {
  const scanFrom = Math.max(0, buffer.length - 65_557);
  for (let at = buffer.length - 22; at >= scanFrom; at -= 1) {
    if (buffer.readUInt32LE(at) === EOCD_SIG) return at;
  }
  throw new Error("Not a ZIP/VSIX archive: end-of-central-directory record not found.");
}

function listEntries(buffer) {
  const eocd = locateEndOfCentralDirectory(buffer);
  const total = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  if (cursor === 0xffffffff) throw new Error("ZIP64 VSIX is not supported by this preflight.");
  const entries = [];
  for (let index = 0; index < total; index += 1) {
    if (buffer.readUInt32LE(cursor) !== CD_SIG) {
      throw new Error(`Corrupt central directory at byte ${cursor}.`);
    }
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const size = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    entries.push({
      name: buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"),
      compression,
      compressedSize,
      size,
      localOffset,
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntry(buffer, entry) {
  const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.compression === 0) return raw;
  if (entry.compression === 8) return inflateRawSync(raw);
  throw new Error(`Unsupported compression method ${entry.compression} for ${entry.name}.`);
}

// ── Manifest checks ─────────────────────────────────────────────────────────

// Read from each host's own resources/app/product.json. Cursor and Kiro report
// only their vendor version there, so their API level is proven by the install
// leg of scripts/test-vscode-family.mjs instead of asserted here.
const KNOWN_FORK_API_BASE = {
  Windsurf: "1.110.1",
  Antigravity: "1.107.0",
};

record("publisher declared", Boolean(manifest.publisher), manifest.publisher
  ? `publisher=${manifest.publisher} (must own the Open VSX namespace of the same name)`
  : "package.json has no publisher; Open VSX derives the namespace from it");
record("license declared", Boolean(manifest.license), manifest.license
  ? `license=${manifest.license}`
  : "Open VSX requires a license; publishing without one is rejected");
record("icon declared", Boolean(manifest.icon), manifest.icon ?? "no icon field");
record("repository declared", Boolean(manifest.repository?.url), manifest.repository?.url ?? "no repository.url");
record("description declared", Boolean(manifest.description), manifest.description ? "present" : "missing");
record(
  "no proposed APIs",
  !manifest.enabledApiProposals,
  manifest.enabledApiProposals
    ? `enabledApiProposals=${JSON.stringify(manifest.enabledApiProposals)} — forks do not ship proposed APIs`
    : "none declared",
);

const engineRange = manifest.engines?.vscode;
const engineFloor = engineRange ? semver.minVersion(engineRange) : null;
if (!engineFloor) {
  record("engines.vscode parses", false, `engines.vscode=${engineRange ?? "(missing)"} is not a usable semver range`);
} else {
  const tooNew = Object.entries(KNOWN_FORK_API_BASE)
    .filter(([, base]) => semver.gt(engineFloor, base))
    .map(([name, base]) => `${name} is on ${base}`);
  record(
    "engines.vscode reachable by every target host",
    tooNew.length === 0,
    tooNew.length === 0
      ? `floor ${engineFloor.version} <= ${Object.entries(KNOWN_FORK_API_BASE).map(([n, v]) => `${n} ${v}`).join(", ")}`
      : `floor ${engineFloor.version} excludes: ${tooNew.join("; ")}`,
  );
}

// ── VSIX content checks ─────────────────────────────────────────────────────

const vsixName = `${manifest.name}-${manifest.version}.vsix`;
let vsixDigest = null;
if (!existsSync(vsixPath)) {
  record("VSIX built for this version", false, `${vsixName} not found — run: npm run openvsx:package`);
} else {
  const buffer = readFileSync(vsixPath);
  vsixDigest = createHash("sha256").update(buffer).digest("hex");
  const megabytes = (buffer.length / 1_048_576).toFixed(2);
  record("VSIX built for this version", true, `${vsixName} (${megabytes} MiB, sha256 ${vsixDigest.slice(0, 12)}…)`);
  record("VSIX size is registry-sane", buffer.length < 100 * 1_048_576, `${megabytes} MiB`, { soft: true });

  let entries = null;
  try {
    entries = listEntries(buffer);
    record("VSIX archive is readable", true, `${entries.length} entries in the central directory`);
  } catch (error) {
    record("VSIX archive is readable", false, error.message);
  }

  if (entries) {
    const names = new Set(entries.map((entry) => entry.name.replace(/\\/g, "/")));
    const has = (path) => names.has(path);

    const inner = entries.find((entry) => entry.name.replace(/\\/g, "/") === "extension/package.json");
    if (!inner) {
      record("shipped manifest present", false, "extension/package.json is missing from the VSIX");
    } else {
      const shipped = JSON.parse(readEntry(buffer, inner).toString("utf8"));
      const drift = ["name", "version", "publisher", "main"]
        .filter((field) => shipped[field] !== manifest[field])
        .map((field) => `${field}: vsix=${shipped[field]} src=${manifest[field]}`);
      record(
        "shipped manifest matches source",
        drift.length === 0,
        drift.length === 0
          ? `${shipped.publisher}.${shipped.name}@${shipped.version}`
          : `stale VSIX — ${drift.join("; ")}; rebuild with npm run openvsx:package`,
      );
      // Functional parity across hosts is only meaningful if the command surface
      // actually travels inside the artifact, not just in the source manifest.
      const commandCount = shipped.contributes?.commands?.length ?? 0;
      const sourceCount = manifest.contributes?.commands?.length ?? 0;
      record(
        "shipped command surface intact",
        commandCount > 0 && commandCount === sourceCount,
        `${commandCount} contributed commands in the VSIX (source declares ${sourceCount})`,
      );
    }

    const entryPoint = `extension/${String(manifest.main ?? "").replace(/^\.?\//, "")}`;
    for (const required of [entryPoint, "extension.vsixmanifest", "[Content_Types].xml"]) {
      record(`required entry: ${required}`, has(required), has(required) ? "present" : "missing from the VSIX");
    }
    // vsce lower-cases readme/changelog and licenses arrive as LICENSE, LICENSE.md
    // or LICENSE.txt, so match the family rather than one spelling.
    const STORE_ASSETS = [
      { label: "license file", pattern: /^extension\/LICEN[SC]E(\.(md|txt))?$/i },
      { label: "readme (listing body)", pattern: /^extension\/README(\.(md|txt))?$/i },
      { label: "changelog", pattern: /^extension\/CHANGELOG(\.(md|txt))?$/i },
      { label: `icon (${manifest.icon ?? "none declared"})`, pattern: new RegExp(`^extension/${(manifest.icon ?? " ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    ];
    for (const asset of STORE_ASSETS) {
      const hit = [...names].find((name) => asset.pattern.test(name));
      record(
        `store asset: ${asset.label}`,
        Boolean(hit),
        hit ?? "missing — the Open VSX listing renders without it",
        { soft: true },
      );
    }

    // "SEE LICENSE IN <file>" is a promise about the artifact; keep it truthful.
    const licensePointer = /^SEE LICEN[SC]E IN\s+(.+)$/i.exec(String(manifest.license ?? ""));
    if (licensePointer) {
      const pointed = `extension/${licensePointer[1].trim()}`;
      record(
        "license pointer resolves inside the VSIX",
        has(pointed),
        has(pointed)
          ? `${manifest.license} → ${pointed}`
          : `package.json says "${manifest.license}" but ${pointed} does not ship; the listing will show a dead license reference`,
        { soft: true },
      );
    }

    // .vscodeignore states an intent; the central directory states what actually
    // leaves the building. Only the second one is evidence.
    const FORBIDDEN = [
      { label: "no dotenv files", match: (name) => /(^|\/)\.env(\..*)?$/i.test(name) },
      {
        label: "no private keys or certificates",
        match: (name) => /\.(pem|key|p12|pfx|jks|keystore)$/i.test(name)
          || /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i.test(name),
      },
      { label: "no node_modules tree", match: (name) => name.startsWith("extension/node_modules/") },
      { label: "no TypeScript sources", match: (name) => /^extension\/src\//.test(name) },
      { label: "no compiled tests", match: (name) => /^extension\/(out|dist)\/.*test/i.test(name) },
      { label: "no nested VSIX", match: (name) => name.endsWith(".vsix") },
      { label: "no source maps", match: (name) => name.endsWith(".map"), soft: true },
    ];
    for (const rule of FORBIDDEN) {
      const hits = [...names].filter(rule.match);
      record(
        rule.label,
        hits.length === 0,
        hits.length === 0
          ? "clean"
          : `${hits.length} offending entr${hits.length === 1 ? "y" : "ies"}: ${hits.slice(0, 5).join(", ")}`,
        { soft: rule.soft === true },
      );
    }
  }
}

// ── Registry state checks ───────────────────────────────────────────────────

const REGISTRY = "https://open-vsx.org";
const namespace = manifest.publisher;

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  return { status: response.status, body: response.ok ? await response.json() : null };
}

if (offline) {
  record("Open VSX registry state", true, "skipped (--offline): namespace and version reuse were NOT checked", { soft: true });
} else if (!namespace) {
  record("Open VSX registry state", false, "cannot query the registry: package.json declares no publisher");
} else {
  try {
    const ns = await getJson(`${REGISTRY}/api/${namespace}`);
    record(
      "Open VSX namespace is claimed",
      ns.status === 200,
      ns.status === 200
        ? `${REGISTRY}/api/${namespace} resolves`
        : `${REGISTRY}/api/${namespace} → HTTP ${ns.status}. Sign in to ${REGISTRY} with GitHub, mint a token, then: npx ovsx create-namespace ${namespace}`,
    );
  } catch (error) {
    record("Open VSX namespace is claimed", false, `namespace lookup failed: ${error.message}`, { soft: true });
  }

  try {
    const exact = await getJson(`${REGISTRY}/api/${namespace}/${manifest.name}/${manifest.version}`);
    record(
      "version is not already published",
      exact.status !== 200,
      exact.status === 200
        ? `${namespace}.${manifest.name}@${manifest.version} already exists — Open VSX rejects overwrites, so bump the version first`
        : `${manifest.version} is unpublished (HTTP ${exact.status})`,
    );
    const latest = await getJson(`${REGISTRY}/api/${namespace}/${manifest.name}`);
    if (latest.status === 200 && latest.body?.version) {
      record(
        "local version moves the listing forward",
        semver.gt(manifest.version, latest.body.version),
        semver.gt(manifest.version, latest.body.version)
          ? `${latest.body.version} → ${manifest.version}`
          : `Open VSX already serves ${latest.body.version}, which is >= local ${manifest.version}`,
      );
    } else {
      record("local version moves the listing forward", true, `no prior release on Open VSX; ${manifest.version} would be the first`);
    }
  } catch (error) {
    record("version is not already published", false, `version lookup failed: ${error.message}`, { soft: true });
  }
}

// ── Cross-editor runtime evidence ───────────────────────────────────────────

// One Open VSX publish reaches five hosts, so "it installs" is not enough: the
// claim being made is that the SAME artifact behaves the same everywhere. That
// claim is only as good as the probe reports left by
// SOTERAI_PACKAGED_RUNTIME=1 node scripts/test-vscode-family.mjs all.
const OPEN_VSX_HOSTS = ["cursor", "windsurf", "codium", "kiro", "antigravity"];
const runtimeDir = join(repoRoot, "artifacts", "editor-runtime");
const runtimeFiles = existsSync(runtimeDir)
  ? readdirSync(runtimeDir).filter((file) => file.endsWith(".json"))
  : [];

// Evidence is only demandable for hosts this machine can actually run. Hosts that
// are not installed are reported as unverified rather than quietly assumed good.
function isInstalled(command) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  return spawnSync(locator, [command], { encoding: "utf8" }).status === 0;
}

for (const host of OPEN_VSX_HOSTS) {
  const reportPath = join(runtimeDir, `${host}.json`);
  const installed = isInstalled(host);
  if (!runtimeFiles.includes(`${host}.json`)) {
    record(
      `runtime evidence: ${host}`,
      false,
      installed
        ? `${host} is installed here but has no artifacts/editor-runtime/${host}.json — run: SOTERAI_PACKAGED_RUNTIME=1 node scripts/test-vscode-family.mjs ${host}`
        : `${host} is not installed on this machine, so parity there is UNVERIFIED (sideload + probe it before claiming support)`,
      { soft: !installed },
    );
    continue;
  }
  let evidence = null;
  try {
    evidence = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    record(`runtime evidence: ${host}`, false, `${host}.json is unreadable: ${error.message}`);
    continue;
  }
  const passed = evidence.result === "PASS" && evidence.packagedExecution === true;
  const sameVersion = evidence.version === manifest.version;
  const sameBytes = vsixDigest !== null && evidence.artifact?.sha256 === vsixDigest;
  record(
    `runtime evidence: ${host}`,
    passed && sameVersion && sameBytes,
    passed && sameVersion && sameBytes
      ? `PASS in ${evidence.editor?.appName ?? host} — ${evidence.checks?.length ?? 0} runtime checks on ${manifest.version} (sha256 ${vsixDigest.slice(0, 12)}…)`
      : !passed
        ? `probe result=${evidence.result} packagedExecution=${evidence.packagedExecution}`
        : !sameVersion
          ? `evidence is for ${evidence.version ?? "an unrecorded version"}, not ${manifest.version} — re-run the probe`
          : `evidence was produced by a different build of ${manifest.version} (evidence sha256 ${evidence.artifact?.sha256?.slice(0, 12) ?? "absent"}…, VSIX ${vsixDigest?.slice(0, 12) ?? "unreadable"}…) — re-run the probe against the current artifact`,
  );
}

// ── Credential check ────────────────────────────────────────────────────────

const hasToken = Boolean(process.env.OVSX_PAT);
if (requireToken) {
  record(
    "OVSX_PAT available",
    hasToken,
    hasToken
      ? "set in the environment (value never read or printed by this script)"
      : `not set — mint a token at ${REGISTRY}/user-settings/tokens and pass it via the environment, never on the command line`,
  );
} else {
  record("OVSX_PAT available", true, hasToken ? "set (value never printed)" : "not set — pass --require-token to make this blocking", { soft: false });
}

// ── Report ──────────────────────────────────────────────────────────────────

const ready = failures.length === 0;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  registry: REGISTRY,
  target: {
    namespace: namespace ?? null,
    extension: namespace ? `${namespace}.${manifest.name}` : manifest.name,
    version: manifest.version,
    vsix: vsixPath,
    sha256: vsixDigest,
  },
  // One publish, five hosts: recorded so the evidence file says what this gate
  // was actually gating.
  reaches: {
    "open-vsx.org": ["VSCodium", "Kiro", "Antigravity"],
    "marketplace.windsurf.com (Open VSX mirror)": ["Windsurf"],
    "marketplace.cursorapi.com (Cursor proxy over Open VSX)": ["Cursor"],
  },
  mode: { requireToken, offline },
  result: ready ? "READY" : "BLOCKED",
  checks,
  failures,
  warnings,
};

mkdirSync(dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Open VSX publish preflight — ${report.target.extension}@${manifest.version}`);
for (const check of checks) {
  const status = check.ok ? "PASS" : check.soft ? "WARN" : "FAIL";
  console.log(`  ${status}  ${check.name}: ${check.detail}`);
}
if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s) — non-blocking:`);
  for (const warning of warnings) console.log(`  - ${warning}`);
}
if (!ready) {
  console.error(`\n${failures.length} blocker(s) — publish refused:`);
  for (const failure of failures) console.error(`  - ${failure}`);
}
console.log(`\nEvidence: ${evidencePath}`);
console.log(ready
  ? "READY: npm run openvsx:publish is safe to run (it will re-run this gate)."
  : "BLOCKED: fix the blockers above, then re-run npm run openvsx:preflight.");
process.exit(ready ? 0 : 1);
