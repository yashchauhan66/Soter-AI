'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let source = fs.readFileSync(path.join(__dirname, 'review-local-cdp-transport-01.cjs'), 'utf8');
const before = "const closePath = core.text.slice(core.text.indexOf('async _connectOverCDPImpl('), core.text.indexOf('async connectToWorker('));";
const after = "const closeStart = core.text.indexOf('async _connectOverCDPImpl(');\nconst closeEnd = core.text.indexOf('async connectToWorker(', closeStart);\nassert(closeStart >= 0 && closeEnd > closeStart);\nconst closePath = core.text.slice(closeStart, closeEnd);";
assert.equal(source.split(before).length - 1, 1); source = source.replace(before, () => after);
source = source.replace("'local-cdp-transport-review-01.json'", "'local-cdp-transport-review-02.json'");
fs.writeFileSync(path.join(__dirname, 'review-local-cdp-transport-02.cjs'), source, { flag: 'wx' });
fs.writeFileSync(path.join(__dirname, 'cdp-review-attempt-01-failure.json'), JSON.stringify({
  status: 'STATIC_REVIEW_SELECTOR_FAILURE_RETAINED_NOT_NATIVE', actualToolExitCode: 1,
  diagnosis: 'All12 individual source-token witnesses were found, but the final bounded section used the first global async connectToWorker occurrence, which precedes the Chromium CDP section. The empty section failed assert rather than inventing acceptance. Successor02 selects the ending marker after the verified starting offset and retains all original assertions.',
  source: 'review-local-cdp-transport-01.cjs', source02: 'review-local-cdp-transport-02.cjs',
  currentObservation: 'public-vendor-observation-02.json', hostLaunches: 0, processQueries: 0,
  listenerQueries: 0, networkRequests: 0, signalsRequested: 0,
}, null, 2) + '\n', { flag: 'wx' });
