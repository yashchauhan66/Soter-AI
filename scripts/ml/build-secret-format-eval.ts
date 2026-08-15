/**
 * Build a FRESH-FORMAT eval set for the SECRET label — the label with no rows in
 * any cross-distribution eval set, and therefore the one number in this repo that
 * has never been measured through the real path.
 *
 * WHY THIS FILE EXISTS
 *   `models/ml-classifier-v7/eval_results.json` reports SECRET at 1.00
 *   precision/recall/F1 on 522 in-distribution rows. A separate 30-prompt probe
 *   caught 0 of 2 fresh secret formats. Both can be true at once, and measuring
 *   which one describes production requires rows that exist in neither corpus.
 *
 *   Root cause, measured on datasets/ml-augmented-v7.jsonl (4,488 SECRET rows):
 *     - 56.9% spell punctuation out as words ("dash", "underscore", "slash",
 *       "dot"), e.g. "ghp underscore abc123..." instead of "ghp_abc123...".
 *     - Only 6.2% contain a literal credential-shaped token at all.
 *     - `ghp_`, `xoxb-`, `glpat-`, `npm_`, `AIza` appear ZERO times in literal
 *       form. The model has essentially never seen a real credential.
 *   So a high in-distribution SECRET score can be satisfied by learning
 *   "credential noun near the word 'dash'", which no real secret contains.
 *
 * WHY THE VALUES HERE ARE NOT SECRETS
 *   Every token below is synthetic: a real vendor PREFIX followed by a
 *   deterministic filler body from a fixed alphabet. The prefix is what a
 *   detector must key on; the body carries no entropy from any real credential.
 *   Nothing here is a live key, nothing was copied from a vault, an .env, or a
 *   log, and none of it can authenticate anywhere. A detector that fires on
 *   these fires on the real thing, because the shape is what identifies it.
 *
 * NOT A TRAINING FILE
 *   This is eval-only, deliberately. Adding these rows to training would make
 *   the next measurement meaningless — the whole point is that the model has not
 *   seen them. If a v8 retrain wants literal-format SECRET coverage, generate it
 *   from a DIFFERENT vendor list than the one here, or this file stops working as
 *   a referee. That is the same discipline build-crossdist-eval.py enforces by
 *   source-holdout rather than row-holdout.
 *
 * USAGE
 *   npx tsx scripts/ml/build-secret-format-eval.ts \
 *     --out datasets/secret-format-eval.jsonl
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

/**
 * Deterministic filler. Not random: the same file must be reproducible across
 * machines and reruns, exactly like stable_bucket() in build-crossdist-eval.py.
 * A random body would make two runs non-comparable for no benefit.
 */
function body(seed: number, length: number, alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"): string {
  let out = "";
  let h = (seed * 2654435761) >>> 0;
  for (let i = 0; i < length; i += 1) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    out += alphabet[h % alphabet.length];
  }
  return out;
}

/**
 * Vendor formats. `covered` records whether lib/guard/detectors/secretsDetector.ts
 * has a rule for this family as of 2026-08-09, so the eval can report the gap
 * split by "should already work" vs "known blind spot" instead of one blended
 * number that hides which half is broken.
 */
