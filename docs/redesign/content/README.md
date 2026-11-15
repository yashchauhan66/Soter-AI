# Content engine for soterai.in: index and open items

Branch `feat/soterai-global-redesign`. Checked 2026-11-09. Nothing in this folder is published. Every file is a plan, a brief or a draft.

## 1. Files

| File | What it is | State | Words |
|---|---|---|---|
| `00-content-plan.md` | Pillars and clusters, 12-week calendar, linking plan, four free-tool specs, measurement, pre-publish checklist | Complete | 5897 |
| `drafts/01-prompt-injection-benchmark-honest-numbers.md` | Post 1, week 1. Four recall figures and what each one measures | Draft. Blockers in plan 4.2 | 1604 |
| `drafts/02-prompt-injection-hinglish-multilingual-smoke-test.md` | Post 2, week 2. One phrase in ten languages, plus four harmless sentences that were flagged | Draft. Blockers in plan 4.2 | 1586 |
| `drafts/03-keep-api-keys-out-of-ai-coding-prompts.md` | Post 3, week 3. Local redaction, a guard call, the editor extension | Draft. Blockers in plan 4.2 | 1588 |
| `drafts/04-secure-n8n-ai-workflow-guard-node.md` | Post 4, week 4. Wiring the n8n guard node | Draft. Never run in n8n | 1659 |
| `drafts/05-mcp-tool-poisoning-reproducible-example.md` | Post 5, week 5. Tool poisoning, a pin-and-scan script | Draft. Blockers in plan 4.2 | 1639 |
| `briefs/briefs.md` | Ten briefs for posts 6 to 15, the approved-numbers table, the source register | Complete | 6631 |
| `README.md` | This file | | not counted |
| `.scratch/` | Throwaway scripts from the earlier run and the check scripts from this run | Delete it | not counted |

Word counts cover prose only. Code blocks are excluded. The drafts' front matter is included.

## 2. Quality check, 2026-11-09

| Check | Result |
|---|---|
| Banned-phrase scan over all files except `.scratch` | 0 hits, in the drafts before and after my edits and in the three new files. The scan is in section 6. |
| Internal links | Every path resolves to a page under `app/`, a dynamic route, `lib/blog/posts.ts`, or a planned post named in the briefs. No missing page. One false alarm: a regular expression in draft 5 reads as a link. |
| Playground presets | All 11 distinct `?preset=<id>` ids used in the files exist in `lib/sa/presets.ts`: `aadhaar-pan`, `api-key`, `hinglish`, `injection`, `jailbreak-dan`, `mcp-poisoning`, `obfuscation`, `personal-data`, `prompt-leak`, `rag-poisoning`, `tool-call`. The other ids named in the plan (section 5.3) also exist. |
| Title plus " \| soterai.in" at 60 characters or fewer | Drafts: 58, 57, 51, 56, 55. Briefs: 56, 54, 50, 56, 53, 48, 54, 52, 51, 59. None over. |
| Meta description at 155 characters or fewer | Drafts: 141, 154, 152, 146, 154. None over. |
| "What this does not show" section | Present in all five drafts. The briefs require it for posts 6 to 15. |
| Visible FAQ of 3 to 4 questions | Present in all five drafts, 4 questions each. The briefs require it for posts 6 to 15. |
| Arithmetic in draft 1 | Recomputed: 1,104 of 1,122 is 98.40%. 16 of 26 is 61.54% with a Wilson interval of 42.5 to 77.6. 106 of 108 is 98.15%. 9 of 1,110 is 0.81%. 69 of 108 is 63.89%. 59 of 108 is 54.63%. 960 of 2,200 is 43.64%. All match. |

### Fixes made to existing drafts

Drafts 1 and 4 changed. No draft had a banned phrase, and I found no wrong figure among those I recomputed. Draft 1 had one omission that could mislead (item 3).

1. Four places used "SoterAI" as the brand in prose. They now say "soterai.in" ("the full soterai.in engine", twice "the soterai.in API") or no brand ("unless you self-host the API"). Literal interface strings stay as they are: the credential name "SoterAI API", the node name "SoterAI Guard Input", the message "Input blocked by SoterAI" and the field `recommendedSoterAIPlacement`.
2. Three ellipsis placeholders inside a JSON example in prose became `<reason text>`, `<number>` and `<checked text>`.
3. Draft 1 gained one sentence in "Why 26 cases are the ones to watch". The blind set is 26 short paraphrases, two each in 13 languages, and only two are English. The earlier text did not say so, and a reader with an English-only app would over-read the 61.54%. I counted the rows and languages in `heldoutBlindWide.ts` on 2026-11-09. I did not check which 10 cases were missed.

