# 19 — Store & Registry Listing Copy

**Why this file matters more than it looks.** npm, PyPI, and the extension marketplaces are search engines with buying intent. Someone typing "prompt injection" into npm search is one command away from installing. That is a warmer lead than anyone who ever liked a LinkedIn post — and unlike social, the listing keeps ranking after you stop working on it.

**Every listing needs three things:** a first line that survives truncation, keywords that match how people actually search, and a link to `/playground` rather than the homepage.

---

## 1. npm — `@soterai/core`

**Description field** (shows in search results, truncates around 100 chars — front-load it):

```
Block prompt injection, secret leakage, and unsafe LLM output. Local CPU detection, no network call.
```

**Keywords** — these are the actual npm search terms, ordered by intent:

```json
"keywords": [
  "prompt-injection",
  "llm-security",
  "ai-security",
  "ai-guardrails",
  "llm-guardrails",
  "jailbreak-detection",
  "pii-redaction",
  "secret-detection",
  "ai-agent-security",
  "rag-security",
  "mcp",
  "content-moderation",
  "data-loss-prevention",
  "openai",
  "anthropic",
  "langchain"
]
```

**README first screen** — npm renders the README on the package page, and the first screen decides installs. Order it: one-line value proposition → install command → 10-line working example → benchmark table with disclaimer → playground link. Do not open with a logo and badges alone; the reader wants to know within two seconds whether this solves their problem.

Apply the same keyword discipline to `@soterai/langchain-middleware`, `@soterai/llamaindex-middleware`, `@soterai/vercel-ai-sdk-middleware`, and `@soterai/mcp-gateway`, swapping the framework name into position one.

---

## 2. PyPI — `soter`

**Summary** (one line, appears in search results):

```
Security layer for LLM apps: blocks prompt injection, redacts secrets and PII, gates agent tool calls.
```

**Keywords + classifiers** — PyPI ranks on name, summary, and keywords:

```toml
keywords = [
  "prompt-injection", "llm-security", "ai-security", "guardrails",
  "jailbreak-detection", "pii-redaction", "secret-detection",
  "ai-agent-security", "rag-security", "langchain", "llamaindex", "mcp",
]

classifiers = [
  "Topic :: Security",
  "Topic :: Scientific/Engineering :: Artificial Intelligence",
  "Intended Audience :: Developers",
  "Development Status :: 4 - Beta",
  "License :: OSI Approved :: Apache Software License",
]
```

`long_description` must be the full README with `long_description_content_type = "text/markdown"`. A PyPI page with a bare summary and no body converts badly.

**Verify the project URLs resolve.** `00-START-HERE-30-DAY-PLAN.md` flagged broken PyPI metadata as blocker B2 — confirm Homepage, Source, Documentation, and Issues all return 200 before the next release.

---

## 3. Open VSX / VS Code Marketplace — `soterai-ide-guard`

**Display name:** `SoterAI IDE Guard — Secret & Prompt Injection Scanner`

Marketplace search matches on display name, so the keywords belong in it. "IDE Guard" alone is unsearchable.

**Short description** (appears under the name in search):

```
Scans secrets, prompts, MCP tools, and terminal commands locally before they reach an AI model.
```

**Categories:** Linters, Other, Programming Languages
**Tags:** `security`, `secrets`, `prompt-injection`, `ai`, `copilot`, `cursor`, `windsurf`, `dlp`, `pii`, `mcp`

**Gallery — five screenshots, in this order.** Marketplace conversion is driven almost entirely by the first image:

1. A secret detected inline in the editor, blocked before reaching the copilot
2. The control panel with detectors listed
3. Redaction before/after, using a synthetic key
4. MCP tool review screen
5. Settings, showing local-only operation

Put `"Local by default — detection runs on your machine, no code leaves it"` in the first paragraph of the README. It is the strongest objection-handler for this audience, and it is true.

**Publisher verification** is still open on the VS Code Marketplace side — see `docs/vscode-publisher-verification.md`. Unverified publishers convert measurably worse on a security tool.

---

## 4. n8n — `n8n-nodes-soterai`

Already the strongest organic channel in the project. Protect it:

- Keep the `n8n-community-node-package` keyword. Removing it delists you from in-app search.
- Node display name should read as a benefit: `SoterAI — Guard AI Input & Output`.
- **Publish three templates.** Templates rank above nodes in n8n's search and are how most n8n users discover anything:
  1. "Guard a chatbot workflow against prompt injection"
  2. "Redact PII before writing to Google Sheets"
  3. "Require human approval before an agent sends an email"

---

## 5. Docker Hub — `soterai/soterai`

**Short description:**

```
Self-hosted AI security layer for LLM apps, RAG pipelines, and agents. Runs offline on CPU.
```

**Overview:** the quickstart from `DEPLOY-GUIDE.md` — a `docker run` line that works, the required environment variables, the healthcheck endpoint, and the resource footprint. Docker Hub visitors want the footprint before anything else. Lead with it.

Tag properly: `:latest`, `:0.2.0`, `:0.2`. A repo with only `:latest` reads as unmaintained.

---

## 6. GitHub repository — the page every other listing links to

The repo is the conversion page for every channel in this kit. Three things matter:

- **About sidebar:** description, `soterai.in` as the website, and topics — `ai-security`, `prompt-injection`, `llm-security`, `guardrails`, `ai-agents`, `mcp`, `pii-detection`, `rag-security`, `llm-firewall`, `jailbreak-detection`. GitHub topic pages are browsable and indexed.
- **A demo GIF above the fold.** The README currently opens with a logo and badges. A 3-second "attack → BLOCKED" GIF placed before the badge row is the highest-impact single change available to the repo.
- **Social preview image.** Set it in repo settings. Without it, every GitHub link shared anywhere renders as a grey placeholder.

---

## 7. One rule for all listings

The numbers you publish in a store listing are the numbers a reviewer will check. Every listing that cites recall or latency carries the same clause the README does: **self-maintained synthetic benchmark, not a third-party audit**, with the blind held-out figure beside the aggregate. `tests/marketing-launch-claims.test.ts` enforces this for the launch kit — hold store copy to the same standard, because store copy outlives launch copy.
