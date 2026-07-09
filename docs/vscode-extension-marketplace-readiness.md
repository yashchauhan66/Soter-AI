# VS Code Extension — Marketplace Readiness

**Package:** soterai-ide-guard v0.1.0
**Date:** 2026-07-09
**VSIX size:** 210 KB (10 files)

## Pre-Marketplace Checklist

### Package Quality

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | `package.json` has valid name, version, publisher | ✅ | `soterai-ide-guard` v0.1.0, publisher: soterai |
| 2 | `preview: false` for GA | ✅ | Fixed from `true` |
| 3 | `engines.vscode` set correctly | ✅ | `^1.85.0` |
| 4 | `main` points to bundled entry | ✅ | `./dist/extension.js` |
| 5 | `categories` appropriate | ✅ | AI, Linters, Other |
| 6 | `keywords` populated | ✅ | 12 keywords |
| 7 | `icon` present | ✅ | `media/icon.png` |
| 8 | `galleryBanner` configured | ✅ | Dark theme |
| 9 | License file present | ✅ | MIT |
| 10 | README.md with screenshots | ✅ | 4.57 KB, 5 screenshots |

### Build & Bundle

| # | Item | Status | Notes |
|---|---|---|---|
| 11 | `npm run bundle` succeeds | ✅ | esbuild production build |
| 12 | `npm run package` produces VSIX | ✅ | 210 KB, 10 files |
| 13 | `.vscodeignore` excludes source | ✅ | Only dist/, package.json, README, LICENSE, media |
| 14 | No source maps in VSIX | ✅ | Verified |
| 15 | No node_modules in VSIX | ✅ | Only bundled dist/ |

### Security

| # | Item | Status | Notes |
|---|---|---|---|
| 16 | No hardcoded secrets | ✅ | Verified via tests |
| 17 | Tokens stored in SecretStorage | ✅ | Verified via tests |
| 18 | Telemetry redacts raw content | ✅ | Verified via tests |
| 19 | Webviews have CSP | ✅ | Verified via tests |
| 20 | Clipboard writes go through redaction | ✅ | Verified via tests |

### Manifest & Contracts

| # | Item | Status | Notes |
|---|---|---|---|
| 21 | All 100 commands declared | ✅ | Verified via tests |
| 22 | All 100 commands registered | ✅ | Verified via tests |
| 23 | Command registration parity | ✅ | 24/24 tests pass |
| 24 | Workspace trust support | ✅ | Limited, cloud gated |
| 25 | Vault safety (backup + confirm) | ✅ | Verified via tests |

## Runtime Checklist (Requires VS Code Host)

The following items require a real VS Code installation to verify:

| # | Test | Status | Notes |
|---|---|---|---|
| 1 | Extension activates on install | ⏳ PENDING | Requires VS Code host |
| 2 | All 100 commands appear in Command Palette | ⏳ PENDING | Requires VS Code host |
| 3 | Activity Bar icon visible | ⏳ PENDING | Requires VS Code host |
| 4 | 3 Tree Views render in sidebar | ⏳ PENDING | Requires VS Code host |
| 5 | Status bar items appear | ⏳ PENDING | Requires VS Code host |
| 6 | Webview panel opens | ⏳ PENDING | Requires VS Code host |
| 7 | Scan current file works | ⏳ PENDING | Requires VS Code host |
| 8 | Scan selection works | ⏳ PENDING | Requires VS Code host |
| 9 | Scan workspace works | ⏳ PENDING | Requires VS Code host |
| 10 | Policy creation works | ⏳ PENDING | Requires VS Code host |
| 11 | Vault migration works | ⏳ PENDING | Requires VS Code host |
| 12 | Cloud connection works | ⏳ PENDING | Requires VS Code host |
| 13 | Broker starts/stops | ⏳ PENDING | Requires VS Code host |
| 14 | Sentinel enable/disable | ⏳ PENDING | Requires VS Code host |
| 15 | Memory guard scans | ⏳ PENDING | Requires VS Code host |
| 16 | MCP firewall scans | ⏳ PENDING | Requires VS Code host |
| 17 | Output panel shows no secrets | ⏳ PENDING | Requires VS Code host |
| 18 | Activation time <500ms | ⏳ PENDING | Requires VS Code host |
| 19 | Memory usage reasonable | ⏳ PENDING | Requires VS Code host |
| 20 | Offline mode works | ⏳ PENDING | Requires VS Code host |
| 21 | Invalid key shows error | ⏳ PENDING | Requires VS Code host |
| 22 | Rate limit shows warning | ⏳ PENDING | Requires VS Code host |
| 23 | Trust on/off works | ⏳ PENDING | Requires VS Code host |
| 24 | No console errors | ⏳ PENDING | Requires VS Code host |
| 25 | Extension deactivates cleanly | ⏳ PENDING | Requires VS Code host |

## Summary

| Category | Verified | Pending |
|---|---|---|
| Package Quality | 10/10 | 0 |
| Build & Bundle | 5/5 | 0 |
| Security | 5/5 | 0 |
| Manifest & Contracts | 5/5 | 0 |
| Runtime | 0/25 | 25 |
| **Total** | **25/50** | **25** |

## Known Issues

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | `preview: true` was set for GA | P2 | FIXED |
| 2 | 100 commands have no `when` clauses | P3 | DOCUMENTED (all commands always available) |
| 3 | Runtime tests require VS Code host | P2 | BLOCKED (no VS Code in this environment) |

## Next Steps

1. Install VS Code on a machine with display
2. Run `code --install-extension soterai-ide-guard-0.1.0.vsix`
3. Complete the 25-point runtime checklist
4. Take screenshots for marketplace listing
5. Submit to VS Code Marketplace and Open VSX
