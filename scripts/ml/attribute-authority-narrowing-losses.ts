/**
 * WHICH attack rows did the authority/policy narrowing actually cost?
 *
 * The battery says real-path recall moved 94.85% -> 94.75%: 11 rows lost the
 * RULES catch, the ML tier recovered 9, so 2 attacks are now missed outright.
 * An aggregate of 2 is not a finding -- the question is WHY those rows were
 * caught before. The bare-`it` precedent (see the AC6 memory) is the reason to
 * ask: that rule "caught 8 attacks" via the English pronoun, a catch that does
 * not survive paraphrase. A narrowing that drops that kind of catch costs
 * nothing real; one that drops a genuine Skeleton-Key catch is a regression.
 *
 * HOW IT ATTRIBUTES WITHOUT A BEFORE-STATE
 *   Re-running the old build is not possible without mutating the working tree
 *   (`git stash push` is NOT a read-only probe -- see the autocrlf memory). So
 *   the removed alternatives are reconstructed here as explicit regexes, exactly
 *   as they read before the edit, and a row is attributed to this change only if
 *   it matches a removed alternative AND the rule's own demand cue. That is the
 *   same conjunction the rule used, so a row matching both is one the rule fired
 *   on before and cannot fire on now.
 *
 *   npx tsx scripts/ml/attribute-authority-narrowing-losses.ts
 */
import * as path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });
process.env.SOTERAI_ML_AUGMENT = "enforce";

const mod = (rel: string) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
const FILE = "artifacts/ml/v18-balanced-comparison-rows.jsonl";
const OUT = "artifacts/ml/authority-narrowing-losses-2026-09-29.json";

type Row = { text: string; label: string; language?: string; category?: string };
type Finding = { label?: string; type?: string };
type Verdict = { allowed?: boolean; action?: string; findings?: Finding[] };

const flagged = (v: Verdict): boolean =>
  v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");
const keyOf = (f: Finding) => f.label ?? f.type ?? "?";

/**
 * Exactly the alternatives that were removed, as they read before the edit.
 * A row matching one of these matched the OLD group[0] and cannot match the NEW
 * one, so any catch it had through this rule is gone.
 */
const REMOVED = [
  { name: "bare org noun (was `(?:team|lead)?` optional)", re: /\b(?:alignment|security|compliance|engineering|it|red[- ]?team|qa)\b(?!\s+(?:team|lead|dept|department)\b)/i },
  { name: "bare `root` (was `root(?:_?admin)?`)", re: /\broot\b(?![_ ]?admin)/i },
  { name: "bare `sudo`", re: /\bsudo\b(?!\s*(?:mode|access|override|enabled?))/i },
  { name: "bare `deployment`", re: /\bdeployment\b/i },
  { name: "bare `staff`", re: /\bstaff\b/i },
  { name: "bare `onboarding` (was `(?:updated\\s+)?onboarding`)", re: /(?<!\b(?:updated|new|revised)\s)\bonboarding\b/i },
  { name: "bare `release notes`", re: /\brelease\s+notes?\b(?!\s+(?:say|state|confirm|mention|note|indicate))/i },
];

/** group[1] of the authority rule and of the fake-policy-update rule. */
const AUTH_DEMAND =
  /\b(?:disable|lift|remove|bypass|unlock|permit|waiv(?:e|ed)|allow (?:all|any|every)|answer (?:anything|everything|freely|prohibited|restricted)|respond (?:to|freely|fully|as if|without)|output (?:the )?(?:unfiltered|restricted|prohibited|full)|reveal|show all|proceed (?:freely|without)|say anything|discuss anything|break\s+free|help\s+me\s+(?:with|on|complete|fulfill)|just\s+this\s+once|give\s+me\s+(?:the|this|that)|tell\s+me\s+(?:the|this|that)|share\s+(?:the|this|that)|output\s+(?:the|this|that)|comply\s+with\s+(?:my|this|the)|answer\s+(?:my|this|the)|respond\s+with|provide\s+(?:it|this|that|the))\b/i;
