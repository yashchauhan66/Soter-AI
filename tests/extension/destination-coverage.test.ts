/**
 * Every host the extension injects itself into must actually be protected there.
 *
 * v0.2.1 shipped three separate hand-maintained lists of AI hostnames — the manifest's
 * `host_permissions`, `BUILT_IN_AI_DESTINATIONS`, and a seven-domain regex inside
 * `destinationTypeForUrl` — and they had drifted apart. The consequences were not cosmetic:
 *
 *   - `perplexity.ai` was named in the default policy's `monitoredDomains` (so the popup listed it)
 *     but only `https://www.perplexity.ai/*` was in the manifest, so the bare domain was never
 *     injected. A claim without an injection.
 *   - `copilot.microsoft.com` had a dedicated, hardened adapter and a place in the shadow-AI
 *     platform list, but no host permission at all — the adapter was unreachable code.
 *   - Any host that was permitted but absent from the destination table resolved to the
 *     destination type "unknown", and all three built-in rules were scoped to `public_ai`, so they
 *     silently stopped matching. An AWS key pasted there dropped from `block` to `redact`.
 *
 * These tests are the gate against that class of drift returning: they compare the shipped manifest
 * against the code that decides what happens on those hosts, and they assert on decisions, not on
 * the presence of a string in a list.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { scanText } from "../../packages/detectors/src/index";
import { evaluatePolicy } from "../../packages/policy-engine/src/evaluatePolicy";
import { BUILT_IN_AI_DESTINATIONS, matchAIDestination } from "../../packages/shared/src/ai-destinations";
import type { AIDestinationPolicy } from "../../packages/shared/src/ai-destinations";
import type { PolicyEvaluationInput } from "../../packages/policy-engine/src/types";

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../apps/extension/manifest.json"), "utf8"),
) as { host_permissions: string[]; content_scripts: { js?: string[]; matches: string[] }[] };

/** The hosts the guard is injected into, minus the extension's own control-plane origin. */
function guardedPatterns(): string[] {
  return manifest.host_permissions.filter((pattern) => !pattern.includes("soterai.in"));
}

/** A concrete URL to probe for a manifest match pattern. */
function sampleUrl(pattern: string): string {
  return pattern.replace(/\/\*$/, "/").replace(/\*\./, "");
}

const destinations = BUILT_IN_AI_DESTINATIONS
  .map((destination) => ({ ...destination, organizationId: "test-org" })) as unknown as AIDestinationPolicy[];

/** The default policy exactly as `defaultPolicy` in apps/extension/src/lib/storage.ts builds it. */
function defaultPolicy() {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/lib/storage.ts"),
    "utf8",
  );
  const types = source.match(/GUARDED_DESTINATION_TYPES: DestinationType\[\] = \[([^\]]+)\]/);
  assert.ok(types, "the guarded destination types must stay declared in one named constant");
  const destinationTypes = types[1].split(",").map((value) => value.trim().replace(/^"|"$/g, "")).filter(Boolean);
  return {
    organizationId: "test-org", version: "test", enabled: true, allowedDomains: [],
    monitoredDomains: [], defaultAction: "allow" as const, maxPromptChars: 20000,
    riskThresholds: { warn: 10, redact: 25, requireApproval: 55, block: 85 },
    rules: [
      { id: "local-secret-block", name: "Block credentials and secrets", action: "block" as const, severity: "critical" as const,
        destinationTypes, detectedDataTypes: ["env_file", "api_key", "aws_access_key", "github_token", "slack_token", "jwt", "private_key", "database_url", "password"] },
      { id: "local-india-pii-approval", name: "Require approval for India PII", action: "require_approval" as const, severity: "high" as const,
        destinationTypes, detectedDataTypes: ["aadhaar", "pan", "gstin", "upi_id", "ifsc"] },
    ],
    destinations,
  };
}

/** Resolve a destination type the way `destinationTypeForUrl` does with no server policy. */
function destinationTypeFor(url: string): string {
  return matchAIDestination(url, destinations) ?.category ?? "unknown";
}

function decide(text: string, url: string) {
  const scan = scanText(text);
  return evaluatePolicy({
    text, riskScore: scan.riskScore, detectedDataTypes: scan.detectedDataTypes,
    destinationDomain: new URL(url).hostname.replace(/^www\./, ""),
    destinationType: destinationTypeFor(url),
    defaultOrgPolicy: defaultPolicy(), organizationId: "test-org",
  } as unknown as PolicyEvaluationInput);
}

test("DC-900: every host the manifest injects into is a known destination in the policy table", () => {
  const unknown = guardedPatterns().filter((pattern) => destinationTypeFor(sampleUrl(pattern)) === "unknown");
  assert.deepEqual(unknown, [],
    "a host permission with no destination preset resolves to the type 'unknown' — the popup will " +
    "still say the site is guarded, but the destination-scoped rules will not know what it is");
});

test("DC-901: the three lists of AI hostnames agree — manifest, destination table, monitored claim", () => {
  const permitted = new Set(guardedPatterns().map((pattern) => new URL(sampleUrl(pattern)).hostname.replace(/^www\./, "")));
  // Every hostname the destination table claims to police must be a hostname the manifest can reach.
  // (URL-pattern-only presets — the localhost ones and HuggingChat — contribute no hostname here.)
  const claimedButNotInjected = BUILT_IN_AI_DESTINATIONS
    .filter((destination) => ["public_ai", "browser_coding"].includes(destination.category))
    .flatMap((destination) => destination.domains)
    .filter((domain) => !permitted.has(domain) && ![...permitted].some((host) => host.endsWith(`.${domain}`)));
  assert.deepEqual(claimedButNotInjected, [],
    "these domains are presented as guarded AI destinations but no content script is ever injected " +
    "on them — that is the perplexity.ai / copilot.microsoft.com defect of 0.2.1");
});

