# Soter AI Security Guard — Store Review Notes

## For Chrome Web Store / Microsoft Edge Add-ons Reviewers

### Purpose
Soter AI Security Guard is an enterprise security extension that helps organizations monitor and control AI tool usage to prevent data leaks and policy violations.

### How It Works
1. **Enrollment:** An enterprise admin generates enrollment tokens. Employees install the extension and enter the token to register their device.
2. **Policy Sync:** The extension periodically fetches the security policy from the organization's Soter AI backend.
3. **Monitoring:** When a user visits a monitored AI tool (ChatGPT, Claude, Gemini, etc.), the extension scans the prompt for sensitive data.
4. **Enforcement:** If sensitive data is detected (PII, secrets, source code), the extension can block, redact, or require approval before the prompt is sent.
5. **Reporting:** Security events are transmitted to the organization's backend in redacted form for audit and compliance.

### Content Scripts
Content scripts are injected ONLY on:
- `chatgpt.com` and `chat.openai.com`
- `claude.ai`
- `gemini.google.com`
- `perplexity.ai`
- `*.localhost` (only during lockdown to block local AI)

Content scripts do NOT run on general websites.

### Network Communication
The extension communicates with:
- The organization's Soter AI backend (customer-configured URL) for policy sync and event reporting
- No other external services

All communication is over HTTPS/TLS with HMAC-SHA256 signed payloads.

### Data Handling
- Raw secrets (API keys, passwords) are NEVER stored or transmitted
- PII is redacted (replaced with placeholders) before any transmission
- Only redacted metadata and risk detection events are sent to the backend
- Local storage contains only: enrollment state, cached policy, and local audit log

### Background Scripts
The extension uses a service worker that:
- Handles heartbeats (periodic check-ins with the backend)
- Processes messages from content scripts
- Manages policy sync scheduling

The service worker does NOT:
- Run persistent timers beyond what is necessary
- Make network requests to third-party services
- Track browsing history

### Emergency Lockdown
During emergency lockdown (admin-triggered), the extension:
- Blocks all prompts to non-enterprise AI destinations
- Blocks all file uploads to AI tools
- Requires approval for source code submission
- Polls more frequently for policy updates (every 30 seconds vs. 15 minutes)

### What We Do NOT Do
- We do NOT monitor browsing outside AI tool domains
- We do NOT collect browsing history
- We do NOT capture keystrokes globally
- We do NOT inject advertisements or tracking scripts
- We do NOT sell or share user data
- We do NOT use data for any purpose other than security enforcement

### Enterprise-Only Distribution
This extension is designed for enterprise customers and is distributed as a private/unlisted listing. It is not intended for general consumers.

### Support
- Email: support@soterai.com
- Documentation: https://docs.soterai.com/extension
- Privacy Policy: See `privacy-policy.md`
