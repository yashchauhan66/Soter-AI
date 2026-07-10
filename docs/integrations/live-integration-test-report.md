# Live Integration Test Report

Date: 2026-07-10  
Status: LOCAL CONTRACTS PARTIALLY VERIFIED; MARKETPLACE AND THIRD-PARTY RUNTIMES EVIDENCE REQUIRED

## Classification rule

Stable requires implementation, documentation, install/package validation, authentication, a working example, invalid-key behavior, error handling, and a live run on the named host. Code presence alone is Beta or Labs. Marketplace publication is reported separately.

| Integration | Local evidence | Live-host evidence | Honest status |
|---|---|---|---|
| JavaScript SDK | Build, types, unit tests | Direct API smoke still required per release | Beta |
| Python SDK | Package and tests available | Published-package/API smoke required | Beta |
| REST API | Route and application tests | Deployed invalid-key/success smoke required | Beta |
| WordPress | Plugin source/package path | Real WordPress install required | Labs |
| n8n | Node builds and five importable examples | Running n8n execution required | Beta / EVIDENCE REQUIRED |
| Zapier, Make | Connector artifacts/docs | Platform execution and review required | Labs |
| Langflow, Flowise, Dify, Botpress, Voiceflow | Artifacts or instructions | Named host execution required | Labs |
| LangChain, LlamaIndex, Vercel AI | Middleware source/examples | Framework smoke with deployed API required | Beta |

## Required evidence record

For every promotion to Stable, record package version, host version, clean-install command, UTC timestamp, success request, invalid-key response, timeout/error behavior, output schema, evidence location, and tester. Never infer a live pass from a successful build.