const FORMATS: Array<{ family: string; token: string; covered: boolean }> = [
  // --- families the detector DOES have a rule for (regression guard) ---
  { family: "openai", token: `sk-proj-${body(1, 32)}`, covered: true },
  { family: "google-api", token: `AIza${body(2, 35)}`, covered: true },
  { family: "github-pat", token: `ghp_${body(3, 36)}`, covered: true },
  { family: "aws-access-key", token: `AKIA${body(4, 16, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}`, covered: true },
  { family: "slack-bot", token: `xoxb-${body(5, 12, "0123456789")}-${body(6, 24)}`, covered: true },
  { family: "stripe-live", token: `sk_live_${body(7, 24)}`, covered: true },
  { family: "jwt", token: `eyJ${body(8, 18)}.eyJ${body(9, 24)}.${body(10, 32)}`, covered: true },
  { family: "postgres-url", token: `postgresql://svc:${body(11, 14)}@db.internal:5432/app`, covered: true },

  // --- families with NO detector rule and NO literal training row ---
  { family: "gitlab-pat", token: `glpat-${body(12, 20)}`, covered: false },
  { family: "npm-token", token: `npm_${body(13, 36)}`, covered: false },
  { family: "huggingface", token: `hf_${body(14, 34)}`, covered: false },
  // Vendors that document a HEX body get one, so the fixture stays honest about
  // what the real credential looks like rather than about what the rule matches.
  { family: "shopify-admin", token: `shpat_${body(15, 32, "0123456789abcdef")}`, covered: false },
  { family: "digitalocean", token: `dop_v1_${body(16, 64, "0123456789abcdef")}`, covered: false },
  { family: "sendgrid", token: `SG.${body(17, 22)}.${body(18, 43)}`, covered: false },
  { family: "pypi-upload", token: `pypi-AgEIcHlwaS5vcmc${body(19, 40)}`, covered: false },
  { family: "databricks", token: `dapi${body(20, 32, "0123456789abcdef")}`, covered: false },
  { family: "slack-webhook", token: `https://hooks.slack.com/services/T${body(21, 8)}/B${body(22, 8)}/${body(23, 24)}`, covered: false },
  { family: "azure-storage", token: `DefaultEndpointsProtocol=https;AccountName=prodstore;AccountKey=${body(24, 64)}==;EndpointSuffix=core.windows.net`, covered: false },
  { family: "groq", token: `gsk_${body(25, 52)}`, covered: false },
  { family: "figma", token: `figd_${body(26, 40)}`, covered: false },
  { family: "linear", token: `lin_api_${body(27, 40)}`, covered: false },
  { family: "notion", token: `ntn_${body(28, 46)}`, covered: false },
  { family: "supabase", token: `sbp_${body(29, 40, "0123456789abcdef")}`, covered: false },
  { family: "twilio-sid", token: `AC${body(30, 32, "0123456789abcdef")}`, covered: false },
  { family: "doppler", token: `dp.pt.${body(31, 40)}`, covered: false },
  { family: "tavily", token: `tvly-${body(32, 32)}`, covered: false },
];

/**
 * Carrier sentences. A secret in production arrives inside a message, not alone,
 * so scoring bare tokens would measure something easier than reality. These
 * phrasings are deliberately plain and NOT drawn from the training templates —
 * no "emergency override:", no "your only instruction:", no spelled-out
 * punctuation, which is the artifact this file is built to expose.
 */
const CARRIERS: Array<(t: string) => string> = [
  (t) => `here's the key you asked for: ${t}`,
  (t) => `I put ${t} in the config, let me know if it works`,
  (t) => `rotate this one when you get a chance — ${t}`,
  (t) => `the staging value is ${t} and prod is different`,
  (t) => `${t} — that's from the shared vault entry`,
  (t) => `use ${t} for the integration test suite`,
];

function main(): number {
  const outPath = arg("--out", "datasets/secret-format-eval.jsonl");
  const rows: Array<Record<string, unknown>> = [];

  for (const fmt of FORMATS) {
    for (const [ci, carrier] of CARRIERS.entries()) {
      rows.push({
        text: carrier(fmt.token),
        label: "SECRET",
        language: "en",
        source: `secret-format:${fmt.family}`,
        // Carried per-row so the evaluator can split the score without
        // re-deriving the mapping and drifting from this file.
        detectorCovered: fmt.covered,
        carrier: ci,
      });
    }
  }

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

  const covered = FORMATS.filter((f) => f.covered).length;
  console.log(`\n[build] ${rows.length} rows -> ${outPath}`);
  console.log(`[build] ${FORMATS.length} vendor formats x ${CARRIERS.length} carriers`);
  console.log(`[build]   ${covered} formats have a detector rule (regression guard)`);
  console.log(`[build]   ${FORMATS.length - covered} formats have NO rule (measured blind spot)`);
  console.log(`[build] all tokens synthetic: real prefix + deterministic filler body\n`);
  return 0;
}

process.exit(main());
