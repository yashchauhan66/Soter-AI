# Phase 13 -- VS Code Marketplace SEO Optimization

> **Goal:** Maximize discoverability and install conversion for SoterAI IDE Guard on the VS Code Marketplace through optimized metadata, README structure, visual assets, and keyword targeting.

---

## Current State

| Field | Current Value | Status |
|-------|-------------|--------|
| displayName | `SoterAI IDE Guard` | Needs keyword enrichment |
| description | `Enterprise-ready AI Security Guard extension...` | Needs rewrite for marketplace search |
| keywords | (none defined) | Critical gap |
| categories | `Security`, `Linters`, `Programming Languages` | Needs adjustment |
| galleryBanner | (not set) | Needs addition |
| preview | (not set) | Should be `true` for beta |

---

## Recommended package.json Changes

### Metadata Fields

```jsonc
{
  "displayName": "SoterAI IDE Guard — Local AI Security",
  "description": "Protect secrets, prompts, MCP tools, and AI coding context locally before they reach AI. Secret scanning, prompt injection detection, MCP tool auditing, AI Safe Mode, and full audit trail — 100% local, nothing leaves your machine.",
  "keywords": [
    "ai-security",
    "ai-coding",
    "prompt-injection",
    "secret-scanning",
    "mcp-security",
    "cursor",
    "copilot",
    "claude",
    "local-ai",
    "data-leakage",
    "vscode-security",
    "developer-security"
  ],
  "categories": [
    "Other",
    "Linters"
  ],
  "galleryBanner": {
    "color": "#0a0a0a",
    "theme": "dark"
  },
  "preview": true
}
```

### Field-by-Field Rationale

**displayName: "SoterAI IDE Guard -- Local AI Security"**
- Includes brand name (SoterAI) for recognition
- Includes product name (IDE Guard) for specificity
- Includes primary keyword phrase (Local AI Security) for search
- Under 50 characters for full display in search results
- The em dash separates brand from keyword naturally

**description (short, for search results):**
- Front-loads the value proposition: "Protect secrets, prompts, MCP tools..."
- Includes action-oriented language: "Protect... before they reach AI"
- Includes key differentiator: "100% local, nothing leaves your machine"
- Includes specific features: secret scanning, prompt injection, MCP tool auditing
- Under 300 characters for optimal display in marketplace search

**keywords (12 terms):**
| Keyword | Search Volume Rationale |
|---------|----------------------|
| `ai-security` | Primary category term |
| `ai-coding` | Targets "AI coding" searchers |
| `prompt-injection` | Specific threat term, low competition |
| `secret-scanning` | Direct feature match |
| `mcp-security` | Emerging term, first-mover advantage |
| `cursor` | Users searching for Cursor-related tools |
| `copilot` | Users searching for Copilot-related tools |
| `claude` | Users searching for Claude-related tools |
| `local-ai` | Privacy-focused searchers |
| `data-leakage` | Security concern searchers |
| `vscode-security` | Direct category match |
| `developer-security` | Broad developer security term |

**categories: ["Other", "Linters"]**
- "Other" is a catch-all that avoids miscategorization
- "Linters" because the extension scans and reports issues (similar user mental model)
- Removed "Programming Languages" (not applicable, reduces relevance)
- Note: VS Code Marketplace allows up to 2 categories

