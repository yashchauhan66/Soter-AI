/**
 * ReDoS probe (growth-based). For every regex literal in the guard sources we
 * time it against pump strings at increasing length and look for super-linear
 * growth — the signature of catastrophic backtracking. Lengths stay small so a
 * bad pattern is detected instead of hanging the probe.
 * Run: npx tsx scripts/guard-benchmark/_audit-redos-2026-08-02.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const DIRS = ["lib/guard", "lib/detectors", "lib/classifiers", "packages/guard-core/src/detectors"];
const say = (s: string) => fs.writeSync(1, s + "\n"); // unbuffered: survives a hang

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

const RX_LITERAL = /(^|[=,(\[:!&|?\s])\/((?:[^/\\\n\[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/([gimsuy]*)/g;
const files = DIRS.flatMap((d) => walk(path.join(ROOT, d)));
type Entry = { file: string; src: string; rx: RegExp };
const entries: Entry[] = [];
const seen = new Set<string>();
for (const f of files) {
  for (const m of fs.readFileSync(f, "utf8").matchAll(RX_LITERAL)) {
    const body = m[2];
    const flags = m[3].replace(/g/g, "");
    const key = `${body}//${flags}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try { entries.push({ file: path.relative(ROOT, f), src: `/${body}/${flags}`, rx: new RegExp(body, flags) }); } catch { /* not a regex */ }
  }
}

const UNITS: Array<[string, string]> = [
  ["a", "a"], ["sp", " "], ["ab", "ab"], ["d", "1"], ["w", "ignore "],
  ["exp", "export user data "], ["sl", "/"], ["dot", "."], ["eq", "="],
  ["q", '"'], ["mix", "aA1_"], ["nl", "a\n"], ["uni", "á"], ["b64", "QUJD"],
  ["tag", "<a href=x>"], ["json", '{"k":"v"},'], ["sql", "SELECT * FROM users WHERE "],
  ["kv", "KEY=value "], ["hex", "0x1f"], ["dash", "-"], ["us", "_"], ["col", ":"],
];
const N = [10, 20, 30];

function timeIt(rx: RegExp, s: string): number {
  const t0 = performance.now();
  try { rx.lastIndex = 0; rx.test(s); } catch { /* ignore */ }
  return performance.now() - t0;
}

const NESTED = /\((?![?]:?[=!<])[^)]*[+*][^)]*\)\s*[+*]|\((?:[^)]*\|[^)]*)\)\s*[+*]/;

const suspects: Array<{ e: Entry; unit: string; t: number[] }> = [];
say(`\n═════════ ReDoS growth probe ═════════`);
say(`regex literals: ${entries.length} from ${files.length} guard source files`);
for (const e of entries) {
  for (const [uname, unit] of UNITS) {
    const t = N.map((n) => timeIt(e.rx, unit.repeat(n)));
    // exponential signature: growth from n=10 to n=30 far beyond quadratic
    if (t[2] > 2 && t[2] > t[0] * 20) suspects.push({ e, unit: uname, t });
  }
}
say(`\n── super-linear suspects (${suspects.length}) ──`);
suspects.sort((a, b) => b.t[2] - a.t[2]).slice(0, 30).forEach((s) =>
  say(`  n=10/20/30 → ${s.t.map((x) => x.toFixed(2)).join(" / ")}ms  [${s.unit}]  ${s.e.file}  ${s.e.src.slice(0, 100)}`));
if (!suspects.length) say("  none");

const staticFlags = entries.filter((e) => NESTED.test(e.src));
say(`\n── static nested-quantifier candidates (${staticFlags.length}) ──`);
staticFlags.slice(0, 30).forEach((e) => say(`  ${e.file}  ${e.src.slice(0, 120)}`));

// Confirm the worst suspects at a larger n in a hard-timeout child process.
if (suspects.length) {
  const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
  say(`\n── confirmation at n=60 with 3s hard timeout ──`);
  for (const s of suspects.slice(0, 8)) {
    const probe = `const rx=${s.e.src};const u=${JSON.stringify(UNITS.find((u) => u[0] === s.unit)![1])};const t=Date.now();rx.test(u.repeat(60));console.log(Date.now()-t);`;
    const r = spawnSync(process.execPath, ["-e", probe], { timeout: 3000, encoding: "utf8" });
    const verdict = r.signal || r.error ? "HUNG >3000ms (catastrophic)" : `${(r.stdout || "").trim()}ms`;
    say(`  ${verdict.padEnd(28)} [${s.unit}] ${s.e.file} ${s.e.src.slice(0, 80)}`);
  }
}
say("");
