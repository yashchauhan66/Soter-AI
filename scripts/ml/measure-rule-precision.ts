/**
 * Measure every detector rule on BOTH sides of the train split, so the decision
 * layer can stop treating all rules as equally trustworthy.
 *
 * WHY BOTH SIDES AND NOT JUST THE BENIGN ONE
 *   The first version of this script measured only the benign fire rate and the
 *   fusion layer demoted anything above 0.1%. That halved the false-positive rate
 *   (4.9% -> 2.4%) and cost 22 real detections, because a benign fire rate on its
 *   own cannot tell these two rules apart:
 *
 *     fires on 0.30% of benign text, 41% of attacks   <- excellent rule, noisy
 *     fires on 0.30% of benign text,  0.4% of attacks <- pure noise
 *
 *   Both look identical to a threshold on benign rate alone. What separates them
 *   is the LIKELIHOOD RATIO: how much more often the rule fires on an attack than
 *   on benign text. A rule earns the right to act alone by discriminating, not by
 *   being quiet.
 *
 * WHY IT MEASURES ON THE TRAIN SPLIT, NOT THE EVAL SPLIT
 *   Deriving rule authority from crossdist-eval-v2.jsonl and then reporting FPR on
 *   that same file would be measuring the fix against its own training data - the
 *   exact mistake that produced the fake 99.2% F1. Authority comes from
 *   external-train-v2.jsonl; the eval split stays untouched so the numbers
 *   afterwards still mean something. The two are split by group key, so an
 *   augmentation sibling cannot leak across.
 *
 *   npx tsx scripts/ml/measure-rule-precision.ts
 *   npx tsx scripts/ml/measure-rule-precision.ts --limit 2000
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

type Row = { text: string; label: string; source?: string };

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

const corpusPath = arg("--corpus", "datasets/external-train-v2.jsonl");
const outPath = arg("--out", "artifacts/security/rule-precision.json");
const limit = Number(arg("--limit", "0"));

/** Count of rows a rule fired on, and up to two examples, per side. */
interface Side {
  fires: Map<string, number>;
  examples: Map<string, string[]>;
  total: number;
}

function emptySide(): Side {
  return { fires: new Map(), examples: new Map(), total: 0 };
}

async function scoreSide(
  rows: Row[],
  side: Side,
  analyze: (text: string, dir: "INPUT") => { findings?: Array<{ label?: string; type?: string }> },
  riskOf: Map<string, string>,
) {
  for (const r of rows) {
    side.total += 1;
    const v = analyze(r.text, "INPUT");
    const seenThisRow = new Set<string>();
    for (const f of v.findings ?? []) {
      const label = f.label ?? f.type ?? "?";
      if (seenThisRow.has(label)) continue; // one row = one vote per rule
      seenThisRow.add(label);
      side.fires.set(label, (side.fires.get(label) ?? 0) + 1);
      if (f.type) riskOf.set(label, f.type);
      const ex = side.examples.get(label) ?? [];
      if (ex.length < 2) {
        ex.push(r.text.slice(0, 90).replace(/\s+/g, " "));
        side.examples.set(label, ex);
      }
    }
  }
}

