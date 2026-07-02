# Edge Add-ons Listing

**Name:** Soter Enterprise AI Guard
**Version:** 0.1.0 beta
**Short Description:** Enterprise AI DLP for ChatGPT, Claude, Gemini, and AI coding tools.

**Detailed Description:**
Soter Enterprise AI Guard is an enterprise AI Data Loss Prevention (DLP) solution designed to protect sensitive data while employees use external AI tools like ChatGPT, Claude, Gemini, and Perplexity.

### Key Features (v0.1.0 beta):
* **Prompt Protection:** Intercepts and blocks sensitive prompts containing PII, API keys, or enterprise secrets.
* **File Scanning for Text/Code Files:** Inspects uploaded text files to ensure no sensitive source code or credentials leak. (Note: PDF/DOCX/XLSX/PPTX scanning is metadata-only in this beta).
* **Data Lineage:** Tracks copy/paste events from internal systems to AI sites to prevent data exfiltration.
* **Approval Workflow:** Allows employees to request just-in-time access for specific prompts that trigger policies.
* **Emergency Lockdown:** Allows admins to instantly block access to all AI sites during a security incident.
* **Privacy-Safe Logging:** No raw prompts, files, or copied text are stored by default. Only redacted previews and metadata are securely sent to your enterprise admin dashboard.

**Target Audience:**
Enterprise security teams, privacy engineers, and IT administrators.

**Note:** This is a v0.1.0 beta release intended for paid pilot customers. Semantic fingerprinting and full Office document parsing are planned for future releases.
