---
title: "Keep API Keys Out of AI Coding Prompts"
rendered_title: "Keep API Keys Out of AI Coding Prompts | soterai.in"
meta_description: "Three layers that keep API keys out of AI coding prompts: local redaction, a guard call you control, and the editor extension. Code, results and limits."
slug: keep-api-keys-out-of-ai-coding-prompts
canonical_path: /blog/keep-api-keys-out-of-ai-coding-prompts
target_query: "prevent ai coding assistant leaking api keys"   # monthly volume UNVERIFIED
secondary_queries:
  - "stop cursor leaking secrets"        # UNVERIFIED
  - "copilot sends api keys to model"    # UNVERIFIED
  - "redact secrets before sending to chatgpt"   # UNVERIFIED
cluster: "5 Dev how-to: stop Cursor/Copilot leaking secrets (with 2 data leakage prevention)"
pillar: "Data leakage and PII"
publish_week: 3
schema_type: BlogPosting
author: Yash Chauhan
date_published: "TBD (set on publish day)"
try_it: "/playground?preset=api-key"
internal_links:
  - anchor: "how AI coding tools leak secrets"
    url: "/blog/how-ai-coding-tools-leak-secrets"
  - anchor: "SoterAI IDE Guard"
    url: "/extensions/ide"
  - anchor: "VS Code AI security"
    url: "/vscode-ai-security"
  - anchor: "Cursor AI security"
    url: "/cursor-ai-security"
  - anchor: "REST API reference"
    url: "/docs/rest-api"
  - anchor: "AI data leakage prevention"
    url: "/ai-data-leakage-prevention"
claims_register_numbers_used:
  - "benchmarks/results/latest.md: secret-pii category 300/300 (synthetic, self-written)."
  - "README-CLAIMS.md and packages/vscode-extension/README.md: IDE Guard assertion counts and exclusions."
verification_notes:
  - "Run on 2026-11-09: the curl below, guard-prompt.mjs on three synthetic prompts, and the five secret shapes in the table, all against https://soterai.in/api/guard/analyze. Outputs in this post are copied from those runs."
  - "preflight.cjs was tested through a twin that imports packages/soter-pii/index.ts (v1.1.0). The published package was not installed. npm registry shows soter-pii 1.1.0, Apache-2.0, modified 2026-08-01 (accessed 2026-11-09). Run npm install soter-pii in a scratch folder and re-run before publishing."
  - "NOT run: the authenticated call to /api/guard/input (no API key available). Request fields (message, sessionId) and the x-api-key header were checked against app/api/guard/input/route.ts, lib/validations.ts and app/docs/rest-api/page.tsx. The docs page lists decision values (ALLOW, REDACT, BLOCK, HUMAN_REVIEW) that differ from the action values the route returns (ALLOW_WITH_REDACTION, REWRITE). This post uses the action values seen in live responses."
  - "IDE Guard wording follows packages/vscode-extension/README.md and README-CLAIMS.md. The founder may soften tone but must keep the exclusions and the assertion counts."
  - "public/llms.txt says other VS Code-family editors are not tested, while the extension README install table lists Cursor, Windsurf, Kiro and others. This post follows llms.txt."
---

# Keep API Keys Out of AI Coding Prompts

The common ways a key ends up in a prompt are already covered in [how AI coding tools leak secrets](/blog/how-ai-coding-tools-leak-secrets). This post is the code. It shows what the soterai.in engine does with a key, a script that redacts a log before you paste it, a guard call you can put in a tool you control, and where the editor extension helps and where it cannot.

Every key below is fake and marked EXAMPLE. Do not send real secrets to the public endpoint.

## What the engine does with a key in a prompt

```bash
curl -s https://soterai.in/api/guard/analyze \
  -H "Content-Type: application/json" \
  -d '{"direction":"INPUT","text":"Here is my config: OPENAI_API_KEY=sk-proj-EXAMPLE00000000000000000000000000EXAMPLE please debug it."}'
```

An abridged response from 2026-11-09:

```json
{
  "allowed": false,
  "action": "BLOCK",
  "riskScore": 91,
  "riskTypes": ["SECRET_DETECTED"],
  "redactedText": "Here is my config: [REDACTED_SECRET] please debug it.",
  "findings": [
    { "label": "OpenAI-like API key", "severity": "CRITICAL", "start": 34, "end": 82 },
    { "label": "Environment secret assignment", "severity": "CRITICAL", "start": 19, "end": 82 }
  ]
}
```

