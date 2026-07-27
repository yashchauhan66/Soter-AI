# SoterAI Browser Extension Privacy Policy

SoterAI protects AI work in the browser by scanning prompts, pasted content, file metadata, and optional AI responses on configured AI destinations. The extension is designed so sensitive content is evaluated locally first and raw prompt text is not stored by default.

## What Is Scanned

- Prompt text entered into configured AI destinations such as supported chat, coding, and enterprise AI tools.
- Optional response scans when an admin enables response scanning for a destination.
- File names, file type metadata, and locally inspected text content for supported file uploads.
- Lineage metadata for copy/paste context when source tracking is enabled by policy.

The extension does not monitor unrelated browsing and does not scan sites outside the configured destination list.

## What Is Stored By Default

By default, extension storage contains metadata and redacted previews, including:

- Policy cache and enrollment status.
- Decision, risk score, detected data types, and timestamps.
- Redacted preview or safe rewrite.
- Hashes and lengths for source text where needed for privacy-preserving verification.

Raw prompts, raw copied text, and raw file content are not stored by default.

## What Leaves The Browser

When enrolled, the extension may send security events to SoterAI containing metadata, decision details, risk score, detected data types, destination URL context, and a redacted preview. Backend payloads are sanitized again before processing.

Raw prompt logging is off by default. It can only be changed by an explicit admin policy mode for full prompt logging.

## Response Scanning Controls

Response scanning is controlled per destination. An admin can enable, disable, or disable response scanning per destination through policy. Clean response scans remain local unless policy requires an event; response findings use redacted previews by default.

## Data Minimization

SoterAI uses local detection, redaction, hashing, and policy checks to minimize what is stored or sent. The extension avoids broad browser permissions and does not request access to all websites.