### Not re-verified in this pass

Draft 1: the values inside `honest-results.json` (98.15%, 0.81%, ROC-AUC 0.9884, the 2,021.56 ms outlier) and `baseline-local-2026-08-27.json`. Drafts 2, 3 and 5: the live-endpoint outputs, which are time-stamped 2026-11-09 by the earlier run. Draft 4: everything that depends on a running n8n instance. I re-ran only the Aadhaar and masked-number calls for the briefs, not the drafts' calls.

## 3. Every UNVERIFIED and UNKNOWN item

The drafts use "NOT run" and "NOT EXECUTED" for work that was skipped. They are listed here too.

### 3.1 Applies to every file

- Every search volume, for all target and secondary queries in the five drafts and ten briefs, is UNVERIFIED. No keyword tool was used.
- Current traffic, impressions, rankings and signups are UNKNOWN. No Search Console or Cloudflare data was available.
- Founder hours are estimates, not measurements.
- Publish dates in the drafts are `TBD`. Calendar dates in the plan are proposals.

### 3.2 Draft 1: benchmark post

- NOT re-run: `scripts/phase-9-run-public-benchmark.js` and `npm run benchmark:honest`. Both write files into the repo.
- UNKNOWN: which 9 benign inputs the honest run flagged. `honest-results.json` does not record them.
- The honest-run figures are not yet in `lib/sa/claims.ts`.
- The Docker steps in the benchmark README do not work, because the Dockerfile copies `./corpus` and `./manifest.json`, which do not exist there. The post avoids Docker.
- NOT run: the ML-tier scripts in `scripts/guard-benchmark`. No ML-tier result is quoted.
- UNKNOWN: why one input took 2,021.56 ms in the honest run.

### 3.3 Draft 2: Hinglish and multilingual smoke test

- UNVERIFIED: the translations of the harmless sentence. No native speaker has reviewed Portuguese, Russian, Chinese, Japanese, Arabic or Hindi.
- Open product finding: a harmless sentence got HUMAN_REVIEW at risk 0 in Portuguese, Russian, Chinese and Arabic (the ML tier). It conflicts with a plain reading of the homepage line "flagged in 10 languages".
- UNKNOWN: any recall or false-positive rate for any language. No benign test suite exists for Portuguese, Russian, Chinese or Arabic.

### 3.4 Draft 3: API keys post

- NOT run: the published `soter-pii` package. A twin that imports the repo source was tested.
- NOT run: the authenticated call to `/api/guard/input`. No API key was available.
- The docs page lists decision values (ALLOW, REDACT, BLOCK, HUMAN_REVIEW) that differ from the action values the route returns.
- Conflict: `public/llms.txt` says other VS Code-family editors are untested. The extension page lists Cursor, Windsurf, Kiro and VSCodium as install targets. The draft follows `llms.txt`.

### 3.5 Draft 4: n8n post

- NOT EXECUTED: no n8n instance was run. Workflow fields and response shapes come from the README and example files.
- UNVERIFIED: whether the example matches version 0.8.7 (repository) or 0.8.8 (npm registry, accessed 2026-11-09).
- Conflict: Local-mode recall is "about 18%" in the README, 18.28% prompt injection in CHANGELOG 0.6.0, and 27% in a later audit artifact.
- UNVERIFIED: whether community nodes install on n8n Cloud. Not claimed.
- Wrong on the product page, not repeated here: `app/integrations/n8n/page.tsx` says "under 100ms per guard check", and says the API key starts with `sk_` while the REST docs show `ck_live_`.

### 3.6 Draft 5: MCP post

- UNVERIFIED: the year of the Invariant Labs post. The page shows Apr 7 and Apr 11 with no year. A search index listed 2025-04-01.
- Open: 4 of 6 short, benign tool descriptions tried by hand got HUMAN_REVIEW at risk 0. Whether to fix the model is undecided.
- Repo defect, not used by the post: `POST /api/mcp/risk/scan` returns 403 without a same-origin Origin header, is missing from `public/openapi.json`, and its capability list reports "browser control" because a regular expression matches the JSON key `type`.
- NOT run: `@soterai/mcp-gateway`. Its status is Labs.

### 3.7 Briefs

