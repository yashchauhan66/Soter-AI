import {setupCoverage,type SetupReportState} from "../setup-verification/SetupVerificationReport";
/** Presentation only: saved policy and existing reviewed commands remain authoritative. */
export interface CenterRow { readonly label: string; readonly description?: string; readonly icon: string; readonly action?: string }
export interface CenterFacts {
    enabled: boolean; trusted: boolean; workspaceCount: number; unavailable: boolean;
    restrictions: ReadonlyArray<{ project: string; kind: string; pattern: string; sensitive?: boolean }>;
    activity: ReadonlyArray<unknown>; activityEnabled: boolean; broker: string;
    evidence: { state: string; generatedAt?: string; surfaces: ReadonlyArray<{ id: string; status: string }>; fullClaim: string };
    setupEnabled?:boolean;setupReport?:SetupReportState;
}
export type CenterSection = "protected" | "activity" | "coverage";
export type CenterRows = Record<CenterSection, ReadonlyArray<CenterRow>>;
export type CenterTranslator = (message: string, ...args: Array<string | number>) => string;
export const centerEnglish: CenterTranslator = (message, ...args) => message.replace(/\{(\d+)\}/g, (all, n: string) => String(args[Number(n)] ?? all));
export const CENTER_ACTIONS: Readonly<Record<string, string>> = Object.freeze({
    privacy: "soterai.openProjectPrivacy", verify:"soterai.verifySetup", restrict: "soterai.restrictProjectFile", sensitive: "soterai.restrictSensitiveFile",
    manage: "soterai.manageAIRules", review: "soterai.reviewSafeFileAccess", revoke: "soterai.revokeProjectReads",
    activity: "soterai.showAITimeline", exportActivity: "soterai.exportAIActivityReport",
    vault: "soterai.migrateSecretsToVault", restoreVault: "soterai.restoreSecretPlaceholders",
    ps51: "soterai.configureCheckedPowerShell", restorePs51: "soterai.restoreCheckedPowerShell",
    cmd: "soterai.configureCheckedCmd", restoreCmd: "soterai.restoreCheckedCmd",
    gitbash: "soterai.configureCheckedGitBash", restoreGitBash: "soterai.restoreCheckedGitBash",
    history: "soterai.installPSReadLineHistoryGuard", restoreHistory: "soterai.restorePSReadLineHistoryGuard",
    cline: "soterai.configurePinnedCline", restoreCline: "soterai.restorePinnedCline",
    claude: "soterai.configurePinnedClaude", restoreClaude: "soterai.restorePinnedClaude",
    codexIde: "soterai.configurePinnedCodexIde", restoreCodexIde: "soterai.restorePinnedCodexIde",
    codexCli: "soterai.configurePinnedCodexCli", restoreCodexCli: "soterai.restorePinnedCodexCli",
    gemini: "soterai.configurePinnedGeminiCli", restoreGemini: "soterai.restorePinnedGeminiCli",
});
export function centerActionCommand(action: unknown): string | undefined {
    return typeof action === "string" && Object.prototype.hasOwnProperty.call(CENTER_ACTIONS, action) ? CENTER_ACTIONS[action] : undefined;
}
export function centerLabel(value: unknown): string {
    return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
        .replace(/\$\(/g, "＄(").slice(0, 256) : "";
}
function field(value: unknown, key: string): unknown {
    try { if (!value || typeof value !== "object") return undefined; const d = Object.getOwnPropertyDescriptor(value, key); return d && "value" in d ? d.value : undefined; }
    catch { return undefined; }
}
const TYPES = new Set(["file_change", "protected_access", "mcp_config_change", "repo_instruction_change", "canary_hit", "extension_change", "config_change", "terminal_command"]);
const RISKS = new Set(["low", "medium", "high", "critical"]);
const DECISIONS = new Set(["allow", "warn", "block", "monitor", "detected_after_start", "unknown", "ALLOW", "WARN", "BLOCK"]);
const SURFACES = ["managed-reader", "public-workspace", "cline-tools", "ordinary-terminal", "buffers-clipboard", "independent-network", "os-isolation", "trusted-runtime"];
const EVIDENCE_STATES = new Set(["MATCHED", "MISSING", "INVALID", "MISMATCH", "UNAVAILABLE", "DISABLED"]);

/** Every user-visible message is passed through the same translation boundary.
 * Native trees supply theme, focus, keyboard navigation and reduced-motion behavior. */
export function protectionCenterRows(facts: CenterFacts, now = Date.now(), t: CenterTranslator = centerEnglish): CenterRows {
    const row = (label: string, icon = "info", action?: string, description?: string): CenterRow => Object.freeze({ label: t(label), icon, ...(action ? { action } : {}), ...(description ? { description: t(description) } : {}) });
    if (!facts.enabled) {
        const disabled = Object.freeze([row("Protection Center disabled. Saved protection is retained.")]);
        return { protected: disabled, activity: disabled, coverage: disabled };
    }
    const p: CenterRow[] = [], a: CenterRow[] = [], c: CenterRow[] = [];
    if (!facts.trusted) p.push(row("Trust this workspace to review saved protection.", "workspace-untrusted"));
    else if (!facts.workspaceCount) p.push(row("Open a local workspace to review protected items.", "folder-opened"));
    else if (facts.unavailable) p.push(row("Saved restrictions unavailable. Refresh after checking policy storage.", "warning"));
    else {
        p.push(row("Saved explicit restrictions", "lock", undefined, "Default and team denies may protect additional paths."));
        for (const item of facts.restrictions.slice(0, 256)) {
            if (!["file", "folder", "glob", "region"].includes(item.kind)) continue;
            p.push(row(t("{0} / {1}: {2}", centerLabel(item.project), item.kind, centerLabel(item.pattern)), "lock", "manage",
                item.sensitive || item.kind === "region" ? "Values stay masked; changes require owner review." : "Saved deny; changes require owner review."));
        }
        if (!facts.restrictions.length) p.push(row("No saved explicit restrictions. Default denies still apply."));
        if (facts.restrictions.length > 256) p.push(row("More saved restrictions are available in policy review.", "ellipsis", "manage"));
        p.push(row("Choose a file to protect…", "lock", "restrict"), row("Choose a file to mark sensitive…", "shield", "sensitive"),
            row("Review one safe file read…", "eye", "review"), row("Review saved rules and deliberate changes…", "settings-gear", "manage"));
    }
    p.push(row("Revoke managed reads and clear previews", "close", "revoke"), row("Project privacy and recovery…", "notebook", "privacy"));
    if (!facts.activityEnabled || !facts.trusted) a.push(row("Owned activity disabled or unavailable. No events displayed."));
    else {
        for (const event of facts.activity.slice(-100).reverse()) {
            const type = field(event, "type"), risk = field(event, "risk"), decision = field(event, "decision"), stamp = field(event, "timestamp");
            if (typeof type !== "string" || !TYPES.has(type)) continue;
            const severity = typeof risk === "string" && RISKS.has(risk) ? risk : "unknown";
            const outcome = typeof decision === "string" && DECISIONS.has(decision) ? decision : "unknown";
            const time = typeof stamp === "number" && Number.isFinite(stamp) && stamp >= 0 && stamp <= 8640000000000000 ? new Date(stamp).toISOString() : t("Time unavailable");
            a.push(row(t("{0}: {1} / {2}", type, severity, outcome), severity === "high" || severity === "critical" ? "warning" : "history", undefined, time));
        }
        if (!a.length) a.push(row("No owned activity recorded. This does not prove no exposure."));
        a.push(row("Review activity timeline…", "history", "activity"), row("Export metadata-only activity…", "export", "exportActivity"));
    }
    const state = EVIDENCE_STATES.has(facts.evidence.state) ? facts.evidence.state : "INVALID";
    const stamp = typeof facts.evidence.generatedAt === "string" ? Date.parse(facts.evidence.generatedAt) : NaN;
    const fresh = Number.isFinite(now) && Number.isFinite(stamp) && now >= stamp && now - stamp <= 24 * 60 * 60 * 1000;
    const current = state === "MATCHED" && fresh;
    c.push(row(t("Packaged evidence: {0}", state === "MATCHED" && !fresh ? "STALE" : state), current ? "info" : "warning"),
        row("Live verification: NOT_TESTED. Use verified results, never enabled settings."),
        row("Uncovered: unmanaged native reads, other extensions and independent uploads.", "warning"));
    if(facts.setupEnabled){
        c.push(row("Verify my setup","beaker","verify"));
        const result=facts.setupReport;
        c.push(row(t("Synthetic checks: {0}",result?.state??"MISSING"),result?.state==="CURRENT"?"info":"warning"));
        if(result?.report){
            c.push(row(t("Last synthetic check: {0}",result.report.verifiedAt)));
            for(const check of result.report.checks)c.push(row(t("{0}: {1} ({2}/{3})",check.id,result.state==="CURRENT"?check.status:"NOT_TESTED",result.state==="CURRENT"?check.passed:0,check.total),check.status==="FAIL"?"warning":"info",undefined,"Synthetic owned component only; live tool routes remain NOT_TESTED."));
        }
        for(const surface of setupCoverage(result??{state:"MISSING"}).surfaces)c.push(row(t("Live {0}: {1}",surface.id,surface.status),"info",undefined,"Local synthetic component checks do not establish this live surface or a tool route."));
    }
    if (current) {
        c.push(row(t("Report time: {0}", new Date(stamp).toISOString())));
        for (const id of SURFACES) {
            const surface = facts.evidence.surfaces.find(item => item.id === id);
            const safePass = ["managed-reader", "public-workspace"].includes(id) && surface?.status === "PASS";
            const status = safePass ? "Reported PASS" : ["FAIL", "INCOMPLETE"].includes(surface?.status ?? "") ? surface!.status : "NOT_TESTED";
            c.push(row(t("{0}: {1}", id, status), status === "FAIL" || status === "INCOMPLETE" ? "warning" : "info"));
        }
    }
    const broker = ["healthy", "offline", "starting", "incompatible", "error"].includes(facts.broker) ? facts.broker : "unavailable";
    c.push(row(t("Local broker: {0} (operational state only)", broker), broker === "healthy" ? "info" : "warning"));
    for (const name of ["Cline", "Claude Code", "Codex IDE", "Codex CLI", "Gemini CLI"]) c.push(row(t("{0}: Uncovered — live route not verified here.", name), "question"));
    c.push(row("Review optional setup and restore…", "settings-gear", "workflows"), row("Coverage details and limitations…", "info", "privacy"));
    return { protected: Object.freeze(p), activity: Object.freeze(a), coverage: Object.freeze(c) };
}

export const CENTER_WORKFLOWS: ReadonlyArray<Readonly<{ label: string; apply: string; restore: string }>> = Object.freeze([
    { label: "Vault migration", apply: "vault", restore: "restoreVault" },
    { label: "PowerShell 5.1 checked terminal", apply: "ps51", restore: "restorePs51" },
    { label: "cmd checked terminal", apply: "cmd", restore: "restoreCmd" },
    { label: "Git Bash checked terminal", apply: "gitbash", restore: "restoreGitBash" },
    { label: "PSReadLine history exclusion", apply: "history", restore: "restoreHistory" },
    { label: "Pinned Cline", apply: "cline", restore: "restoreCline" },
    { label: "Pinned Claude Code", apply: "claude", restore: "restoreClaude" },
    { label: "Pinned Codex IDE", apply: "codexIde", restore: "restoreCodexIde" },
    { label: "Pinned Codex CLI", apply: "codexCli", restore: "restoreCodexCli" },
    { label: "Pinned Gemini CLI", apply: "gemini", restore: "restoreGemini" },
].map(item => Object.freeze(item)));