**galleryBanner:**
- Dark theme (#0a0a0a) matches the SoterAI brand and futuristic design direction
- Provides visual consistency with the soterai.in website

**preview: true**
- Signals beta status honestly to users
- Sets appropriate expectations
- Can be removed when the extension reaches stable release

---

## Marketplace README Structure

The README displayed on the VS Code Marketplace is the primary conversion tool. It must communicate value quickly, build trust, and drive installs.

### Section 1: Hero Banner Image

```markdown
![SoterAI IDE Guard — Local AI Security](https://soterai.in/marketplace/hero-banner.png)
```

**Specifications:**
- Dimensions: 1280 x 640px (recommended marketplace banner size)
- Content: SoterAI logo, tagline ("See what AI sees. Protect what AI touches."), dark background matching gallery banner
- Format: PNG with transparency or solid dark background
- File size: Under 500KB

---

### Section 2: Badges

```markdown
[![Version](https://img.shields.io/visual-studio-marketplace/v/soterai.soterai-ide-guard)](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/soterai.soterai-ide-guard)](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/soterai.soterai-ide-guard)](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
```

**Purpose:** Social proof and trust signals. Even at low install counts, showing the badge establishes professionalism.

---

### Section 3: One-Line Value Proposition

```markdown
> **Protect your secrets, prompts, MCP tools, and AI coding context locally — before they reach any AI.**
```

**Rules:**
- One sentence maximum
- Bold for visual weight
- Blockquote for visual separation
- Must answer "what does this do?" in under 5 seconds

---

### Section 4: Screenshots (3-5 Key Screens)

```markdown
## See It in Action

### AI Safe Mode
![AI Safe Mode redacts secrets before AI sees them](screenshots/safe-mode.png)
*AI Safe Mode automatically redacts secrets before they enter AI context windows.*

### Security Scan Results
![Workspace scan showing detected secrets and risks](screenshots/scan-results.png)
*Scan your entire workspace for secrets, prompt injection, and MCP risks in seconds.*

### What AI Saw Ledger
![Audit log of all AI interactions](screenshots/ai-saw-ledger.png)
*Full audit trail of everything AI saw — and everything SoterAI blocked.*

### MCP Tool Scanner
![MCP tool risk assessment](screenshots/mcp-scanner.png)
*Risk-score every MCP server and tool in your environment.*

### Terminal Command Firewall
![Terminal command risk detection](screenshots/terminal-firewall.png)
*Block dangerous commands before AI executes them in your terminal.*
```

**Screenshot Specifications:**
- Dimensions: 1366 x 768px or 1920 x 1080px (consistent across all)
- Theme: Dark theme VS Code (matches target audience preference)
- Content: Real-looking but sanitized data (no actual secrets)
- Annotations: Red/green highlights on key areas, brief caption below each
- Format: PNG
- Count: 5 screenshots (marketplace carousel supports up to 10, but 5 is optimal)

---

### Section 5: Quick Start (3 Steps)

```markdown
## Quick Start

1. **Install** this extension from the VS Code Marketplace
2. **Scan** your workspace: open Command Palette (`Ctrl+Shift+P`) → `SoterAI: Scan Workspace`
3. **Enable Safe Mode**: open Command Palette → `SoterAI: Enable AI Safe Mode`

That's it. Your secrets are now protected from AI. No account required. No data leaves your machine.
```

**Rules:**
- Maximum 3 steps
- Each step is one action
- Include keyboard shortcuts
- End with reassurance (no account, no data leaves)

---

### Section 6: Features List with Descriptions

```markdown
## Features

### Core Protection
| Feature | What It Does |
|---------|-------------|
| **AI Safe Mode** | One-click redaction of all secrets from AI context windows |
| **AI Context Firewall** | 14-phase zero-trust pipeline for every AI interaction |
| **Secret Vault** | Protected storage for sensitive values, invisible to AI |
| **What AI Saw Ledger** | Complete audit log of all context sent to AI |

### Threat Detection
| Feature | What It Does |
|---------|-------------|
| **Secret Scanning** | Detects API keys, tokens, passwords, and PII before AI sees them |
| **Prompt Injection Detection** | Finds adversarial instructions hidden in repo files |
| **MCP/Tool Permission Monitor** | Risk-scores MCP servers and AI tools |
| **LLM Extension Risk Scanner** | Audits VS Code extensions that call AI APIs |
| **Canary Leak Detection** | Plant trackable tokens to detect data exfiltration |

### AI Control
| Feature | What It Does |
|---------|-------------|
| **Local AI Broker** | Route AI requests through a local security proxy |
| **AI Memory Inspector** | View and manage what AI remembers about your project |
| **Terminal Command Firewall** | Block dangerous commands AI tries to execute |
```

---

### Section 7: Local AI Broker

```markdown
## Local AI Broker

Route AI requests through a local security proxy that scans every prompt before it leaves your machine.

- **Auto-detection**: Finds Ollama and LM Studio running on your machine
- **One-click setup**: Select a preset or configure a custom endpoint
- **Policy routing**: Define which requests go to local models vs. cloud
- **Full visibility**: See every request in the What AI Saw Ledger

[Set up the Local AI Broker →](https://soterai.in/docs/tutorials/local-ai-broker)
```

---

### Section 8: AI Safe Mode

```markdown
## AI Safe Mode

One toggle. All secrets redacted from AI context.

When Safe Mode is ON, SoterAI intercepts AI context assembly and replaces sensitive values with `[REDACTED]` tokens. AI still gets the code structure it needs to help you — without the secrets it doesn't.

- Works with Copilot, Cursor, Claude, and any AI that reads your workspace
- Toggle via Command Palette, status bar, or keyboard shortcut
- Configurable: choose what gets redacted (secrets, PII, custom patterns)
```

---

### Section 9: AI Memory Inspector

```markdown
## AI Memory Inspector

See what AI remembers about your project — and clear it.

AI tools build up context and memory over time. The Memory Inspector shows you exactly what's been retained and gives you one-click controls to clear sensitive entries.
```

---

### Section 10: MCP Tool Scanner

```markdown
## MCP/Tool Permission Monitor

Audit every MCP server and tool in your environment.

MCP (Model Context Protocol) tools can read files, access APIs, and modify your code. The scanner analyzes every tool's permissions and flags over-privileged or risky configurations.

- Scans all configured MCP servers
- Risk-scores each tool (low/medium/high/critical)
- Shows exactly what each tool can access
- Alerts on new or changed tool configurations
```

---

### Section 11: Privacy Model

```markdown
## Privacy

**SoterAI runs 100% locally.** No data is sent to SoterAI servers. No telemetry is collected by default. No account is required.

- All scanning happens on your machine
- No code, secrets, or prompts are uploaded
- Optional anonymized usage analytics (opt-in only)
- Open-source core for full transparency

[Read our privacy policy →](https://soterai.in/privacy)
```

---

### Section 12: Limitations (Honest)

```markdown
## Limitations

SoterAI is in beta. Here's what you should know:

- **Detection is pattern-based**, not AI-powered. It catches known secret formats and common prompt injection patterns, but novel attacks may slip through.
- **MCP scanning is static analysis.** It reads tool manifests and configurations, but does not monitor runtime behavior.
- **Terminal Command Firewall** works with integrated terminals. External terminal applications are not covered.
- **Cross-IDE support** is on the roadmap but not yet available. Currently VS Code only.
- **Performance** on very large workspaces (>100K files) may be slower. We're optimizing.

We ship improvements weekly. [Report issues on GitHub →](https://github.com/soterai/ai-agent-security-guard/issues)
```

---

### Section 13: Pricing

```markdown
## Pricing

| | Free | Pro | Enterprise |
|---|---|---|---|
| Local scanning | Unlimited | Unlimited | Unlimited |
| AI Safe Mode | Yes | Yes | Yes |
| AI Context Firewall | Yes | Yes | Yes |
| What AI Saw Ledger | Yes | Yes | Yes |
| MCP Tool Scanner | Yes | Yes | Yes |
| Terminal Command Firewall | Yes | Yes | Yes |
| Canary secrets | 5 | Unlimited | Unlimited |
| Team policies | — | Yes | Yes |
| Advanced analytics | — | Yes | Yes |
| CI/CD integration | — | Yes | Yes |
| SSO/SAML | — | — | Yes |
| Dedicated support | — | — | Yes |
| **Price** | **$0** | **$9/mo** | **Contact us** |

[View full pricing →](https://soterai.in/pricing)
```

---

### Section 14: Support Links

```markdown
## Support

- [Documentation](https://soterai.in/docs)
- [GitHub Issues](https://github.com/soterai/ai-agent-security-guard/issues)
- [Discord Community](https://discord.gg/soterai)
- [Security vulnerabilities](mailto:security@soterai.in)
- [Enterprise inquiries](mailto:enterprise@soterai.in)
```

---

### Section 15: Changelog

```markdown
## Changelog

See the [full changelog](https://soterai.in/changelog) for all updates.

### 0.1.0 (2026-07-05)
- Initial beta release
- AI Safe Mode, Context Firewall (14 phases), Secret Vault
- MCP/Tool Permission Monitor
- What AI Saw Ledger
- Terminal Command Firewall
- Canary Leak Detection
- LLM Extension Risk Scanner
- AI Memory Inspector
- Local AI Broker
- 98 tests passing
```

---

## Marketplace Search Optimization

### How VS Code Marketplace Search Works

The marketplace search algorithm considers:
1. **Exact match** in extension name/displayName (highest weight)
2. **Keyword match** in the `keywords` field
3. **Description match** (lower weight)
4. **Category match** (filter, not ranking)
5. **Install count** (social proof / popularity signal)
6. **Recency** of last publish (favors actively maintained extensions)
7. **Rating** (quality signal)

### Target Search Queries and Expected Ranking

| Search Query | Relevance | Expected Position | Competition |
|-------------|-----------|-------------------|-------------|
| "ai security" | Exact keyword match | Top 5 | Low (few AI security extensions) |
| "secret scanning" | Exact keyword match | Top 10 | Medium (some secret scanners exist) |
| "prompt injection" | Exact keyword match | Top 3 | Very low (nearly no competitors) |
| "mcp security" | Exact keyword match | Top 1 | None (first mover) |
| "copilot security" | Keyword match | Top 10 | Low |
| "cursor security" | Keyword match | Top 5 | Very low |
| "ai coding security" | Partial match | Top 5 | Low |
| "data leakage" | Exact keyword match | Top 10 | Medium |
| "local ai" | Exact keyword match | Top 20 | High (many local AI extensions) |
| "developer security" | Exact keyword match | Top 15 | Medium |

### Long-Tail Keyword Opportunities
These queries have low volume but near-zero competition:
- "protect secrets from ai"
- "what does copilot see"
- "mcp tool permissions"
- "ai context firewall"
- "ai safe mode vscode"
- "canary token ai"
- "terminal command security ai"
- "dpdp act compliance tool"

---

## Visual Assets Checklist

| Asset | Dimensions | Format | Status |
|-------|-----------|--------|--------|
| Gallery banner | 1280 x 640 | PNG | NEEDS CREATION |
| Icon | 256 x 256 | PNG | EXISTS (verify quality) |
| Screenshot: Safe Mode | 1366 x 768 | PNG | NEEDS CREATION |
| Screenshot: Scan Results | 1366 x 768 | PNG | NEEDS CREATION |
| Screenshot: AI Saw Ledger | 1366 x 768 | PNG | NEEDS CREATION |
| Screenshot: MCP Scanner | 1366 x 768 | PNG | NEEDS CREATION |
| Screenshot: Terminal Firewall | 1366 x 768 | PNG | NEEDS CREATION |
| Social preview (GitHub) | 1280 x 640 | PNG | NEEDS CREATION |

### Screenshot Guidelines
- Use VS Code Dark+ theme (most popular theme)
- Show realistic but sanitized data
- Include subtle annotations (arrows, highlights) pointing to key features
- Add a thin border (1px, #333) for visual separation on white backgrounds
- Compress with TinyPNG to keep file sizes under 200KB each

---

## Implementation Checklist

- [ ] Update `packages/vscode-extension/package.json` with recommended metadata
- [ ] Create gallery banner image
- [ ] Create 5 marketplace screenshots
- [ ] Rewrite marketplace README following the structure above
- [ ] Add CHANGELOG.md to extension root
- [ ] Publish updated extension to marketplace
- [ ] Verify marketplace listing renders correctly
- [ ] Submit to Open VSX Registry
- [ ] Set up marketplace analytics monitoring
- [ ] Plan monthly publish cadence for freshness signal

---

*Document version: 1.0 -- Created 2026-07-06*