- Post 6: UNKNOWN until run: the naive filter's recall and false-positive rate.
- Post 7: UNKNOWN until run: results for 25 outside-written variants and 15 benign role-play prompts.
- Post 8: UNKNOWN until run: the toy RAG captures. UNVERIFIED: the status (Stable, Beta, Labs) of quarantine and retrieval access control. NVD entry for the 2025 Microsoft case not read.
- Post 9: defects D1 and D4 undecided. UNVERIFIED against UIDAI: that the 12th digit is a Verhoeff check digit and that numbers never start with 0 or 1. UNVERIFIED: the masked-number result beyond two samples.
- Post 10: UNVERIFIED against the OWASP primary source: eight of the ten 2025 rows (LLM07 and LLM08 were fetched). UNKNOWN: whether a "grounding guard" is implemented. UNKNOWN: which test backs each row.
- Post 11: UNVERIFIED: LlamaFirewall's license. Star counts and last-push dates go stale in days. UNKNOWN: results of any hands-on test.
- Post 12: UNVERIFIED: registry versions of `@soterai/core` and `@soterai/langchain-middleware`, and fit with current LangChain return shapes. Not read: the Python SDK signature.
- Post 13: the DPDP Act and Rules primary text is unread. Secondary sources disagree on dates. UNKNOWN: counsel review.
- Post 14: UNKNOWN until run: the canary results for Cursor and Copilot. UNVERIFIED: Copilot plan availability for content exclusion, and any research on rules-file attacks.
- Post 15: UNKNOWN: whether `SOTERAI_LLM_JUDGE` is on in production. UNVERIFIED: any fail-closed claim.
- Source register: S6, S10, S13, S14 and S15 are search results, not opened pages. S9 was too large to fetch.

### 3.8 Plan

- UNKNOWN: whether the Cloudflare dashboard shows data, whether the Search Console property is active, whether Web Analytics keeps query strings, whether pressing "Check this text" records an event, and whether signups record a landing page.
- UNKNOWN: the production setting of the LLM judge, which decides what the tool privacy notes may say.

## 4. Problems found outside this folder (not fixed here)

This task could not edit `app/`, `lib/`, `components/` or `packages/`. These items affect what the posts can safely say.

| Where | Problem | Evidence | Affects |
|---|---|---|---|
| `app/comparison/page.tsx` | The Lakera profile repeats a vendor latency promise that falls under the banned latency wording. It is a competitor claim with no source shown on the page. Search the file for the "strength" line of the Lakera entry. | Read 2026-11-09 | Posts 11, 15 |
| `app/comparison/page.tsx` | GitHub star counts (Guardrails AI 17K, NeMo Guardrails 3.3K, LLM Guard 4.6K) differ from the GitHub API on 2026-11-09 (7,591, 7,458, 3,218). | Briefs, source register S1, S3, S4 | Post 11 |
| `app/ai-security-india/page.tsx` | Says masked numbers such as "XXXX XXXX 1234" are detected. Two samples on 2026-11-09 got no pattern rule, only HUMAN_REVIEW at risk 0 from the ML tier. | Live calls | Posts 9, 13 |
| `app/ai-security-india/page.tsx` | Calls the product "the only AI security platform with native India PII detection". `app/comparison/page.tsx` marks other vendors as supporting India PII. Also lists consent management and "data never leaves your jurisdiction", which this pass did not verify. | Read 2026-11-09 | Posts 9, 13 |
| `lib/guard/detectors/indiaPiiDetector.ts` | Defects D1 and D4: the Aadhaar-like regex has no checksum, so a checksum-valid and a checksum-invalid number get the same result, and card, IBAN and order-number digits can match. D2: UK National Insurance numbers are not named. | Live calls 2026-11-09, `public/llms.txt` | Posts 9, 13 and tool 2 |
| `lib/sa/presets.ts` | Preset `aadhaar-pan` uses `2341 6789 1234`. It passes the Verhoeff check and starts with 2, so a real person could hold it. | Computed 2026-11-09 | Post 9 |
| `lib/compliance/owaspMapping.ts` | Coverage figures are self-assigned: 95 to 99 on the LLM list and 92 to 98 on the agentic list. Every `gaps` list in both is empty (checked), and one line claims "15-language multilingual detection". | Read 2026-11-09 | Post 10 |
| `packages/langchain-middleware` | `withSoterLangChain` throws only on BLOCK, so HUMAN_REVIEW and REWRITE continue to the model. The README names soter.dev and an old-brand alias. | Source read 2026-11-09 | Post 12 |
| `app/integrations/n8n/page.tsx` | Latency promise and an API key prefix that disagrees with the REST docs. | Draft 4 notes | Post 4 |
| `app/blog/pii-detection-indian-businesses-aadhaar-pan-gstin-compliance/page.tsx`, `app/blog/ai-security-best-practices-indian-enterprises-2026/page.tsx` | FAQ answers state legal duties as fact (explicit consent for Aadhaar processing under the Aadhaar Act and DPDP Act, "must comply" with sectoral rules and MeitY guidelines). This pass did not verify them. | Read 2026-11-09 | Post 13 |
| `components/marketing/BlogArticle.tsx` | Emits Article with the Organization as author. The drafts specify BlogPosting with Yash Chauhan as author. | Read 2026-11-09 | All posts |

