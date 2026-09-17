# 23 — Reddit r/vscode Launch Post: "Fear + Solution" Format

**Created:** 2026-09-12 | **Status:** READY TO POST (copy-paste below)
**Placement:** r/vscode — **Show and Tell flair required** (subreddit self-promo sirf is flair ke saath allowed hai; title me "[Show]" prefix + flair select karo)

> **r/vscode rules (verified via subreddit wiki, summary):**
>
> - Self-promotion posts MUST use the **"Show and Tell"** flair + `[Show]` title prefix
> - Account should have prior non-promo activity (karma farming account pe spam-flag lagta hai)
> - Post Tuesday–Thursday, 9–11 AM ET (6:30–8:30 PM IST) — US workday peak
> - First 60 min me har comment ka reply karo (Reddit algorithm early engagement se rank karta hai)

---

## 📋 TITLE (copy this exactly)

```text
[Show] I built a free VS Code extension that catches your secrets BEFORE you paste them into ChatGPT/Copilot/Cursor
```

## 📋 POST BODY (copy-paste, ready)

```markdown
Last month I nearly shipped a fake-looking-but-real AWS key into a Copilot chat while debugging. The "oh no" moment came _after_ hitting send — that data went to a third-party server, and no amount of undo fixes that.

So I built SoterAI IDE Guard — a free, local-first VS Code extension that works where the leak actually happens: **inside your editor, before the paste**.

**What it caught in my own repo during testing (all fake values, but all real shapes):**

- AWS access keys (AKIA...)
- GitHub tokens (ghp_...)
- Database URLs with embedded passwords (postgres://admin:hunter2@...)
- Aadhaar / PAN / UPI IDs (Indian PII — I'm Indian, and no tool I found covers this)
- Prompt-injection attempts in pasted content ("ignore all previous instructions...")

**How it works in practice:**

1. You're about to paste something into an AI tool.
2. Select text → `Ctrl+Alt+S` (SoterAI: Check Before Sending to AI)
3. You get ALLOW / REDACT / BLOCK with a one-click **safe copy** — secrets replaced with `soterai://secret/...` references, so the AI still sees structure but never the values.

Works in: VS Code, Cursor, Windsurf, Kiro, Antigravity, VSCodium (free, no account, no API key, fully local by default).

**Honest limitations (because I'd rather lose a install than trust):**

- Live scan is diagnostics-only — it can't block other extensions' network calls (no VS Code API exists for that)
- Terminal guard warns on risky commands; full blocking needs the local broker path
- MCP/agent config analysis is detection-only
- No ML in the VSIX — regex + heuristics, ~46ms per check locally

I'd genuinely love brutal feedback — especially:

1. Would the Check-Before-Send shortcut fit your workflow, or would you want it automatic?
2. What else leaks from your editor into AI that I should detect?

Links: [Marketplace](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard) | [Open VSX](https://open-vsx.org/extension/soterai/soterai-ide-guard) | [Docs](https://soterai.in/vscode-ai-security)
```

## 📋 FIRST COMMENT (post ke turant baad — GIF + templates)

```markdown
**30-second GIF of it catching a fake AWS key mid-paste:**

[GIF link — soterai-secret-caught-before-ai.gif, hosted at soterai.in/marketplace/screenshots/]

Bonus: it also ships a demo scan command (`SoterAI: Run Safe Demo Scan`) with built-in test data, so you can verify it works without exposing anything real.
```

---

## 🎯 EXPECTED OUTCOMES & RULES OF ENGAGEMENT

| Metric         | Conservative | Good    | Viral (rare) |
| -------------- | ------------ | ------- | ------------ |
| Views          | 2-5K         | 15-30K  | 100K+        |
| Upvotes        | 10-25        | 60-150  | 400+         |
| Installs (48h) | 15-40        | 100-250 | 500+         |
| Comments       | 5-15         | 30-60   | 100+         |

**Comment reply strategy:**

- Every question < 30 min reply (6:30 PM IST posting = evening free)
- "Why not just use .gitignore?" → reply: gitignore git se bachata hai, AI paste se nahi — the leak vector is editor→clipboard→LLM, jo git ke baad bhi hota hai
- "How is this different from SonarLint?" → local-first AI-specific: SonarLint code lint karta hai, SoterAI the _content you're about to send to an AI_ check karta hai + secret broker references
- Koi bhi criticism accept karo — "you're right, that's a real limitation" builds more trust than defense

**⚠️ DO NOT:**

- Same day me multiple subreddits me crosspost (Reddit spam-filter multi-post flag karta hai — 2-3 din gap rakho, each post subreddit-specific ho)
- Upvote asking in DMs (sitewide ban risk)
- GIF host as imgur default — Reddit imgur GIFs ko mp4 me convert karta hai, marketplace GIF ka URL better works

```

---

## 🔁 OPTIONAL VARIANT FOR r/cursor (next week, after 2-3 day gap)

Title: `[Show] Cursor sends your open files to its servers. I built a free local guard that scans what leaves your editor first.`
Body: same skeleton, swap the intro to the Cursor-specific context-sharing story; link Cursor install link first (Cursor users Open VSX se install karte hain, marketplace nahi).
```