async function main() {
  if (corpusPath.includes("crossdist-eval")) {
    console.error(
      `[FATAL] refusing to measure rule authority on the EVAL split.\n` +
        `        Authority measured on the same file the FPR is reported on is\n` +
        `        circular. Use datasets/external-train-v2.jsonl.`,
    );
    process.exit(2);
  }

  const all: Row[] = readFileSync(corpusPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  const cut = (rows: Row[]) => (limit ? rows.slice(0, limit) : rows);
  const benignRows = cut(all.filter((r) => r.label === "SAFE"));
  const attackRows = cut(all.filter((r) => r.label !== "SAFE"));

  if (!benignRows.length || !attackRows.length) {
    console.error(
      `[FATAL] ${corpusPath} needs BOTH sides: got ${benignRows.length} benign / ` +
        `${attackRows.length} attack. A one-sided corpus can only measure noise, ` +
        `not discrimination.`,
    );
    process.exit(2);
  }

  const { analyzeText } = await import("../../lib/guard/analyze");

  const riskOf = new Map<string, string>();
  const benign = emptySide();
  const attack = emptySide();
  await scoreSide(benignRows, benign, analyzeText as never, riskOf);
  await scoreSide(attackRows, attack, analyzeText as never, riskOf);

  // Laplace smoothing on the benign side. Without it a rule that fired on zero
  // benign rows gets an infinite likelihood ratio from a single lucky attack
  // match, and a corpus of 5000 rows cannot distinguish "never fires on benign"
  // from "fires on 1 in 10000".
  const SMOOTH = 1;
  const labels = new Set([...benign.fires.keys(), ...attack.fires.keys()]);

  const entries = [...labels]
    .map((label) => {
      const b = benign.fires.get(label) ?? 0;
      const a = attack.fires.get(label) ?? 0;
      const benignFireRate = b / benign.total;
      const attackFireRate = a / attack.total;
      const smoothedBenign = (b + SMOOTH) / (benign.total + SMOOTH);
      // How many times more likely this rule is to fire on an attack than on
      // benign text. This, not the raw benign rate, is what should bound a
      // rule's authority.
      const lift = attackFireRate / smoothedBenign;
      return {
        label,
        riskType: riskOf.get(label) ?? "UNKNOWN",
        benignFires: b,
        attackFires: a,
        benignFireRate: Number(benignFireRate.toFixed(5)),
        attackFireRate: Number(attackFireRate.toFixed(5)),
        lift: Number(lift.toFixed(2)),
        benignExamples: benign.examples.get(label) ?? [],
      };
    })
    .sort((x, y) => y.benignFires - x.benignFires);

  const measuredTypes = new Set(attackRows.map((r) => r.label));

  const payload = {
    generatedFrom: corpusPath,
    benignRowsScored: benign.total,
    attackRowsScored: attack.total,
    // WHICH RISK TYPES THE ATTACK CORPUS ACTUALLY CONTAINS.
    //
    // This field is what stops the lift measurement from doing real damage. The
    // corpus is gandalf + in-the-wild + deepset: injection, jailbreak and
    // system-prompt extraction, and nothing else. Measured against it,
    // "Chemistry dual-use evasion" fires on 0.24% of benign rows and 0.00% of
    // attacks — which reads as pure noise and is not. It reads that way because
    // there is not one chemistry attack in the corpus.
    //
    // A zero attack fire rate for an unrepresented risk type means UNMEASURED,
    // not USELESS. Demoting CBRN detection on the strength of a corpus that
    // contains no CBRN would be blinding the guard on the basis of absent
    // evidence. The fusion layer therefore only applies the lift test to types
    // listed here; everything else keeps its authority until someone measures it
    // against a corpus that can actually see it.
    attackRiskTypesMeasured: [...new Set(attackRows.map((r) => r.label))].sort(),
    note:
      "benignFireRate/attackFireRate = fraction of KNOWN-BENIGN / KNOWN-ATTACK rows this " +
      "rule fired on. lift = attackFireRate / smoothed benignFireRate: how much more often " +
      "the rule accuses an attack than an innocent. A rule may act alone only if it both " +
      "stays quiet on benign text AND discriminates. Rules absent from this file never " +
      "fired at all and default to trusted. lift is only meaningful for the risk types in " +
      "attackRiskTypesMeasured.",
    rules: entries,
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

  // The JSON is the evidence artifact; the generated module is what the guard
  // actually imports. Emitting both from one run is what stops them drifting.
  const { emitRulePrecisionModule } = await import("./emit-rule-precision-module");
  const emitted = emitRulePrecisionModule(outPath);

  console.log(`\nscored ${benign.total} benign + ${attack.total} attack rows from ${corpusPath}`);
  console.log(`${entries.length} distinct rules fired at least once`);
  console.log(`wrote ${outPath}`);
  console.log(`wrote ${emitted.outPath} (${emitted.rules} measured rules)\n`);

  const noisy = entries.filter((e) => e.benignFireRate > 0.001);
  console.log(`rules firing on >0.1% of benign text (${noisy.length}):`);
  console.log(`  ${"benign".padStart(7)} ${"attack".padStart(7)} ${"lift".padStart(8)}  label`);
  for (const e of noisy) {
    const measurable = measuredTypes.has(e.riskType);
    const flag = !measurable
      ? `  <- ${e.riskType} UNMEASURED by this corpus, authority kept`
      : e.lift < 10
        ? "  <- demoted: poor discrimination"
        : "";
    console.log(
      `  ${(e.benignFireRate * 100).toFixed(2).padStart(6)}% ${(e.attackFireRate * 100)
        .toFixed(2)
        .padStart(6)}% ${e.lift.toFixed(1).padStart(8)}  ${e.label}${flag}`,
    );
  }
  console.log(`\nattack corpus covers: ${[...measuredTypes].sort().join(", ")}`);
  console.log(
    `rules of any OTHER risk type keep full authority — a zero attack fire rate\n` +
      `against a corpus that contains no such attack means unmeasured, not useless.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
