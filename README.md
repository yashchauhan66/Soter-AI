<div align="center">

<img src="public/logo.png" alt="SoterAI" width="220" />

# SoterAI

**The AI security command layer.** Stop prompt injection, data exfiltration, and rogue agent actions — at the input, at the output, and at the tool call.

Self-hostable · Offline-capable · India-first PII detection · Reproducible benchmarks

<p>
  <a href="https://soterai.in"><img src="https://img.shields.io/badge/Live-soterai.in-1f6feb?style=flat-square&logo=googlechrome&logoColor=white" alt="Live site" /></a>
  <a href="https://soterai.in/playground"><img src="https://img.shields.io/badge/Playground-try%20it-00a67e?style=flat-square&logo=react&logoColor=white" alt="Playground" /></a>
  <a href="https://soterai.in/docs"><img src="https://img.shields.io/badge/Docs-read-6e7781?style=flat-square&logo=gitbook&logoColor=white" alt="Docs" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Proprietary-b42318?style=flat-square" alt="Proprietary — all rights reserved" /></a>
  <img src="https://img.shields.io/badge/repository-private-6e7781?style=flat-square&logo=github&logoColor=white" alt="Private repository" />
</p>

<p>
  <img src="https://img.shields.io/badge/recall-98.40%25-00a67e?style=flat-square" alt="98.40% recall" />
  <img src="https://img.shields.io/badge/benign%20FPR-0.00%25-00a67e?style=flat-square" alt="0.00% false-positive rate" />
  <img src="https://img.shields.io/badge/p95-17.8ms-00a67e?style=flat-square" alt="17.8ms p95" />
  <img src="https://img.shields.io/badge/OWASP%20LLM%20Top%2010-mapped-6e7781?style=flat-square" alt="OWASP LLM Top 10 mapped" />
</p>

<a href="#quick-start"><b>Quick start</b></a> ·
<a href="#detection-performance"><b>Benchmarks</b></a> ·
<a href="#architecture"><b>Architecture</b></a> ·
<a href="#sdks--integrations"><b>SDKs</b></a> ·
<a href="#self-hosting"><b>Self-host</b></a> ·
<a href="#licensing"><b>Licensing</b></a>

</div>

---

## Why SoterAI

An LLM app has three attack surfaces, and most tools cover one. SoterAI covers all three from a single policy engine:

| Surface | The risk | What SoterAI does |
|---|---|---|
| **Input** | Prompt injection, jailbreaks, encoded payloads, multilingual trojans | Classifies and blocks, rewrites, or redacts before the model is called |
| **Output** | PII/secret leakage, unsafe HTML/script sinks, exfiltration channels | Scans and redacts before the response reaches the user |
| **Tool calls** | Rogue agent actions — payments, emails, deletes, deployments | Classifies reversibility, holds risky calls for human approval, supports rollback |

Detection runs **locally, on CPU, with no network call** — so it works air-gapped and adds single-digit milliseconds rather than an extra LLM round-trip.

**OWASP LLM Top 10 aligned defense-in-depth for risk reduction:** the layers below work together — detection, protection, control, compliance, and monitoring — because no single check is sufficient on its own.

---

## Quick start

### 1. Guard an LLM call (Node.js)

```bash
npm install @soterai/core
```

```typescript
import { Soter } from "@soterai/core";

const soter = new Soter({ apiKey: process.env.SOTERAI_API_KEY });

// ── Input: check before you spend a token on the model ──
const check = await soter.guardInput({
  message: userMessage,
  userId: "user_123",
  sessionId: "session_456",
});

if (soter.shouldBlock(check)) {
  return { reply: "Message blocked for security reasons." };
}

const safeInput = soter.getSafeText(check, userMessage) ?? userMessage;
const answer = await callMyLLM(safeInput);

// ── Output: check before it reaches the user ──
const outbound = await soter.guardOutput({
  aiResponse: answer,
  sessionId: "session_456",
});

return { reply: soter.getSafeText(outbound, answer) ?? answer };
```

### 2. Guard an LLM call (Python)

```bash
pip install soter
```

```python
from soter import Soter

guard = Soter()  # reads SOTER_API_KEY / SOTER_BASE_URL

check = guard.input(user_message, session_id="session_456")
if not guard.should_call_llm(check):
    return "Message blocked for security reasons."

answer = call_my_llm(guard.get_safe_input(check, user_message))

outbound = guard.output(answer, session_id="session_456")
return guard.get_safe_output(outbound, answer)
```

