/**
 * Apply candidate \b boundary fixes, measure row-level recall/FPR before and
 * after, then RESTORE the sources. The edits are never left in place — this is a
 * measurement instrument, not the change itself.
 *
 * The output decides the real edit: if the fixes remove false accusations and
 * row-level recall holds (or improves), they are worth making for real. If rows
 * that were previously flagged become ALLOW, they are NOT worth the boundary.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";

const EDITS: { file: string; from: string; to: string }[] = [
  // "ied" matches inside dried/died/married/specified/verified.
  {
    file: "lib/guard/detectors/broadHarmfulContentDetector.ts",
    from: '"black powder|acetone peroxide|pipe bomb|pressure cooker bomb|ied|car bomb|nail bomb|" +',
    to: '"black powder|acetone peroxide|pipe bomb|pressure cooker bomb|\\\\bieds?\\\\b|car bomb|nail bomb|" +',
  },
  // "meth" matches inside something/methods/methodology.
  {
    file: "lib/guard/detectors/broadHarmfulContentDetector.ts",
    from: '"(?:methamphetamine|meth|crystal meth|cocaine|crack cocaine|heroin|fentanyl|carfentanil|" +',
    to: '"(?:methamphetamine|crystal meth|\\\\bmeth\\\\b|cocaine|crack cocaine|heroin|fentanyl|carfentanil|" +',
  },
  // "dox" matches inside orthodox/unorthodox/paradox.
  {
    file: "lib/guard/detectors/broadHarmfulContentDetector.ts",
    from: '"(?:dox|doxx)(?:ing)?',
    to: '"\\\\b(?:dox|doxx)(?:ing)?',
  },
  // "persona" inside personality, "mode" inside model.
  {
    file: "lib/guard/detectors/promptInjectionDetector.ts",
    from: ".{0,140}(?:mode|persona|no restrictions|",
    to: ".{0,140}(?:\\\\bmode\\\\b|\\\\bpersona\\\\b|no restrictions|",
  },
  // "iterate" inside reiterate/illiterate.
  {
    file: "lib/guard/detectors/promptInjectionDetector.ts",
    from: "|until it succeeds|iterate|mutate|rewrite the prompt|",
    to: "|until it succeeds|\\\\biterate\\\\b|\\\\bmutate\\\\b|rewrite the prompt|",
  },
  // "eval"/"exec" inside evaluating/Executive.
  {
    file: "lib/guard/detectors/modelSupplyChainDetector.ts",
    from: "|postinstall|eval|exec)/i,",
    to: "|postinstall|\\\\beval\\\\b|\\\\bexec\\\\b)/i,",
  },
];

const RUNNER = "scripts/dev/_rowmeasure.ts";

function measure(tag: string) {
  const out = execFileSync("npx", ["tsx", RUNNER], { encoding: "utf8", maxBuffer: 1 << 28, shell: true });
  const j = JSON.parse(out.trim().split("\n").pop()!);
  console.log(
    `${tag.padEnd(8)} recall ${(j.recall * 100).toFixed(2)}%  FPR ${(j.fpr * 100).toFixed(2)}%   (${j.tp}/${j.na} attacks, ${j.fp}/${j.nb} benign)`,
  );
  return j;
}

const files = [...new Set(EDITS.map((e) => e.file))];
for (const f of files) copyFileSync(f, f + ".bak");
try {
  const before = measure("BEFORE");
  for (const e of EDITS) {
    const src = readFileSync(e.file, "utf8");
    if (!src.includes(e.from)) throw new Error(`anchor not found in ${e.file}: ${e.from}`);
    writeFileSync(e.file, src.replace(e.from, e.to), "utf8");
  }
  const after = measure("AFTER");
  const dR = (after.recall - before.recall) * 100;
  const dF = (after.fpr - before.fpr) * 100;
  console.log(`\ndelta   recall ${dR >= 0 ? "+" : ""}${dR.toFixed(2)} pts   FPR ${dF >= 0 ? "+" : ""}${dF.toFixed(2)} pts`);

  // An aggregate delta is not enough to accept or reject a safety edit. Print the
  // rows that changed side, so each lost detection is judged on its own text
  // rather than on a rounded percentage.
  const wasFlagged = new Set<string>(before.flagged);
  const nowFlagged = new Set<string>(after.flagged);
  const lost = [...wasFlagged].filter((k) => !nowFlagged.has(k));
  const gained = [...nowFlagged].filter((k) => !wasFlagged.has(k));
  const rows = readFileSync("datasets/external-train-v2.jsonl", "utf8")
    .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as { text: string; label: string });

  const show = (keys: string[], title: string) => {
    const atk = keys.filter((k) => k[0] === "a");
    const ben = keys.filter((k) => k[0] === "b");
    console.log(`\n${title}: ${atk.length} attack, ${ben.length} benign`);
    for (const k of atk) {
      const i = Number(k.slice(1));
      console.log(`  ATTACK row ${i}: ${rows[i].text.replace(/\s+/g, " ").slice(0, 240)}`);
    }
    for (const k of ben.slice(0, 6)) {
      const i = Number(k.slice(1));
      console.log(`  benign row ${i}: ${rows[i].text.replace(/\s+/g, " ").slice(0, 160)}`);
    }
    if (ben.length > 6) console.log(`  ... and ${ben.length - 6} more benign`);
  };
  if (lost.length) show(lost, "NO LONGER FLAGGED");
  if (gained.length) show(gained, "NEWLY FLAGGED");
  console.log(
    dR >= -0.05 && dF <= 0
      ? "TAKE — false accusations removed, row-level recall held"
      : dR < -0.05
        ? "DO NOT TAKE BLINDLY — rows became undetected; find which"
        : "inspect",
  );
} finally {
  for (const f of files) {
    copyFileSync(f + ".bak", f);
    unlinkSync(f + ".bak");
  }
  console.log("\n(detector sources restored)");
}
