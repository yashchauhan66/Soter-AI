# Microsoft Edge Add-ons — Hidden Listing

## Extension Details

- **Extension Name:** Soter AI Security Guard
- **Short Description:** Enterprise AI security guard for browser extensions — detects and blocks unsafe AI prompts, secrets, and PII in real time.
- **Category:** Developer Tools
- **Supported Platforms:** Windows, macOS, Linux

## Long Description

Soter AI Security Guard provides enterprise-grade AI security for organizations using Microsoft Edge. It monitors AI tool usage, blocks sensitive data leaks, and enforces admin-defined policies.

### Key Capabilities
- Real-time prompt scanning and blocking for secrets, PII, and sensitive data
- Shadow AI discovery and classification
- Emergency lockdown for instant AI restriction
- Admin approval workflows for sensitive prompts
- SIEM/webhook integration with HMAC-SHA256 signed payloads
- Per-department and per-role policy enforcement

### Enterprise Features
- Device enrollment via admin-generated tokens
- Push-based policy updates via heartbeat polling
- Audit logging of all security events
- No browsing history collection — monitors only known AI tool domains

## Data Usage Declaration

This extension collects data for the following purposes:

1. **Security Event Data** (transmitted to enterprise backend): Redacted prompts, detected risk types, AI destination domain, employee ID, and device ID.
2. **Policy Configuration** (stored locally): Cached extension policy, lockdown state, and enrollment credentials.

**The extension does NOT collect:**
- Browsing history outside of AI tool domains
- Personal files, documents, or images
- Raw API keys, passwords, or credentials (these are redacted before transmission)
- Keystroke recordings

## Hidden Listing Publishing Steps

1. Sign in to [Partner Center](https://partner.microsoft.com/dashboard) → **Microsoft Edge Add-ons**
2. Click **"New Extension"**
3. Upload the extension package (`.zip`)
4. Complete all listing details using the information above
5. Under **Distribution**, select **"Hidden"** — the extension will not appear in the Edge Add-ons store
6. To distribute: Go to **"Distribution"** → **"Package name"** and share the direct link with authorized users
7. Alternatively, use **Microsoft Edge Management** policies to auto-install the extension
8. Submit for certification review
9. Once approved, distribute the link only to authorized enterprise users

## Host Permission Justification

Same as Chrome listing — see `chrome-private-listing.md`.

| Host | Purpose |
|------|---------|
| `chatgpt.com`, `chat.openai.com` | Prompt monitoring on ChatGPT |
| `claude.ai` | Prompt monitoring on Claude |
| `gemini.google.com` | Prompt monitoring on Gemini |
| `perplexity.ai` | Prompt monitoring on Perplexity |
| `*.localhost` | Block local AI tools during lockdown |

## Support Checklist

- [ ] Enterprise support email configured
- [ ] Privacy policy published
- [ ] Documentation site live
- [ ] Package signing certificate valid
- [ ] Extension version matches manifest
