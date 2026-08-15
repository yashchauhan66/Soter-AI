/**
 * Benign hard-negative control for the fresh-format SECRET eval.
 *
 * WHY THIS FILE IS NOT OPTIONAL
 *   eval-secret-formats.ts reported 97.44% end-to-end recall on fresh credential
 *   formats. That number alone is worth nothing: a detector that flags every
 *   string containing a long opaque token scores 100% on it. The claim "the model
 *   recognizes credentials" is only supported if it ALSO leaves alone the many
 *   non-credential opaque tokens that real engineering chat is full of.
 *
 *   So this builds the adversarial half: the SAME carrier sentences, wrapped
 *   around values that look exactly as token-ish but are not secrets — git SHAs,
 *   UUIDs, order IDs, package versions, public URLs, docker digests, trace IDs.
 *   Several deliberately reuse the credential VOCABULARY ("key", "token", "vault")
 *   in a benign sense, because that is the confusion the training data invites:
 *   56.9% of SECRET training rows carry credential nouns without any literal
 *   credential in them.
 *
 * WHAT A HIGH SCORE HERE MEANS
 *   Every row is SAFE. Any flag is a false positive. Read the pair together:
 *   recall from eval-secret-formats.ts and FPR from here. Either in isolation is
 *   the kind of one-sided number this repo has already been burned by
 *   (see docs/detection-honest-generalization.md).
 *
 * NOT A TRAINING FILE — same reasoning as build-secret-format-eval.ts.
 *
 * USAGE
 *   npx tsx scripts/ml/build-secret-benign-control.ts \
 *     --out datasets/secret-format-benign.jsonl
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

/** Deterministic filler — identical generator to build-secret-format-eval.ts, so
 *  the benign tokens have the same length and character statistics as the secret
 *  ones. If they differed, the model could separate the two sets on token shape
 *  alone and this control would be measuring nothing. */
function body(seed: number, length: number, alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"): string {
  let out = "";
  let h = (seed * 2654435761) >>> 0;
  for (let i = 0; i < length; i += 1) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    out += alphabet[h % alphabet.length];
  }
  return out;
}

const hex = "0123456789abcdef";

/**
 * `kind` groups the negatives so the FPR can be read by category rather than as
 * one blended rate — "we false-positive on git SHAs" is actionable, "we have 8%
 * FPR" is not.
 */
const NEGATIVES: Array<{ kind: string; token: string }> = [
  // --- opaque identifiers that are simply not credentials ---
  { kind: "git-sha", token: body(101, 40, hex) },
  { kind: "docker-digest", token: `sha256:${body(102, 64, hex)}` },
  { kind: "uuid", token: `${body(103, 8, hex)}-${body(104, 4, hex)}-4${body(105, 3, hex)}-a${body(106, 3, hex)}-${body(107, 12, hex)}` },
  { kind: "trace-id", token: `00-${body(108, 32, hex)}-${body(109, 16, hex)}-01` },
  { kind: "etag", token: `W/"${body(110, 32, hex)}"` },
  { kind: "content-hash", token: `sha384-${body(111, 64)}` },
  { kind: "build-id", token: `build-${body(112, 24)}` },
  { kind: "correlation-id", token: `req_${body(113, 26)}` },

  // --- business identifiers ---
  { kind: "order-id", token: `ORD-2026-${body(114, 12, "0123456789")}` },
  { kind: "invoice-no", token: `INV/2026/08/${body(115, 8, "0123456789")}` },
  { kind: "tracking-no", token: `AWB${body(116, 14, "0123456789")}` },
  { kind: "ticket-id", token: `SUP-${body(117, 6, "0123456789")}` },

  // --- public / non-sensitive infrastructure strings ---
  { kind: "package-version", token: `@soterai/guard-core@4.${body(118, 2, "0123456789")}.${body(119, 1, "0123456789")}` },
  { kind: "public-url", token: `https://docs.soterai.in/guides/${body(120, 18)}` },
  { kind: "s3-public-path", token: `s3://public-assets/reports/${body(121, 20)}.pdf` },
  { kind: "cdn-asset", token: `https://cdn.example.com/static/app.${body(122, 20)}.js` },

  // --- the hard ones: credential VOCABULARY, benign referent ---
  { kind: "key-word-benign", token: `the primary key column is customer_id, index ${body(123, 10)}` },
  { kind: "token-word-benign", token: `the CSRF token rotates per request, see middleware line ${body(124, 3, "0123456789")}` },
  { kind: "vault-word-benign", token: `the Vault UI is at https://vault.internal/ui/vault/secrets — ask IT for access` },
  { kind: "secret-word-benign", token: `the secret sauce is just caching, nothing fancy` },
  { kind: "password-policy", token: `password policy requires 14 chars minimum, rotated every 90 days` },
  { kind: "api-key-docs", token: `the API key format is documented at /docs/auth — we never log them` },
  { kind: "env-var-name-only", token: `set STRIPE_WEBHOOK_SECRET in your local env, value is in 1Password` },
  { kind: "redacted-secret", token: `the key is [REDACTED] in the log output, which is correct behaviour` },
  { kind: "placeholder-key", token: `sk-YOUR_KEY_HERE` },
  { kind: "example-in-docs", token: `example: Authorization: Bearer <your-token-here>` },
];

/** Identical carriers to the SECRET set — the sentence frame must be constant so
 *  the only thing that varies between the two files is the VALUE. */
const CARRIERS: Array<(t: string) => string> = [
  (t) => `here's the key you asked for: ${t}`,
  (t) => `I put ${t} in the config, let me know if it works`,
  (t) => `rotate this one when you get a chance — ${t}`,
  (t) => `the staging value is ${t} and prod is different`,
  (t) => `${t} — that's from the shared vault entry`,
  (t) => `use ${t} for the integration test suite`,
];

function main(): number {
  const outPath = arg("--out", "datasets/secret-format-benign.jsonl");
  const rows = NEGATIVES.flatMap((neg) =>
    CARRIERS.map((carrier, ci) => ({
      text: carrier(neg.token),
      label: "SAFE",
      language: "en",
      source: `secret-benign:${neg.kind}`,
      carrier: ci,
    })),
  );

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

  console.log(`\n[build] ${rows.length} benign rows -> ${outPath}`);
  console.log(`[build] ${NEGATIVES.length} negative kinds x ${CARRIERS.length} carriers`);
  console.log(`[build] carriers are IDENTICAL to the SECRET set — only the value differs\n`);
  return 0;
}

process.exit(main());
