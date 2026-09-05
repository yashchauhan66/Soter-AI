# 21 — InVideo AI: Full Product Tour Script (English VO, real app on screen)

**Kaise use karna hai (short):** Part 1 ki 26 recordings apne chalte hue app se capture karo (`npm run demo:seed` → `npm run dev`), Part 2 ka prompt InVideo AI me paste karo, Part 3/4 ka script wahi paste karo, aur upload kiye clips ko scene-by-scene assign karo. Narration English hai. Ek bhi frame stock footage ka nahi hona chahiye — har visual tumhare asli app ka screen recording hoga.

**What this is:** a complete, ready-to-paste production package for one ~9-minute product tour that shows **every shipped SoterAI capability inside the real running app** — what the screen shows, how a user actually uses it, and what benefit it gives.

**What this is not:** slide-ware. The existing generated video (`scripts/marketing/generate-video.mjs`) is a rendered slide deck with TTS. This document is the opposite approach: real UI, real clicks, real routes, English voiceover from InVideo AI.

**The one hard constraint:** InVideo AI cannot log into your dashboard. It will happily generate stock footage of an office if you let it. So the real app can only reach the video as **your uploaded screen recordings**. Part 1 is therefore not optional — it *is* the video. The script and prompt exist to sequence and narrate that footage.

---

## Part 0 — Hard facts block (nothing outside this list goes on screen)

Every number below is read from committed evidence in this repo. Do not round, re-word, or "improve" any of them.

| Fact | Value | Source of truth |
|---|---|---|
| Aggregate recall (tuned corpora) | **98.40%** (1104/1122) | `benchmarks/results/readme-detection-audit-2026-09-02.txt` |
| Blind held-out recall (never tuned against) | **61.54%** (16/26) | same audit file |
| False positive rate | **0.00%** (0/322 benign controls) | same audit file |
| Latency p50 / p95 | **9.30ms / 17.83ms** | `benchmarks/results/latest.json` |
| Benchmark corpus | **3,200 cases** (2,200 attack, 1,000 benign), CPU only | `benchmarks/results/latest.json` |
| Benchmark run date | 2026-07-22 | `benchmarks/results/latest.json` |
| Documented services | **33 services across 6 layers** (Monitor, Protect, Detect, Control, Compliance, Manage) | `lib/docs/services.ts` → `/docs/services` |
| Jailbreak families covered | 15 | `README.md` ("Jailbreak families (15)") |
| India PII types | Aadhaar-like, PAN, UPI, IFSC, GSTIN | `lib/docs/services.ts` |
| Rollback windows | 15 min for high-risk, 60 min for reversible | `README.md` (Action ledger section) |
| Evidence hashing | SHA-256 evidence hashing in the action ledger | `README.md`; e.g. `lib/a2a-security/index.ts` |
| Plans | ₹0 Free forever · ₹999 Starter · ₹2,999 Pro · ₹9,999 Agency · Enterprise custom (volume-based) | `app/pricing/page.tsx` |
| Self-host | `docker compose up -d --build` → `http://localhost:3000` | `README.md` quickstart |
| Licence | Core BUSL-1.1 (self-host for internal / non-production use), converts to Apache-2.0 on 2030-06-25; SDKs in `packages/*` are Apache-2.0 | `LICENSE`, `README.md` |
| Repo | `github.com/yashchauhan66/Soter-AI` | repo remote |

**Launch status labels — say these out loud, do not hide them** (`lib/marketing/launchStatus.ts`):

| Surface | Status |
|---|---|
| API Guard | Stable |
| Audit Evidence | Stable |
| Browser Guard · IDE Guard · n8n Guard · Make Guard · Zapier Guard | Beta |
| MCP / Agent Guard | Labs |

**Required on-screen text whenever a number appears:**
> Self-maintained synthetic benchmark, not an independent audit.

**Required on-screen text whenever an identifier appears:**
> All identifiers on screen are synthetic test values.

**Forbidden — never in narration, on screen, in the title, or in the description.** This is the list the repo enforces on the generated video (`tests/marketing-video-claims.test.ts`); that gate does not read this file, so apply it by hand:
`100% secure` · `fully secure` · `unbreakable` · `SOC 2 compliant/certified` · `ISO 27001 compliant/certified` · `independently validated/audited/verified` · `third-party audited` · `zero false positives` · `guarantees complete/full security` · `marketplace approved` · `best in world`