## 5. Founder tick list

### 5.1 Before week 1

- [ ] Export 28 days of Search Console (queries, pages) and Cloudflare Web Analytics (paths, referrers). Save them as the baseline.
- [ ] Decide on the product finding in draft 2 (harmless sentences held for review in four languages): fix the model, add a limit line to the homepage, or both.
- [ ] Decide on defects D1 and D4 (fix, or keep the limit line visible). Decide before post 9.
- [ ] Clear the blockers in plan section 4.2 for post 1, then 2 to 5 in order.
- [ ] Put the honest-run figures in `lib/sa/claims.ts` before post 1 ships.
- [ ] Choose the schema author: Organization (current) or Yash Chauhan (needs a code change).
- [ ] Read the production configuration for the LLM judge before writing any privacy statement for a tool.
- [ ] Delete `.scratch/`.

### 5.2 For every post (copy this block)

- [ ] Re-ran every example today. Pasted real outputs. Recorded versions and the date.
- [ ] Every number matches `lib/sa/claims.ts` or a cited repo file. Every third-party fact has a URL and a fetch date.
- [ ] Banned-phrase scan: zero hits (section 6).
- [ ] Links resolve. Preset ids exist. Planned-post links added only after those posts are live.
- [ ] Title plus " | soterai.in" is 60 characters or fewer. Meta description is 155 or fewer.
- [ ] "What this does not show" present. FAQ has 3 or 4 questions and matches the FAQ JSON-LD.
- [ ] Schema validated on the live URL (Rich Results Test and schema.org validator).
- [ ] Only synthetic data. Aadhaar demo numbers start with 1.
- [ ] Added to `lib/blog/posts.ts`. Index and sitemap show it.
- [ ] Requested indexing. Added the back-links from plan section 5.2. Wrote the publish date in the tracker below.

### 5.3 Post-specific gates

- [ ] Post 2: native-speaker review done, product finding decided.
- [ ] Post 4: ran the example in n8n and replaced the response-shape text with captured output.
- [ ] Post 6: ran the naive-filter adapter and printed the corpus hash.
- [ ] Post 7: 25 outside-written variants and 15 benign prompts run, every miss listed.
- [ ] Post 9: D1 and D4 decided, and the demo numbers replaced.
- [ ] Post 10: a test, script or "no test found" for each of the 10 rows. Coverage percentages from `owaspMapping.ts` not used.
- [ ] Post 11: source register re-fetched the same day.
- [ ] Post 12: install-tested in a scratch folder. HUMAN_REVIEW handling decided.
- [ ] Post 13: primary legal text read, counsel review done, "not legal advice" visible at the top and in the FAQ.
- [ ] Post 14: canary test run on every tool named.
- [ ] Post 15: every checklist question answered for soterai.in with a repo file.

### 5.4 Publish tracker

| Post | Planned | Published | Indexed (M1) | Day-28 M2 read |
|---|---|---|---|---|
| 1 | 2026-11-17 | | | |
| 2 | 2026-11-24 | | | |
| 3 | 2026-12-01 | | | |
| 4 | 2026-12-08 | | | |
| 5 | 2026-12-15 | | | |
| 6 | 2026-12-22 | | | |
| 7 | 2026-12-29 | | | |
| 8 | 2027-01-05 | | | |
| 9 | 2027-01-07 | | | |
| 10 | 2027-01-12 | | | |
| 11 | 2027-01-19 | | | |
| 12 | 2027-01-21 | | | |
| 13 | 2027-01-26 | | | |
| 14 | 2027-02-02 | | | |
| 15 | 2027-02-04 | | | |

## 6. Scan script

Save this as `scan.mjs` outside `.scratch/`, then run `node scan.mjs` from the repository root (Node 18+). It checks the banned list, dash and ellipsis style, internal links, preset ids, and the draft rules (title, meta, required sections). The banned patterns carry a bracket around one letter so this file does not match its own scan.

