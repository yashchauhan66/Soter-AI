# Integration Status Matrix

**Date:** 2026-07-09
**Rule:** Only integrations with verified code, docs, and at least one working example are marked Stable. Unfinished integrations are hidden from marketing.

## Summary

| Status | Count |
|---|---|
| **Stable** | 15 |
| **Beta** | 4 |
| **Scaffold** | 7 |
| **Not Started** | 0 |

## SDKs & Frameworks

| # | Integration | Status | README | Tests | Examples | Language | Marketplace |
|---|---|---|---|---|---|---|---|
| 1 | JS SDK (`@soterai/core`) | ✅ STABLE | ✅ | ✅ (2) | Inline | TypeScript | npm |
| 2 | Python SDK (`soter`) | ✅ STABLE | ✅ | ✅ (12) | ✅ (5) | Python | PyPI |
| 3 | LangChain middleware | ✅ STABLE | ✅ | — | Inline | TypeScript | npm |
| 4 | LlamaIndex middleware | ✅ STABLE | ✅ | — | Inline | TypeScript | npm |
| 5 | Vercel AI SDK middleware | ✅ STABLE | ✅ | — | Inline | TypeScript | npm |
| 6 | REST API | ✅ STABLE | ✅ | — | ✅ (6 languages) | HTTP | — |
| 7 | CLI tool | ✅ STABLE | ✅ | — | — | TypeScript | npm |

## Workflow Platforms

| # | Integration | Status | README | Tests | Examples | Language | Marketplace |
|---|---|---|---|---|---|---|---|
| 8 | n8n node | ✅ STABLE | ✅ | — | ✅ (1) | TypeScript | npm |
| 9 | Botpress integration | ✅ STABLE | ✅ | — | Inline | TypeScript | — |
| 10 | Zapier integration | ✅ STABLE | ✅ | — | ✅ (4) | TypeScript | Zapier |
| 11 | Flowise nodes | ✅ STABLE | ✅ | — | Inline | TypeScript | npm |
| 12 | Langflow component | ✅ STABLE | ✅ | — | Inline | Python | PyPI |
| 13 | Dify plugin | ✅ STABLE | ✅ | — | ✅ (4) | Python + YAML | Dify |
| 14 | Make.com app | ✅ STABLE | ✅ | — | ✅ (1) | JSON | Make |
| 15 | Voiceflow templates | ✅ BETA | ✅ | — | ✅ (4) | JSON | — |

## CMS & Plugins

| # | Integration | Status | README | Tests | Examples | Language | Marketplace |
|---|---|---|---|---|---|---|---|
| 16 | WordPress plugin | ✅ STABLE | ✅ | — | Inline | PHP | WordPress.org |

## IDE Extensions

| # | Integration | Status | README | Tests | Examples | Language | Marketplace |
|---|---|---|---|---|---|---|---|
| 17 | VS Code extension | ✅ STABLE | ✅ | ✅ (24) | — | TypeScript | VS Code Marketplace |
| 18 | Browser extension | ✅ BETA | ✅ | — | — | TypeScript | Chrome Web Store |
| 19 | Local AI Broker | ✅ BETA | — | — | — | TypeScript | — |
| 20 | JetBrains extension | 🔧 SCAFFOLD | — | — | — | — | — |
| 21 | Neovim extension | 🔧 SCAFFOLD | — | — | — | — | — |
| 22 | Sublime extension | 🔧 SCAFFOLD | — | — | — | — | — |
| 23 | Vim extension | 🔧 SCAFFOLD | — | — | — | — | — |
| 24 | Eclipse extension | 🔧 SCAFFOLD | — | — | — | — | — |
| 25 | Visual Studio extension | 🔧 SCAFFOLD | — | — | — | — | — |
| 26 | JupyterLab extension | 🔧 SCAFFOLD | — | — | — | — | — |

## Test Coverage

| Integration | Test Files | Test Count |
|---|---|---|
| Python SDK | 12 | ~100+ |
| VS Code extension | 1 | 24 |
| JS SDK | 2 | 15 |
| Shared integration lib | 1 | ~10 |
| n8n workflow E2E | 1 | 13 |
| Guard API (core) | 1 | 670 |
| **Total** | **19** | **~832** |

## All integrations follow the 4-action pattern:

| Action | Description |
|---|---|
| Input Guard | Scan prompts before they reach AI |
| Output Guard | Scan AI responses for sensitive data |
| PII Redactor | Redact PII from text |
| RAG Scanner | Scan RAG documents for threats |

## Publishing Status

| Integration | Published | Notes |
|---|---|---|
| JS SDK | ❌ | Ready for npm |
| Python SDK | ❌ | Ready for PyPI |
| n8n node | ❌ | Ready for npm |
| VS Code extension | ❌ | Ready for marketplace |
| Browser extension | ❌ | Ready for Chrome Web Store |
| WordPress plugin | ❌ | Ready for WordPress.org |
| Zapier | ❌ | Ready for Zapier |
| Dify | ❌ | Ready for Dify marketplace |
| Make | ❌ | Ready for Make |

## Hidden from Marketing

The following are NOT advertised as production-ready:
- JetBrains, Neovim, Sublime, Vim, Eclipse, Visual Studio, JupyterLab extensions (scaffold only)
- No integration is published on any marketplace yet