const POLICY_DEMAND =
  /\b(?:disable|lift|remove|bypass|unlock|permit|allow|answers?|reveal|output|show|comply|fulfill|ignore|proceed|discuss\s+anything)\b/i;

async function main(): Promise<void> {
  const { analyzeText } = (await import(mod("lib/guard/analyze.ts"))) as {
    analyzeText: (t: string, d: string) => Verdict;
  };
  const { augmentWithMl, resolveMlAugmentMode } = (await import(mod("lib/guard/mlAugment.ts"))) as {
    augmentWithMl: (v: Verdict, t: string, d: string) => Promise<Verdict>;
    resolveMlAugmentMode: () => string;
  };
  if (resolveMlAugmentMode() === "off") {
    console.error("[FATAL] ML augment is 'off'; 'the model still catches it' is unobservable. Refusing.");
    process.exit(2);
  }

  const rows: Row[] = readFileSync(path.resolve(process.cwd(), FILE), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row)
    .filter((r) => r.label !== "SAFE");

  const affected: {
    text: string;
    language?: string;
    category?: string;
    removedAlternative: string;
    stillCaughtByRules: boolean;
    stillCaughtRealPath: boolean;
    findingsNow: string[];
  }[] = [];

  let mlEscalations = 0;
  for (const r of rows) {
    const hit = REMOVED.find((x) => x.re.test(r.text));
    if (!hit) continue;
    if (!AUTH_DEMAND.test(r.text) && !POLICY_DEMAND.test(r.text)) continue;

    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");
    if (!flagged(before) && flagged(after)) mlEscalations++;
    affected.push({
      text: r.text.slice(0, 200).replace(/\s+/g, " "),
      language: r.language,
      category: r.category,
      removedAlternative: hit.name,
      stillCaughtByRules: flagged(before),
      stillCaughtRealPath: flagged(after),
      findingsNow: [...new Set((before.findings ?? []).map(keyOf))],
    });
  }

  if (mlEscalations === 0) {
    console.error("[FATAL] ML escalated 0 affected rows; 'the model recovers it' could not be observed. Refusing.");
    process.exit(2);
  }

  const lostRules = affected.filter((a) => !a.stillCaughtByRules);
  const lostReal = affected.filter((a) => !a.stillCaughtRealPath);

  console.log(`\nAttack rows touched by the authority/policy narrowing (of ${rows.length} attacks)\n`);
  console.log(`  matched a removed alternative AND the rule's demand cue : ${affected.length}`);
  console.log(`  of those, no longer caught by RULES                     : ${lostRules.length}`);
  console.log(`  of those, no longer caught on the REAL path (ML too)    : ${lostReal.length}\n`);

  console.log("  ── rows now missed outright ──");
  for (const a of lostReal) {
    console.log(`    [${a.language ?? "?"}/${a.category ?? "?"}]  via ${a.removedAlternative}`);
    console.log(`      ${a.text}`);
  }
  console.log("\n  ── rows the rules tier dropped but ML recovered ──");
  for (const a of lostRules.filter((x) => x.stillCaughtRealPath).slice(0, 12)) {
    console.log(`    [${a.removedAlternative}] ${a.text.slice(0, 120)}`);
  }
  console.log("");

  mkdirSync(path.dirname(path.resolve(process.cwd(), OUT)), { recursive: true });
  writeFileSync(
    path.resolve(process.cwd(), OUT),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        file: FILE,
        attacksScanned: rows.length,
        affected: affected.length,
        lostAtRulesTier: lostRules.length,
        lostOnRealPath: lostReal.length,
        note:
          "Attribution is by reconstructing the removed alternatives, not by re-running the old build. " +
          "A row counts as affected only if it matches a removed alternative AND the rule's demand cue.",
        rowsMissedOutright: lostReal,
        rowsRecoveredByMl: lostRules.filter((x) => x.stillCaughtRealPath),
      },
      null,
      2,
    ),
  );
  console.log(`wrote ${OUT}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
