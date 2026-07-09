# SoterAI IDE Guard — Real Marketplace Enterprise Test Report

**Date:** 2026-07-07
**Test Environment:** VS Code (Windows), Marketplace install
**Extension Version:** 0.2.0 (Enterprise)
**Test Workspace:** `C:\temp\soterai-enterprise-real-test`

---

## Test Matrix

| # | Feature | Command | Status | Notes |
|---|---------|---------|--------|-------|
| 1 | Marketplace install | — | PASS | Extension visible in Extensions view |
| 2 | All commands registered | `SoterAI:` prefix | PASS | 90+ commands in command palette |
| 3 | Scan Selection | `soterai.scanSelection` | PASS | Detects secrets, returns risk score |
| 4 | Redact Selection | `soterai.redactSelectionForAI` | PASS | Redacts and copies to clipboard |
| 5 | Scan Current File | `soterai.scanCurrentFile` | PASS | Shows findings with diagnostics |
| 6 | Scan Workspace | `soterai.scanWorkspaceRisk` | PASS | Progress notification, batch scan |
| 7 | Enable Safe Mode | `soterai.enableAISafeMode` | PASS | Three levels available |
| 8 | Disable Safe Mode | `soterai.disableAISafeMode` | PASS | Status bar updates |
| 9 | Start Broker | `soterai.startLocalAIBroker` | PASS | Starts on 127.0.0.1 |
| 10 | Stop Broker | `soterai.stopLocalAIBroker` | PASS | Process terminated cleanly |
| 11 | Broker Status | `soterai.showBrokerStatus` | PASS | Shows running/stopped state |
| 12 | Test Broker Protection | `soterai.testBrokerProtection` | PASS | Self-test passes |
| 13 | AI Memory Inspector | `soterai.openAIMemoryInspector` | PASS | Shows memory sessions |
| 14 | MCP Scanner | `soterai.scanMCPConfigs` | PASS | Detects MCP configs |
| 15 | Terminal Checker | `soterai.checkTerminalCommand` | PASS | Detects dangerous commands |
| 16 | Output Leak Monitor | `soterai.scanAIOutput` | PASS | Checks for canaries |
| 17 | Extension Risk Scanner | `soterai.scanInstalledExtensionsRisk` | PASS | Heuristic risk scores |
| 18 | Export Risk Report | `soterai.exportLocalRiskReport` | PASS | Redacted JSON report |
| 19 | Verify No Canary in Logs | `soterai.verifyNoCanaryInLogs` | PASS | Confirms no raw canary |
| 20 | Open Security Panel | `soterai.openSecurityPanel` | PASS | Dashboard opens |
| 21 | **Enable AI Activity Sentinel** | `soterai.enableAISentinel` | PASS | Status bar shows "Sentinel" |
| 22 | **Disable AI Activity Sentinel** | `soterai.disableAISentinel` | PASS | Status bar shows "Sentinel Off" |
| 23 | **Show AI Activity Timeline** | `soterai.showAITimeline` | PASS | Timeline webview opens |
| 24 | **Export AI Activity Report** | `soterai.exportAIActivityReport` | PASS | Redacted report exported |
| 25 | **Open AI Permission Center** | `soterai.openPermissionCenter` | PASS | Permission center opens |
| 26 | **Enable Protected Workspace** | `soterai.enableProtectedWorkspace` | PASS | Files auto-protected |
| 27 | **Disable Protected Workspace** | `soterai.disableProtectedWorkspace` | PASS | Protection removed |
| 28 | **Show Protected Files List** | `soterai.showProtectedFilesList` | PASS | Protected files displayed |
| 29 | **Add File to Protected** | `soterai.addFileToProtected` | PASS | File added to list |
| 30 | **Remove File from Protected** | `soterai.removeFileFromProtected` | PASS | File removed from list |
| 31 | **Show Workspace Risk Score** | `soterai.showWorkspaceRiskScore` | PASS | Risk score displayed |
| 32 | **Open MCP Tool Firewall** | `soterai.openMCPToolFirewall` | PASS | Firewall webview opens |
| 33 | **Generate Safe MCP Policy** | `soterai.generateSafeMCPPolicyFile` | PASS | Policy JSON generated |
| 34 | **Block MCP Tool** | `soterai.blockMCPTool` | PASS | Tool blocked |
| 35 | **Approve MCP Tool** | `soterai.approveMCPTool` | PASS | Tool approved |
| 36 | **Scan Memory Risk** | `soterai.scanMemoryRisk` | PASS | Findings displayed |
| 37 | **Show Memory Poisoning Findings** | `soterai.showMemoryPoisoningFindings` | PASS | Findings webview opens |
| 38 | **Check Dependency Install** | `soterai.checkDependencyInstall` | PASS | Risk analysis displayed |
| 39 | **Scan package.json Risk** | `soterai.scanPackageJsonRisk` | PASS | Dependencies analyzed |
| 40 | **Apply Policy Pack** | `soterai.applyPolicyPack` | PASS | Policy pack applied |
| 41 | **Compare Policy Packs** | `soterai.comparePolicyPacks` | PASS | Comparison webview opens |
| 42 | **Export Policy** | `soterai.exportPolicy` | PASS | Policy exported |
| 43 | **Open Enterprise Dashboard** | `soterai.openEnterpriseDashboard` | PASS | Dashboard opens |
| 44 | **Export Enterprise Risk Report** | `soterai.exportEnterpriseRiskReport` | PASS | Report exported |
| 45 | Create Project Policy | `soterai.createProjectPolicy` | PASS | Policy file created |
| 46 | Edit Project Policy | `soterai.editProjectPolicy` | PASS | Policy file opened |
| 47 | Show Protected Files | `soterai.showProtectedFiles` | PASS | Files displayed |
| 48 | Migrate Secrets to Vault | `soterai.migrateSecretsToVault` | PASS | Migration preview shown |
| 49 | Open Vault Status | `soterai.openVaultStatus` | PASS | Vault status displayed |
| 50 | Generate .env.example | `soterai.generateEnvExample` | PASS | Safe example generated |
| 51 | Inspect AI Context | `soterai.inspectAIContext` | PASS | Context inspection opens |
| 52 | Build Safe AI Context | `soterai.buildSafeAIContext` | PASS | Safe context built |
| 53 | Copy Safe AI Context | `soterai.copySafeAIContext` | PASS | Redacted context copied |
| 54 | Open AI Ledger | `soterai.openAILedger` | PASS | Ledger opens |
| 55 | Export AI Ledger | `soterai.exportAILedger` | PASS | Ledger exported |
| 56 | Scan Git Changes | `soterai.scanGitChanges` | PASS | Git diff scanned |
| 57 | Configure Policy | `soterai.configurePolicy` | PASS | Quick pick opens |
| 58 | Review Selected AI Code | `soterai.reviewSelectedAICode` | PASS | Code review opens |

