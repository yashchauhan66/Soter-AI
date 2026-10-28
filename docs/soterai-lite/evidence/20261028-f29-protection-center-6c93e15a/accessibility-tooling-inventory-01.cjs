"use strict";
// Read-only local tooling discovery. No browser, Code, network, child, or signals.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../../..");
const output = path.join(__dirname, "accessibility-tooling-inventory-01.json");
assert(!fs.existsSync(output), "Refuse to overwrite an earlier observation.");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function pin(filename, limit = 400 * 1024 * 1024) {
    const absolute = path.isAbsolute(filename) ? filename : path.join(root, filename);
    const stat = fs.lstatSync(absolute);
    assert(stat.isFile() && !stat.isSymbolicLink(), `Ordinary fixed file required: ${filename}`);
    assert(stat.size <= limit, `Bounded local input required: ${filename}`);
    const bytes = fs.readFileSync(absolute);
    return { path: absolute, bytes: bytes.length, sha256: sha(bytes) };
}
const app = "C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/e646868227/resources/app";
const playwright = JSON.parse(fs.readFileSync(path.join(root, "node_modules/playwright/package.json"), "utf8"));
const axe = JSON.parse(fs.readFileSync(path.join(root, "node_modules/axe-core/package.json"), "utf8"));
const corePath = "node_modules/playwright-core/lib/coreBundle.js";
const core = fs.readFileSync(path.join(root, corePath), "utf8");
const workbenchPath = path.join(app, "out/vs/workbench/workbench.desktop.main.js");
const workbench = fs.readFileSync(workbenchPath, "utf8");
const excerpts = (text, terms) => terms.map(term => {
    const offset = text.indexOf(term);
    return { term, offset, present: offset >= 0, excerpt: offset < 0 ? null : text.slice(Math.max(0, offset - 55), offset + term.length + 95) };
});
const result = {
    schemaVersion: 1,
    status: "PREPARED_STATIC_LOCAL_INVENTORY_NOT_ACCESSIBILITY_ACCEPTANCE",
    observedAt: new Date().toISOString(),
    independence: "LOW_SAME_LINEAGE",
    browserLaunched: false,
    editorLaunched: false,
    networkRequests: 0,
    signals: 0,
    versions: { playwright: playwright.version, axe: axe.version, edgeFileVersionObserved: "157.0.4341.24", codePriorPinVersion: "1.143.1" },
    pins: [
        pin("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"),
        pin("C:/Program Files (x86)/Microsoft/Edge/Application/157.0.4341.24/msedge.dll"),
        pin("node_modules/playwright/package.json"),
        pin("node_modules/playwright-core/package.json"),
        pin(corePath),
        pin("node_modules/axe-core/package.json"),
        pin("node_modules/axe-core/axe.min.js"),
        pin(workbenchPath),
        pin(path.join(app, "extensions/theme-defaults/package.json")),
        pin(path.join(app, "extensions/theme-defaults/themes/hc_black.json")),
        pin(path.join(app, "extensions/theme-defaults/themes/hc_light.json")),
    ],
    staticWitnesses: {
        playwright: excerpts(core, ["async function launchProcess(options)", "taskkill /pid", "async _connectOverCDPInternal", "chromeTransport.close()"]),
        workbench: excerpts(workbench, ["workbench.reduceMotion", "prefers-reduced-motion", "monaco-reduce-motion", "hc-black", "role", "treeitem"]),
    },
    acceptance: {
        nativeTreeKeyboard: "NOT_RUN",
        nativeTreeHighContrast: "NOT_RUN",
        nativeTreeReducedMotion: "NOT_RUN",
        edgeAxeAdjacentShippedWebview: "NOT_RUN_UNBOUND",
        humanScreenReader: "NOT_RUN_HUMAN_REQUIRED_LATER",
        note: "No DOM mock, duplicate product instance, new renderer, old artifact PASS transfer, or native command invocation is counted as keyboard execution.",
    },
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, output: path.relative(root, output).replace(/\\/g, "/"), pins: result.pins.length, browserLaunched: false, editorLaunched: false }));
