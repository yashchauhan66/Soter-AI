# SoterAI — Screenshots Checklist

> Required screenshots for marketplace submissions across all platforms.

---

## Universal screenshots needed

- [ ] **SoterAI Dashboard** — main overview showing threat analytics
- [ ] **Threat detection result** — example of a blocked prompt injection
- [ ] **PII redaction result** — example showing redacted text
- [ ] **RAG scan result** — example of document scan with issues
- [ ] **API key setup** — credential configuration screen
- [ ] **SoterAI logo** — 256x256 PNG, transparent background

## Platform-specific screenshots

### n8n
- [ ] SoterAI node in the n8n node panel (search result)
- [ ] SoterAI node configuration (Input Guard action selected)
- [ ] SoterAI credential setup dialog
- [ ] Complete workflow: Webhook → SoterAI Input Guard → IF → OpenAI → SoterAI Output Guard
- [ ] Execution result showing guard output

### Zapier
- [ ] SoterAI app in Zapier app search
- [ ] "Check Input Safety" action configuration
- [ ] Auth setup screen
- [ ] Complete Zap: Webhook → SoterAI Input Guard → Filter → Slack
- [ ] Test result showing output fields

### Make.com
- [ ] SoterAI module in Make module panel
- [ ] "Check Input for Threats" module configuration
- [ ] Connection setup dialog
- [ ] Complete scenario: Webhook → SoterAI → HTTP → SoterAI Output Guard
- [ ] Execution log showing results

### Dify
- [ ] SoterAI plugin in Dify marketplace / plugin list
- [ ] Input Guard tool configuration
- [ ] Credentials setup
- [ ] Workflow with SoterAI tools integrated

### Botpress
- [ ] SoterAI integration in Botpress integrations list
- [ ] checkInput action configuration
- [ ] Bot flow with SoterAI actions

### Flowise
- [ ] SoterAI nodes in Flowise sidebar
- [ ] Input Guard node configuration
- [ ] Flow with SoterAI tools connected

### Voiceflow
- [ ] API step configured with SoterAI endpoint
- [ ] Flow diagram showing guard steps

## Image specifications

| Platform | Format | Size | Notes |
|----------|--------|------|-------|
| n8n | PNG | Any | Node icon: 60x60 SVG preferred |
| Zapier | PNG | 256x256 | App icon, square, no rounded corners |
| Make.com | PNG | 256x256 | App icon |
| Dify | SVG/PNG | 64x64+ | Plugin icon |
| Botpress | PNG | Any | Integration icon |
| npm | N/A | N/A | No icon in npm, but good for README |

## Brand assets

- Primary color: #2563EB (blue)
- Icon: Shield with checkmark
- Font: System/sans-serif
- Logo files: public/logo.png, public/icon.png
