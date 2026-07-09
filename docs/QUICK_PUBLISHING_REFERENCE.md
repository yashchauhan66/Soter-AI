# SoterAI IDE Guard — Quick Publishing Reference

## Pre-Publishing Checklist

```bash
# 1. Verify all tests pass
npm test

# 2. Verify typecheck passes
npm run typecheck

# 3. Verify VSIX builds
npm run vscode:package

# 4. Verify marketplace assets
npm run validate:marketplaces

# 5. Verify VS Code family install
npm run test:vscode-family
```

---

## Publishing Commands

### VS Code Marketplace

**Requires:** VS Code Marketplace publisher PAT

```bash
# Set the token in the release environment
export VSCE_PAT="<your-marketplace-pat>"

# Publish
npm run vscode:publish
```

**Verify:**
1. Search for "SoterAI" in VS Code Marketplace
2. Install into clean profile: `code --user-data-dir /tmp/vscode-clean --install-extension soterai.soterai-ide-guard`
3. Verify extension activates and commands appear

---

### Open VSX (Cursor, VSCodium, Windsurf)

**Requires:** Open VSX token for `soterai` namespace

```bash
# Set the token in the release environment
export OVSX_PAT="<your-openvsx-token>"

# Publish
npm run openvsx:publish
```

**Verify:**
1. Search for "soterai-ide-guard" in Open VSX registry
2. Install in Cursor: `cursor --install-extension soterai.soterai-ide-guard`
3. Install in Windsurf if available
4. Verify extension activates

---

### npm (CLI)

**Requires:** npm token with publish permission

```bash
# Set the token in the release environment
export NPM_TOKEN="<your-npm-token>"

# Publish
npm publish --access public
```

**Verify:**
```bash
npm view @soterai/soterai-cli
npm install -g @soterai/soterai-cli
soterai --help
```

---

## Rollback Commands

### VS Code Marketplace

```bash
# Unpublish via vsce
vsce unpublish soterai.soterai-ide-guard
```

### Open VSX

```bash
# Unpublish via ovsx
ovsx unpublish soterai soterai-ide-guard
```

### npm

```bash
# Deprecate version
npm deprecate @soterai/soterai-cli@0.1.0 "critical issue - use 0.1.1 or later"
```

---

## Marketplace Listings

### VS Code Marketplace

- **URL:** https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard
- **Publisher:** soterai
- **Extension ID:** soterai.soterai-ide-guard

### Open VSX

- **URL:** https://open-vsx.org/extension/soterai/soterai-ide-guard
- **Namespace:** soterai
- **Extension ID:** soterai-ide-guard

### npm

- **URL:** https://www.npmjs.com/package/@soterai/soterai-cli
- **Package:** @soterai/soterai-cli
- **Scope:** @soterai

---

## Canary Privacy Test (Post-Release)

Run in each published editor to verify no raw secrets leak:

```bash
# 1. Create a test file with a canary
echo "SOTERAI-CANARY-$(uuidgen)" > /tmp/canary.txt
echo "sk-test-1234567890abcdefghij" >> /tmp/canary.txt

# 2. Open the file in the editor
# 3. Select all text
# 4. Run "SoterAI: Scan Selection"
# 5. Verify:
#    - Decision is shown (e.g., "BLOCK")
#    - Raw canary is NOT displayed
#    - Raw API key is NOT displayed
#    - Only redacted evidence appears (e.g., "[SECRET_DETECTED]")

# 6. Check editor logs for any raw secret leakage
# 7. Check system logs for any cloud uploads
```

---

## Support & Troubleshooting

### If VSIX build fails

```bash
npm run vscode:package --verbose
```

### If marketplace validation fails

```bash
npm run validate:marketplaces --verbose
```

### If install test fails

```bash
npm run test:vscode-family -- --verbose
```

### If publish fails

1. Verify credentials are set correctly
2. Verify version is unique (not already published)
3. Verify package.json has correct publisher/namespace
4. Check marketplace documentation for rate limits

---

## Release Notes Template

```markdown
# SoterAI IDE Guard 0.1.0

## Features

- 🛡️ Local-first AI security for VS Code, Cursor, and Windsurf
- 🔍 Scan selections, files, and workspaces for secrets and prompt injection
- 🔐 Redact sensitive content before sharing with AI
- 🧠 AI Memory Inspector to see what AI saw
- 🎛️ Safe Mode with developer/strict/enterprise levels
- 📋 What AI Saw ledger with redacted evidence
- 🚀 Local AI Broker for all security logic
- ✅ 669 tests passing, 84% recall @ 1% FPR

## Security

- Local-first: raw source/secrets/prompts not sent to cloud by default
- Loopback-only broker on 127.0.0.1:47321
- Bearer token authentication
- No raw secrets in reports or logs
- Fail-closed when broker unavailable

## Limitations

- Cannot intercept every terminal command
- Cannot observe private prompts of other AI extensions
- Remote workspaces require explicit broker topology
- Not a "100% secure" solution — see docs for honest limitations

## Installation

- **VS Code:** Search for "SoterAI" in Extensions
- **Cursor:** Search for "soterai-ide-guard" in Open VSX
- **Windsurf:** Search for "soterai-ide-guard" in Open VSX

## Documentation

- [Privacy Policy](https://soterai.in/privacy)
- [Limitations](https://github.com/soterai/soterai-guard/blob/main/docs/cross-ide-limitations.md)
- [Getting Started](https://soterai.in/docs)
```

---

## Monitoring Post-Release

1. **Marketplace ratings:** Monitor for user feedback
2. **GitHub issues:** Watch for bug reports
3. **Telemetry:** Check for error spikes
4. **Canary tests:** Run weekly to verify no leaks
5. **Security:** Monitor for any reported vulnerabilities

---

## Contact & Support

- **Issues:** https://github.com/soterai/soterai-guard/issues
- **Discussions:** https://github.com/soterai/soterai-guard/discussions
- **Email:** support@soterai.in
- **Website:** https://soterai.in
