# 25 — n8n Creator Outreach: Verified Targets + DM Templates

**Created:** 2026-09-12 | **Goal:** 1 creator video in 3 weeks = 50-200 node installs
**Source of targets:** n8n's own **Verified Creators Directory** (https://n8n.io/creators/) — every name below is verified by n8n itself with public template counts. No guessed names.

---

## 🎯 THE 3 PRIORITY TARGETS (DM in this order)

### 1. Harshil Agrawal — BEST FIT

**Why:** n8n verified creator with **186 published workflow templates**; n8n's former education lead — he literally taught thousands of people n8n. His audience = exact ICP (workflow builders adding AI nodes).
**Where to reach:** LinkedIn (search "Harshil Agrawal n8n") + n8n forum DM + his YouTube channel.
**Angle:** He writes about n8n best practices — "securing AI workflows" is a natural next topic for his content.

### 2. Cheng Siong Chin — HIGH REACH

**Why:** n8n verified creator, **204 templates**; runs a popular YouTube channel with n8n courses (search "Cheng Siong Chin n8n YouTube"). Large tutorial audience.
**Where to reach:** YouTube channel about/business email + LinkedIn.
**Angle:** Full workflow-course angle — "AI agent security" module for his n8n course series.

### 3. Yaron Been — AUTOMATION NATIVE

**Why:** n8n verified creator, **180 templates**; well-known automation YouTube presence; interviews founders building in the automation space (his channel regularly features tool founders).
**Where to reach:** LinkedIn + YouTube.
**Angle:** Founder-interview format — he features new automation tools, which is exactly our launch.

### Backup bench (agar pehle 3 me se koi reply na kare 7 din me)

| Creator                    | Templates                          | Note                                         |
| -------------------------- | ---------------------------------- | -------------------------------------------- |
| Rahul Joshi                | 331                                | #1 by template count                         |
| Davide Boizza              | 155                                | EU timezone audience                         |
| Jitesh Dugar               | 133                                | India-based — Hindi/English content possible |
| Nate Herk \| AI Automation | YouTube channel (confirmed active) | Big n8n tutorial channel                     |

---

## 📋 DM TEMPLATE #1 — Harshil (LinkedIn/forum, personalize before sending)

````text
Hi Harshil,

I've followed your n8n work since your education-team days — your templates
are half the reason I got productive in n8n quickly, so thank you for that.

I've just released a free MIT community node that I think fits a gap your
audience keeps hitting: n8n-nodes-soterai — an AI security layer for AI
workflows. One node between input and your AI app that:

- blocks prompt injection / jailbreaks before they reach the LLM
## 📋 DM TEMPLATE #2 — Cheng Siong Chin (course-module angle)

```text
Hi Cheng,

Your n8n course series is one of the clearest on YouTube — I've pointed
several people at it.

Quick pitch relevant to your AI-workflow content: I've released a free
community node, n8n-nodes-soterai, that adds a security layer to AI workflows
in n8n — prompt-injection blocking, PII redaction (India + global), and
least-privilege agent "passports" for tool calls. It has a fully offline local
engine, so it demos well on camera: paste an "ignore all previous
instructions" payload, watch the node BLOCK and route it to a Flagged output.
No IF node needed — the two outputs (Safe/Flagged) are built in.

I can hand you a ready-made demo workflow + the exact test payloads, so
recording would be mostly hitting execute. Free, MIT, no strings — credit is
all I'd ask.

Would that fit a module in your series?

[Yash / SoterAI]
````

## 📋 DM TEMPLATE #3 — Yaron Been (founder-interview angle)

```text
Hi Yaron,

I've seen the founder interviews on your channel — great format, and the
automation audience you've built is exactly who I built this for.

I'm Yash, founder of SoterAI. We just shipped an n8n community node (MIT,
free) that adds a security layer to AI workflows: prompt-injection blocking,
PII redaction (Aadhaar/PAN/UPI + global), and scoped agent passports for tool
calls — with a genuinely offline local engine (no network, no credential,
~46ms/item).

The story your audience might like: most n8n AI workflows send everything to
LLM providers with zero checks — and nobody's covering the security gap yet.
I can demo it live: an "ignore previous instructions" payload getting blocked,
a customer PII payload coming back redacted, an agent tool call getting
refused without a valid passport.

Happy to come on, or just hand you the node + demo workflows if you prefer
solo coverage. Either works.

[Yash / SoterAI]
https://soterai.in · npm: n8n-nodes-soterai
```

---

## 🔁 CADENCE & RULES

| Day    | Action                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day 1  | DM #1 (Harshil) + DM #2 (Cheng) — LinkedIn morning IST                                                                                                                                   |
| Day 3  | DM #3 (Yaron)                                                                                                                                                                            |
| Day 5  | Gentle follow-up to non-responders (ONE line: "Floating this up in case it got buried — no worries if not a fit.")                                                                       |
| Day 10 | Move to backup bench (Rahul Joshi, Davide Boizza)                                                                                                                                        |
| Day 14 | Any creator who replies: send the demo-workflow bundle within 24h (from `packages/integrations/n8n/examples/` — pick `soterai-guard-input-webhook` + `soterai-agent-passport-lifecycle`) |

**Rules:**

- Ek creator ko sirf EK follow-up. Do follow-ups = spam.
- Reply aaye to < 4 hr response time, unke timezone me.
- "No payment expected / just credit" line rakho — creators ko paid-promo disclosure ka jhanjhat nahi, aur honest partnership zyada trustworthy lagta hai.
- Har DM me pehli 2 lines UNKE kaam ke baare me ho — generic DMs delete ho jaate hain.

## 📊 SUCCESS METRICS

| Metric                      | 7 din   | 21 din     |
| --------------------------- | ------- | ---------- |
| Reply rate (3 DMs)          | 1 reply | 2+ replies |
| Video commitments           | —       | 1          |
| Installs from creator video | —       | 50-200     |

- redacts PII (Aadhaar, PAN, UPI, IFSC + global) from text flowing to AI
- gives AI agents scoped "passports" (enroll → issue → validate → revoke)
- runs a fully OFFLINE engine — no network, no credential, ~46ms/item
  (air-gapped n8n instances work; nothing else does this)

Tested on real Docker n8n, 8/8 verdicts correct. 11 importable example
workflows included.

If it's interesting, I'd be glad to give you a ready-to-import demo workflow +
talking points so a video on it would be 20 minutes of prep, not days. No
payment expected — just a credit/link if you find it worth covering.

Either way, thanks for everything you've put into the n8n community.

[Yash / SoterAI]
npm: n8n-nodes-soterai · https://soterai.in/integrations/n8n

```

```
