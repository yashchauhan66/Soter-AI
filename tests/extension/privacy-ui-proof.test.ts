import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd());
const popupSource = fs.readFileSync(path.join(root, "apps/extension/src/popup/PopupApp.tsx"), "utf8");
const sidePanelSource = fs.readFileSync(path.join(root, "apps/extension/src/sidepanel/SidePanelApp.tsx"), "utf8");
const serviceWorkerSource = fs.readFileSync(path.join(root, "apps/extension/src/background/service-worker.ts"), "utf8");
const readmeSource = fs.readFileSync(path.join(root, "apps/extension/README.md"), "utf8");
const privacyDisclosureSource = fs.readFileSync(path.join(root, "docs/extension-store/privacy-practices-disclosure.md"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "apps/extension/manifest.json"), "utf8")) as {
  host_permissions?: string[];
  permissions?: string[];
};

test("browser extension surfaces privacy proof in user-facing UI", () => {
  for (const source of [popupSource, sidePanelSource]) {
    assert.match(source, /What leaves browser\?/);
    assert.match(source, /Raw prompt to SoterAI/);
    assert.match(source, /No by default/);
    assert.match(source, /Redacted preview, safe rewrite, hashes, and policy cache/);
    assert.match(source, /Metadata, decision, risk score, redacted preview/);
  }
});

test("browser extension keeps raw text out of default storage and backend paths", () => {
  assert.match(serviceWorkerSource, /createStorageSafeScanResult/);
  assert.match(serviceWorkerSource, /previewForScan/);
  assert.match(serviceWorkerSource, /Do NOT send raw text to backend/);
  assert.match(serviceWorkerSource, /full_prompt_explicit_admin_enabled/);
  assert.equal(manifest.host_permissions?.includes("<all_urls>"), false);
  assert.equal(manifest.permissions?.includes("tabs"), false);
});

test("browser extension README documents the store privacy contract", () => {
  assert.match(readmeSource, /Privacy Model/);
  assert.match(readmeSource, /Raw prompt text\s+\| Not sent to SoterAI by default/);
  assert.match(readmeSource, /Full prompt logging\s+\| Off by default/);
  assert.match(readmeSource, /does not request `<all_urls>`, `tabs`, `activeTab`, `scripting`, or `webNavigation`/);
  for (const permission of manifest.permissions ?? []) {
    assert.match(readmeSource, new RegExp(`\`${permission}\``));
  }
});

test("browser extension privacy practices disclosure matches Chrome store expectations", () => {
  assert.match(privacyDisclosureSource, /Single Purpose/);
  assert.match(privacyDisclosureSource, /Website content/);
  assert.match(privacyDisclosureSource, /User-generated content/);
  assert.match(privacyDisclosureSource, /Authentication information/);
  assert.match(privacyDisclosureSource, /does not sell extension data/);
  assert.match(privacyDisclosureSource, /Raw prompt to SoterAI: no by default/);
  assert.match(privacyDisclosureSource, /backend privacy guards reject disallowed raw-content fields/);
});
