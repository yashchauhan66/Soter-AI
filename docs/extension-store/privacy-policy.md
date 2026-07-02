# Privacy Policy for Soter Enterprise AI Guard

**Effective Date:** (Current Date)

Soter Enterprise AI Guard ("the Extension") is designed with enterprise privacy and data security as its core focus.

## What is processed locally
- All prompt scanning and policy evaluation occurs **locally** in the browser.
- Response scanning, when enabled by an enterprise admin for a supported AI destination, occurs **locally** in the browser before any event is reported.
- Clipboard monitoring for Data Lineage occurs **locally**.
- Document text extraction (where applicable) occurs **locally**.

## What metadata is sent to your enterprise dashboard
- Audit logs of blocked or flagged prompts (containing rule IDs, timestamps, and redacted snippets).
- Response scan events for flagged AI outputs store metadata and redacted previews by default, not raw response text.
- Metadata of uploaded files (name, size, file type).
- Hash values for Data Lineage matching.

## What is NOT sent or stored by default
- We do **NOT** store or send raw prompts.
- We do **NOT** store or send raw file contents.
- We do **NOT** store or send raw copied text.
- We do **NOT** monitor or send browsing history on non-AI domains.

## How admins configure policies
Enterprise administrators configure the active DLP policies, allowed domains, and event tracking thresholds through the Soter Admin Control Plane. These policies are securely synced to the extension.
Admins can enable or disable response scanning per destination. If response scanning is disabled for a destination, the extension does not scan AI responses on that destination.

## Contacting Support
For pilot customers and end-users, please contact your internal IT or Security team for primary support.
For bug reports, enterprise inquiries, or security issues, contact `security@soter-example.com`.

## Limitations
- PDF/DOCX/XLSX/PPTX scanning relies on metadata extraction in v0.1.0 beta.
- The extension's functionality is dependent on the DOM structure of external AI sites; updates to those sites may temporarily degrade detection until the extension is updated.
- Semantic fingerprinting is planned but not fully implemented in v0.1.0 beta.