The offsets are UTF-16 positions in the text you sent, the same as JavaScript string indices. The public endpoint allows 20 requests per minute and accepts up to 8,000 characters by default (`lib/guard/constants.ts`).

Here are five secret shapes and what came back. All values are synthetic.

| Shape | Action | Risk | Rules reported | What was replaced |
|---|---|---|---|---|
| OpenAI-style key in an env assignment | BLOCK | 91 | OpenAI-like API key, Environment secret assignment | The whole assignment became `[REDACTED_SECRET]` |
| AWS's documented example access key | HUMAN_REVIEW | 70 | AWS access key | The key value |
| GitHub-shaped token inside a clone URL | BLOCK | 95 | GitHub token, Email address | The token and host became `[REDACTED_EMAIL]` |
| Database URL with a password | BLOCK | 100 | Database URL, Named secret reference, Environment secret assignment, Email address | The text before `@`. The host and path stayed |
| Bearer token with a JWT-shaped value | HUMAN_REVIEW | 70 | JWT token | The token became `[REDACTED_JWT]` |

Two details matter. The GitHub row was redacted under an email label because the token and host look like `user@host`. The database row kept `@db.example.com:5432/prod`, so a redaction can leave infrastructure details behind.

## Layer one: redact locally before you paste

For a real log or file, do not call a remote service at all. The `soter-pii` package runs offline, has no dependencies, and checks Luhn for cards and Verhoeff for Aadhaar numbers, so look-alike order numbers are left alone. Install it with `npm install soter-pii`.

```js
// preflight.cjs  (Node 18+)  Usage: node preflight.cjs error.log
const { readFileSync } = require("node:fs");
const { redactPII } = require("soter-pii");

const result = redactPII(readFileSync(process.argv[2], "utf8"));
if (!result.hasPII) {
  console.log("nothing recognised");
  process.exit(0);
}
console.error(`redacted ${result.matchCount} value(s): ${result.detectedTypes.join(", ")}`);
process.stdout.write(result.redactedText);
```

On a four-line log holding an email address, a fake OpenAI key, AWS's example key, and a made-up Aadhaar number with a PAN, stderr read `redacted 5 value(s): AWS Access Key, OpenAI API Key, Aadhaar Card, PAN Card, Email`. The output had `[REDACTED_EMAIL]`, `[REDACTED_OPENAI_KEY]`, `[REDACTED_AWS_KEY]`, `[REDACTED_AADHAAR]` and `[REDACTED_PAN]` in place of the values. Redirect stdout to a file or the clipboard and paste that instead of the original.

## Layer two: a guard call in a path you control

If you own the tool that builds the prompt, such as a CLI wrapper, an internal chat proxy or a script, put a check in front of the model call. This script turns each action into a decision. With `SOTER_API_KEY` set it calls `/api/guard/input`, which takes `message` and an `x-api-key` header. Without a key it uses the public demo endpoint.

```js
// guard-prompt.mjs  (Node 18+)  Usage: node guard-prompt.mjs prompt.txt
import { readFileSync } from "node:fs";

const BASE = process.env.SOTER_BASE_URL ?? "https://soterai.in";
const KEY = process.env.SOTER_API_KEY; // server-side only

async function checkPrompt(text) {
  const res = KEY
    ? await fetch(`${BASE}/api/guard/input`, {
        method: "POST",
        headers: { "x-api-key": KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
    : await fetch(`${BASE}/api/guard/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, direction: "INPUT" }),
      });
  // A 429 body looks like a BLOCK verdict. Read the status first.
  if (res.status === 429) throw new Error(`rate limited, retry after ${res.headers.get("retry-after")}s`);
  if (!res.ok) throw new Error(`guard returned HTTP ${res.status}`);
  return res.json();
}

function decide(text, r) {
  switch (r.action) {
    case "ALLOW": return { send: true, text };
    case "ALLOW_WITH_REDACTION": return { send: true, text: r.redactedText };
    case "REWRITE": return { send: true, text: r.safeText };
    case "HUMAN_REVIEW": return { send: false, reason: "needs a person to look", riskScore: r.riskScore };
    default: return { send: false, reason: r.reason, riskScore: r.riskScore, redactedText: r.redactedText };
  }
}

