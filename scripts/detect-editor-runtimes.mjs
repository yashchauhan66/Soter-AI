#!/usr/bin/env node
/**
 * Editor Runtime Detection & Harness Script
 *
 * Detects installed editor executables and produces the exact commands needed
 * to run the SoterAI extension in isolation for each editor.
 *
 * Usage:
 *   node scripts/detect-editor-runtimes.mjs
 *
 * Exit code: 0 = all checks passed, 1 = no editors detected but script works.
 *
 * Each detected editor gets:
 *   ✓ Detection status
 *   ✓ Exact command to install + test the VSIX in isolation
 *   ✓ Which features to verify (broker startup, policy load, context protection,
 *     secret redaction, controlled terminal, MCP route, lockdown)
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { platform, homedir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const extensionRoot = join(repoRoot, "packages", "vscode-extension");
const version = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8")).version;
const vsixRelative = `packages/vscode-extension/soterai-ide-guard-${version}.vsix`;

// ── Editor detection paths ──────────────────────────────────────────────

function which(cmd) {
  try {
    const locator = platform() === "win32" ? "where.exe" : "which";
    const output = execSync(`${locator} ${cmd}`, { stdio: "pipe", encoding: "utf8" }).trim();
    const paths = output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    return paths.find((value) => platform() !== "win32" || /\.(cmd|exe)$/i.test(value)) ?? paths[0] ?? null;
  } catch { return null; }
}

function tryPaths(paths) {
  for (const p of paths) {
    const expanded = p.replace(/^~/, homedir());
    if (existsSync(expanded)) return expanded;
  }
  return null;
}

const extensionId = "soterai.soterai-ide-guard";

// `gallery` is the extension registry each host resolves at runtime, read from
// its own resources/app/product.json. It decides which registry must carry the
// extension for install-by-search (as opposed to sideloading) to work there.
const editorTargets = {
  "VS Code": { cli: "code", gallery: "Visual Studio Marketplace", paths: [
    "/usr/local/bin/code", "/snap/bin/code", "~/.vscode-server/bin/*/bin/code",
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
    `${homedir()}\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd`,
    "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd",
  ] },
  "Cursor": { cli: "cursor", gallery: "marketplace.cursorapi.com (Cursor proxy over Open VSX)", paths: [
    "~/.cursor-server/bin/*/bin/cursor",
    "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    `${homedir()}\\AppData\\Local\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd`,
  ] },
  "Windsurf": { cli: "windsurf", gallery: "marketplace.windsurf.com (Open VSX mirror)", paths: [
    "~/.windsurf-server/bin/*/bin/windsurf",
    "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf",
    `${homedir()}\\AppData\\Local\\Programs\\Windsurf\\bin\\windsurf.cmd`,
  ] },
  "VSCodium": { cli: "codium", gallery: "open-vsx.org", paths: [
    "/usr/local/bin/codium",
    "/Applications/VSCodium.app/Contents/Resources/app/bin/codium",
    `${homedir()}\\AppData\\Local\\Programs\\VSCodium\\bin\\codium.cmd`,
  ] },
  "Kiro": { cli: "kiro", gallery: "open-vsx.org", paths: [
    "/usr/local/bin/kiro",
    "/Applications/Kiro.app/Contents/Resources/app/bin/kiro",
    `${homedir()}\\AppData\\Local\\Programs\\Kiro\\bin\\kiro.cmd`,
  ] },
  "Antigravity": { cli: "antigravity", gallery: "open-vsx.org", paths: [
    "/usr/local/bin/antigravity",
    "/Applications/Antigravity.app/Contents/Resources/app/bin/antigravity",
    `${homedir()}\\AppData\\Local\\Programs\\Antigravity IDE\\bin\\antigravity.cmd`,
  ] },
};