Or let the SDK run the whole round-trip, guarding both sides:

```python
result = guard.protect_chat(user_message, call_llm=call_my_llm, session_id="session_456")
print(result.reply)
```

### 3. No code — try it first

The [**playground**](https://soterai.in/playground) runs the same classifier this repo ships. Paste an attack, see the decision and which detector fired.

---

## Detection performance

Every number below is produced by the **production classifier** (`analyzeText`) — the same code path the API serves — and is reproducible from a clean checkout.

### Measured 2026-09-02 · commit `911e8d8b` · Node v22.16.0

```bash
npx tsx scripts/readme-recall-audit.ts
```

| Corpus | Recall | n |
|---|---:|---:|
| Jailbreak | 100.00% | 300 |
| Multilingual / Hinglish | 100.00% | 150 |
| Red-team benchmark | 100.00% | 68 |
| Tool abuse | 99.33% | 150 |
| RAG poisoning | 99.00% | 100 |
| Data exfiltration | 98.00% | 150 |
| System-prompt leak | 98.00% | 150 |
| **Aggregate** | **98.40%** | **1,122** |
| **Blind held-out** (never tuned against) | **61.54%** | 26 |

| Benign controls | False positives | n |
|---|---:|---:|
| **Aggregate benign FPR** | **0.00%** | **322** |

> **Read the blind-set row before you trust the aggregate.** The 98.40% figure covers corpora the detectors were iterated against — it is a **regression** measure, not a generalization one. On the blind held-out set, which no detector has ever been tuned against, recall is **61.54%**, consistent with the ~64% documented ceiling of a rules-first engine on novel phrasings. That gap is the honest state of the art here, it is asserted as a floor in CI (`tests/guard/heldout-generalization.test.ts`), and closing it is what the ML/semantic tier exists for.
>
> Precision is treated as the hard gate, not recall: benign false positives break real users, so FPR is held at ≤5% on every set, tuned or blind. It currently measures 0.00% on 322 controls.

### Latency

From the committed benchmark run ([`benchmarks/results/latest.json`](benchmarks/results/latest.json), 2026-07-22, 3,200 cases, CPU only, no network):

| p50 | p95 | p99 |
|---:|---:|---:|
| 9.30 ms | 17.83 ms | 31.31 ms |

### Public synthetic benchmark

A separate 3,200-case synthetic corpus (2,200 attacks / 1,000 benign) scores 100.00% recall at 0.00% FPR. It is **self-authored and self-maintained** — useful as a release gate, not as evidence against an adaptive attacker, and not an independent audit.

```bash
node scripts/phase-9-run-public-benchmark.js
```

Methodology, per-category recall, and stated limitations: [`/benchmark`](https://soterai.in/benchmark) · [dataset card](benchmarks/soterai-public-benchmark/dataset-card.md) · [limitations](benchmarks/soterai-public-benchmark/limitations.md)

To benchmark against third-party corpora, drop PINT / JailbreakBench / HarmBench files into `datasets/external/`.

---

## Architecture

```
        ┌──────────────┐   ┌──────────┐   ┌──────────────────┐
        │   Chatbot    │   │ RAG app  │   │ Autonomous agent │
        └──────┬───────┘   └────┬─────┘   └────────┬─────────┘
               │                │                  │
               ▼                ▼                  ▼
   ╔═══════════════════════════════════════════════════════════╗
   ║                      SoterAI Guard                        ║
   ║                                                           ║
   ║   ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ║
   ║   │ Input Guard │  │Output Guard │  │ Agent Firewall  │  ║
   ║   ├─────────────┤  ├─────────────┤  ├─────────────────┤  ║
   ║   │ injection   │  │ PII leak    │  │ tool allowlist  │  ║
   ║   │ jailbreak   │  │ secrets     │  │ identity verify │  ║
   ║   │ encoding    │  │ unsafe HTML │  │ risk score      │  ║
   ║   │ PII redact  │  │ exfil sinks │  │ policy eval     │  ║
   ║   └─────────────┘  └─────────────┘  └────────┬────────┘  ║
   ║                                              │           ║
   ║   ┌──────────────────────────────────────────┘           ║
   ║   ▼                                                       ║
   ║   ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ║
   ║   │  Webhooks   │  │   Reports   │  │   Forensics     │  ║
   ║   │  + SIEM     │  │ + analytics │  │   + audit       │  ║
   ║   └─────────────┘  └─────────────┘  └─────────────────┘  ║
   ╚═══════════════════════════════════════════════════════════╝
               │                │                  │
               ▼                ▼                  ▼
        ┌─────────────┐  ┌───────────┐  ┌──────────────┐
        │ PostgreSQL  │  │   Redis   │  │    Qdrant    │
        │  (Prisma)   │  │  (cache)  │  │  (optional)  │
        └─────────────┘  └───────────┘  └──────────────┘
```

Detection is a **three-tier cascade**: deterministic rules first (fast, explainable), then an ONNX classifier, then an optional semantic/LLM judge. Each tier is independently gated and fails open, so a tier being disabled degrades coverage rather than breaking traffic.

| Component | Technology |
|---|---|
| Framework | Next.js 15.5 (TypeScript) + Turbopack |
| Database | PostgreSQL 16 + Prisma ORM 5.22 |
| Cache | Redis (Upstash-compatible) |
| Vector store | Qdrant (optional) |
| Auth | NextAuth v5 (JWT sessions) |
| ML runtime | ONNX Runtime (CPU) |
| Container | Docker (multi-stage) |
| CI/CD | GitHub Actions → registry → EC2 |

---

## SDKs & integrations

Versions below are the **currently published** ones, verified against the registries on 2026-09-02.

| Surface | Package | Version | Status |
|---|---|---|---|
| Node.js / TypeScript | [`@soterai/core`](https://www.npmjs.com/package/@soterai/core) | 0.2.0 | GA |
| Python | [`soter`](https://pypi.org/project/soter/) | 0.2.2 | GA |
| LangChain | [`@soterai/langchain-middleware`](https://www.npmjs.com/package/@soterai/langchain-middleware) | 0.2.0 | GA |
| LlamaIndex | [`@soterai/llamaindex-middleware`](https://www.npmjs.com/package/@soterai/llamaindex-middleware) | 0.2.0 | GA |
| Vercel AI SDK | [`@soterai/vercel-ai-sdk-middleware`](https://www.npmjs.com/package/@soterai/vercel-ai-sdk-middleware) | 0.2.0 | GA |
| MCP gateway | [`@soterai/mcp-gateway`](https://www.npmjs.com/package/@soterai/mcp-gateway) | 0.2.0 | GA |
| CLI | [`@soterai/cli`](https://www.npmjs.com/package/@soterai/cli) | 0.1.0 | Beta |
| n8n community node | [`n8n-nodes-soterai`](https://www.npmjs.com/package/n8n-nodes-soterai) | 0.7.0 | GA |
| VS Code / Cursor / Windsurf | [`soterai.soterai-ide-guard`](https://open-vsx.org/extension/soterai/soterai-ide-guard) | 0.6.2 | GA (Open VSX) |
| REST API | `/api/*` | — | GA · [docs](https://soterai.in/docs/rest-api) |

<details>
<summary><b>In this repo, not yet published</b></summary>

These are real code, but do not claim them as installable products yet: Go SDK (`packages/go-sdk`), PII library (`packages/soter-pii`), browser extension (`apps/extension`), JupyterLab extension (`extensions/jupyterlab`), WordPress plugin, and the Botpress / Intercom / Zendesk / WhatsApp integration channels (`packages/integrations`).

</details>

---

## Products

<table>
<tr>
<td width="50%" valign="top">

### Agent Control

*For agents that take real-world actions — email, CRM, DB writes, payments, deploys.*

- **Action ledger** — classifies every call as `IRREVERSIBLE`, `COMPENSATING_ACTION`, or `REVERSIBLE`
- **Reversibility engine** — infers the rollback action, SHA-256 evidence hashing
- **Rollback windows** — 15 min for high-risk, 60 min for reversible, with dry-run
- **Approval queue** — human-in-the-loop with redacted payload review
- **Operator audit trail** — human decisions attributed and stored separately from agent logs

</td>
<td width="50%" valign="top">

### Usage Governance

*For 50–500 person companies whose staff paste company data into ChatGPT, Claude, and Cursor daily.*

- **5-step policy engine** — dept rules → data class → policy rules → sensitive override → default
- **Provider allow/block** — per provider and per model, wildcards supported
- **Data classification** — which sensitivity levels may reach which provider
- **Enforcement** — HTTP 403 with `X-Governance-Action` / `X-Governance-Reason` on all guard routes
- **Compliance reports** — weekly/monthly/quarterly with scoring and findings

</td>
</tr>
</table>

<details>
<summary><b>Six defense layers — full service list (40+)</b></summary>

**Monitor** — Guard Logs · Reports · Detection Feedback · Customer Success

**Protect** — Agent Firewall · Policy Engine · RAG Security · Webhooks

**Detect** — Shadow AI · Red Team Lab · Forensics · Semantic Egress · Canary Network

**Control** — Agent Control Center · Agent Passports · Action Ledger · Identity Fabric · Transaction Escrow · Intent Guard · Tool Chain · Dry-Run Sandbox · Memory Firewall · MCP Drift · Legal Boundary

**Compliance** — Evidence Vault · Context Lineage · Blast Radius · Credential Vault

**Manage** — Projects · API Keys · Cost Firewall · Security Badges · Billing · Audit Exports · Onboarding · Settings

Some modules are marked **Preview** and have open production-integration gaps — the per-service docs state which. Full reference: [soterai.in/docs/services](https://soterai.in/docs/services)

</details>

### Attack coverage

<details>
<summary><b>What the guard detects — expand for the full taxonomy</b></summary>

- **Encoding & obfuscation** — base64/base64url, hex, binary, decimal bytes, Morse, leetspeak, compact spacing, Unicode controls, homoglyphs, Caesar shifts
- **Jailbreak families (15)** — roleplay, adversarial suffixes, multilingual trojans, token smuggling, ASCII-art smuggling, evolutionary generation, cognitive overload, function-call wrappers, cross-modal payloads, automated chains, multi-agent propagation
- **Adversarial NLP** — imperceptible perturbations, gradient/word-substitution evasion, universal transferable suffixes, classifier/NER evasion, tabular entity swaps, cross-lingual adaptation
- **Backdoors & poisoning** — trigger phrases, syntactic/style triggers, BadPrompt/BadPre/BITE-style poisoning, poisoned embeddings, LoRA/PEFT safety compromise, code-search poisoning, seq2seq backdoors
- **Extraction & inference** — training-data extraction, membership and private-attribute inference, data reconstruction, model theft
- **Agent & supply chain** — RCE/escalation, package hallucination, dependency confusion, resource exhaustion, MCP poisoning
- **Unsafe output handling** — model-generated HTML/script sinks, credentialed browser requests, script exfiltration, unverified install guidance

Regression coverage lives in `tests/guard.test.ts` and `lib/classifiers/datasets/guardRedTeamBenchmark.ts`.

</details>

---

## Self-hosting

SoterAI runs entirely on your own infrastructure. No telemetry leaves the box, and detection needs no outbound network.

> This repository is private. Cloning it requires authorized access, and self-hosting from source requires a written license — see [LICENSING.md](LICENSING.md).

```bash
git clone https://github.com/yashchauhan66/Soter-AI.git
cd Soter-AI
cp .env.example .env.local        # set DATABASE_URL and AUTH_SECRET
docker compose up -d --build
# → http://localhost:3000
```

<details>
<summary><b>Minimum environment</b></summary>

```env
# Required
DATABASE_URL=postgresql://user:pass@host:5432/soter
AUTH_SECRET=<32+ char random string>

# Optional
REDIS_URL=redis://...
QDRANT_URL=http://qdrant:6333
SOTERAI_API_KEY=<key for the hosted control plane>
```

Validate before you boot: `npx tsx scripts/validate-env.ts`

</details>

<details>
<summary><b>Production Docker build</b></summary>

```bash
docker build -t soterai:latest --secret id=npmrc,src=$HOME/.npmrc .
docker run -p 3000:3000 --env-file .env.production soterai:latest
```

`docker-compose.prod.yml` is the reference production topology (app + Redis + Qdrant). There is no public prebuilt image yet — build from source, or point `DOCKER_IMAGE` in `.github/workflows/ci-cd.yml` at your own registry.

</details>

<details>
<summary><b>CI/CD</b></summary>

`.github/workflows/ci-cd.yml` runs typecheck + Prisma validation → tests → Docker build/push → SSH deploy, on every push to `main`.

</details>

---

## Development

```bash
npm install
npx prisma migrate deploy      # requires a running PostgreSQL
npm run dev                    # → http://localhost:3000
npm run db:seed                # optional fixtures
```

### Testing

```bash
npm test                       # unit + security suites (103 test files)
npm run typecheck              # tsc --noEmit
npm run test:e2e               # Playwright
npm run verify                 # full gate
npm run test:sdk:js
npm run test:sdk:python
```

The [latest `main` run of `ci-cd.yml`](https://github.com/yashchauhan66/Soter-AI/actions/workflows/ci-cd.yml?query=branch%3Amain) is the source of truth for what currently passes. The repository is private, so that link and the run logs are visible to authorized collaborators only.

Playwright applies migrations and seeds fixtures. Point it at a dedicated database via `E2E_DATABASE_URL`; a loopback-only `DATABASE_URL` is accepted as a fallback. A remote `DATABASE_URL` is never touched unless it is repeated verbatim as `E2E_DATABASE_URL` to confirm it is test-only.

<details>
<summary><b>Repository layout</b></summary>

```
app/                     Next.js app — pages and API routes
  api/guard/               input / output / streaming guard
  api/agent/               agent firewall, ledger, passport, escrow
  dashboard/               50+ feature pages
lib/
  guard/                   detection engine (rules → ONNX → semantic)
  classifiers/datasets/    benchmark corpora
  agent-firewall/          tool-call enforcement
  agent-action-ledger/     reversibility classification
  usage-governance/        5-step policy engine
  control-plane/           enterprise modules (commercial)
packages/                Publishable SDKs and middleware
apps/                    Browser extension, local AI broker
prisma/                  Schema and migrations
benchmarks/              Public benchmark corpus and results
scripts/                 Maintenance, benchmark and CI scripts
tests/                   103 test files
```

</details>

---

## Compliance

Evidence collection and control mappings are implemented; **certification is a separate audit process this repository does not claim to have completed.**

| Framework | What SoterAI provides |
|---|---|
| **OWASP LLM Top 10** | Detector mapping for all 10 categories |
| **SOC 2** | Evidence collection — security, availability, confidentiality |
| **ISO 27001** | Evidence for A.8 (access control), A.12 (operations security) |
| **DPDP (India)** | Consent records, breach-notification workflow |
| **GDPR** | Data-subject request workflows |
| **HIPAA** | PII/PHI detection and redaction |
| **PCI-DSS** | Secret detection and masking |

---

## Security

Found a vulnerability? Please **do not** open a public issue — see [SECURITY.md](SECURITY.md) for the disclosure process.

---

## Licensing

SoterAI is **proprietary, closed-source software**. This repository is private and confidential. Read [LICENSING.md](LICENSING.md) for the authoritative map.

| Area | License | You may |
|---|---|---|
| This repository (core product, server, models, benchmarks, evidence) | [**Proprietary — all rights reserved**](LICENSE) | Nothing without a written agreement. Access is by authorization only |
| Enterprise modules (`lib/control-plane`, `lib/agent-firewall`) | **Commercial** | Requires a written license |
| Packages already published to npm / VS Code Marketplace / Open VSX | **Their own shipped license** (Apache-2.0, MIT, or BUSL-1.1) | Keep using the published versions under that license — see [LICENSING.md](LICENSING.md) for the per-package map |

**You may not** use, copy, modify, redistribute, or self-host this source, offer SoterAI as a hosted or managed AI-security service, or build a competing product from it, without a commercial license.

> **Previously open core.** Until 2026-09-04 this repository was public under BUSL-1.1 with Apache-2.0/MIT client packages. That model is retired. Rights already granted on **published package versions** are not revoked; the repository source is no longer licensed for outside use.

Commercial licensing and enterprise enquiries: [**soterai.in/contact-sales**](https://soterai.in/contact-sales)

Copyright © 2026 Yash Chauhan. All rights reserved.

---

## Contributing

This is a private repository and external contributions are not accepted. For authorized collaborators, [CONTRIBUTING.md](CONTRIBUTING.md) has the workflow.

```bash
git checkout -b feature/your-change
npm run verify                 # must pass before you open a PR
```

Two ground rules specific to this project:

1. **Never tune a detector against the blind held-out set** (`heldoutBlindWide.ts`, `VALIDATION_ATTACKS`). Doing so destroys the only honest generalization measurement in the repo.
2. **Benchmark claims need a reproduce command.** If you change a number in this README, change the script that produces it in the same PR.

---

<div align="center">

<a href="https://soterai.in">Website</a> ·
<a href="https://soterai.in/docs">Docs</a> ·
<a href="https://soterai.in/playground">Playground</a> ·
<a href="https://soterai.in/benchmark">Benchmarks</a> ·
<a href="https://soterai.in/pricing">Pricing</a> ·
<a href="https://soterai.in/trust">Trust</a> ·
<a href="https://soterai.in/contact-sales">Contact sales</a>

<br /><br />

<sub>Proprietary — © 2026 Yash Chauhan, all rights reserved · India-first PII detection</sub>

</div>
