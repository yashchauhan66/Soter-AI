# Soter-AI Product Architecture & Technical Context

## 1. Executive Summary & Core Mission
**Soter-AI** (`https://soterai.in`) is an enterprise-grade, local-first AI security guardrail and governance platform. It protects autonomous AI agents, LLM applications, IDE extensions, and multi-tenant AI pipelines from prompt injections, jailbreaks, data exfiltration, MCP (Model Context Protocol) tool poisoning, insecure deserialization, and covert reply channels.

---

## 2. Core Tech Stack
- **Frontend & Web Framework:** Next.js 15.5.28 (`app/` App Router with Turbopack), React 19, TypeScript 5.9.3, Tailwind CSS, Radix UI primitives (`@radix-ui/react-dialog`, `collapsible`, `tooltip`), Lucide React icons.
- **Backend & API Runtime:** Next.js Server Components & Route Handlers, Node.js v20+, NextAuth v5 (beta 25) with `@auth/prisma-adapter`, BCrypt.js.
- **Database & State:**
  - **Relational / Metadata:** PostgreSQL with Prisma ORM 5.22.0 (`prisma/schema.prisma` spanning 4,100+ lines covering Multi-Tenant Organizations, Projects, Guard Policies, Audits, API Keys, Webhooks, Canaries, and RBAC).
  - **Caching & Rate Limiting:** Upstash Redis (`@upstash/redis`).
  - **Log Ingestion & SIEM:** AWS DynamoDB (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) with TTL auto-expiry and AWS KMS customer-managed key encryption.
- **Monorepo Architecture (npm workspaces):**
  - `packages/guard-core`: Deterministic, zero-network, local-first guard engine used across IDE plugins, brokers, and browser extensions.
  - `packages/sdk`: Client SDK for JavaScript/TypeScript (`@soterai/sdk`).
  - `packages/python-sdk`: Python client SDK (`soterai`) with pytest test suite.
  - `packages/soterai-lite`: Ultra-lightweight VS Code / Open-VSX bundle.
  - `packages/vscode-extension`: Full VS Code / Antigravity IDE security extension.
  - `apps/extension`: Chromium & Firefox Manifest V3 browser extension.
  - `apps/local-ai-broker`: Local IPC/HTTP broker isolating host AI agents.

---

## 3. Model Architecture & Inference Pipeline
- **Model Portfolio (`models/`):**
  - `ml-classifier-v14` through `ml-classifier-v17`: ONNX-quantized fine-tuned MiniLM / RoBERTa models for adversarial prompt injection, jailbreak classification, and semantic egress analysis.
  - `ml-classifier-v17-minilm`: Low-latency distilled transformer for edge / browser deployment.
  - `ml-classifier-v18-candidate` & `ml-classifier-v18-student`: High-precision student-distillation models trained on adversarial corpora with zero false-positive constraints for programming code contexts.
- **Inference Pipeline & Latency Profile:**
  - **Tier 1 (Sub-1ms):** Pre-scan token sanitization, zero-width / homoglyph de-obfuscation, regex heuristics, and literal pattern pre-filtering (`literalPrefilter.ts`).
  - **Tier 2 (1–5ms):** Deterministic parser analysis (`DecisionEngine`), credential entropy scoring, India/US PII detectors, and vault token matching.
  - **Tier 3 (10–35ms):** Quantized ONNX neural classifiers with Google Colab T4 GPU / CPU fallback. Target end-to-end TTFT: `< 50ms`.

---

## 4. Guard Detectors & Protection Matrix
Located in `packages/guard-core/src/detectors/` and `lib/guard/detectors/`:
1. **Secret & Credential Leakage:** API keys (OpenAI, Anthropic, AWS, GitHub, Stripe, Slack, HuggingFace), private keys (RSA/EC/Ed25519), connection strings, base64/hex-encoded tokens, and `.env` files.
2. **PII & Identity Protection:** US SSN, Credit Cards (Luhn validated), and India PII (PAN, Aadhaar, GSTIN, UPI, IFSC, Passport).
3. **Prompt Injection & Jailbreaks:** Direct instruction overrides, context wipes, chat template delimiters (`[SYSTEM]`, `<|im_start|>`), role impersonations, DAN variants, and multilingual / Hinglish instruction overrides (`pichle saare rules ignore karo`).
4. **Evasion & Obfuscation:** Unicode zero-width character smuggling (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`, `\u2060`), Cyrillic homoglyph lookalikes, pig-latin, and phonetic spelling channels.
5. **Terminal Command Guard:** Destructive file operations (`rm -rf`, PowerShell `Remove-Item -Recurse -Force`, `Format-Volume`), remote execution (`curl|bash`, PowerShell `iwr|iex`, `Invoke-WebRequest|Invoke-Expression`), reverse shells (`nc -e`, python socket), and fork bombs.
6. **Supply Chain & MCP Security:** MCP server config preflight inspection, tool call credential sniffing, unpinned packages, and typosquatting detection (`DEP-01` through `DEP-04`).
7. **Active Defense:** Synthetic Canary tokens injected into context to pinpoint data exfiltration sources.

---

## 5. Worker Services & Background Automation
- `workers/webhookWorker.ts`: Idempotent delivery with exponential backoff for enterprise alert webhooks.
- `workers/siemWorker.ts`: High-throughput log streaming into DynamoDB and SIEM endpoints.
- `workers/backgroundWorker.ts`: Scheduled cleanup, telemetry rollups, and certificate rotations.
- `workers/threatIntelWorker.ts`: Dynamic threat signature feed sync.
- `workers/continuousLearningWorker.ts`: Shadow evaluation and adversarial sample collection for v18+ retraining.

---

## 6. Route Landscape
- **API Families (`/app/api`):**
  - `/api/guard`: Real-time streaming guardrail evaluation endpoint.
  - `/api/mcp`: MCP tool inspection and boundary validation.
  - `/api/gateway` & `/api/agent-firewall`: Forwarding proxy and LLM gateway.
  - `/api/rag`: Retrieval augmentation pipeline poisoning detector.
  - `/api/extension`: Extension heartbeat, telemetry, and policy synchronization.
  - `/api/auth`, `/api/billing`, `/api/dashboard`, `/api/compliance`, `/api/siem`.
- **UI Surfaces (`/app`):**
  - Marketing & Conversion: `/`, `/pricing`, `/about`, `/comparison`, `/benchmarks`, `/enterprise`, `/case-studies`.
  - App Dashboard: `/dashboard` (Analytics, Live Event Stream, Security Rules, Vault, Usage Governance, Team Settings).
  - Interactive Scanners & Live Demos: `/demo`, `/demo/rag`, `/demo/red-team`, `/demo-chatbot`, `/jailbreak-detection`.
