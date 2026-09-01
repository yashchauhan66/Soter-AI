# SoterAI — September 2026 User-Growth Sprint

**North-star goal:** turn product proof into activated users, not vanity impressions.

**Primary audience:** AI developers and small engineering/security teams shipping chatbots, RAG systems, automations, or agents.

**Positioning:**

> Stop sensitive company data and risky AI-agent actions before they become incidents.

**Primary campaign CTA:** `Test it live — no signup` → `https://soterai.in/playground`

**Activation event:** a visitor runs one playground scan, then creates a project/API key or installs a guard.

---

## 1. The funnel to optimize

| Stage | User action | Target rate | Measure |
|---|---|---:|---|
| Attention | Views a demo, post, listing, or search result | — | Impressions and reach |
| Interest | Visits a SoterAI landing page | 2%+ social CTR | UTM sessions |
| Proof | Runs a playground scan or opens benchmark methodology | 25%+ of visits | Playground/benchmark visits |
| Activation | Creates an account, API key, or installs a guard | 10%+ of visits | Activated users |
| Retention | Completes 3+ scans in week one | 35%+ of activations | Weekly active users |
| Referral | Shares a result, stars GitHub, or invites a teammate | 10%+ of activated users | Referrals/stars/invites |

Do not optimize posts for likes. Optimize the sequence **post → playground → first scan → API key/install → repeated scan**.

---

## 2. Message hierarchy

Use one message per creative. Do not list every feature.

### Hook A — immediate developer pain

**Headline:** Your AI app can leak data before your security team sees the request.

**Proof:** Show one prompt entering SoterAI and the `BLOCK` or `REDACT` decision.

**CTA:** Test the same flow in the public playground—no signup.

### Hook B — agent-action control

**Headline:** AI agents should not send, spend, delete, or deploy without policy checks.

**Proof:** Show a risky tool call routed to block or human review.

**CTA:** Review the agent firewall demo.

### Hook C — India-specific data protection

**Headline:** Before Aadhaar-like data, PAN, GSTIN, UPI, or IFSC reaches an AI model, redact it.

**Proof:** Use synthetic identifiers only; show before/after redaction.

**CTA:** Try a safe example in the playground.

### Hook D — transparent engineering proof

**Headline:** Do not trust an AI-security benchmark you cannot inspect.

**Proof:** Link the 3,200-case self-maintained synthetic dataset, methodology, results, and limitations together.

**CTA:** Reproduce the benchmark or inspect the methodology.

Always say **self-maintained synthetic benchmark** beside performance numbers. Never imply independent validation.

---

## 3. Campaign assets to create once and reuse

1. **15-second vertical demo:** malicious prompt → scan → block → playground URL.
2. **15-second India DLP demo:** synthetic PAN/Aadhaar-like sample → redact → no raw-value storage claim scoped to redaction paths.
3. **20-second agent demo:** dangerous tool call → policy decision → human review.
4. **Benchmark proof card:** 3,200 synthetic cases, attack/control split, result date, and “self-maintained—not third-party” footer.
5. **One architecture image:** User/RAG/Agent → SoterAI → Model/Tool.
6. **Founder image and story:** why the product exists, what is live, and what remains Beta/Labs.

Each asset needs three crops: 16:9 for YouTube/website, 1:1 for LinkedIn/Product Hunt, and 9:16 for Shorts/Reels.

---

## 4. Four-week execution calendar

### Week 1 — Fix measurement and demonstrate value

- **Day 1:** record baseline sessions, playground scans, signups, activated API keys, installs, and GitHub stars.
- **Day 2:** publish the 15-second prompt-injection demo on X and LinkedIn.
- **Day 3:** publish a technical breakdown on Dev.to/Hashnode; link to the playground first and docs second.
- **Day 4:** share the India DLP demo in developer communities where self-promotion is allowed.
- **Day 5:** contact 10 AI app builders with a personalized, no-pitch offer to test one workflow.
- **Day 6:** turn objections and comments into an FAQ post.
- **Day 7:** keep the top-performing hook; retire weak hooks instead of reposting them unchanged.

### Week 2 — Developer launch

