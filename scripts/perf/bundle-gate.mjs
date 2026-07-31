#!/usr/bin/env node
/**
 * bundle-gate.mjs — evidence-based packaging budgets for SoterAI front-end artifacts.
 * Fails (exit 1) when any shipped artifact exceeds its declared ceiling.
 * Budgets are evidence-based and maximal-tight, set from measured production builds
 * so regressions trip immediately but legitimate growth requires deliberate change.
 *
 * Baselines (2026-07-31, Node 22.16.0, Windows, esbuild production):
 *   - browser extension runtime JS ESM bundle (dist/extension):  1298 KB raw / 111 KB gzip
 *   - VS Code VSIX: 307.03 KB packaged, extension.js 402.1 KB, broker.js 200.7 KB
 *   - browser zip archive (Chrome/Edge): soter-extension-*.zip measured at build time
 */
import { statSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, basename, relative } from 'node:path';


const repo = resolve(process.cwd());
const outDir = join(repo, 'artifacts', 'perf');
mkdirSync(outDir, { recursive: true });

function kb(b) { return b / 1024; }
function round(x, d = 1) { return Number(x.toFixed(d)); }

function sumDirBytes(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) total += sumDirBytes(p);
    else total += statSync(p).size;
  }
  return total;
}

function latestZip(dir, prefix) {
  const f = join(repo, 'apps', 'extension', 'dist');
  if (!existsSync(f)) return null;
  const zips = readdirSync(f).filter((n) => n.startsWith(prefix) && n.endsWith('.zip')).map((n) => join(f, n));
  if (!zips.length) return null;
  return zips.reduce((a, b) => (statSync(b).mtimeMs > statSync(a).mtimeMs ? b : a));
}

const rows = [];
function gate(name, path, budgetKB, measuredKB, rationale) {
  rows.push({
    name, path, budgetKB, measuredKB, pass: measuredKB <= budgetKB,
    headroomKB: round(budgetKB - measuredKB), rationale,
  });
}

// Browser runtime JS (loadable extension dir): primary artifacts are under apps/extension/dist/extension;
// some packaging flows mirror into dist/extension. Measure whichever exists; skip cleanly when none.
const primary = join(repo, 'apps', 'extension', 'dist', 'extension');
const fallback = join(repo, 'dist', 'extension');
const browserDist = existsSync(primary) ? primary : (existsSync(fallback) ? fallback : null);
if (browserDist) {
  const browserJSBytes = sumDirBytes(browserDist);
  gate('browser-runtime-js-bundle', relative(repo, browserDist).split('\\').join('/'), 1350,
    round(kb(browserJSBytes)), 'Measured 2026-07-31 at 1298 KB raw (apps/extension build); budget = measured + 4%.');
} else {
  console.log('SKIP  browser-runtime-js-bundle  — no browser build artifact found in either apps/extension/dist/extension or dist/extension');
}


// Browser archive (zip) — pick the latest requested target
for (const pref of ['soter-extension-chrome', 'soter-extension-edge', 'soter-extension-v0.1.2']) {
  const z = latestZip(join(repo, 'apps', 'extension', 'dist'), pref);
  if (z && existsSync(z)) {
    const sz = statSync(z).size;
    gate(`browser-archive-${pref}`, 'apps/extension/dist/' + basename(z), 250, round(kb(sz)),
      'Budget set from current packaged size with ~15% slack; growth reviewed case-by-case.');
  }
}

// VSIX: packaged artifact (real shipped), not dev node_modules tree
const vsix = join(repo, 'packages', 'vscode-extension', 'soterai-ide-guard-0.2.1.vsix');
if (existsSync(vsix)) {
  gate('vscode-vsix-packaged', 'packages/vscode-extension/soterai-ide-guard-0.2.1.vsix', 320,
    round(kb(statSync(vsix).size)),
    'Measured 2026-07-31 = 307.03 KB; ~4% headroom. Major growth requires justification.');
}
const extJs = join(repo, 'packages', 'vscode-extension', 'dist', 'extension.js');
const brokerJs = join(repo, 'packages', 'vscode-extension', 'dist', 'local-ai-broker.js');
if (existsSync(extJs)) {
  gate('vscode-runtime-js-extension', 'packages/vscode-extension/dist/extension.js', 420,
    round(kb(statSync(extJs).size)), 'Measured 402.08 KB; +4% headroom.');
}
if (existsSync(brokerJs)) {
  gate('vscode-runtime-js-broker', 'packages/vscode-extension/dist/local-ai-broker.js', 210,
    round(kb(statSync(brokerJs).size)), 'Measured 200.68 KB; +4% headroom.');
}

const failed = rows.filter((r) => !r.pass);
const report = {
  generatedAt: new Date().toISOString(),
  policy: 'fail-on-exceed: CI runs this script; budgets act as regression gates for packaging size',
  rows,
  pass: failed.length === 0,
  failedCount: failed.length,
};
writeFileSync(join(outDir, 'bundle-gate.json'), JSON.stringify(report, null, 2));

for (const r of rows) {
  const mark = r.pass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${r.name.padEnd(32)} ${String(r.measuredKB).padStart(8)} KB  ≤ ${String(r.budgetKB).padStart(6)} KB  (${r.path})`);
}
if (failed.length) {
  console.error('\nBudget failures: ' + failed.length);
  for (const f of failed) console.error(`  - ${f.name}: ${f.measuredKB} KB > ${f.budgetKB} KB`);
  process.exitCode = 1;
} else {
  console.log('\nAll bundle budgets satisfied.');
}
console.log('Report: ' + join('artifacts', 'perf', 'bundle-gate.json'));