Note the trap: the measured FPR **is** 0.00%, but the standalone phrase *"zero false positives"* is on the forbidden list and the claim gate matches it literally. Always say it the way scene 21 says it — *"the false positive rate is zero point zero zero percent, across three hundred and twenty-two benign controls"* — a measured result with its corpus named. Do not paraphrase.

---

## Part 1 — Screen recordings you must capture (this *is* the video)

### Prerequisites (once)

```powershell
npm run demo:seed     # applies schema, seeds workspace + sample guard logs + a report, prints the login
npm run dev           # http://localhost:3000
```

The seed prints a local demo login (`demo@cyberrakshak.dev`, password from `DEMO_USER_EMAIL`/`DEMO_USER_PASSWORD`, override them if you like). Reset the demo activity any time with `npm run demo:reset`.

### Capture settings (non-negotiable)

- Record at **1920×1080, 60 fps**, browser zoom **100%**, bookmarks bar hidden, one clean profile, no notifications.
- **Synthetic data only.** Use the playground's built-in samples — they already ship synthetic Aadhaar/PAN/keys. Never a real customer value, never a real live key. If a real key is visible anywhere, re-record; do not blur in post.
- **Never speed up a clip that shows latency.** Real time or nothing.
- If a page is empty because that module has no activity yet, either generate activity first (run the playground / `/demo/guided`) or leave the empty state visible. Do not fake rows.
- Move the mouse slowly and deliberately. Pause ~1s on every value the narration mentions.
- Preview/Beta/Labs modules: keep their own status chip visible in frame.

### Take list

