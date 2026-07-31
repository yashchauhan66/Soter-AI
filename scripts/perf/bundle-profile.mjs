#!/usr/bin/env node
/**
 * bundle-profile.mjs — factual bundle inventory for SoterAI extensions.
 * Reports:
 *  - per-bundle (dist/extension, apps/extension/dist, packages/vscode-extension) file tree sizes
 *  - duplicate module names across the tree (basename-level heuristic)
 *  - presence/size of sourcemaps, tests, fixtures, docs/READMEs inside shipped dirs
 *  - largest JS modules by raw + gzip
 *  - top repeated string tables (regex/detectors) shared across generated chunks
 *
 * Outputs JSON to artifacts/perf/bundle-profile.json and a short console summary.
 * Read-only: does not modify source or dist.
 */
import { readdirSync, statSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { platform } from 'node:os';

const repo = resolve(process.cwd());
const outDir = join(repo, 'artifacts', 'perf');
mkdirSync(outDir, { recursive: true });

const codeExts = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.map']);
const docFiles = new Set(['README.md', 'CHANGELOG.md', 'LICENSE', 'NOTICE', '.npmignore']);

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function profileTree(root, label) {
  const files = [];
  const byBase = new Map();
  let total = 0, totalGzip = 0, jsCount = 0, jsBytes = 0, mapBytes = 0, docBytes = 0, testBytes = 0;
  const largest = [];
  for (const f of walk(root)) {
    const st = statSync(f);
    const rel = relative(root, f).split('\\').join('/');
    const ext = extname(f);
    const isJs = ['.js', '.mjs', '.cjs'].includes(ext) && !f.endsWith('.map');
    const isMap = ext === '.map' || f.endsWith('.js.map');
    const isDoc = docFiles.has(f.split(/[\\/]/).pop() || '') || /docs?[\\/]/.test(rel) || /\.md$/.test(rel);
    const isTest = /__tests__[\\/]/.test(rel) || /test[\\/]/.test(rel) || /\.test\./.test(rel) || /fixture|fixture[s]?[\\/]/.test(rel);
    let gz = 0;
    if (isJs || isMap) {
      gz = gzipSync(readFileSync(f)).length;
      if (isJs) { jsCount += 1; jsBytes += st.size; totalGzip += gz; }
      else mapBytes += st.size;
    }
    if (isDoc) docBytes += st.size;
    if (isTest) testBytes += st.size;
    total += st.size;
    files.push({ path: rel, bytes: st.size });
    const base = rel.split('/').pop();
    byBase.set(base, (byBase.get(base) || []).concat(rel));
    if (isJs || isMap) largest.push({ path: rel, bytes: st.size, gzip: gz });
  }
  const duplicates = [...byBase.entries()].filter(([, paths]) => paths.length > 1)
    .map(([base, paths]) => ({ base, count: paths.length, paths }));
  largest.sort((a, b) => b.bytes - a.bytes);
  return {
    label,
    root: relative(repo, root).split('\\').join('/') || root,
    fileCount: files.length,
    totalBytes: total,
    totalGzipBytes: totalGzip,
    jsCount,
    jsBytes,
    mapBytes,
    docBytes,
    testBytes,
    largestJs: largest.slice(0, 15),
    duplicates,
  };
}

function probeRegexTables(trees) {
  // find shared regex/detector tables across chunks by counting repeated long literal strings
  const counts = new Map();
  for (const tree of trees) {
    for (const _path of tree.largestJs || []) {
      const rel = _path.path;
      const abs = join(repo, tree.root, rel);
      if (!existsSync(abs)) continue;
      const src = readFileSync(abs, 'utf8');
      // match quoted strings >= 24 chars (threshold to catch detector keywords)
      const re = /["'`]([\x20-\x7E]{24,})["'`]/g;
      let m;
      const local = new Set();
      while ((m = re.exec(src))) {
        const s = m[1];
        if (/\s{2,}|function|=>|undefined/.test(s)) continue;
        local.add(s);
      }
      for (const s of local) counts.set(s, (counts.get(s) || 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, c]) => c > 1)
    .sort((a, b) => (b[0]?.length || 0) - (a[0]?.length || 0))
    .slice(0, 20)
    .map(([str, count]) => ({ length: str.length, count, sample: str.slice(0, 80) }));
}

const candidates = [
  ['browser-dist-extension', join(repo, 'dist', 'extension')],
  ['vscode-extension', join(repo, 'packages', 'vscode-extension')],
  ['browser-apps-extension', join(repo, 'apps', 'extension', 'dist')],
];
const trees = [];
for (const [label, root] of candidates) {
  const r = profileTree(root, label);
  if (r.fileCount > 0) trees.push(r);
}
const repeatedTables = probeRegexTables(trees);
const summary = { platform: platform(), when: new Date().toISOString(), trees, repeatedTables };
const out = join(outDir, 'bundle-profile.json');
writeFileSync(out, JSON.stringify(summary, null, 2));

for (const t of trees) {
  const kb = (b) => (b / 1024).toFixed(1);
  const gzk = (b) => (b / 1024).toFixed(1);
  console.log(`\n== ${t.label} ==`);
  console.log(` files=${t.fileCount}  raw=${kb(t.totalBytes)} KB  js-gzip=${gzk(t.totalGzipBytes)} KB  maps=${kb(t.mapBytes)} KB  docs=${kb(t.docBytes)} KB  tests=${kb(t.testBytes)} KB`);
  console.log(` largest modules (raw/gzip KB):`);
  for (const m of (t.largestJs || []).slice(0, 8)) {
    console.log(`   ${kb(m.bytes).padStart(9)} / ${gzk(m.gzip).padStart(9)}  ${m.path}`);
  }
  if (t.duplicates.length) {
    const top = t.duplicates.slice(0, 5);
    console.log(` duplicate basenames (${t.duplicates.length} total):`);
    for (const d of top) console.log(`   x${d.count}  ${d.base}`);
  }
}
if (repeatedTables.length) {
  console.log(`\n shared long literals repeated across modules (potential shared tables):`);
  for (const r of repeatedTables.slice(0, 6)) console.log(`   len=${r.length} x${r.count}  "${r.sample}"`);
}
console.log(`\n wrote ${relative(repo, out)}`);
