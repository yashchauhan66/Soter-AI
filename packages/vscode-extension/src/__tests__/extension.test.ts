import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";

// These tests run under `tsx --test` WITHOUT a VS Code host, so they validate
// the manifest ⇄ source contracts statically rather than importing `vscode`.

const root = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

/** Recursively read every .ts file under src/ (excluding tests). */
function readAllSrc(): string {
    const srcDir = path.join(root, "src");
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "__tests__") continue;
                walk(full);
            } else if (entry.name.endsWith(".ts")) {
                out.push(fs.readFileSync(full, "utf8"));
            }
        }
    };
    walk(srcDir);
    return out.join("\n");
}

const allSrc = readAllSrc();
const pkg = JSON.parse(read("package.json"));
const commandsSrc = read("src/commands.ts");
const extensionSrc = read("src/extension.ts");
const telemetrySrc = read("src/telemetry.ts");
const stateSrc = read("src/state.ts");
const dashboardSrc = read("src/webview/DashboardPanel.ts");
const firewallCommandsSrc = read("src/firewall/commands.ts") + read("src/firewall/vault-commands.ts") + read("src/firewall/context-commands.ts") + read("src/firewall/canary-commands.ts") + read("src/firewall/output-commands.ts") + read("src/firewall/policy-commands.ts");
const ledgerStoreSrc = read("src/firewall/LedgerStore.ts");
const vaultManagerSrc = read("src/firewall/VaultManager.ts");
const brokerManagerSrc = read("src/broker/BrokerManager.ts");
const brokerCommandsSrc = read("src/broker/commands.ts");
const launchCommandsSrc = read("src/launchCommands.ts");
const liveScannerSrc = read("src/diagnostics/LiveScanner.ts");
const clipboardGuardSrc = read("src/clipboard/ClipboardGuard.ts");