const text = readFileSync(process.argv[2], "utf8").trim();
console.log(JSON.stringify(decide(text, await checkPrompt(text)), null, 2));
```

Three synthetic prompts gave these decisions on 2026-11-09:

| Prompt | Decision |
|---|---|
| The fake key in an env assignment | `send: false`, risk 91, with the redacted text returned for display |
| An email address and a US phone number in a refund note | `send: true` with `[REDACTED_EMAIL]` and `[REDACTED_PHONE]` |
| A TypeScript question about an empty array | `send: true`, text unchanged |

Keep the API key on the server. The [REST API reference](/docs/rest-api) says never to call the endpoint from browser JavaScript.

This wrapper only checks text that passes through it. It does not sit between Cursor or Copilot and their models.

## Layer three: the editor

SoterAI IDE Guard scans files, selections and the clipboard locally inside the editor. Local scanning needs no account, cloud connection or API key. Install it with `code --install-extension soterai.soterai-ide-guard`, or from the [SoterAI IDE Guard](/extensions/ide) page. The commands that matter for this problem:

- `SoterAI: Scan Before Sending to AI` (Ctrl+Alt+S, or Cmd+Alt+S on macOS) checks the selection or the clipboard and returns allow, redact, ask or block.
- `SoterAI: Redact Selection for AI` copies the selection with recognised values replaced.
- Safe Paste (Ctrl+Alt+V, or Cmd+Alt+V) scans the clipboard and pastes the safe version.
- `SoterAI: Generate Local Canary Secret` creates a fake token so you can test whether a leak would be noticed.

IDE Guard is Beta. The assertion run described below used VS Code 1.104.0 on Windows 11. Other editors in the VS Code family have not been tested and are not claimed. The extension's own page describes more, in [VS Code AI security](/vscode-ai-security) and [Cursor AI security](/cursor-ai-security).

## What this does not show

- **The public endpoint sees what you send.** It sends your text to the soterai.in server. For real files, use the offline script or the extension.
- **Redaction can be partial.** The database URL row kept the host and path. Review the output before you paste it.
- **Five samples are not a recall figure.** The public benchmark's secret and personal-data category scored 300 of 300 (100.00%), on a set we wrote. Neither number describes your secrets.
- **The wrapper covers only its own path.** An assistant that reads files itself never calls it.
- **The extension has a published ceiling.** `packages/vscode-extension/README.md` lists what it does not cover: native agents, same-user file and process access, other extensions, the original buffers and tabs, the OS clipboard and independent network traffic. It also says Copilot's direct content and traffic cannot be rerouted or observed by this integration. `README-CLAIMS.md` records 47 assertions evaluated under a threat model with a hostile process running as the same OS user: 8 scoped passes, 9 observed confidentiality leaks and 30 untested. 62 of 63 real-agent matrix cells are untested. The headline score is 2/10, provisional, and the full claim is blocked.
- **Redaction after the fact does not unsend.** If a real key reached a model provider, rotate it.

## Try it

Open the [API key preset in the playground](/playground?preset=api-key). It uses a made-up key and shows the rules, the redacted text and the action. For the wider picture, see [AI data leakage prevention](/ai-data-leakage-prevention).

## Frequently asked questions

### Does IDE Guard send my code to soterai.in?

Local scanning runs inside the extension host. Cloud features are off by default and only work in trusted workspaces, and telemetry is off by default, according to the extension README. Requests that you route through its local broker go to the model provider you configure.

### Can this stop Copilot or Cursor from reading a file?

No. Those tools read files through their own paths. The extension can scan what you select or paste and what passes through its broker. It cannot control another tool's direct reads or network calls.

### Is .gitignore enough?

No. It stops Git from committing a file. It does not stop an assistant from reading an ignored `.env` file that is open in your editor. The post on [how AI coding tools leak secrets](/blog/how-ai-coding-tools-leak-secrets) covers why.

### What if a real key already reached a model provider?

Treat it as exposed and rotate it. The engine's own finding message says the same: rotate it if the value is real.
