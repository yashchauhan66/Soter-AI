/**
 * Turn the measured precision artifact into a plain TypeScript module the guard
 * can import.
 *
 * WHY A GENERATED MODULE AND NOT `readFileSync` AT RUNTIME
 *   analyzeText runs in four places with four different filesystem stories: the
 *   Next.js server, a Docker standalone build (which only copies traced files),
 *   the VS Code extension host, and `tsx` scripts. A runtime file read works in
 *   the last one and silently returns nothing in the others — and "silently
 *   returns nothing" here means every noisy rule quietly regains BLOCK authority
 *   in production while the local eval says the fix works. A generated module is
 *   resolved by the bundler, so it either ships or the build fails loudly.
 *
 *   It also makes the table reviewable: the diff shows exactly which rule's
 *   authority changed, which a binary artifact never would.
 *
 *   npx tsx scripts/ml/emit-rule-precision-module.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";

export interface MeasuredRule {
  label: string;
  riskType: string;
  benignFires: number;
  benignFireRate: number;
  attackFireRate: number;
  lift: number;
}

export interface PrecisionArtifact {
  generatedFrom: string;
  benignRowsScored: number;
  attackRowsScored: number;
  attackRiskTypesMeasured: string[];
  rules: MeasuredRule[];
}

/**
 * Only rules that actually fired on benign text are worth shipping. Everything
 * absent from the table defaults to trusted (see evidenceFusion.ts), so emitting
 * the rules that never accused an innocent would add bytes and change nothing.
 */
const EMIT_MIN_RATE = 0;

export function emitRulePrecisionModule(
  artifactPath = "artifacts/security/rule-precision.json",
  outPath = "lib/guard/generated/rulePrecisionTable.ts",
): { rules: number; outPath: string } {
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as PrecisionArtifact;

  if (!artifact.benignRowsScored || !Array.isArray(artifact.rules)) {
    throw new Error(`[FATAL] ${artifactPath} is not a precision artifact`);
  }
  if (!artifact.attackRowsScored) {
    throw new Error(
      `[FATAL] ${artifactPath} has no attack side. A table without attack fire ` +
        `rates can only measure noise, not discrimination — regenerate with ` +
        `scripts/ml/measure-rule-precision.ts.`,
    );
  }
  if (!artifact.attackRiskTypesMeasured?.length) {
    throw new Error(
      `[FATAL] ${artifactPath} does not record which risk types its attack corpus ` +
        `covers. Without that the fusion layer cannot tell "this rule catches no ` +
        `attacks" from "this corpus contains no such attack", and would demote ` +
        `whole detector families on the strength of absent evidence.`,
    );
  }
  // A table measured on a few hundred rows would give every rule a fire rate
  // quantised to ~0.3%, which lands right on the demotion threshold. Refuse
  // rather than ship a table that is mostly rounding error.
  if (artifact.benignRowsScored < 1000) {
    throw new Error(
      `[FATAL] measured on only ${artifact.benignRowsScored} benign rows; ` +
        `a fire-rate threshold of 0.1% is not resolvable below ~1000 rows.`,
    );
  }

  const rules = artifact.rules
    .filter((r) => r.benignFireRate > EMIT_MIN_RATE)
    .sort((a, b) => b.benignFireRate - a.benignFireRate || a.label.localeCompare(b.label));

  const body = rules
    .map(
      (r) =>
        `  { label: ${JSON.stringify(r.label)}, riskType: ${JSON.stringify(r.riskType)}, ` +
        `benignFireRate: ${r.benignFireRate}, attackFireRate: ${r.attackFireRate}, lift: ${r.lift} },`,
    )
    .join("\n");

  const source = `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   npx tsx scripts/ml/measure-rule-precision.ts
 *
 * Measured over ${artifact.benignRowsScored} known-benign and ${artifact.attackRowsScored}
 * known-attack rows from ${artifact.generatedFrom}.
 *
 *   benignFireRate  fraction of INNOCENT rows this rule accused
 *   attackFireRate  fraction of ATTACK rows this rule caught
 *   lift            attackFireRate / smoothed benignFireRate
 *
 * lift is the field that bounds a rule's authority. Benign fire rate alone
 * cannot separate "noisy but excellent" (0.14% benign, 12.2% attack) from "pure
 * noise" (0.32% benign, 0.27% attack); the ratio can.
 *
 * measuredRiskTypes is the safety catch. This corpus contains only
 * ${artifact.attackRiskTypesMeasured.join(", ")}
 * attacks, so a chemistry or explosives rule scores 0% attack fire rate here for
 * the simple reason that there is no such attack in the corpus. Those rules are
 * UNMEASURED, not useless, and the fusion layer leaves their authority alone.
 *
 * A rule ABSENT from this list never fired on benign text and is trusted by
 * default. See lib/guard/evidenceFusion.ts.
 *
 * Measured on the TRAIN split. Deriving it from the eval split and then
 * reporting FPR on that same split would be circular.
 */
import type { RulePrecisionTable } from "../evidenceFusion";

export const RULE_PRECISION: RulePrecisionTable = {
  benignRowsScored: ${artifact.benignRowsScored},
  attackRowsScored: ${artifact.attackRowsScored},
  measuredRiskTypes: ${JSON.stringify(artifact.attackRiskTypesMeasured)},
  rules: [
${body}
  ],
};
`;

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, source, "utf8");
  return { rules: rules.length, outPath };
}

if (process.argv[1] && /emit-rule-precision-module/.test(process.argv[1])) {
  try {
    const { rules, outPath } = emitRulePrecisionModule();
    console.log(`wrote ${outPath} (${rules} measured rules)`);
  } catch (e) {
    console.error(String(e));
    process.exit(2);
  }
}
