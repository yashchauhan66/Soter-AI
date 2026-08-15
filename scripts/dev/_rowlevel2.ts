/**
 * Re-measures the boundary fixes on the PRODUCTION path.
 *
 * The first run of this experiment (_rowlevel.ts) called analyzeText(text) with no
 * `direction`. That argument gates six branches in analyze.ts — the
 * isSafeSecurityEducationRequest and isClearlyBenignKnowledgeQuestion benign
 * exemptions, the semantic INPUT family gate, and the hasHighTrustExploitationFinding
 * escalation to BLOCK. Undefined took the else path on all of them, so the harness
 * measured a decision pipeline the product never runs. Same defect class as the
 * rules-only crossdist harness.
 *
 * The A/B conclusion survived (both sides used the same harness) but the absolute
 * recall/FPR did not. The fixes are already applied, so the edits here are INVERTED:
 * BEFORE = current, fixed state; AFTER = boundaries removed. A good fix therefore
 * shows AFTER as worse, and the sign of the reported delta is flipped to describe
 * the fix rather than the revert.
 */
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BROAD = "lib/guard/detectors/broadHarmfulContentDetector.ts";
const SUPPLY = "lib/guard/detectors/modelSupplyChainDetector.ts";
const INJ = "lib/guard/detectors/promptInjectionDetector.ts";

// from = the fixed text now on disk, to = the original unbounded text.
const EDITS: { file: string; from: string; to: string }[] = [
  { file: BROAD,
    from: '"(?:methamphetamine|crystal meth|\\\\bmeth\\\\b|cocaine',
    to: '"(?:methamphetamine|meth|crystal meth|cocaine' },
  { file: BROAD,
    from: 'pressure cooker bomb|\\\\bieds?\\\\b|car bomb',
    to: 'pressure cooker bomb|ied|car bomb' },
  { file: BROAD,
    from: '"\\\\b(?:dox|doxx)(?:ing)?',
    to: '"(?:dox|doxx)(?:ing)?' },
  { file: SUPPLY,
    from: '|postinstall|\\beval\\b|\\bexec\\b)',
    to: '|postinstall|eval|exec)' },
  { file: INJ,
    from: '.{0,140}(?:\\bmode\\b|\\bpersona\\b|no restrictions',
    to: '.{0,140}(?:mode|persona|no restrictions' },
];

const RUNNER = "scripts/dev/_rowmeasure.ts";

function measure(tag: string) {
  const out = execFileSync("npx", ["tsx", RUNNER], { encoding: "utf8", maxBuffer: 1 << 28, shell: true });
  const j = JSON.parse(out.trim().split("\n").pop()!);
  console.log(
    `${tag.padEnd(22)} recall ${(j.recall * 100).toFixed(2)}%  FPR ${(j.fpr * 100).toFixed(2)}%   (${j.tp}/${j.na} attacks, ${j.fp}/${j.nb} benign)`,
  );
  return j;
}

const files = [...new Set(EDITS.map((e) => e.file))];
for (const f of files) copyFileSync(f, f + ".bak");
try {
  for (const e of EDITS) {
    const src = readFileSync(e.file, "utf8");
    if (!src.includes(e.from)) throw new Error(`anchor not found in ${e.file}: ${e.from}`);
  }
  const fixed = measure("FIXED (applied)");
  for (const e of EDITS) {
    const src = readFileSync(e.file, "utf8");
    writeFileSync(e.file, src.replace(e.from, e.to), "utf8");
  }
  const broken = measure("UNBOUNDED (reverted)");

  const dR = (fixed.recall - broken.recall) * 100;
  const dF = (fixed.fpr - broken.fpr) * 100;
  console.log(
    `\neffect OF THE FIX   recall ${dR >= 0 ? "+" : ""}${dR.toFixed(2)} pts   FPR ${dF >= 0 ? "+" : ""}${dF.toFixed(2)} pts`,
  );

  const fixedSet = new Set<string>(fixed.flagged);
  const brokenSet = new Set<string>(broken.flagged);
  const rows = readFileSync("datasets/external-train-v2.jsonl", "utf8")
    .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as { text: string; label: string });

  // Rows the fix removed from the flagged set, i.e. flagged only while unbounded.
  const onlyBroken = [...brokenSet].filter((k) => !fixedSet.has(k));
  const onlyFixed = [...fixedSet].filter((k) => !brokenSet.has(k));
  const show = (keys: string[], title: string) => {
    const atk = keys.filter((k) => k[0] === "a");
    const ben = keys.filter((k) => k[0] === "b");
    console.log(`\n${title}: ${atk.length} attack, ${ben.length} benign`);
    for (const k of atk.slice(0, 10)) {
      const i = Number(k.slice(1));
      console.log(`  ATTACK row ${i}: ${rows[i].text.replace(/\s+/g, " ").slice(0, 200)}`);
    }
    for (const k of ben.slice(0, 8)) {
      const i = Number(k.slice(1));
      console.log(`  benign row ${i}: ${rows[i].text.replace(/\s+/g, " ").slice(0, 150)}`);
    }
  };
  show(onlyBroken, "FLAGGED ONLY WHEN UNBOUNDED (the fix removed these)");
  show(onlyFixed, "FLAGGED ONLY WHEN BOUNDED (the fix added these)");
} finally {
  for (const f of files) {
    copyFileSync(f + ".bak", f);
    unlinkSync(f + ".bak");
  }
  console.log("\n(detector sources restored to the FIXED state)");
}
