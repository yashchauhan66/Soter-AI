# No-Gap Remaining Work Plan

**Created:** 2026-07-08
**Branch:** `seo-perf-full-pass`
**Purpose:** Everything still to do to finish the 18-phase no-gap readiness pass. Written so it can be picked up later. Honest state only — no faked results.

---

## Where things stand (verified this session)

**DONE and verified:**
- **Phase 1** — `docs/no-gap-master-readiness-register.md` created (scores, 17 gaps, 10 evidence-required items).
- **Phase 2** — full command battery green: `typecheck` clean, `lint` **0 errors** (91→**79 warnings**), `npm test` **669/669**, `test:sdk:js` 15/15, `benchmark:honest` 100% mitigation recall @ 0.54% FPR, `bench:guard-core` gates pass, `npm audit` 0 vulns, `npm run build` succeeds (**prod First Load JS = 102 KB**, far below the 405 KB dev figure). Lint triage: `docs/lint-warning-triage.md`.
- **Phase 2 bonus — real P2 security fix (GAP-17):** `app/api/extension/approval-claim/route.ts` was an unauthenticated, unrate-limited DB-write endpoint (imported `checkRateLimit` but never called it). Added `authenticateExtensionRequest` + `checkRateLimit("approval-claim")`, registered the limit in `lib/extension/rateLimiter.ts`, and hardened `tests/api-route-audit.test.ts`. 669/669 still pass.

**IN PROGRESS (WIP left in tree, repo is GREEN):**
- **Phase 3 (detection expansion)** — 1,450 NEW, non-overfit adversarial+benign cases created under `lib/classifiers/datasets/expanded/` (jailbreak 300, system-prompt-leak 150, data-exfil 150, tool-abuse 150, rag-poisoning 100, multilingual/Hinglish 150, benign 300). Scoring harness `tests/guard/_expanded-harness.ts` + `scripts/guard-benchmark/measure-expanded.ts`. New generalized detector `lib/guard/detectors/generalizedIntentDetector.ts` written.
  - **HONEST measured recall on the NEW cases (current, with the generalized detector active during tuning):** jailbreak **37.7%**, system-prompt-leak **55.3%**, data-exfil **29.3%**, tool-abuse **40.0%**, rag-poisoning **49.0%**, multilingual/Hinglish **35.3%**; benign FPR **3.0%**. This CONFIRMS the audit's core warning: the internal 100% was overfit; real generalization is far lower. This is the single most important finding of the pass.
  - The detector is currently **NOT registered** in `lib/guard/analyze.ts` (a `void generalizedIntentDetector;` placeholder + note). Reason: registering it double-fires on bare "ignore previous instructions" and breaks `tests/phase3.test.ts:130,139` (bare-injection policy escalation). Repo left at **669/669** deliberately.
- **Phase 4 (guard routing unification)** — `lib/guard/routingAdvisory.ts` written (advisory: riskClass/severity/recommendedEndpoint/safeNextAction). NOT yet wired into `analyzeText` metadata, SDK, or tests.

**NOT STARTED:** Phases 5–18.

---

## Phase 3 — finish detection generalization (highest priority)

**Goal:** ≥95% recall per attack category on the expanded corpus, benign FPR <1%, internal `benchmark:honest` unchanged (still 100% / 0.54%).

**Steps:**
1. **Resolve the bare-injection interaction, then register the detector.**
   - In `lib/guard/analyze.ts`, add `generalizedIntentDetector` back to `INPUT_DETECTORS` and `OUTPUT_DETECTORS` (remove the `void` line + note).
   - Fix `tests/phase3.test.ts:130/139`: the "Instruction override (generalized)" rule must not make `"Ignore all previous instructions."` non-bare. Either (a) suppress that rule when `promptInjectionDetector` already fired the same span, or (b) update the `applyPolicy` bare-injection classifier (`lib/guard/policy*`) to treat co-located override findings as one bare signal. Prefer (a) — dedupe redundant findings.