| Take | Route(s) — in order | What to do on camera | Length |
|---|---|---|---|
| TAKE-01 | `/` | Slow scroll of the hero and the three-surface section | 0:12 |
| TAKE-02 | `/playground` | Click sample **Prompt injection** → let the verdict panel land → hover the detector + latency | 0:20 |
| TAKE-03 | `/playground` | Click **Aadhaar / PII leak**, then **API key leak** — hold on the redacted output | 0:20 |
| TAKE-04 | `/playground` | Click **Hinglish attack**, then **Unicode obfuscation**, then benign **Support question** (shows it does *not* over-block) | 0:18 |
| TAKE-05 | `/signup` → `/dashboard/projects` → `/dashboard/api-keys` | Signup form (don't submit a real email), project list, then generate a **test** key and reveal-then-hide it | 0:28 |
| TAKE-06 | `/dashboard/get-started` → `/dashboard/onboarding` | Scroll the checklist, tick one item so live validation fires | 0:20 |
| TAKE-07 | `/docs/quickstart` → `/docs/rest-api` | Hold on the `guardInput` / `guardOutput` snippet, then the REST contract | 0:20 |
| TAKE-08 | `/dashboard` | Slow scroll through every tile group: Agent Control, Usage Governance, Monitor, Security Tools, Compliance, Manage | 0:25 |
| TAKE-09 | `/dashboard/logs` | Filter to **BLOCK**, open one row, show risk score + reason, then the export button | 0:22 |
| TAKE-10 | `/dashboard/policy` | Drag a risk threshold, switch a default action, save | 0:20 |
| TAKE-11 | `/dashboard/agent-firewall` → `/approvals` → `/sessions` → `/replay` → `/canaries` → `/mcp-scanner` → `/rag-trust` | Open the approval queue, show a held irreversible action with redacted payload, approve it, then tab through the sub-pages | 0:32 |
| TAKE-12 | `/dashboard/agent-control` → `/agent-passports` → `/escrow` → `/intent-guard` → `/tool-chain` → `/dry-run` → `/memory-firewall` → `/mcp-drift` → `/legal-boundary` → `/identity-fabric` | ~4s on each page, page title clearly in frame | 0:42 |
| TAKE-13 | `/dashboard/rag` → `/dashboard/rag/security` → `/demo/rag` | Source trust list, then the sample RAG demo running | 0:20 |
| TAKE-14 | `/dashboard/shadow-ai` | Discovered AI destinations, risk column, one remediation action | 0:18 |
| TAKE-15 | `/dashboard/redteam/lab` → `/demo/red-team` | Pick a scenario set, run it, show the pass/fail report | 0:20 |
| TAKE-16 | `/dashboard/canary-network` → `/dashboard/semantic-egress` | Generate a canary token, then a paraphrase similarity check | 0:22 |
| TAKE-17 | `/dashboard/forensics` | Open an incident timeline, expand reconstructed content, click evidence export | 0:18 |
| TAKE-18 | `/dashboard/usage-governance` → `/policy` → `/providers` → `/departments` → `/data-classification` → `/approvals` → `/monitoring` → `/audit` → `/reports` | Overview, then ~3s per sub-page; if you can trigger a blocked call, show the 403 + reason header | 0:32 |
| TAKE-19 | `/dashboard/evidence-vault` → `/dashboard/lineage` → `/dashboard/blast-radius` → `/dashboard/credentials` | Framework mapping view, lineage graph, a blast-radius simulation, vault entry (values masked) | 0:28 |
| TAKE-20 | `/dashboard/cost-firewall` → `/dashboard/webhooks` → `/dashboard/reports` → `/dashboard/detection-feedback` → `/dashboard/exports` → `/dashboard/badges` → `/dashboard/customer-success` → `/dashboard/settings` | Set a budget, show a signed webhook delivery, open a monthly report, mark one false positive, start an export, copy the badge embed, show the activation funnel | 0:34 |
| TAKE-21 | `/dashboard/enterprise/sso` → `/scim` → `/audit` → `/data-retention` → `/dashboard/reports/white-label` → `/dashboard/agency/clients` | ~3s each; white-label report with a client logo | 0:22 |
| TAKE-22 | `/dashboard/integrations` → `/extensions/browser` → `/extensions/ide` → `/integrations/n8n` → terminal | Integration catalogue, extension pages (status chips visible), n8n node, then a terminal running `docker compose up -d --build` | 0:28 |
| TAKE-23 | `/benchmark` → `/benchmark/methodology` → `/limitations` → `/trust` | Hold on the tuned vs blind numbers, the methodology note, and the limitations page | 0:26 |
| TAKE-24 | `/pricing` → `/dashboard/billing` → `/docs/services` | Plan cards, then the billing page showing plan and usage, then the searchable 33-service directory | 0:24 |
| TAKE-25 | `/demo/guided` | Let the full 5-stage run play: Injection → Tool blocked → Human approval → Evidence → SIEM trace | 0:30 |
| TAKE-26 | `/dashboard/code-security` → `/dashboard/security/model-scan` → `/dashboard/security/supply-chain` → `/dashboard/evaluations` | ~4s each | 0:18 |

Raw footage total ≈ 9 minutes — roughly 1:1 with the finished cut, which is deliberate: no filler, no B-roll padding.

---

## Part 2 — The InVideo AI brief (paste this into the prompt box first)

Upload all 26 takes to the project **before** sending this. Then paste it verbatim:

```text
Make a 9-minute product tour video for a real software product called SoterAI — an AI security control layer for AI apps and AI agents.

HARD RULES:
1. Use ONLY the screen recordings I uploaded. Do not add stock footage, no offices, no people, no generic tech b-roll, no AI-generated imagery. If a scene has no matching upload, hold the previous clip instead.
2. Do not invent, change, or round any number, price, feature name, or claim. Use my script exactly as written, word for word. Do not rewrite the script for "flow".
3. Voiceover: one Indian-English male voice, calm, technical, documentary tone, ~150 words per minute. No music swells over the numbers section.
4. Background music: minimal ambient tech bed at 10% volume, ducked under the voice throughout.
5. Aspect ratio 16:9, 1920x1080, 30fps. Burn in English subtitles, sans-serif, bottom centre, high contrast.
6. On-screen text: only the short titles I give per scene. Do not add emoji, do not add exclamation marks, do not add "Subscribe".
7. Transitions: hard cuts only. No zoom-blur, no glitch effects, no page peels.
8. Keep the app UI at 100% scale and never crop the browser chrome out of a clip that shows a URL — the URL is the proof.

Brand: dark UI, teal accent (#31d7c8), red for BLOCK (#f0616d), amber for approval-required (#f6c454), green for safe (#4ade80).

I will paste the scene-by-scene script next. Each scene names its uploaded clip as TAKE-xx. Assign that exact clip to that scene.
```

Then paste **Part 4** (the narration script) as the script.

Voice note: the brief above asks for an Indian-English **male** voice. If you prefer female, change that one line to `one Indian-English female voice` — just keep it identical for all 22 scenes, because a voice change mid-video reads as two different videos stitched together.

If your plan caps the runtime below 9 minutes, drop scenes in this order: 15 (Forensics), 19 (Enterprise & agency), 13 (Red Team Lab). Never drop scene 21 (the honesty numbers) — that scene is the reason this video is credible.

---

## Part 3 — Scene map (22 scenes · target 9:04)

| # | Scene | In → Out | Clip | On-screen title | Benefit stated |
|---|---|---|---|---|---|
| 1 | Hook | 0:00 → 0:18 | TAKE-01, TAKE-02 | `Your app checks auth. Not the prompt.` | Names the gap the viewer already has |
| 2 | Three surfaces | 0:18 → 0:40 | TAKE-01, TAKE-08 | `Input · Output · Tool call` | One layer instead of three point tools |
| 3 | Sign up → project → key | 0:40 → 1:05 | TAKE-05 | `Projects · API Keys` | Env isolation; a test key can't touch live data |
| 4 | Onboarding + integrate | 1:05 → 1:32 | TAKE-06, TAKE-07 | `Two calls. Any stack.` | Ships in an afternoon, not a sprint |
| 5 | Input Guard | 1:32 → 1:57 | TAKE-02, TAKE-04 | `Blocked before the model runs` | Attack stopped without an extra LLM round-trip |
| 6 | Output Guard | 1:57 → 2:22 | TAKE-03 | `Redacted before it leaves` | India PII stays out of the model and the logs |
| 7 | Guard Logs | 2:22 → 2:42 | TAKE-09 | `Every decision, searchable` | Incident timeline + auditor export |
| 8 | Policy Engine | 2:42 → 3:03 | TAKE-10 | `Your risk tolerance, versioned` | Provable policy on the day of an incident |
| 9 | Agent Firewall | 3:03 → 3:33 | TAKE-11, TAKE-25 | `₹2,50,000 held for approval` | Irreversible actions need a human |
| 10 | Agent Control Center | 3:33 → 4:13 | TAKE-12 | `Identity · Intent · Sequence · Memory` | Governs *how* an agent behaves, not just what it says |
| 11 | RAG Security | 4:13 → 4:32 | TAKE-13 | `Poisoned document, blocked` | Your knowledge base stops being an attack path |
| 12 | Shadow AI | 4:32 → 4:50 | TAKE-14 | `The tools nobody told you about` | Find exposure before it becomes a disclosure |
| 13 | Red Team Lab | 4:50 → 5:09 | TAKE-15, TAKE-26 | `Attack yourself first` | Evidence of what gets through, before a customer finds it |
| 14 | Canary + Semantic Egress | 5:09 → 5:31 | TAKE-16 | `Catches attacks nobody has seen` | Detects novel leaks and paraphrased exfiltration |
| 15 | Forensics | 5:31 → 5:49 | TAKE-17 | `Reconstruct the incident` | Answers "what exactly happened" in minutes |
| 16 | Usage Governance | 5:49 → 6:19 | TAKE-18 | `Who may use which AI, with which data` | Visibility and control over staff AI use |
| 17 | Compliance | 6:19 → 6:47 | TAKE-19 | `Audit-ready evidence` | Audit prep becomes a download |
| 18 | Manage & operate | 6:47 → 7:15 | TAKE-20 | `Cost · Alerts · Reports · Feedback` | No bill shock, no silent failures |
| 19 | Enterprise & agency | 7:15 → 7:37 | TAKE-21 | `SSO · SCIM · SIEM · White-label` | Fits procurement and multi-client work |
| 20 | Integrations + self-host | 7:37 → 8:03 | TAKE-22 | `Where you already build` | Adopt without leaving your stack or your box |
| 21 | The honest numbers | 8:03 → 8:39 | TAKE-23 | `98.40% tuned · 61.54% blind` | Trust earned by publishing the bad number |
| 22 | Pricing + CTA | 8:39 → 9:04 | TAKE-24, TAKE-02 | `Free playground. No signup.` | Try it before you talk to anyone |

---

## Part 4 — The script (paste this whole block as the script)

Word-for-word narration. `[...]` lines are directions, not narration — InVideo AI reads them as scene instructions.

```text
[SCENE 1 | 0:00-0:18 | CLIP: TAKE-01 then TAKE-02 | TEXT: "Your app checks auth. Not the prompt."]
Your AI app checks the login. It checks the permissions. It never checks the prompt. And that is where the attack arrives — inside the prompt, inside the model's output, and inside the tool call your agent is about to make. This is SoterAI, running live.

[SCENE 2 | 0:18-0:40 | CLIP: TAKE-01 then TAKE-08 | TEXT: "Input · Output · Tool call"]
SoterAI is one control layer with three enforcement points. At the input it stops prompt injection and jailbreaks. At the output it redacts PII and secrets. At the tool call it holds risky actions for human approval. One policy engine decides all three — and detection runs locally, on CPU, with no outbound network call.

[SCENE 3 | 0:40-1:05 | CLIP: TAKE-05 | TEXT: "Projects · API Keys"]
Setup starts here. You sign up and land in a workspace. Projects keep production, staging and development apart, so a test key can never touch live data. Under API Keys you generate a scoped key — test or live — each with its own rate limit and rotation. Copy it once, and you are ready to send your first guarded call.

[SCENE 4 | 1:05-1:32 | CLIP: TAKE-06 then TAKE-07 | TEXT: "Two calls. Any stack."]
The Get Started checklist validates each step as you finish it, so you can watch the first guard call actually land. And integration is two calls, not a rewrite: guardInput before the model, guardOutput before the response reaches the user. Node, Python, LangChain, LlamaIndex, the Vercel AI SDK, or the REST API directly — five lines, any stack.

[SCENE 5 | 1:32-1:57 | CLIP: TAKE-02 then TAKE-04 | TEXT: "Blocked before the model runs" | FOOTER: "Self-maintained synthetic benchmark, not an independent audit."]
This is the Input Guard, in the public playground, no signup needed. Paste a prompt injection and it is blocked before the model is ever called. Base64, hex, homoglyphs, invisible Unicode, Hinglish attacks — the payload is decoded first, then judged. Fifteen jailbreak families. Deterministic rules first, then an ONNX classifier. Seventeen point eight milliseconds at p95.

[SCENE 6 | 1:57-2:22 | CLIP: TAKE-03 | TEXT: "Redacted before it leaves" | FOOTER: "All identifiers on screen are synthetic test values."]
Now the other direction. A support ticket carrying an Aadhaar-like number, a PAN, a UPI ID — every value on this screen is synthetic. The Output Guard redacts them before the response leaves your app, and blocks unsafe HTML or a script sink outright. India-first PII: Aadhaar, PAN, UPI, IFSC and GSTIN — which almost no global vendor covers.

[SCENE 7 | 2:22-2:42 | CLIP: TAKE-09 | TEXT: "Every decision, searchable"]
Every decision is written to Guard Logs — what was blocked, allowed or redacted, the risk score, and why. Filter by action, risk level or date, open a single event, then export to JSON or CSV for your auditor or your SIEM. This is your incident timeline, and it exists before you need it.

[SCENE 8 | 2:42-3:03 | CLIP: TAKE-10 | TEXT: "Your risk tolerance, versioned"]
You decide how strict it is. The Policy Engine sets risk thresholds and the default action per project — monitor only, redact, or block — with override rules for sensitive categories, and versioning, so you can prove what the policy was on the day of an incident.

[SCENE 9 | 3:03-3:33 | CLIP: TAKE-11 then TAKE-25 | TEXT: "₹2,50,000 held for approval"]
Agents are different, because agents act. The Agent Firewall inspects every tool call before it executes. Here the agent decides to transfer two hundred and fifty thousand rupees. The call is intercepted, classified irreversible, and held in the approval queue with the payload redacted. Approve it and it runs, with a fifteen-minute rollback window. Every decision lands in the action ledger with a SHA-256 hash. Sessions, replay, canaries and the MCP scanner sit alongside it.

[SCENE 10 | 3:33-4:13 | CLIP: TAKE-12 | TEXT: "Identity · Intent · Sequence · Memory"]
The Agent Control Center is where governance gets specific. Agent Passports give every agent a signed Ed25519 identity that can be revoked instantly. Transaction Escrow holds risky actions for a human reviewer. Intent Guard flags actions that drift from what the user originally asked for. Tool Chain catches dangerous sequences — read a config file, email it, delete the logs. The Dry-Run Sandbox tests a policy without executing anything. Memory Firewall quarantines poisoned agent memory. MCP Drift alerts you when an MCP server's tools change underneath you. And Legal Boundary is the line an agent cannot cross, even when it is explicitly instructed to. MCP and Agent Guard ship as Labs.

[SCENE 11 | 4:13-4:32 | CLIP: TAKE-13 | TEXT: "Poisoned document, blocked"]
Your knowledge base is an attack surface too. RAG Security scans documents at ingest, guards retrieval at query time, and scores source trust, so a poisoned page cannot quietly instruct your model. LangChain and LlamaIndex hook straight in. You can watch the whole flow in the sample RAG demo.

[SCENE 12 | 4:32-4:50 | CLIP: TAKE-14 | TEXT: "The tools nobody told you about"]
Shadow AI finds the tools nobody told you about. It fingerprints AI service usage across your traffic, scores the risk of each destination, and gives you a remediation path — before an employee's paste becomes a disclosure you have to report.

[SCENE 13 | 4:50-5:09 | CLIP: TAKE-15 then TAKE-26 | TEXT: "Attack yourself first"]
Red Team Lab attacks your own system on purpose. Run adversarial prompts and jailbreaks in a sandbox, mapped to the OWASP LLM Top Ten, and get a report of exactly what got through. AI code review, model scanning and supply-chain checks sit beside it.

[SCENE 14 | 5:09-5:31 | CLIP: TAKE-16 | TEXT: "Catches attacks nobody has seen"]
Two detectors for the attacks nobody has seen yet. Canary Network plants unique tripwire tokens in system prompts and documents — if one ever appears in an output, you know protected context leaked, even from a novel attack. Semantic Egress catches confidential data that has been paraphrased to slip past pattern matching.

[SCENE 15 | 5:31-5:49 | CLIP: TAKE-17 | TEXT: "Reconstruct the incident"]
When something does happen, Forensics reconstructs it: a timeline of the session, the content as it was, the root cause, and an evidence package you can hand to legal or an auditor. Detection here is defence in depth — not a guarantee.

[SCENE 16 | 5:49-6:19 | CLIP: TAKE-18 | TEXT: "Who may use which AI, with which data"]
This is the problem every company already has: staff pasting company data into ChatGPT, Claude and Cursor. Usage Governance decides it by policy — department rules, data classification, which providers and models are allowed, and who needs approval. A blocked request returns an HTTP 403 with a reason header, not a silent failure. Employee monitoring, a full audit trail and quarterly compliance reports come with it. Browser Guard and IDE Guard are Beta.

[SCENE 17 | 6:19-6:47 | CLIP: TAKE-19 | TEXT: "Audit-ready evidence"]
Audit season. Evidence Vault collects guard logs, policy configuration and access records, and packages them against SOC 2 and ISO 27001 control mappings — that is evidence collection, not certification, and certification is a separate audit we do not claim. Context Lineage tracks where data came from and blocks cross-domain use. Blast Radius estimates the damage if an agent were compromised. Credential Vault keeps agent secrets out of environment variables.

[SCENE 18 | 6:47-7:15 | CLIP: TAKE-20 | TEXT: "Cost · Alerts · Reports · Feedback"]
Day to day. Cost Firewall caps LLM spend with real-time budgets and hard enforcement, so a looping agent cannot hand you a bill shock. Webhooks stream signed events to Slack, PagerDuty or your SIEM in seconds. Then monthly Reports, Detection Feedback to cut false positives on your own data, Audit Exports, Security Badges, Settings for team and roles, and Customer Success for activation and churn risk.

[SCENE 19 | 7:15-7:37 | CLIP: TAKE-21 | TEXT: "SSO · SCIM · SIEM · White-label"]
For larger teams, the enterprise pages are already here: SAML single sign-on, SCIM user provisioning, an enterprise audit trail, configurable data retention, security review, and SIEM delivery. Agencies get isolated client workspaces and white-label reports carrying their own logo. Enterprise pricing is volume-based, with a paid pilot and an SLA review.

[SCENE 20 | 7:37-8:03 | CLIP: TAKE-22 | TEXT: "Where you already build"]
It ships where you already build. Published packages for Node and Python, browser and IDE extensions for VS Code, Cursor and Windsurf, nodes for n8n, Make and Zapier, and an MCP gateway. The extensions and workflow nodes are Beta — labelled, not hidden. And the whole stack self-hosts: docker compose up, on your own box, with no telemetry leaving it.

[SCENE 21 | 8:03-8:39 | CLIP: TAKE-23 | TEXT: "98.40% tuned · 61.54% blind" | FOOTER: "Self-maintained synthetic benchmark, not an independent audit."]
Now the number most vendors cut. Aggregate recall is ninety-eight point four zero percent — but that is on tuned corpora, so treat it as a regression measure. On the blind held-out set, never tuned against, recall is sixty-one point five four percent. That is the honest one. The false positive rate is zero point zero zero percent, across three hundred and twenty-two benign controls. Seventeen point eight milliseconds at p95, CPU only. This is our own synthetic benchmark, not an independent audit — and the command to reproduce it is on screen.

[SCENE 22 | 8:39-9:04 | CLIP: TAKE-24 then TAKE-02 | TEXT: "Free playground. No signup."]
Pricing is public. Free is zero rupees, forever — input and output guard, playground access, basic logs. Starter is nine hundred and ninety-nine rupees a month, Pro is two thousand nine hundred and ninety-nine, Agency is nine thousand nine hundred and ninety-nine, and Enterprise is volume-based. The playground needs no signup at all. Go and try to break it — soter a i dot in, slash playground. If you get through, tell us how.
```

---

## Part 5 — Coverage matrix (all 33 documented services)

Proof that "sabhi features" is actually covered. Every row in `lib/docs/services.ts` appears in a scene, on its real dashboard route.

| Layer | Service | Real route | Scene |
|---|---|---|---|
| Monitor | Guard Logs | `/dashboard/logs` | 7 |
| Monitor | Reports | `/dashboard/reports` | 18 |
| Monitor | Detection Feedback | `/dashboard/detection-feedback` | 18 |
| Monitor | Customer Success | `/dashboard/customer-success` | 18 |
| Protect | Agent Firewall | `/dashboard/agent-firewall` | 9 |
| Protect | Policy Engine | `/dashboard/policy` | 8 |
| Protect | RAG Security | `/dashboard/rag/security` | 11 |
| Protect | Webhooks | `/dashboard/webhooks` | 18 |
| Detect | Shadow AI | `/dashboard/shadow-ai` | 12 |
| Detect | Red Team Lab | `/dashboard/redteam/lab` | 13 |
| Detect | Forensics | `/dashboard/forensics` | 15 |
| Detect | Canary Network | `/dashboard/canary-network` | 14 |
| Detect | Semantic Egress | `/dashboard/semantic-egress` | 14 |
| Control | Agent Passports | `/dashboard/agent-passports` | 10 |
| Control | Transaction Escrow | `/dashboard/escrow` | 10 |
| Control | Intent Guard | `/dashboard/intent-guard` | 10 |
| Control | Tool Chain | `/dashboard/tool-chain` | 10 |
| Control | Dry-Run Sandbox | `/dashboard/dry-run` | 10 |
| Control | Memory Firewall | `/dashboard/memory-firewall` | 10 |
| Control | MCP Drift | `/dashboard/mcp-drift` | 10 |
| Control | Legal Boundary | `/dashboard/legal-boundary` | 10 |
| Compliance | Evidence Vault | `/dashboard/evidence-vault` | 17 |
| Compliance | Context Lineage | `/dashboard/lineage` | 17 |
| Compliance | Blast Radius | `/dashboard/blast-radius` | 17 |
| Compliance | Credential Vault | `/dashboard/credentials` | 17 |
| Manage | Projects | `/dashboard/projects` | 3 |
| Manage | API Keys | `/dashboard/api-keys` | 3 |
| Manage | Cost Firewall | `/dashboard/cost-firewall` | 18 |
| Manage | Security Badges | `/dashboard/badges` | 18 |
| Manage | Billing | `/dashboard/billing` | 22 |
| Manage | Settings | `/dashboard/settings` | 18 |
| Manage | Audit Exports | `/dashboard/exports` | 18 |
| Manage | Onboarding | `/dashboard/onboarding` | 4 |

**Also on screen, beyond the 33 documented services:** Agent Control Center (`/dashboard/agent-control`), Identity Fabric (`/dashboard/identity-fabric`), AI Code Review (`/dashboard/code-security`), Model Scan (`/dashboard/security/model-scan`), Supply Chain (`/dashboard/security/supply-chain`), Evaluations (`/dashboard/evaluations`), the nine Usage Governance pages, the six Enterprise pages, Agency clients, White-label reports, Browser/IDE extensions, and the public `/playground`, `/demo/guided`, `/demo/rag`, `/demo/red-team`, `/benchmark`, `/limitations`, `/trust`, `/pricing`, `/docs/services`.

---

## Part 6 — Publish kit

**Exports:** 16:9 1920×1080 master first. Then ask InVideo for a 1:1 and a 9:16 version of the 60-second cut in Part 8 — do not vertically crop the 9-minute tour, the dashboard tables become unreadable.

**Title (pick one, all ≤70 chars, all claim-safe):**
- `SoterAI full product tour — AI security for apps and agents`
- `I published my AI firewall's worst number. Full product tour.`
- `Every SoterAI feature, in the real app, in 9 minutes`

**Description:**
```text
A complete walkthrough of SoterAI in the real product — 33 documented services across six layers: Monitor, Protect, Detect, Control, Compliance, Manage.

00:00 The gap: your app checks auth, not the prompt
01:32 Input Guard — prompt injection blocked before the model runs
01:57 Output Guard — Aadhaar, PAN, UPI and live keys redacted (synthetic values)
03:03 Agent Firewall — an irreversible ₹2,50,000 transfer held for approval
05:49 Usage Governance — who may use which AI, with which data
06:19 Compliance evidence — SOC 2 and ISO 27001 control mappings
08:03 The numbers, including the one that looks bad

Detection numbers shown in this video: 98.40% aggregate recall on tuned corpora (1104/1122), 61.54% on a blind held-out set (16/26), 0.00% false positives on 322 benign controls, 17.83ms p95 over 3,200 cases on CPU. Self-maintained synthetic benchmark, not an independent audit. Reproduce: npx tsx scripts/readme-recall-audit.ts

Status labels: API Guard and Audit Evidence are Stable. Browser Guard, IDE Guard, n8n, Make and Zapier nodes are Beta. MCP / Agent Guard is Labs. Detection is defence in depth, not a guarantee.

Try it with no signup: https://soterai.in/playground
Service reference: https://soterai.in/docs/services
Limitations, in our own words: https://soterai.in/limitations
Trust centre: https://soterai.in/trust
Repo: https://github.com/yashchauhan66/Soter-AI
```

**Thumbnail text:** `98.40% tuned · 61.54% blind` over a frame of the playground BLOCK verdict. No face, no arrows, no red circles.

**Pinned comment:** `The 61.54% blind held-out number is in the video on purpose. If you can get an attack past the playground, reply with it — that is the fastest way to make this better.`

**Captions:** keep the burned-in subtitles and also download the `.srt`. Upload the `.srt` to YouTube rather than relying on auto-captions — auto-captions mangle "Aadhaar", "GSTIN", "guardInput" and "ONNX".

---

## Part 7 — QA before you publish

- [ ] Every clip is my own screen recording. Zero stock footage, zero AI-generated b-roll, zero people.
- [ ] No real API key, token, customer name, email or phone number is legible in any frame — pause on every frame that shows a key column.
- [ ] Every identifier on screen is synthetic, and scene 6 says so out loud.
- [ ] Every frame that shows a number also shows: *Self-maintained synthetic benchmark, not an independent audit.*
- [ ] Scene 21 still contains **61.54%**. If it got cut for pacing, put it back.
- [ ] Numbers in the video match Part 0 exactly — no rounding to "98%" or "99%".
- [ ] Beta and Labs statuses are spoken in scenes 10, 16 and 20, and the on-screen status chips are visible.
- [ ] Narration matches Part 4 word for word; the AI did not "improve" a claim.
- [ ] No forbidden phrase anywhere in the video, title, description, thumbnail or pinned comment (see Part 0).
- [ ] No clip is sped up in a way that implies faster latency than measured.
- [ ] Runtime is within 30s of 9:04 — if it is much shorter, a scene silently lost its clip.

---

## Part 8 — Derived cuts (same footage, same narration, no new recording)

**60-second social cut** — scenes 1, 5, 6, 9, 21, 22, first two sentences of each. Export 9:16 and 1:1.

**3-minute sales cut** — scenes 1, 2, 5, 6, 9, 10, 16, 17, 21, 22 in full. This is the version to send to a prospect who asked "what does it actually do".

**Per-feature shorts** — every scene from 7 to 20 is already a standalone 20-40s short: one feature, one route, one benefit. Post them one at a time with the scene title as the caption.

---

## Maintenance

This document is hand-authored, so it is **not** guarded by `tests/marketing-video-claims.test.ts` (that gate only checks `marketing/video/manifest-*.json` from the slide-render pipeline). If the detection numbers change, they must be updated here by hand:

```powershell
npx tsx scripts/readme-recall-audit.ts          # regenerates benchmarks/results/readme-detection-audit-<date>.txt
node scripts/phase-9-run-public-benchmark.js    # regenerates benchmarks/results/latest.json
```

Then update Part 0, scene 5 (p95), scene 21 (all four numbers) and the description block in Part 6. Nothing else in this file carries a number.





