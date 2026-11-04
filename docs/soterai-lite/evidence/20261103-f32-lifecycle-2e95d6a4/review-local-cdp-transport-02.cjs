'use strict';
// Reads pinned public package source only. Does not load the vendor package,
// instrument a module loader, connect to CDP, launch a browser or use network.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const observationPath = path.join(__dirname, 'public-vendor-observation-02.json');
const observationRaw = fs.readFileSync(observationPath);
const observation = JSON.parse(observationRaw.toString('utf8'));
const rows = new Map(observation.vendorFacts.map(row => [row.path.toLowerCase(), row]));
const repo = path.resolve(__dirname, '../../../..');
function pinned(relative) {
  const file = path.join(repo, relative), row = rows.get(file.toLowerCase());
  assert(row && row.bytes <= 8 * 1024 * 1024);
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size === row.bytes);
  const raw = fs.readFileSync(file); assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256);
  return { fact: row, text: raw.toString('utf8') };
}
const entry = pinned('node_modules/playwright/index.js');
const coreEntry = pinned('node_modules/playwright-core/index.js');
const bootstrap = pinned('node_modules/playwright-core/lib/bootstrap.js');
const core = pinned('node_modules/playwright-core/lib/coreBundle.js');
function witness(source, token, before = 100, after = 650) {
  const offset = source.text.indexOf(token); assert(offset >= 0, 'Expected static vendor path witness absent.');
  return { source: source.fact, token, utf16Offset: offset,
    snippet: source.text.slice(Math.max(0, offset - before), Math.min(source.text.length, offset + token.length + after)),
    status: 'STATIC_SOURCE_WITNESS_ONLY_NOT_A_NATIVE_BEHAVIOR_RESULT' };
}
const witnesses = [
  witness(entry, "module.exports = require('playwright-core');", 0, 0),
  witness(coreEntry, "require('./lib/bootstrap');", 0, 100),
  witness(coreEntry, "module.exports = require('./lib/coreBundle').inprocess.playwright;", 0, 0),
  witness(bootstrap, 'if (process.env.PW_INSTRUMENT_MODULES)', 0, 300),
  witness(core, 'async _connectOverCDPInternal(progress2, endpointURL, options, onClose)', 0, 1600),
  witness(core, 'const closeAndWait = async () => await chromeTransport.closeAndWait();', 0, 130),
  witness(core, 'const doClose = async () => {\n          await closeAndWait();\n          await doCleanup();', 0, 180),
  witness(core, 'const browserProcess = { close: doClose, kill: doClose };', 0, 700),
  witness(core, 'this._ws.once("close", f)', 500, 160),
  witness(core, 'await this.options.browserProcess.close();', 230, 250),
  witness(core, 'if (this._shouldCloseConnectionOnClose)', 130, 380),
  witness(core, 'followRedirects: true, debugLogHeader: "x-playwright-debug-log"', 180, 160),
];
const closeStart = core.text.indexOf('async _connectOverCDPImpl(');
const closeEnd = core.text.indexOf('async connectToWorker(', closeStart);
assert(closeStart >= 0 && closeEnd > closeStart);
const closePath = core.text.slice(closeStart, closeEnd);
assert(closePath.includes('const browserProcess = { close: doClose, kill: doClose };'));
assert(!closePath.includes('launchProcess(') && !closePath.includes('process.kill(') && !closePath.includes('Browser.close'));
const report = {
  schemaVersion: 1, feature: 'F32', status: 'PINNED_CDP_ATTACH_DISCONNECT_STATIC_REVIEW_NATIVE_NOT_RUN',
  observedAt: new Date().toISOString(), independence: 'LOW_SAME_LINEAGE_SOURCE_REVIEW',
  publicVendorObservation: { path: observationPath, bytes: observationRaw.length, sha256: sha(observationRaw) },
  packageVersions: observation.playwright.packages.map(item => ({ name: item.name, version: item.version,
    installedFileCount: item.completeInstalledFileGraph.length, manifest: item.manifest })),
  entry: entry.fact, sourceFilesRead: [entry.fact, coreEntry.fact, bootstrap.fact, core.fact], witnesses,
  reviewedAttachClosePath: 'playwright/index.js -> playwright-core/index.js -> bundled inprocess Chromium CDP attach. CDP _connectOverCDPImpl supplies browserProcess.close and browserProcess.kill as the same doClose closure; it invokes transport.closeAndWait plus scoped artifact cleanup. Browser server close delegates browserProcess.close; WebSocketTransport closes its own socket and waits for close. No OS child process kill is on this inspected attached-browser closure.',
  limits: [
    'Library launch, browser server, tests and other paths contain process-launch/kill capabilities. Those are not invoked or admitted by this attach-only review.',
    'Full installed playwright/playwright-core file graph was hashed twice, not every dynamic code path executed or behavior proven.',
    'PW_INSTRUMENT_MODULES enables a module-load hook in bootstrap. Scrubbed fixture environment must not set it; no require hook is part of the fixture.',
    'Current bundled CDP helper explicitly permits WebSocket redirects. Numeric initial endpoint plus ownership of current vendor Code listener is the admitted cooperative-vendor boundary, not a general library enforcement of loopback at every redirect.',
    'For stricter transport admission, the driver should perform a bounded no-redirect loopback /json/version lookup, validate returned ws URL exact numeric127.0.0.1/sameport/no credentials, and declare remaining internal WebSocket redirect behavior. Do not claim no possible redirects or external requests from source review alone.',
    'No browser, process, listener, CDP request, keyboard interaction, token or SecretStorage read ran in this static review.'
  ],
  hostLaunches: 0, processQueries: 0, listenerQueries: 0, networkRequests: 0, signalsRequested: 0,
  admission: 'ROOT_FRESH_SOURCE_VSIX_SIGNATURE_VENDOR_BINDING_AND_READ_ONLY_OWNER_CUSTODY_REQUIRED',
};
const output = path.join(__dirname, 'local-cdp-transport-review-02.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, witnesses: witnesses.length, output, sha256: sha(fs.readFileSync(output)), hostLaunches: 0 }));