// Commands are registered either directly (registerCommand("id", ...)) or via
// the firewall `reg("id", ...)` helper.
const registeredCommands = new Set(
    [...allSrc.matchAll(/(?:registerCommand|reg)\(\s*["']([^"']+)["']/g)].map((m) => m[1])
);
const declaredCommands: string[] = pkg.contributes.commands.map((c: any) => c.command);

describe("Command registration parity (#4)", () => {
    it("every declared command is registered", () => {
        const missing = declaredCommands.filter((c) => !registeredCommands.has(c));
        assert.deepStrictEqual(missing, [], `Declared but not registered: ${missing.join(", ")}`);
    });

    it("every registered command is declared (no orphan handlers)", () => {
        const orphan = [...registeredCommands].filter((c) => c.startsWith("soterai.") && !declaredCommands.includes(c));
        assert.deepStrictEqual(orphan, [], `Registered but not declared: ${orphan.join(", ")}`);
    });

    it("the three previously-missing commands are still registered", () => {
        for (const c of ["soterai.configurePolicy", "soterai.scanBeforeAIPrompt", "soterai.scanGitChanges"]) {
            assert.ok(registeredCommands.has(c), `${c} must be registered`);
        }
    });
});

describe("AI Context Firewall commands (Phases 1–7)", () => {
    const expected = [
        "soterai.createProjectPolicy", "soterai.editProjectPolicy", "soterai.showProtectedFiles",
        "soterai.addToProtectedFiles", "soterai.removeFromProtectedFiles",
        "soterai.migrateSecretsToVault", "soterai.restoreSecretPlaceholders", "soterai.openVaultStatus", "soterai.generateEnvExample",
        "soterai.inspectAIContext", "soterai.buildSafeAIContext", "soterai.copySafeAIContext",
        "soterai.approveContextSession", "soterai.clearContextApproval",
        "soterai.buildSafeDebugPrompt", "soterai.buildSafeCodeReviewPrompt", "soterai.buildSafeDeploymentPrompt",
        "soterai.buildSafeErrorFixPrompt", "soterai.buildSafeArchitecturePrompt",
        "soterai.openAILedger", "soterai.exportAILedger", "soterai.clearAILedger", "soterai.showWhatAISawLastSession",
        "soterai.scanAIOutput", "soterai.compareOutputAgainstContext", "soterai.checkOutputForLeakage",
        "soterai.generateCanary", "soterai.insertCanaryIntoTestFile", "soterai.scanWorkspaceForCanary",
        "soterai.verifyNoCanaryInLogs", "soterai.rotateCanary",
    ];
    it("all firewall commands are declared AND registered", () => {
        for (const c of expected) {
            assert.ok(declaredCommands.includes(c), `${c} must be declared in package.json`);
            assert.ok(registeredCommands.has(c), `${c} must be registered`);
        }
    });
});

describe("Workspace Trust (#5)", () => {
    it("declares limited untrusted-workspace support", () => {
        assert.strictEqual(pkg.capabilities?.untrustedWorkspaces?.supported, "limited");
    });
    it("gates cloud connection behind workspace trust", () => {
        assert.match(commandsSrc, /connectToCloudHandler[\s\S]{0,200}isTrusted/,
            "connectToCloud must check vscode.workspace.isTrusted");
    });
    it("gates the secret vault behind workspace trust", () => {
        assert.match(firewallCommandsSrc, /requireTrust/, "vault commands must call requireTrust");
        assert.match(firewallCommandsSrc, /isTrusted/, "firewall must check workspace trust");
    });
});

describe("Vault safety — dry-run preview + backup + confirm", () => {
    it("migration writes a .bak backup before overwriting", () => {
        assert.match(vaultManagerSrc, /\.bak/, "vault migration must create a .bak backup");
    });
    it("migration requires an explicit modal confirmation after previewing", () => {
        assert.match(firewallCommandsSrc, /modal:\s*true/, "vault migration must confirm via a modal dialog");
        assert.match(firewallCommandsSrc, /"Migrate & Backup"/, "confirm action label present");
        assert.match(firewallCommandsSrc, /preview\.candidates/, "migration must preview candidates first");
    });
    it("vault status/preview surface metadata only — rawValue stays inside the encrypted store", () => {
        // status() strips rawValue, returning metadata only.
        assert.match(vaultManagerSrc, /map\(\(\{\s*rawValue,\s*\.\.\.meta\s*\}\)\s*=>\s*meta\)/,
            "status() must strip rawValue from displayed entries");
        // preview surfaces a masked preview, never the raw value.
        assert.match(vaultManagerSrc, /redactValuePreview/);
    });
});

describe("Ledger privacy — no raw secrets persisted (#6)", () => {
    it("every ledger write goes through sanitizeLedgerEntry / buildLedgerEntry", () => {
        assert.match(ledgerStoreSrc, /sanitizeLedgerEntry/);
        assert.match(ledgerStoreSrc, /buildLedgerEntry/);
    });
    it("ledger store never references raw content fields", () => {
        assert.ok(!/rawContent|rawValue|\.token\b/.test(ledgerStoreSrc), "ledger must not read raw content/tokens");
    });
});

describe("Telemetry contains no raw content (#6)", () => {
    it("telemetry never references redactedText or raw content fields", () => {
        assert.ok(!telemetrySrc.includes("redactedText"), "telemetry must not read redactedText");
        assert.ok(!/rawContent|\.content\b/.test(telemetrySrc), "telemetry must not include raw content");
    });
    it("event payload only uses the safe redacted preview", () => {
        assert.match(telemetrySrc, /redactedEvidencePreview:\s*decision\.evidencePreview/);
    });
});

describe("SecretStorage token hygiene (#6)", () => {
    it("token is stored via context.secrets, never logged", () => {
        assert.match(stateSrc, /context\.secrets\.(store|get|delete)/);
        assert.ok(!/console\.(log|info|warn|error)\([^)]*token/i.test(commandsSrc), "token must never be logged");
        assert.ok(!/console\.(log|info|warn|error)\([^)]*token/i.test(telemetrySrc), "token must never be logged");
    });
    it("vault key and canary tokens live in SecretStorage, not globalState/logs", () => {
        assert.match(vaultManagerSrc, /context\.secrets\.(store|get|delete)/);
        assert.ok(!/console\.(log|info|warn|error)\([^)]*token/i.test(firewallCommandsSrc), "canary token must never be logged");
    });
});

describe("Launch readiness command surface", () => {
    const expected = [
        "soterai.quickStart",
        "soterai.checkExtensionHealth",
        "soterai.openSettings",
        "soterai.runDemoScan",
        "soterai.scanSelectedText",
        "soterai.scanGitDiff",
        "soterai.reviewTerminalCommand",
        "soterai.scanMCPAgentTools",
        "soterai.openAIActivityLedger",
        "soterai.generateCanaryToken",
        "soterai.choosePolicyPack",
    ];

    it("declares and registers launch-critical command names", () => {
        for (const command of expected) {
            assert.ok(declaredCommands.includes(command), `${command} must be declared`);
            assert.ok(registeredCommands.has(command), `${command} must be registered`);
        }
    });

    it("keeps friendly launch aliases mapped to implemented scanners", () => {
        assert.match(launchCommandsSrc, /soterai\.scanSelection/);
        assert.match(launchCommandsSrc, /soterai\.scanGitChanges/);
        assert.match(launchCommandsSrc, /soterai\.checkTerminalCommand/);
        assert.match(launchCommandsSrc, /soterai\.scanMCPConfigs/);
        assert.match(launchCommandsSrc, /soterai\.openAILedger/);
        assert.match(launchCommandsSrc, /soterai\.generateCanary/);
        assert.match(launchCommandsSrc, /soterai\.applyPolicyPack/);
    });

    it("has build and lint scripts required by release automation", () => {
        assert.strictEqual(pkg.scripts.build, "npm run bundle");
        assert.strictEqual(pkg.scripts.lint, "npm run typecheck");
    });
});

describe("Local-first privacy mode", () => {
    it("declares soterai.privacyMode with local default", () => {
        const setting = pkg.contributes.configuration.properties["soterai.privacyMode"];
        assert.deepStrictEqual(setting.enum, ["local", "cloud", "hybrid"]);
        assert.strictEqual(setting.default, "local");
    });

    it("prevents telemetry flush in local mode and untrusted workspaces", () => {
        assert.match(telemetrySrc, /privacyMode === "local"/);
        assert.match(telemetrySrc, /!vscode\.workspace\.isTrusted/);
    });

    it("health reports never include raw secrets or prompt text", () => {
        assert.match(launchCommandsSrc, /No API keys, prompts, secrets, or raw file contents/);
        assert.ok(!/cloudToken|providerApiKey|SOTERAI_PROVIDER_API_KEY/.test(launchCommandsSrc));
    });
});

describe("Clipboard safety for firewall handlers (#1)", () => {
    it("all firewall clipboard writes go through redactForSharing or a canary token by design", () => {
        const writes = [...firewallCommandsSrc.matchAll(/clipboard\.writeText\(([^)]*)\)/g)].map((m) => m[1].trim());
        for (const arg of writes) {
            const safe =
                arg.startsWith("redactForSharing(") ||
                arg === "c.token" || // intentional: canary token copied so the user can plant it
                arg === "prompt"; // prompt is redactForSharing(...) output assigned just above
            assert.ok(safe, `Unexpected clipboard write: ${arg}`);
        }
    });
});