const editors = Object.fromEntries(
  Object.entries(editorTargets).map(([name, target]) => [name, {
    exe: which(target.cli) || tryPaths(target.paths),
    cli: target.cli,
    gallery: target.gallery,
    isolation: `${target.cli} --user-data-dir=/tmp/soterai-${target.cli}-data --extensions-dir=/tmp/soterai-${target.cli}-ext`,
    vsixInstall: `${target.cli} --install-extension ${vsixRelative}`,
    uninstall: `${target.cli} --uninstall-extension ${extensionId}`,
  }]),
);

// ── Verification checklist ──────────────────────────────────────────────

const VERIFICATION_STEPS = [
  "1. Extension activates without errors (check Help → Toggle Developer Tools for console errors)",
  "2. Broker starts: run 'SoterAI: Start Local AI Broker' and verify http://127.0.0.1:47321/health responds",
  "3. Policy loads: SoterAI Control Panel shows correct protection status",
  "4. Context protection: run 'SoterAI: Build Safe Prompt for AI' with a secret in the selection — secret is redacted",
  "5. Secret redaction: run 'SoterAI: Scan Current File' — secrets are flagged as diagnostic",
  "6. Controlled terminal: run 'SoterAI: Run Controlled Terminal Command' with 'git status' — runs safely",
  "7. MCP route: run 'SoterAI: Scan MCP / Agent Tools' — config files are scanned",
  "8. Lockdown: run 'SoterAI: Emergency Lockdown' — all capabilities revoked",
  "9. Recovery: run 'SoterAI: Unlock Protection After Lockdown' — returns to normal",
  "10. Uninstall: run the uninstall command — extension removed cleanly",
];

function main() {
  console.log("═══ SoterAI Editor Runtime Detection ═══\n");
  console.log(`Platform: ${platform()}\n`);

  let detected = 0;

  for (const [name, info] of Object.entries(editors)) {
    if (info.exe) {
      detected++;
      console.log(`✓ ${name}: DETECTED`);
      console.log(`  Path: ${info.exe}`);
      console.log(`  Registry: ${info.gallery}`);
      console.log(`  Isolated run:\n    ${info.isolation}\n`);
      console.log(`  Install VSIX:\n    ${info.vsixInstall}\n`);
      console.log(`  Uninstall:\n    ${info.uninstall}\n`);
    } else {
      console.log(`✗ ${name}: NOT DETECTED`);
      console.log(`  (Expected if not installed. To test manually:\n   1. Install ${name}\n   2. Run: ${info.vsixInstall})\n`);
    }
  }

  console.log(`\n═══ Verification Checklist (run inside the isolated editor) ═══\n`);
  for (const step of VERIFICATION_STEPS) {
    console.log(`  ☐ ${step}`);
  }

  console.log(`\n═══ Notes ═══`);
  console.log(`  - The VSIX package is at: ${vsixRelative}${existsSync(join(repoRoot, vsixRelative)) ? "" : "  (NOT BUILT — run: npm run vscode:package)"}`);
  console.log(`  - Cursor, Windsurf, VSCodium, Kiro, and Antigravity all resolve Open VSX (directly or via a`);
  console.log(`    branded proxy/mirror), so one Open VSX publish is what makes the extension`);
  console.log(`    installable by search in all of them. VS Code alone uses the Visual Studio Marketplace.`);
  console.log(`  - Each editor uses isolated user-data and extension directories`);
  console.log(`  - After testing, uninstall the extension and delete the temp directories:`);
  console.log(`      rm -rf /tmp/soterai-*-data /tmp/soterai-*-ext`);
  console.log(`  - The script test-vscode-family.mjs also exists for automated testing:\n      node scripts/test-vscode-family.mjs all`);

  if (detected === 0) {
    console.log(`\n⚠  No editors detected on this machine.`);
    console.log(`   The test-vscode-family.mjs script (${existsSync(join(repoRoot, "scripts", "test-vscode-family.mjs")) ? "exists" : "not found"}) provides automated testing when editors are installed.`);
  }

  console.log(`\n${detected} editor(s) detected.`);
  process.exitCode = detected > 0 ? 0 : 1;
}

main();
