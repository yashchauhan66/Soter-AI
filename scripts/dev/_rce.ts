/**
 * Why does "Agent escalation or RCE attempt" only reach lift 7.5?
 *
 * The rule is a cross product: a subject token (agent, plugin, tool, autogpt...)
 * within 240 characters of a capability token (rce, shell access, container
 * escape...). Lift is computed over the whole rule, which hides the fact that
 * a cross product is only as precise as its worst cell. This scores each side
 * alone, then every cell, so the fix is a deletion with a number behind it rather
 * than a guess.
 *
 * Suspicion to test first: `rce` is written WITHOUT word boundaries, so it also
 * matches inside "source", "resource", "force" and "enforce" — all of which are
 * ordinary infrastructure prose, which is exactly what the benign fires look like.
 */
import { readFileSync } from "node:fs";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);
const nb = rows.filter((r) => isB(r.label)).length;
const na = rows.length - nb;

const SUBJ = ["autogpt", "auto-gpt", String.raw`\bagent\b`, "rag(?:-llm)?", "llm integration", "plugin", "tool"];
const CAP = ["docker escape", "container escape", "remote code execution", "rce", "reverse shell",
  "shell access", "execute commands?", String.raw`read /etc/shadow`, "escape sandbox"];

function score(src: string) {
  const re = new RegExp(src, "i");
  let b = 0, a = 0;
  for (const r of rows) if (re.test(r.text)) { if (isB(r.label)) b++; else a++; }
  return { b, a, lift: b === 0 ? Infinity : (a / na) / (b / nb) };
}
const f = (x: { b: number; a: number; lift: number }) =>
  `${String(x.b).padStart(4)} ${String(x.a).padStart(4)} ${(x.lift === Infinity ? "inf" : x.lift.toFixed(1)).padStart(7)}`;

console.log("SUBJECT tokens alone            ben  atk    lift");
for (const s of SUBJ) console.log(`  ${s.padEnd(28)}${f(score(s))}`);
console.log("\nCAPABILITY tokens alone         ben  atk    lift");
for (const c of CAP) console.log(`  ${c.padEnd(28)}${f(score(c))}`);

console.log("\nIs `rce` unbounded the problem?");
for (const v of ["rce", String.raw`\brce\b`]) {
  const s = score(v);
  console.log(`  ${v.padEnd(28)}${f(s)}`);
}
const bare = new RegExp("rce", "i");
const bounded = new RegExp(String.raw`\brce\b`, "i");
const collat = new Map<string, number>();
for (const r of rows) {
  if (!isB(r.label)) continue;
  if (bare.test(r.text) && !bounded.test(r.text)) {
    for (const m of r.text.match(/\w*rce\w*/gi) ?? []) collat.set(m.toLowerCase(), (collat.get(m.toLowerCase()) ?? 0) + 1);
  }
}
console.log("  words in BENIGN rows that `rce` matches inside:",
  [...collat.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([w, n]) => `${w}(${n})`).join(" ") || "none");

console.log("\nPer-cell, subject x capability (cells with any benign fire):");
console.log("   ben  atk    lift   subject / capability");
const cells: { b: number; a: number; lift: number; s: string; c: string }[] = [];
for (const s of SUBJ) for (const c of CAP) {
  const r = score(`(?:${s}).{0,240}(?:${c})`);
  if (r.b || r.a) cells.push({ ...r, s, c });
}
for (const x of cells.sort((p, q) => q.b - p.b || q.a - p.a))
  console.log(`  ${f(x)}   ${x.s} -> ${x.c}`);

// What the rule looks like if every cell below lift 10 is dropped.
const keep = cells.filter((x) => x.lift >= 10);
const dropped = cells.filter((x) => x.lift < 10);
console.log(`\nkeeping ${keep.length} cells, dropping ${dropped.length}`);
const whole = score(`(?:${SUBJ.join("|")}).{0,240}(?:${CAP.join("|")})`);
console.log(`  WHOLE RULE NOW   ${f(whole)}`);
if (keep.length) {
  const s2 = [...new Set(keep.map((x) => x.s))], c2 = [...new Set(keep.map((x) => x.c))];
  console.log(`  KEEP-CELLS ONLY  ${f(score(`(?:${s2.join("|")}).{0,240}(?:${c2.join("|")})`))}`);
  console.log(`    subjects kept: ${s2.join(", ")}`);
  console.log(`    caps kept    : ${c2.join(", ")}`);
}