describe("Webview hardening (#7)", () => {
    it("all webviews declare a Content-Security-Policy", () => {
        assert.match(dashboardSrc, /Content-Security-Policy/);
        assert.match(commandsSrc, /Content-Security-Policy/, "Review-AI-Code panel needs a CSP");
        assert.match(read("src/firewall/util.ts"), /Content-Security-Policy/, "firewall webviews need a CSP");
    });
    it("webviews escape finding fields before HTML interpolation", () => {
        assert.match(commandsSrc, /escapeHtml\(/);
        assert.match(dashboardSrc, /escapeHtml\(/);
        assert.match(firewallCommandsSrc, /escapeHtml\(/);
    });
    it("firewall info webviews disable scripts", () => {
        assert.match(read("src/firewall/util.ts"), /enableScripts:\s*false/);
    });
    it("dashboard message handler keeps a strict command allowlist including new actions", () => {
        assert.match(dashboardSrc, /knownCommands[\s\S]{0,200}scanClipboard/);
        assert.match(dashboardSrc, /knownCommands[\s\S]{0,200}openWalkthrough/);
        // The allowlist gate must still reject anything not in the set.
        assert.match(dashboardSrc, /!knownCommands\.has\(cmd\)/);
    });
});

describe("Local AI Broker, Safe Mode, and Memory Inspector", () => {
    const expected = [
        "soterai.startLocalAIBroker", "soterai.stopLocalAIBroker", "soterai.restartLocalAIBroker",
        "soterai.showBrokerStatus", "soterai.configureAIBroker", "soterai.copyOpenAIBrokerUrl",
        "soterai.copyAnthropicBrokerUrl", "soterai.testBrokerProtection", "soterai.rotateBrokerToken",
        "soterai.clearBrokerToken", "soterai.enableAISafeMode", "soterai.disableAISafeMode",
        "soterai.showAISafeModeRules", "soterai.configureSafeMode", "soterai.openAIMemoryInspector",
        "soterai.startAIMemorySession", "soterai.endAIMemorySession", "soterai.clearAIMemorySession",
        "soterai.exportAIMemoryReport", "soterai.showWhatAISaw", "soterai.showBlockedAIContext",
        "soterai.compareAIResponseWithContext", "soterai.reviewPendingAIApproval",
        "soterai.approveAIContextOnce", "soterai.denyAIContext", "soterai.showActiveAIApprovals",
        "soterai.clearAIApprovals",
    ];
    it("declares and registers every new command", () => {
        for (const command of expected) {
            assert.ok(declaredCommands.includes(command), `${command} must be declared`);
            assert.ok(registeredCommands.has(command), `${command} must be registered`);
        }
    });
    it("stores broker/provider tokens in SecretStorage and fixes the host to loopback", () => {
        assert.match(brokerManagerSrc, /context\.secrets\.(get|store|delete)/);
        assert.match(brokerManagerSrc, /http:\/\/127\.0\.0\.1/);
        assert.ok(!/console\.(log|info|warn|error)/.test(brokerManagerSrc), "manager must not log tokens");
    });
    it("never injects a token or provider key into a webview", () => {
        assert.ok(!/localBrokerToken|providerApiKey|authorization/i.test(dashboardSrc), "dashboard must contain status only");
        assert.match(dashboardSrc, /never sent to this webview/);
    });
    it("redacts Memory Inspector exports and trust-gates provider configuration", () => {
        assert.match(brokerCommandsSrc, /redactForSharing\(JSON\.stringify/);
        assert.match(brokerCommandsSrc, /configureAIBroker[\s\S]{0,300}isTrusted/);
    });
});

describe("Command-palette hygiene (clutter control)", () => {
    const core = [
        "soterai.quickStart", "soterai.checkExtensionHealth", "soterai.openSettings", "soterai.runDemoScan",
        "soterai.scanSelectedText", "soterai.scanCurrentFile", "soterai.scanGitDiff", "soterai.reviewTerminalCommand",
        "soterai.scanMCPAgentTools", "soterai.openAIActivityLedger", "soterai.generateCanaryToken", "soterai.choosePolicyPack",
        "soterai.openWalkthrough", "soterai.scanClipboard",
    ];
    const palette: Array<{ command: string; when?: string }> = pkg.contributes.menus?.commandPalette ?? [];
    const gated = new Map(palette.map((e) => [e.command, e.when]));

    it("core commands are always palette-visible (not gated)", () => {
        for (const c of core) {
            assert.ok(!gated.has(c), `${c} is a core command and must not be gated in commandPalette`);
        }
    });

    it("every non-core declared command is gated behind soterai.advancedCommands (or fully hidden)", () => {
        // Internal, argument-taking commands (e.g. applyFindingFix) are hidden
        // outright with `when: "false"`; advanced user commands are gated behind
        // the context key. Either counts as "not cluttering the default palette".
        const ungated = declaredCommands.filter((c) => {
            if (core.includes(c)) return false;
            const when = gated.get(c);
            return when !== "soterai.advancedCommands" && when !== "false";
        });
        assert.deepStrictEqual(ungated, [], `These commands should be gated: ${ungated.join(", ")}`);
    });

    it("the context key is driven by stable and experimental command visibility settings", () => {
        assert.ok(pkg.contributes.configuration.properties["soterai.showAllCommands"], "showAllCommands setting must exist");
        assert.strictEqual(pkg.contributes.configuration.properties["soterai.showAllCommands"].default, false);
        assert.ok(pkg.contributes.configuration.properties["soterai.experimentalFeatures.enabled"], "experimentalFeatures.enabled setting must exist");
        assert.strictEqual(pkg.contributes.configuration.properties["soterai.experimentalFeatures.enabled"].default, false);
        assert.match(extensionSrc, /setContext",\s*"soterai\.advancedCommands"/);
        assert.match(extensionSrc, /config\.get<boolean>\("showAllCommands"/);
        assert.match(extensionSrc, /get<boolean>\("experimentalFeatures\.enabled"/);
        assert.match(extensionSrc, /affectsConfiguration\("soterai\.experimentalFeatures\.enabled"\)/);
    });
});

describe("Onboarding walkthrough (UX)", () => {
    const walkthroughs = pkg.contributes.walkthroughs ?? [];
    const wt = walkthroughs[0];

    it("contributes a Getting Started walkthrough with 5 steps", () => {
        assert.ok(wt, "a walkthrough must be contributed");
        assert.strictEqual(wt.id, "soterai.gettingStarted");
        assert.strictEqual(wt.steps.length, 5);
    });

    it("every walkthrough step points to an existing markdown media file", () => {
        for (const step of wt.steps) {
            const rel = step.media?.markdown;
            assert.ok(rel, `step ${step.id} must have markdown media`);
            assert.ok(fs.existsSync(path.join(root, rel)), `missing walkthrough media: ${rel}`);
        }
    });

    it("every walkthrough command button targets a declared or built-in command", () => {
        const builtins = new Set(["workbench.view.extension.soterai-explorer"]);
        for (const step of wt.steps) {
            const cmd = /command:([\w.-]+)/.exec(step.description)?.[1];
            assert.ok(cmd, `step ${step.id} must have a command button`);
            assert.ok(declaredCommands.includes(cmd) || builtins.has(cmd), `walkthrough command not declared: ${cmd}`);
        }
    });

    it("declares onWalkthrough activation and a registered openWalkthrough command", () => {
        assert.ok(pkg.activationEvents.includes("onWalkthrough:soterai.gettingStarted"));
        assert.ok(declaredCommands.includes("soterai.openWalkthrough"));
        assert.ok(registeredCommands.has("soterai.openWalkthrough"));
    });

    it("opens the walkthrough only once via a globalState onboarding flag", () => {
        assert.match(extensionSrc, /globalState\.get<boolean>\("soterai\.onboarded"\)/);
        assert.match(extensionSrc, /globalState\.update\("soterai\.onboarded",\s*true\)/);
        assert.match(extensionSrc, /openWalkthrough/);
    });
});

describe("Live inline scanning + Quick Fixes (UX)", () => {
    it("declares soterai.liveScan.enabled defaulting to on and registers the scanner", () => {
        const setting = pkg.contributes.configuration.properties["soterai.liveScan.enabled"];
        assert.ok(setting, "liveScan.enabled setting must exist");
        assert.strictEqual(setting.default, true);
        assert.match(extensionSrc, /registerLiveScanner\(context\)/);
        assert.match(extensionSrc, /onDidSaveTextDocument/);
        assert.match(extensionSrc, /get<boolean>\("liveScan\.enabled",\s*true\)/);
    });

    it("uses a debounced, local-only scan mapped to a DiagnosticCollection", () => {
        assert.match(liveScannerSrc, /createDiagnosticCollection/);
        assert.match(liveScannerSrc, /setTimeout/, "scans must be debounced");
        assert.match(liveScannerSrc, /engine\.scan\(doc\.getText\(\),\s*\{\s*context:\s*"file"\s*\}\)/);
        assert.match(liveScannerSrc, /positionAt\(finding\.start\)/, "findings must map to editor ranges");
    });

    it("skips non-file schemes, oversized files, and excluded globs", () => {
        assert.match(liveScannerSrc, /scheme !== "file"/);
        assert.match(liveScannerSrc, /maxFileSizeKb/);
        assert.match(liveScannerSrc, /excludeGlobs/);
    });

    it("offers redact + copy-safe Quick Fixes and gates the internal fix command", () => {
        assert.match(liveScannerSrc, /registerCodeActionsProvider/);
        assert.match(liveScannerSrc, /CodeActionKind\.QuickFix/);
        assert.match(liveScannerSrc, /kind:\s*"redact"/);
        assert.match(liveScannerSrc, /kind:\s*"copySafeLine"/);
        assert.ok(registeredCommands.has("soterai.applyFindingFix"), "fix command must be registered");
        const palette = pkg.contributes.menus.commandPalette.find((e: any) => e.command === "soterai.applyFindingFix");
        assert.strictEqual(palette?.when, "false", "internal fix command must be hidden from the palette");
    });

    it("redaction never writes raw secrets and disposes its timers", () => {
        assert.match(liveScannerSrc, /«REDACTED:/);
        assert.ok(!/console\.(log|info|warn|error)/.test(liveScannerSrc), "live scanner must not log");
        assert.match(liveScannerSrc, /dispose\(\)/);
        assert.match(liveScannerSrc, /clearTimeout/);
    });
});

describe("Clipboard / paste guard (UX)", () => {
    it("registers scanClipboard (core) and safePaste (advanced) commands", () => {
        for (const c of ["soterai.scanClipboard", "soterai.safePaste"]) {
            assert.ok(declaredCommands.includes(c), `${c} must be declared`);
            assert.ok(registeredCommands.has(c), `${c} must be registered`);
        }
        assert.match(extensionSrc, /registerClipboardGuard\(context\)/);
    });

    it("scans clipboard locally and offers a redacted safe version", () => {
        assert.match(clipboardGuardSrc, /clipboard\.readText\(\)/);
        assert.match(clipboardGuardSrc, /engine\.scan\([^)]*context:\s*"prompt"/);
        assert.match(clipboardGuardSrc, /redactForSharing/);
        assert.match(clipboardGuardSrc, /Replace Clipboard with Safe Version/);
    });

    it("safe paste can insert a redacted version instead of the raw clipboard", () => {
        assert.match(clipboardGuardSrc, /Paste Redacted/);
        assert.match(clipboardGuardSrc, /editor\.action\.clipboardPasteAction/);
    });

    it("never logs the raw clipboard value", () => {
        assert.ok(!/console\.(log|info|warn|error)/.test(clipboardGuardSrc), "clipboard guard must not log");
    });
});

describe("Security search guardrails", () => {
    it("does not use console.log in extension source", () => {
        assert.ok(!/console\.log/.test(allSrc), "extension source must not console.log");
    });

    it("documents every child process boundary as non-shell fixed argv usage", () => {
        assert.match(commandsSrc, /Safe child process boundary/);
        assert.match(read("src/firewall/ContextGatherer.ts"), /Safe child process boundary/);
        assert.match(brokerManagerSrc, /User input never controls the executable or argv/);
    });
});
