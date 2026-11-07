'use strict';
// Read installed public package inputs only. No tool process, profile, token or network access.
const fs = require('node:fs'), path = require('node:path');
const { routes, selectVendorInputs } = require('./prepare-v01-routes.cjs'), { pin, fact } = require('./prepare-v01-affected.cjs');
const repo = path.resolve(__dirname, '../../../../..');
const results = routes.map(route => {
 const file = path.join(repo, 'docs/soterai-lite/evidence', route.directory, route.pinFile), record = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
 const inputs = [...(record.inputs || record.files), ...(record.dependencies || []).flatMap(row => row.files), ...(record.node ? [record.node] : [])], failures = [];
 for (const row of inputs) { try { pin(row); } catch (error) { failures.push({ path: row.path, reason: error.code || 'BYTES_CHANGED' }); } }
 if (process.argv[3] === '--resolved') {
  try { const resolved = selectVendorInputs(route, record); return { route: route.id, version: record.version, originalPin: fact(file), selectedInputCount: resolved.inputs.length, status: resolved.relocations.length ? 'RETAINED_EXACT_PUBLIC_INPUTS_AVAILABLE_NOT_CURRENT_INSTALLED_ROUTE_PASS' : 'SELECTED_PUBLIC_PINS_STILL_EXACT_NOT_ROUTE_PASS', relocations: resolved.relocations, originalMissingOrChanged: failures.length, failures: [] }; }
  catch (error) { return { route: route.id, status: 'PINNED_PUBLIC_INPUTS_NOT_AVAILABLE', failures: [{ reason: error.code || error.message }] }; }
 }
 return { route: route.id, version: record.version, originalPin: fact(file), selectedInputCount: inputs.length, status: failures.length ? 'PUBLIC_PIN_CHANGED_OR_MISSING' : 'SELECTED_PUBLIC_PINS_STILL_EXACT_NOT_ROUTE_PASS', failures };
});
const output = { observedAt: new Date().toISOString(), nativeLaunches: 0, results };
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(output, null, 2)); if (results.some(row => row.failures.length)) process.exitCode = 1;
