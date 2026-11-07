# Soter-AI Product-Led Growth (PLG) & Viral Loops
*Owner: `14-growth-hacker` | Brand Sign-off: `11-brand-marketing` | UTM: `utm_source=plg&utm_medium=viral_loop&utm_campaign=sprint01_plg`*

---

## 1. Engineering-as-Marketing: `npx soterai scan` (Free Local CLI Scanner)
- **Concept:** A zero-login, instant CLI utility that developers run in their terminal to scan their local `.env`, prompts, MCP configurations, or agent code for vulnerabilities.
- **Viral Trigger:**
  At the end of the scan output, the CLI prints:
  ```text
  🛡️ Soter-AI Local Audit Report:
  [OK] 0 Secrets Leaked
  [WARNING] 2 Unsanitized MCP Tool Calls Detected in ./mcp.json
  [OK] Prompt Injection Pre-Filter Active (Latency: 0.38ms)

  ⚡ Protect your production agent with Soter-AI inline runtime:
  👉 Run: npm install @soterai/guard-core
  👉 Visit: https://soterai.in?utm_source=cli&utm_medium=terminal_scan
  ```
- **Friction:** ZERO. No API key, no account signup required.

---

## 2. Viral Badge Program: "Protected by Soter-AI"
- **Implementation:** Hosted at `/badge.js` and `/api/badge`.
- **Mechanism:** Chatbot & agent developers embed an SVG shield or live trust verification badge into their web UI or GitHub README:
  ```markdown
  [![Protected by Soter-AI](https://soterai.in/api/badge?domain=myapp.com)](https://soterai.in/trust/myapp.com)
  ```
- **Incentive:** Grants the developer +50,000 free monthly guardrail queries when the badge is active on their public web app.

---

## 3. Product Hunt Launch Kit (Q4 2026 Target)
- **Tagline:** "The first local-first, zero-latency security guardrail for autonomous AI agents."
- **Asset Checklist:**
  - 5 High-resolution screenshots showcasing sub-5ms latency and terminal wipe blocking.
  - Interactive web demo sandbox at `soterai.in/demo`.
  - Founder introductory comment detailing the shift from cloud APIs to local-first runtime.

