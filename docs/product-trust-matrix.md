# SoterAI Product Trust Matrix

This matrix is the shared trust contract for the VS Code extension, browser extension, and n8n node. It exists so product copy, marketplace submissions, support answers, and implementation tests all say the same thing.

## Core Promise

SoterAI protects AI workflows with local-first detection, redaction, policy enforcement, and secret-safe context handling. Raw secrets and raw prompts are not sent by default.

## Product Surfaces

| Surface | Default processing | What can leave by default | What must not leave by default | User proof |
| --- | --- | --- | --- | --- |
| VS Code extension | Local extension host scans code, prompts, git diffs, clipboard, MCP/tool config, and terminal commands | Redacted metadata only when telemetry/cloud is explicitly enabled | Raw API keys, tokens, private keys, `.env` values, raw prompts, raw file contents | `SoterAI: Local Privacy Status`, `SoterAI: Open Privacy Guarantee`, `SoterAI: Preview What AI Will See` |
| Browser extension | Content scripts and service worker scan configured AI destinations locally first | Metadata, decision, risk score, hashes, detected data types, destination context, redacted preview | Raw prompt text, raw copied text, raw file content, unrelated browsing activity | Popup and side panel `What leaves browser?` section |
| n8n node | n8n sends configured fields to the selected SoterAI API endpoint and stores API keys in n8n credentials | Configured workflow text fields and sanitized API results | API keys, bearer tokens, common provider tokens, AWS access key IDs, DB URLs in node errors or `rawResponse` output | README privacy notes, changelog, package validator |

## Marketplace Evidence

| Requirement | Evidence |
| --- | --- |
| Minimum permissions | Browser manifest avoids `<all_urls>`, `tabs`, `activeTab`, `scripting`, and `webNavigation`; `docs/extension-store/permission-justification.md` lists exact permissions and hosts. |
| Local processing disclosure | Browser and VS Code READMEs explicitly describe local processing and what leaves the device. |
| Privacy policy | `docs/extension-store/privacy-policy.md` explains collection, storage, response scanning, unrelated browsing, and redacted previews. |
| Prominent in-product disclosure | Browser popup/side panel show `What leaves browser?`; VS Code exposes local privacy commands and dashboard card. |
| Secure credential handling | VS Code uses `SecretStorage`; browser enrollment storage is metadata/policy state; n8n API key is handled by n8n credentials. |
| Regression protection | VS Code tests, browser extension tests, n8n package validator, and manifest permission validator lock the claims. |

## 10/10 Bar

A product can be called 10/10 only when all of these are true:

- Security controls are implemented and tested.
- Privacy claims are visible in-product, not only in docs.
- Marketplace docs match the manifest and runtime behavior.
- Release validators fail when version, permissions, raw-output, or privacy claims drift.
- A buyer can understand what leaves their machine in under 30 seconds.
- Known limitations are honest and not hidden.
