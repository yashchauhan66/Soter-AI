# VS Code Extension — Manual Test Plan

**Extension:** SoterAI IDE Guard
**Version:** 0.1.0
**Status:** BUILD VERIFIED (VSIX 210KB, 10 files)
**Purpose:** Complete manual testing checklist for VS Code Marketplace submission

---

## Pre-Test Setup

### 1.1 Environment
- [ ] VS Code 1.85.0 or later installed
- [ ] Extension loaded from VSIX (not development mode)
- [ ] API key configured in settings
- [ ] Test workspace with sample code files created

### 1.2 Test Data
- [ ] Sample malicious prompt file (`test-malicious.txt`)
- [ ] Sample benign code file (`test-benign.py`)
- [ ] Sample secrets file (`test-secrets.env`)
- [ ] Sample configuration file (`test-config.json`)

---

## 2. Installation & Activation

### 2.1 Installation
- [ ] VSIX installs without errors
- [ ] Extension appears in Extensions view
- [ ] Version shows as 0.1.0
- [ ] Publisher shows correctly
- [ ] Extension size is reasonable (<500KB)

### 2.2 Activation
- [ ] Extension activates on startup (check Output panel)
- [ ] No activation errors in Developer Tools
- [ ] Status bar item appears
- [ ] Commands registered (check Command Palette)

---

## 3. Configuration

### 3.1 Settings
- [ ] API key setting exists (`soterai.apiKey`)
- [ ] Endpoint setting exists (`soterai.endpoint`)
- [ ] Auto-scan setting exists (`soterai.autoScan`)
- [ ] Language whitelist setting exists (`soterai.languages`)
- [ ] Settings have sensible defaults

### 3.2 SecretStorage
- [ ] API key stored in SecretStorage (not settings.json)
- [ ] API key retrievable after restart
- [ ] API key deletable
- [ ] No API key in plain text anywhere

---

## 4. Core Functionality

### 4.1 Manual Scan
- [ ] Right-click menu shows "Scan with SoterAI"
- [ ] Scan command in Command Palette
- [ ] Scanning progress indicator appears
- [ ] Results displayed in panel/editor
- [ ] Malicious content flagged correctly
- [ ] Benign content shows clean
- [ ] Scan time reasonable (<5s for small files)

### 4.2 Auto Scan
- [ ] Auto scan triggers on file save
- [ ] Auto scan respects language whitelist
- [ ] Auto scan can be disabled
- [ ] Auto scan doesn't block editor

### 4.3 Diagnostics
- [ ] Problems panel shows SoterAI issues
- [ ] Issues have correct severity (Error/Warning/Info)
- [ ] Issues have correct source ("soterai")
- [ ] Issues have line/column numbers
- [ ] Clicking issue navigates to location

---

## 5. Webview Panel

### 5.1 Panel Display
- [ ] Panel opens with command
- [ ] Panel shows analysis results
- [ ] Panel has correct CSP (no inline scripts)
- [ ] Panel renders without errors
- [ ] Panel refreshes on new scan

### 5.2 Panel Interaction
- [ ] Buttons in panel work
- [ ] Links in panel open external browser
- [ ] Panel can be closed/reopened
- [ ] Panel state persists across restarts

---

## 6. Security

### 6.1 SecretStorage
- [ ] API key not in settings.json
- [ ] API key not in output logs
- [ ] API key not in error messages
- [ ] API key not in telemetry

### 6.2 Webview CSP
- [ ] No inline scripts allowed
- [ ] No eval() allowed
- [ ] Only whitelisted resources loaded
- [ ] No remote images (or only HTTPS)

### 6.3 Workspace Trust
- [ ] Extension respects workspace trust
- [ ] Untrusted workspace disables features
- [ ] Trusted workspace enables features
- [ ] No code execution in untrusted workspaces

---

## 7. Commands