- Publish a Show HN only when the repository, setup path, benchmark caveats, and demo are ready.
- Publish two n8n workflow templates and a practical community tutorial.
- Share one copy-paste integration snippet for TypeScript and one for Python.
- Ask every new user one question: **“What AI workflow are you trying to protect?”**
- Convert repeated answers into landing pages and templates.

### Week 3 — Trust and India wedge

- Publish the benchmark methodology walkthrough, including limitations.
- Publish a synthetic Aadhaar/PAN/Hinglish demo; never expose real personal data.
- Offer five 20-minute AI data-flow reviews to qualified Indian startups.
- Turn one completed review into an anonymized case study only with explicit permission.
- Pitch security and developer newsletters with the reproducible benchmark angle—not a generic launch pitch.

### Week 4 — Conversion and retention

- Send an activation email to users who signed up but did not create an API key.
- Publish a “first protected request in 10 minutes” walkthrough.
- Add the highest-converting demo to Product Hunt, GitHub, npm, extension listings, and the website.
- Interview five active and five inactive users.
- Report the full funnel and choose next month’s channel based on activated-user cost, not impressions.

---

## 5. Ready-to-use launch copy

### Short social post

> Your AI app checks authentication. But does it check the prompt, retrieved context, model output, and agent action?
>
> SoterAI adds one control layer across that flow: detect prompt injection, redact secrets and Indian PII, and stop risky tool calls before execution.
>
> Test it live—no signup: https://soterai.in/playground

### Developer-community post

> I built SoterAI because AI security controls are usually split across prompt filters, DLP tools, agent permissions, and audit systems.
>
> The project puts those decisions in one layer across inputs, outputs, RAG context, and tool calls. There is a public playground and a reproducible 3,200-case synthetic benchmark. The benchmark is self-maintained, not independent, and its limitations are published.
>
> I would value technical feedback, especially bypasses and false positives: https://soterai.in/playground

### Outreach message

> Hi {{name}} — I saw that {{company}} is building {{specific AI workflow}}. I’m building SoterAI, a control layer for prompt injection, sensitive-data leakage, and risky agent actions. No sales deck first: if useful, I can test one non-sensitive example from your workflow and send the decision trace. Public playground: https://soterai.in/playground

### Homepage one-liner

> One security layer for every prompt, output, retrieved document, and agent action.

---

## 6. Tracking convention

Use the same UTM structure everywhere:

```text
https://soterai.in/playground?utm_source=linkedin&utm_medium=organic_social&utm_campaign=sep26_growth&utm_content=india_dlp_demo
```

- `utm_source`: `linkedin`, `x`, `reddit`, `hackernews`, `devto`, `hashnode`, `youtube`, `n8n`, `email`
- `utm_medium`: `organic_social`, `community`, `article`, `video`, `marketplace`, `outreach`
- `utm_campaign`: `sep26_growth`
- `utm_content`: stable asset name such as `prompt_block_demo`, `india_dlp_demo`, `agent_action_demo`, `benchmark_proof`

Weekly dashboard columns:

```text
Date | Source | Asset | Impressions | Visits | Playground scans | Signups | Activated users | Week-1 retained | Notes
```

Primary KPI: **activated users by source**. Secondary KPI: **visit-to-activation rate**.

---

## 7. Non-negotiable trust rules

- Never claim “100% secure,” “zero false positives” generally, SOC 2 compliance, independent validation, or marketplace approval without current evidence.
- Keep `Stable`, `Beta`, and `Labs` labels visible.
- Benchmark claims must include dataset scope and link to methodology/limitations.
- Use only synthetic secrets and identifiers in demos.
- Do not buy followers, reviews, comments, or upvotes.
- Ask communities for critique, not coordinated votes.
- Obtain explicit permission before naming a customer or publishing a testimonial.

---

## 8. Today’s 90-minute sprint

1. Record the prompt-injection playground demo (20 minutes).
2. Export 16:9, 1:1, and 9:16 versions (20 minutes).
3. Publish the short social post with a tagged playground URL (10 minutes).
4. Send the outreach message to five highly relevant builders (20 minutes).
5. Record baseline funnel numbers and schedule the next six posts (20 minutes).

At the end of seven days, double down only on channels that produce playground scans and activated users.