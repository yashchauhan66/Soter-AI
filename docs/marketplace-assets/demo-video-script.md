# Demo Video Script

## Scene 1: Problem

Show a user preparing to send a prompt containing a fake API key and customer data to an AI assistant. Explain that AI tools can accidentally receive sensitive information during normal work.

## Scene 2: Browser Guard

Show SoterAI Guard detecting the risky prompt before submission. Highlight block, redaction, and human-review decisions. Show that raw secrets are not stored in the audit trail.

## Scene 3: Workflow Integration

Open an n8n workflow with the SoterAI Guard node placed before an AI action. Run a sample item and show the node returning a risk decision and redacted text.

## Scene 4: Developer Integration

Show a server-side JavaScript SDK example using an API key from environment variables. Mention that API keys should stay server-side only and workflows should fail closed for sensitive actions.

## Scene 5: Admin Evidence

Show the dashboard audit view with redacted previews, finding types, and destination metadata. End with policy controls, SIEM/webhook delivery, and support/security documentation.

