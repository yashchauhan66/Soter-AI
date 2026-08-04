/**
 * Gap D — One-click "AI Safety Posture" score + remediation plan.
 *
 * Combines live state from the existing guards into a single 0-100 score and a
 * prioritized, clickable remediation plan. Pure aggregation — no new scanning of
 * raw content, so it never touches secrets. Honest: a high score reflects the
 * state of SoterAI-managed surfaces only and is labelled accordingly.
 */
import * as vscode from "vscode";

export interface PostureItem {
    id: string;
    title: string;
    ok: boolean;
    weight: number;
    fixCommand?: string;
    fixLabel?: string;
    note: string;
}

export interface PostureReport {
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    items: PostureItem[];
    topFix?: PostureItem;
}

export interface PostureDeps {
    brokerRunning: () => boolean;
    safeModeOn: () => boolean;
    liveScanOn: () => boolean;
    protectedCount: () => number;
    sentinelOn: () => boolean;
    mcpStrict: () => boolean;
    privacyLocal: () => boolean;
    trusted: () => boolean;
}

export function computePosture(d: PostureDeps): PostureReport {
    const broker = d.brokerRunning();
    const items: PostureItem[] = [
        {
            id: "privacy",
            title: "Local-first privacy mode",
            ok: d.privacyLocal(),
            weight: 20,
            fixCommand: "soterai.configurePrivacyMode",
            fixLabel: "Set local mode",
            note: d.privacyLocal() ? "Nothing leaves your machine by default." : "Cloud/hybrid mode sends redacted checks off-device.",
        },
        {
            id: "liveScan",
            title: "Live inline secret/injection scan",
            ok: d.liveScanOn(),
            weight: 20,
            fixCommand: "soterai.enableFullProtection",
            fixLabel: "Enable protection",
            note: d.liveScanOn() ? "Files scanned as you type/save (severity findings)." : "No automatic on-save scanning.",
        },
        {
            id: "broker",
            title: "Local AI Broker (enforced path)",
            ok: broker,
            weight: 20,
            fixCommand: "soterai.setupBrokerIntegration",
            fixLabel: "Set up broker",
            note: broker ? "Routed AI traffic is request/response scanned." : "Un-brokered AI traffic is advisory-only.",
        },
        {
            id: "safeMode",
            title: "AI Safe Mode overlay",
            ok: d.safeModeOn(),
            weight: 15,
            fixCommand: "soterai.enableAISafeMode",
            fixLabel: "Enable Safe Mode",
            note: d.safeModeOn() ? "Policy overlay applied to brokered flows." : "No brokered policy overlay.",
        },
        {
            id: "protected",
            title: "Protected files",
            ok: d.protectedCount() > 0,
            weight: 10,
            fixCommand: "soterai.addToProtectedFiles",
            fixLabel: "Protect a file",
            note: d.protectedCount() > 0 ? `${d.protectedCount()} file(s) excluded from AI context bundles.` : "No files excluded from AI context.",
        },
        {
            id: "sentinel",
            title: "AI activity monitoring",
            ok: d.sentinelOn(),
            weight: 8,
            fixCommand: "soterai.enableAISentinel",
            fixLabel: "Enable sentinel",
            note: d.sentinelOn() ? "Redacted AI activity timeline recorded." : "AI activity is not being recorded.",
        },
        {
            id: "mcp",
            title: "MCP strict firewall",
            ok: d.mcpStrict(),
            weight: 7,
            fixCommand: "soterai.scanMCPAgentTools",
            fixLabel: "Review MCP",
            note: d.mcpStrict() ? "MCP tool configs strictly scanned." : "MCP configs use standard checks.",
        },
    ];
    const total = items.reduce((a, i) => a + i.weight, 0);
    const got = items.reduce((a, i) => a + (i.ok ? i.weight : 0), 0);
    const score = Math.round((got / total) * 100);
    const grade: PostureReport["grade"] = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
    const topFix = items.find((i) => !i.ok && i.weight >= 15) ?? items.find((i) => !i.ok);
    return { score, grade, items, topFix };
}

export function postureSummary(r: PostureReport): string {
    const lines = [
        `SoterAI AI Safety Posture: ${r.score}/100 (Grade ${r.grade})`,
        `Scope: SoterAI-managed surfaces only (brokered AI traffic, scans, policies). Not network/OS enforcement.`,
        "",
        ...r.items.map((i) => `${i.ok ? "[OK]" : "[--]"} ${i.title} — ${i.note}`),
    ];
    if (r.topFix) lines.push("", `Top recommended fix: ${r.topFix.title} (${r.topFix.fixLabel ?? ""})`);
    return lines.join("\n");
}