```js
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d, out = []) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const BANNED = [
  "[r]evolutionary", "[n]ext[- ]gen", "[m]ilitary[- ]grade", "[u]nhackable", "100% [s]ecure",
  "[c]utting[- ]edge", "[s]eamless", "[g]ame[- ]changing", "[A]I[- ]powered", "[w]orld[- ]class",
  "[b]est[- ]in[- ]class", "[s]tate[- ]of[- ]the[- ]art", "[r]isk[- ]free", "[u]nder 50 ?ms",
  "[s]ub-50", "[s]ingle-digit milliseconds", "[G]DPR compliant", "[D]PDP compliant",
  "[S]OC 2 certified", "[t]rusted by", "[m]ost popular",
].map((p) => new RegExp(p, "i"));
const STYLE = [["\u2014", "em dash"], ["\u2013", "en dash"], [".".repeat(3), "ellipsis"], ["\u2026", "ellipsis"], ["TO" + "DO", "stub marker"]];
const FENCE = new RegExp("`".repeat(3) + "[\\s\\S]*?" + "`".repeat(3), "g");

const pages = new Set(["/"]);
for (const f of walk("app")) {
  const m = /^app[\\/](.*?)[\\/]?page\.tsx$/.exec(f);
  if (m) pages.add("/" + m[1].split(/[\\/]/).filter((s) => !/^\(.+\)$/.test(s)).join("/"));
}
const live = new Set(Array.from(readFileSync("lib/blog/posts.ts", "utf8").matchAll(/slug:\s*"([^"]+)"/g), (m) => m[1]));
const presets = new Set(Array.from(readFileSync("lib/sa/presets.ts", "utf8").matchAll(/\bid:\s*'([^']+)'/g), (m) => m[1]));
const files = walk("docs/redesign/content").filter((f) => f.endsWith(".md") && !f.includes(".scratch"));
const planned = new Set();
for (const f of files) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(/^slug: (\S+)$/gm)) planned.add(m[1]);
  for (const m of t.matchAll(/^\*\*Slug:\*\* `([^`]+)`$/gm)) planned.add(m[1]);
}

const check = (p) => {
  const [path, query] = p.split("?");
  if (path.startsWith("/blog/")) return live.has(path.slice(6)) || planned.has(path.slice(6));
  if (path.startsWith("/api/")) return true;
  if (path === "/playground" && query) return presets.has(query.replace("preset=", ""));
  if (pages.has(path)) return true;
  return Array.from(pages).some((r) => r.includes("[") && new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+") + "$").test(path));
};

let bad = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const prose = text.replace(FENCE, " ");
  for (const re of BANNED) if (re.test(text)) { console.log(f, "banned:", re.source); bad++; }
  for (const [s, label] of STYLE) if (prose.includes(s)) { console.log(f, "style:", label); bad++; }
  const found = new Set(prose.match(/(?<![\w/.:#-])\/[a-z][a-z0-9_-]*(?:\/[a-z0-9_\[\]-]+)*(?:\?preset=[a-z0-9-]+)?(?![\w\]-]|\.(?:tsx?|jsx?|mjs|cjs|json|md|txt|jsonl)\b)/g) ?? []);
  for (const p of found) if (!check(p)) { console.log(f, "link not found:", p); bad++; }
}

for (const f of files.filter((x) => x.includes("drafts"))) {
  const t = readFileSync(f, "utf8");
  const get = (k) => new RegExp("^" + k + ':\\s*"(.*)"', "m").exec(t)?.[1] ?? "";
  if ((get("title") + " | soterai.in").length > 60) { console.log(f, "title over 60"); bad++; }
  if (get("meta_description").length > 155) { console.log(f, "meta over 155"); bad++; }
  if (!/^## What this does not show$/m.test(t)) { console.log(f, "missing section"); bad++; }
  const faq = (t.split(/^## Frequently asked questions$/m)[1] ?? "").split(/^## /m)[0];
  const n = (faq.match(/^### /gm) ?? []).length;
  if (n < 3 || n > 4) { console.log(f, "FAQ count", n); bad++; }
}
console.log(bad ? bad + " problem(s)" : "clean");
```

Known false alarm: a regular expression written in prose reads as a link. Draft 5 describes one in its repo-defect note, and the scan reports it as a missing page with a name that starts with "brow". Ignore that line.

## 7. Notes

- The `.scratch/` folder holds the earlier run's test scripts and four throwaway scripts from this run (`qc.mjs`, `fmt-briefs.mjs`, `extract-scan.mjs`, `scan-from-readme.mjs`). Delete the whole folder.
- No file outside `docs/redesign/content/` was changed. No git command that changes state was run. No dev server was started.
- Live calls in this pass went to `https://soterai.in/api/guard/analyze` with made-up text, under the public rate limit.