### 7.1 Command Palette
- [ ] `SoterAI: Scan Current File` works
- [ ] `SoterAI: Scan Selection` works
- [ ] `SoterAI: Scan Workspace` works
- [ ] `SoterAI: Show Output` works
- [ ] `SoterAI: Configure API Key` works
- [ ] `SoterAI: About` works

### 7.2 Keyboard Shortcuts
- [ ] Default shortcuts don't conflict
- [ ] Shortcuts can be customized
- [ ] Shortcuts work in all contexts

---

## 8. Error Handling

### 8.1 Network Errors
- [ ] Offline mode shows clear message
- [ ] API errors shown to user
- [ ] Timeout errors handled gracefully
- [ ] Retry mechanism works

### 8.2 File Errors
- [ ] Large files handled (limit message)
- [ ] Binary files skipped gracefully
- [ ] Permission errors shown
- [ ] Missing files handled

### 8.3 API Errors
- [ ] Invalid API key shows message
- [ ] Expired API key shows message
- [ ] Rate limit errors handled
- [ ] Server errors shown

---

## 9. Performance

### 9.1 Startup
- [ ] Extension activates in <2s
- [ ] No blocking during activation
- [ ] Status bar appears quickly

### 9.2 Scanning
- [ ] Small files (<1KB) scan in <1s
- [ ] Medium files (<100KB) scan in <5s
- [ ] Large files (>100KB) scan in <10s
- [ ] No UI freezes during scan

### 9.3 Memory
- [ ] No memory leaks after repeated scans
- [ ] Memory usage reasonable (<50MB)
- [ ] Garbage collection works

---

## 10. Compatibility

### 10.1 VS Code Versions
- [ ] Works on VS Code 1.85.0 (minimum)
- [ ] Works on latest VS Code stable
- [ ] Works on VS Code Insiders (optional)

### 10.2 Platforms
- [ ] Works on Windows
- [ ] Works on macOS
- [ ] Works on Linux

### 10.3 Architectures
- [ ] Works on x64
- [ ] Works on ARM64 (if supported)

---

## 11. Marketplace Requirements

### 11.1 Metadata
- [ ] Display name correct
- [ ] Description accurate
- [ ] Categories correct (Security, Linters)
- [ ] Keywords appropriate
- [ ] Icon displays correctly

### 11.2 README
- [ ] README.md renders correctly
- [ ] Installation instructions clear
- [ ] Usage examples provided
- [ ] Settings documented
- [ ] Commands documented

### 11.3 License
- [ ] LICENSE file included
- [ ] License type correct
- [ ] Copyright notice present

### 11.4 Changelog
- [ ] CHANGELOG.md included
- [ ] Version history documented
- [ ] Breaking changes noted

---

## 12. Edge Cases

### 12.1 Concurrent Operations
- [ ] Multiple scans don't conflict
- [ ] Scan during save works
- [ ] Scan during close works

### 12.2 State Management
- [ ] Extension state persists across restarts
- [ ] State can be reset
- [ ] State doesn't corrupt

### 12.3 Multi-root Workspaces
- [ ] Extension works in multi-root
- [ ] Each root scanned independently
- [ ] Settings per root (if supported)

---

## Test Results

| Category | Tests | Pass | Fail | Notes |
|---|---|---|---|---|
| Installation | 5 | - | - | |
| Configuration | 5 | - | - | |
| Core Functionality | 7 | - | - | |
| Webview Panel | 6 | - | - | |
| Security | 8 | - | - | |
| Commands | 9 | - | - | |
| Error Handling | 8 | - | - | |
| Performance | 6 | - | - | |
| Compatibility | 6 | - | - | |
| Marketplace | 8 | - | - | |
| Edge Cases | 6 | - | - | |
| **Total** | **74** | **-** | **-** | |

---

## Sign-Off

| Role | Name | Date | Status |
|---|---|---|---|
| QA Lead | | | |
| Security Lead | | | |
| Product Manager | | | |

---

**Note:** This test plan requires a real VS Code host. Automated tests (24/24)
cover manifest validation. Runtime testing must be performed manually.
