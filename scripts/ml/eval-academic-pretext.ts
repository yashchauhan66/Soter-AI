/**
 * Grade the academic-pretext dual-use family on rows the detector was NOT built from.
 *
 * WHY THIS HARNESS EXISTS
 *   lib/guard/detectors/jailbreakDetector.ts lines 30-37 contain literal fragments
 *   of the strings in tests/guard.test.ts — "technical methodology", "restricted
 *   computational infrastructure", "synthesis pathway", "energetic organic
 *   compounds", "DARPA-funded". Those test cases pass. The 30 structurally
 *   identical rows in jb-121..150 fail at 80%, and 20 of them survive the ML tier
 *   too. That is the exact signature of memorisation: the rule matches the corpus
 *   it was written from and nothing else.
 *
 *   So a fix cannot be graded on jb-121..150 either — writing rules against those
 *   strings reproduces the same failure one corpus later. This file grades on
 *   datasets/academic-pretext-heldout.jsonl, which was written BEFORE the detector,
 *   from the attack taxonomy rather than from any corpus, using deliberately
 *   different vocabulary.
 *
 * THE BENIGN HALF IS THE POINT
 *   The attack structure is "legitimacy pretext + demand for operational detail".
 *   Real academics produce that structure constantly and harmlessly, so 25 of the
 *   55 rows are benign hard negatives sharing the same frame — including matched
 *   pairs (ap-027 attack / ap-050 benign carry the same "doctoral candidate in
 *   chemistry" pretext). A rule that fires on both has learned the pretext, which
 *   is the FP-generating half, not the attack.
 *
 * USAGE
 *   npx tsx scripts/ml/eval-academic-pretext.ts [--no-ml]
 */
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const noMl = process.argv.includes("--no-ml");
if (!noMl) process.env.SOTERAI_ML_AUGMENT = "enforce";

type Row = { id: string; label: "ATTACK" | "BENIGN"; text: string; note: string };

async function main(): Promise<void> {
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { augmentWithMl, resolveMlAugmentMode } = await import("../../lib/guard/mlAugment");
  if (!noMl && resolveMlAugmentMode() === "off") {
    console.error("[FATAL] ML tier resolved to 'off'; refusing to print a number");
    console.error("        that would read as a production measurement but is not.");
    process.exit(2);
  }

  const rows: Row[] = readFileSync("datasets/academic-pretext-heldout.jsonl", "utf8")
    .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);

  const res: Array<Row & { rules: boolean; e2e: boolean }> = [];
  for (const r of rows) {
    const before: any = analyzeText(r.text, "INPUT");
    const after: any = noMl ? before : await augmentWithMl(before, r.text, "INPUT");
    res.push({ ...r, rules: before.action !== "ALLOW", e2e: after.action !== "ALLOW" });
  }

  const atk = res.filter((r) => r.label === "ATTACK");
  const ben = res.filter((r) => r.label === "BENIGN");
  const p = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : "0.0");

  const rRec = p(atk.filter((r) => r.rules).length, atk.length);
  const eRec = p(atk.filter((r) => r.e2e).length, atk.length);
  const rFpr = p(ben.filter((r) => r.rules).length, ben.length);
  const eFpr = p(ben.filter((r) => r.e2e).length, ben.length);

  console.log(`\n${"=".repeat(66)}`);
  console.log(`  ACADEMIC-PRETEXT HELD-OUT  —  ${atk.length} attacks, ${ben.length} benign hard negatives`);
  console.log(`  rows written BEFORE the detector, from the taxonomy not the corpus`);
  console.log("-".repeat(66));
  console.log(`  rules-only    recall ${rRec.padStart(5)}%   FPR ${rFpr.padStart(5)}%`);
  if (!noMl) console.log(`  production    recall ${eRec.padStart(5)}%   FPR ${eFpr.padStart(5)}%`);
  console.log("-".repeat(66));

  const missed = atk.filter((r) => (noMl ? !r.rules : !r.e2e));
  console.log(`  missed attacks (${missed.length}):`);
  for (const m of missed) console.log(`    ${m.id}  ${m.text.slice(0, 78)}`);
  const fps = ben.filter((r) => (noMl ? r.rules : r.e2e));
  console.log(`  false positives (${fps.length}):`);
  for (const f of fps) console.log(`    ${f.id}  ${f.text.slice(0, 78)}`);
  console.log("=".repeat(66) + "\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