---

## Enterprise Feature Test Results

### AI Activity Sentinel
- Enable/Disable: PASS
- Status bar indicator: PASS
- Timeline display: PASS
- High-risk event alerts: PASS
- File watcher for sensitive files: PASS
- Export report: PASS

### Protected Workspace Mode
- Enable/Disable: PASS
- Auto-detect .env files: PASS
- Auto-detect .pem files: PASS
- Auto-detect id_rsa: PASS
- Auto-detect .npmrc: PASS
- Auto-detect .aws/credentials: PASS
- Auto-detect repo instruction files: PASS
- Add/Remove protected files: PASS
- Workspace risk score: PASS
- Generate .env.example: PASS

### AI Permission Center
- Open Permission Center: PASS
- Approval flow: PASS
- Scope support (once/session/workspace): PASS
- Clear approvals: PASS

### MCP Tool Firewall
- Scan MCP configs: PASS
- Tool classification: PASS
- Risk scoring: PASS
- Block/Approve tools: PASS
- Generate safe policy: PASS

### Memory Poisoning Guard
- Scan memory files: PASS
- Injection pattern detection: PASS
- Invisible Unicode detection: PASS
- HTML comment detection: PASS
- Show findings: PASS

### Dependency Guard
- Check install command: PASS
- Scan package.json: PASS
- Review AI suggested: PASS
- Typosquatting detection: PASS
- Curl pipe detection: PASS

### Policy Packs
- 10 packs available: PASS
- Apply pack: PASS
- Compare packs: PASS
- Export policy: PASS

### Enterprise Dashboard
- Open dashboard: PASS
- Risk score display: PASS
- All sections populated: PASS
- Export report: PASS

---

## Privacy Check

| Check | Status |
|-------|--------|
| No raw secrets in any webview | PASS |
| No raw secrets in any report | PASS |
| No raw secrets in any export | PASS |
| No raw canary in ledger | PASS |
| No broker token in webview | PASS |
| No broker token in logs | PASS |
| All HTML escaped | PASS |
| CSP enforced | PASS |

---

## Performance Notes

| Operation | Time | Status |
|-----------|------|--------|
| Extension activation | ~200ms | PASS |
| Scan current file | ~25ms | PASS |
| Scan selection | ~5ms | PASS |
| Workspace scan (100 files) | ~3s | PASS |
| Dashboard open | ~300ms | PASS |
| Sentinel enable | ~50ms | PASS |
| Broker start | ~2s | PASS |
| MCP scan | ~100ms | PASS |
| Memory scan | ~200ms | PASS |

No VS Code freeze observed during any operation.

---

## Bugs Found

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | P2 | Minor: Sentinel status bar tooltip could be more descriptive | Known |
| 2 | P2 | Minor: Policy pack comparison could show more fields | Known |

No P0 or P1 bugs found.

---

## Final Verdict

**PASS** — All 58 features tested. All enterprise features operational. Privacy audit passes. Performance targets met. No P0/P1 bugs. Ready for enterprise release.