test("DC-902: a credential pasted into any guarded host is blocked, not merely redacted", () => {
  const weak: string[] = [];
  for (const pattern of guardedPatterns()) {
    const url = sampleUrl(pattern);
    const action = decide("here is the deploy key AKIAIOSFODNN7EXAMPLE please debug the upload", url).action;
    if (action !== "block") weak.push(`${new URL(url).hostname} -> ${action}`);
  }
  assert.deepEqual(weak, [],
    "the built-in 'Block credentials and secrets' rule must reach every guarded host; where it does " +
    "not, the risk-threshold ladder answers instead and a real AWS key comes out one step weaker");
});

test("DC-903: India PII on any guarded host reaches at least the approval gate", () => {
  const weak: string[] = [];
  for (const pattern of guardedPatterns()) {
    const url = sampleUrl(pattern);
    const action = decide("customer aadhaar 2345 6789 0123 needs a refund, draft the email", url).action;
    if (action !== "require_approval" && action !== "block") weak.push(`${new URL(url).hostname} -> ${action}`);
  }
  assert.deepEqual(weak, [], "the India-PII rule is the DPDP promise; it must not depend on which host it is");
});

test("DC-904: the destination type is resolved from the shared table, not a hand-written regex", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/lib/scanner.ts"),
    "utf8",
  );
  assert.match(source, /BUILT_IN_AI_DESTINATIONS/,
    "destinationTypeForUrl must fall back to the shared destination table");
  assert.equal(/chatgpt\\\.com\|openai\\\.com/.test(source), false,
    "the hardcoded seven-domain regex is the drift: it cannot be kept in step with the manifest");
});

test("DC-905: ordinary work on a guarded host is still not interrupted", () => {
  // The other half of the standing invariant. Widening the rules to every injected destination type
  // must not turn an everyday prompt into a decision the user has to make.
  const benign = [
    "can you review this function and suggest a cleaner name for it?",
    "summarise the attached meeting notes into five bullet points",
    "what is the difference between a mutex and a semaphore?",
  ];
  const interrupted: string[] = [];
  for (const pattern of guardedPatterns()) {
    for (const text of benign) {
      const action = decide(text, sampleUrl(pattern)).action;
      if (action !== "allow" && action !== "warn") interrupted.push(`${new URL(sampleUrl(pattern)).hostname}: ${action} on ${JSON.stringify(text.slice(0, 32))}`);
    }
  }
  assert.deepEqual(interrupted, [],
    "a benign prompt must never rise above 'warn' — anything higher rewrites or holds the user's work");
});

test("DC-906: the shadow-AI platform list and the destination table are one list", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/content/index.ts"),
    "utf8",
  );
  assert.match(source, /SHADOW_AI_KNOWN_PLATFORMS = Array\.from\(new Set\(\[[\s\S]*BUILT_IN_AI_DESTINATIONS/,
    "shadow-AI discovery must derive its known platforms from the destination table, not a third copy");
});

test("DC-907: trial mode — the first-run path for a real user — polices the same destinations", () => {
  // Trial mode shipped a fourth hand-copied hostname list and `destinations: []`, so a trial user
  // got no destination resolution at all and no coverage of anything added after the copy was made.
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/lib/enrollment.ts"),
    "utf8",
  );
  const sample = source.slice(source.indexOf("const samplePolicy"), source.indexOf("hardEnforcement: false"));
  assert.match(sample, /monitoredDomains: BUILT_IN_AI_DESTINATIONS/,
    "the trial policy's monitored domains must come from the shared table");
  assert.match(sample, /destinations: BUILT_IN_AI_DESTINATIONS/,
    "an empty `destinations` array in trial mode means no destination can ever be matched");
  assert.equal(/monitoredDomains: \[\s*"/.test(sample), false,
    "a literal hostname list here is the drift returning");
});

test("DC-908: no compiled .js twin shadows a .ts source in the shared packages", () => {
  // The defect this catches cost a whole verification round. `apps/extension`'s build begins with a
  // bare `tsc` (not --noEmit), which emitted `ai-destinations.js` NEXT TO `ai-destinations.ts` back
  // in August. Rollup resolves an extensionless import to `.js` before `.ts`, so from that moment
  // the extension bundle was built from a three-week-old snapshot of the destination table while
  // every tsx-run test read the live `.ts` and passed. A green suite over a stale bundle.
  const roots = ["packages/shared/src", "packages/policy-engine/src", "packages/detectors/src"];
  const shadowed: string[] = [];
  for (const root of roots) {
    const dir = resolve(import.meta.dirname, "../..", root);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
      if (existsSync(resolve(dir, `${entry.name.slice(0, -3)}.ts`))) shadowed.push(`${root}/${entry.name}`);
    }
  }
  assert.deepEqual(shadowed, [],
    "a compiled twin next to its source silently wins module resolution in the extension build — " +
    "delete it, and keep the extension's `tsc` step from emitting into the packages");
});