2. **Raise recall with GENERALIZED patterns (no memorizing corpus strings).** Iterate with `npx tsx scripts/guard-benchmark/measure-expanded.ts` after each change. Known remaining gaps and the generalization to add:
   - **Jailbreak (→95%):** broaden the "framed safety-neutralization" family — the `not:` guard is currently too aggressive (it excludes any "explain/how/what is", which real attacks contain). Narrow the benign guard to true education (defend/protect/mitigate/documentation/best-practice framing only). Add authority-impersonation tail (trust&safety team, government inspector, "person who wrote your system prompt", "set safety=false", "disable your refusal logic"). Add "refusal function returned an error / broken state" and inverted-twin/opposite-day framings.
   - **System-prompt-leak (55→95%):** broaden `OUTPUT_VERB`×`SYSTEM_TARGET` — add "character for character / word for word / in its entirety / every line / verbatim / scroll up in your context / read aloud". Ensure the SYSTEM_PROMPT_LEAK_ATTEMPT type still routes to BLOCK.
   - **Data-exfil (29→95%):** the send-verb×destination×data rule is too strict (requires all three). Split into: (a) send-verb + URL, (b) send-verb + covert-channel ("encode/hide/append the secret in…"), (c) OUTPUT-direction exfil payloads. Register on OUTPUT too.
   - **Tool-abuse (40→95%):** broaden `DESTRUCTIVE_CMD` (add `find … -delete`, `dd if=/dev/zero`, `curl … | bash`, `chmod -R 000`, DROP/TRUNCATE variants) and the "use the <shell/exec/db/payment/email/webhook> tool to <destructive/unbounded>" co-occurrence. Add unauthorized-outbound ("send to all contacts", "refund every transaction").
   - **RAG-poisoning (49→90%):** broaden `DOC_ADDRESSES_AI` (add "for AI crawlers only", "any model reading this", "tip zero for AI") and `PRIORITY_SPOOF` ("priority level 0", "supersedes all user instructions", "outranks the user", "higher-priority source").
   - **Multilingual/Hinglish (35→90%):** the Hinglish verb/target co-occurrence needs many more romanized verbs (`hatao/band karo/nikaal ke bhejo/dikha do/tod do/copy-paste karke bhej do/print karo/list karo`) and targets. Also extend `multilingualAttackDetector` for the Devanagari + Spanish/French/German/Chinese/Russian/Arabic cases in the corpus.
   - **Consider an ML/semantic tier** (audit's Top-Missing-Feature #1): the regex approach will plateau below 95% on the long tail. `lib/guard/semanticClassifier.ts` exists; expanding its seed set + lowering the review threshold for novel wordings is the durable path. Wire it so semantic-only hits → HUMAN_REVIEW (already the pattern).
3. **Drive benign FPR <1%.** Current offenders were security-education hard-negatives (bare `\bjailbreak\b` in `jailbreakDetector.ts:6`, CSRF discussion, "retrieval grounding"). Tighten those specific over-broad rules to require adversarial context (verb+target), not the bare noun. Re-check every change against `benignControlExpanded` AND the internal `expandedSafeInputs`.
4. **Write the 7 named test suites** (`tests/guard/*-expanded.test.ts`): jailbreak-expanded, system-prompt-leak-expanded, data-exfiltration-expanded, tool-abuse-expanded, rag-poisoning-expanded, multilingual-hinglish-expanded, benign-false-positive-expanded. Each imports its dataset + `_expanded-harness`, asserts the **measured** recall/FPR threshold (set the assertion to the honestly-achieved number; do NOT hard-code 95% if not met — assert what holds and note the target).
5. **Fold the expanded corpus into `benchmark:honest`** (optional): add the new datasets to `assembleGuardCorpus()` in `lib/benchmarks/honestBenchmark.ts` so the published number reflects generalization, not just the memorized corpus. This will LOWER the headline number honestly — update `docs/security/detection-benchmark-report.md` and the audit report accordingly.
6. **Commands:** `npm run benchmark:honest`, `npx tsx scripts/guard-benchmark/measure-expanded.ts`, `npm test`, `npm run typecheck`, `npm run bench:guard-core`.
7. **Acceptance:** per-category recall at target (or honestly-reported actual), benign FPR <1%, internal benchmark not regressed, all suites green.

**Files:** `lib/guard/detectors/generalizedIntentDetector.ts`, `lib/guard/analyze.ts`, `lib/guard/detectors/{jailbreak,systemPromptLeak,dataExfiltrationInput,multilingualAttack}Detector.ts`, `lib/guard/semanticClassifier.ts`, `lib/benchmarks/honestBenchmark.ts`, `tests/guard/*-expanded.test.ts`.

---

## Phase 4 — unify general guard / agent / tool / RAG routing

**Goal:** No silent coverage gap for callers of only `/guard/input` (BUG-004 / GAP-05).

**Steps:**
1. Wire `lib/guard/routingAdvisory.ts` into `analyzeText`: after findings are computed, call `deriveAdvisory(text, findings, riskTypes)` and attach under `metadata.advisory` (additive — already backward-compatible by design). Confirm existing response shape unchanged.
2. Expose SDK methods clearly (`packages/sdk`): `guard.input/output/analyze/agentAction/toolCall/rag`. Verify each maps to the correct API route; document in SDK README.
3. Add tests: tool-abuse not silently ALLOWed; benign automation not overblocked; advisory recommends the right endpoint; SDK method names resolve. (`npm test`, `npm run test:sdk:js`.)
4. Doc: dashboard "when to use each guard mode" page; route n8n/VS Code/browser-ext/SDK docs correctly.
5. **Acceptance:** advisory present for agent/tool/RAG-shaped inputs; SDK tests green; docs updated.

**Files:** `lib/guard/analyze.ts`, `lib/guard/routingAdvisory.ts`, `packages/sdk/**`, docs.

---

## Phase 5 — production build + scale testing (EVIDENCE REQUIRED for the live run)

**Goal:** Production Readiness >90 needs real scale proof.

**Steps:** `npm run build` (✅ already passes) → `next start` → create `scripts/perf/{guard-api-load-test,public-pages-load-test,dashboard-load-test,logs-scale-test,report-generation-test}.js`. Drive 1/10/100/500 concurrency + large payloads; record p50/p95/p99, throughput, error rate, memory/CPU. Fix slow queries / missing pagination / missing indexes / heavy first-load. Write `docs/performance-production-benchmark.md`.
**Note:** disk was 100% full this session (freed to ~3 GB); provision headroom before load runs. Mark the on-deployed-infra 100/500-concurrency run **EVIDENCE REQUIRED** if only local.

---

## Phase 6 — real web-app user journey (EVIDENCE REQUIRED: real browser)

15-step journey (visitor→signup→OTP→login→org/project→API key→first guard call→logs→policy→webhook→report→upgrade→return→recovery). Use the Playwright runner (`scripts/runPlaywright.mjs`) — see the OneDrive/Turbopack workaround. Fix empty/loading/error states, nav, mobile. Create `docs/quickstart-first-5-minutes.md`, `docs/user-onboarding-checklist.md`, `docs/feature-status-matrix.md` (Stable/Beta/Labs/Enterprise/Evidence-Required). Update User-Friendliness only after a real run.

---

## Phase 7 — n8n live workflow (EVIDENCE REQUIRED: running n8n)

Docker n8n → install community node (`packages/integrations/n8n`) → run 5 workflows (Manual→Analyze→IF; Webhook→Input→Respond; output→Guard Output→Save; invalid-cred; large payload/rate-limit). Fix credential UI/test, required fields, output schema, README, examples. Create `docs/n8n-real-user-test-checklist.md`, `docs/integrations/n8n-final-submission-checklist.md`, `examples/n8n/*.json`. Mark EVIDENCE REQUIRED until a live run exists.

---

## Phase 8 — VS Code extension runtime (EVIDENCE REQUIRED: real VS Code host)

Build VSIX (`npm run vscode:package`) → install → run the 25-point runtime checklist (activation, all public commands, webview, API-key config, scan selection/file/workspace, invalid key, offline, timeout, rate-limit, trust on/off, Output-panel secret check, activation time/memory). Fix `preview:true` (drop at GA), add `when`-clause command scoping (108 commands), hide debug commands, `.vscodeignore`, README. Create `docs/vscode-extension-marketplace-readiness.md`, `docs/vscode-extension-real-runtime-test-report.md`.

---

## Phase 9 — browser extension runtime + store readiness (EVIDENCE REQUIRED: real Chrome/Edge)

Fix first: narrow/justify `<all_urls>` (`apps/extension/manifest.json`), add explicit CSP, README, LICENSE, tests, store-listing + privacy docs, screenshots. Then real Chrome+Edge run of the 24-point checklist (install unpacked, popup/options/storage, mock-AI page scan, ChatGPT/Claude/Gemini/Perplexity after manual login, multi-tab, restart, offline, invalid key, rate-limit, banner/allow-override, no DOM breakage, no token leak, no console errors). Create `docs/browser-extension-store-readiness.md`, `docs/browser-extension-real-runtime-test-report.md`, `apps/extension/README.md`, extension tests.

---

## Phase 10 — billing / Razorpay (EVIDENCE REQUIRED: Razorpay test account)

Test keys + plan IDs → checkout order, success/fail payment, webhook valid/invalid signature (already fails-closed when secret unset), subscribe/cancel/reactivate, over-limit free plan, upgrade prompt, invoice, no secret logged, test/live mismatch. Create `docs/billing-production-readiness.md`, `docs/razorpay-test-mode-checklist.md`, `docs/billing-test-report.md`.

---

## Phase 11 — enterprise readiness + tenant isolation (EVIDENCE REQUIRED: 2 accounts + live IdP)

Seed two orgs/users/projects/keys → 21-point isolation battery (A can't reach B's org/project/logs/reports/webhooks/billing/RAG; viewer≠editor≠admin; audit logs; direct-URL block). Add to CI. SAML/SCIM against a real IdP (Okta/Auth0/Google): login, SCIM create/update/deactivate, role mapping. Create `docs/enterprise-readiness-checklist.md`, `docs/enterprise-runtime-test-report.md`, `docs/security/{access-control-model,shared-responsibility-model,data-retention-policy}.md`.

---

## Phase 12 — RAG security live (EVIDENCE REQUIRED: live vector store + 2 tenants)

Upload safe + malicious (prompt-injection / markdown / hidden-comment) docs → quarantine → verify quarantined not retrieved → namespace/ACL isolation → cross-tenant retrieval blocked → deleted-doc not retrievable → redaction-before-embedding → grounding guard blocks unsupported claim → report includes RAG risk. Create `docs/rag-security-live-test-report.md`. (The Phase-3 rag-poisoning corpus feeds the detection side.)

---

## Phase 13 — integration status matrix

For each of JS SDK / Python / WordPress / REST / Zapier / Make / Langflow / Flowise / Dify / Botpress / Voiceflow / LangChain / LlamaIndex / Vercel-AI: verify impl + docs + install + auth + one working example + invalid-key + error handling + package metadata; label Stable/Beta/Labs/Evidence-Required; hide unfinished from marketing. Create `docs/integrations/integration-status-matrix.md`, `docs/integrations/live-integration-test-report.md`.

---

## Phase 14 — external security validation package

Have (Phase 2): `SECURITY.md`, `public/.well-known/security.txt`, `docs/security/{responsible-disclosure,pentest-scope,pentest-remediation-tracker,soc2-iso-readiness-gap-analysis}.md`.
Still create: `docs/security/{security-architecture,threat-model,data-flow-diagram,vendor-risk-register,incident-response-plan,backup-restore-plan,key-management-policy,logging-monitoring-policy}.md`. Keep "SOC2-ready / preparation" language only — never claim certified. Commission pentest (external — EVIDENCE REQUIRED).

---

## Phase 15 — market & competitor strength

Create/update `docs/market/{competitor-comparison,positioning,pricing-strategy,why-soterai,target-customers,use-cases,beta-launch-plan,enterprise-pilot-plan}.md`. Evidence-based comparison vs Lakera/HiddenLayer/Protect AI/Prompt Security/Lasso/Bedrock Guardrails/Azure Content Safety/Google Model Armor/NeMo/LLM Guard/Promptfoo/Garak/PyRIT. Lead with reach + India/Hinglish + honesty, NOT "best detection" (can't claim yet — see Phase 3).

---

## Phase 16 — full retest

Run the entire battery + all runtime/EVIDENCE items completed. Create `docs/final-no-gap-retest-report.md` (everything fixed/tested/evidence/remaining).

---

## Phase 17 — update main audit report

Prepend "Final No-Gap Readiness Completion Summary" to `docs/final-real-user-enterprise-audit-report.md`; recalculate all 10 scores per the scoring rules (100 only with real proof; never 100 while pentest/prod-load/Razorpay/n8n-live/VS Code-Chrome-runtime/tenant-runtime/onboarding are unproven).

---

## Phase 18 — final output

Print the FINAL NO-GAP READINESS RESULT block (original vs new scores, closed/remaining P0–P3, evidence-required list, launch decisions per surface, top-20 improvements, top remaining evidence).

---

## Cross-cutting reminders
- **Honesty rule:** report measured numbers; mark external/runtime items EVIDENCE REQUIRED; never fake 100%. Phase 3's real generalization numbers (currently 30–55%) must be disclosed, not hidden.
- **Disk:** C: was at 100% (freed to ~3 GB). Keep headroom before builds/benchmarks; `.next` and npm-cache are the reclaimables.
- **Repo state left GREEN:** typecheck clean, `npm test` 669/669, internal benchmark 100%/0.54%. All Phase-3/4 WIP is present but inert (`generalizedIntentDetector` unregistered; `routingAdvisory` unwired) so nothing is broken.
- **Memory written:** `approval-claim-auth-gap-fixed.md` (the P2 + why CI missed it).
