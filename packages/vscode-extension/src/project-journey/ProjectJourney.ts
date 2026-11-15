import { inspectSetupReport } from "../setup-verification/SetupVerificationReport";

export const JOURNEY_STEPS = Object.freeze([
    { id: "scan", label: "1. Check saved project files", detail: "Local shared secret policy; incomplete inputs stay unverified." },
    { id: "vault", label: "2. Review secret migration", detail: "Review each change and encrypted recovery in the existing vault workflow.", command: "soterai.reviewWorkspaceHygiene" },
    { id: "context", label: "3. Prepare reviewed AI context", detail: "Preview a prompt or a names-only environment contract before copying.", command: "soterai.chooseReviewedContext" },
    { id: "app", label: "4. Configure a supported app", detail: "Node CommonJS .js/.cjs (prebundle ESM); finite runs up to five minutes. The selected application receives approved values.", command: "soterai.configureVaultApp" },
    { id: "run", label: "5. Run the reviewed app", detail: "Use mocks or a test identity for AI-modifiable code.", command: "soterai.runVaultApp" },
    { id: "tool", label: "6. Connect an AI tool", detail: "Pinned owner-reviewed configuration; configuration alone is not live-route verification." },
    { id: "verify", label: "7. Verify local protection", detail: "Synthetic local checks; independent tool traffic remains unverified.", command: "soterai.verifySetup" },
    { id: "release", label: "8. Review build/artifact exposure", detail: "Review actual generated outputs before deployment.", command: "soterai.reviewArtifacts" },
    { id: "debug", label: "9. Prepare a reviewed debug bundle", detail: "Select a log or stack trace; preview recognized-value redaction before copying.", command: "soterai.prepareDebugContext" },
    { id: "recovery", label: "10. Review recovery before removal", detail: "Existing owner-reviewed recovery; no automatic raw-secret restore.", command: "soterai.restoreChangesBeforeRemoval" },
] as const);
export const JOURNEY_TOOLS = Object.freeze([
    { label: "Cline", command: "soterai.configurePinnedCline" }, { label: "Claude Code", command: "soterai.configurePinnedClaude" },
    { label: "Codex CLI", command: "soterai.configurePinnedCodexCli" }, { label: "Codex IDE", command: "soterai.configurePinnedCodexIde" },
    { label: "Gemini CLI", command: "soterai.configurePinnedGeminiCli" },
]);
export type JourneyStep = typeof JOURNEY_STEPS[number]["id"];
export interface JourneyDependencies {
    binding(): string | undefined;
    execute(command: string): Promise<unknown>;
    scan(): Promise<{ status: "clean" | "findings" | "incomplete"; scannedFiles: number; findings: unknown[] }>;
    chooseTool(): Promise<typeof JOURNEY_TOOLS[number] | undefined>;
}
/** Progress is observational; opening another workflow never grants protection. */
export class ProjectJourney {
    #revision = 0; #pending = false; #disposed = false;
    #observed = new Map<JourneyStep, string>();
    #scanState?: "clean" | "findings" | "incomplete";
    #verificationAt?: number;
    constructor(private readonly deps: JourneyDependencies) {}
    invalidate(): void { this.#revision++; this.#observed.clear(); this.#scanState = undefined; this.#verificationAt = undefined; }
    recommended(): JourneyStep {
        if (!this.#scanState || this.#scanState === "incomplete") return "scan";
        if (this.#scanState === "findings" && !this.#observed.has("vault")) return "vault";
        for (const id of ["context", "tool", "verify"] as const) if (!this.#observed.has(id)) return id;
        if (this.#verificationAt && Date.now() - this.#verificationAt > 300000) return "verify";
        return "release";
    }
    rows(): Array<{ id: JourneyStep; label: string; description: string; detail: string }> {
        const recommended = this.recommended();
        return JOURNEY_STEPS.map(step => ({ id: step.id, label: step.label,
            description: step.id === "verify" && this.#verificationAt && Date.now() - this.#verificationAt > 300000 ? "Checks expired; run again" : this.#observed.get(step.id) ?? "Not verified",
            detail: (step.id === recommended ? "Recommended next. " : "") + step.detail }));
    }
    async run(id: unknown): Promise<{ status: string }> {
        const step = JOURNEY_STEPS.find(item => item.id === id), binding = this.deps.binding(), revision = this.#revision;
        if (!step || !binding || this.#pending || this.#disposed) return { status: "UNAVAILABLE" };
        this.#pending = true;
        const current = () => !this.#disposed && revision === this.#revision && binding === this.deps.binding();
        try {
            if (step.id === "scan") {
                const report = await this.deps.scan(); if (!current()) return { status: "UNAVAILABLE" };
                this.#scanState = report.status;
                this.#observed.set(step.id, report.status === "clean" ? `No detections in ${report.scannedFiles} admitted saved files` : report.status === "findings" ? `${report.findings.length} finding(s); review required` : "Scan incomplete; protection not established");
                return { status: report.status === "incomplete" ? "INCOMPLETE" : "REVIEWED" };
            }
            let command: string;
            if (step.id === "tool") { const tool = await this.deps.chooseTool(); if (!tool) return { status: "CANCELLED" }; if (!current() || !JOURNEY_TOOLS.includes(tool)) return { status: "UNAVAILABLE" }; command = tool.command; }
            else command = step.command;
            const result = await this.deps.execute(command);
            if (!current()) return { status: "UNAVAILABLE" };
            const status = result && typeof result === "object" ? Object.getOwnPropertyDescriptor(result, "status")?.value : undefined;
            if (status === "CANCELLED") return { status };
            if (status === "SELECTION_REQUIRED") return { status };
            if (step.id === "verify") {
                const state = result && typeof result === "object" ? Object.getOwnPropertyDescriptor(result, "report")?.value : undefined;
                const report = state?.state === "CURRENT" ? inspectSetupReport(state.report, state.report?.binding, Date.now()) : undefined;
                if (report?.state === "CURRENT" && report.report) {
                    const checks = report.report.checks, count = (value: string) => checks.filter(check => check.status === value).length;
                    this.#verificationAt = Date.parse(report.report.verifiedAt);
                    this.#observed.set(step.id, `${count("PASS")} local checks passed; ${count("FAIL")} failed; ${count("NOT_TESTED")} untested. Live AI route unverified`);
                    return { status: count("FAIL") || count("NOT_TESTED") ? "INCOMPLETE" : "LOCAL_CHECKS_PASSED" };
                }
            }
            const known = ["APPLIED", "SAVED", "PREPARED", "PREVIEWED", "COPIED", "ANALYZED", "PARTIAL", "OPENED", "RESTORED", "COMPLETE", "RUNNING", "UNCHANGED"].includes(status);
            this.#observed.set(step.id, known ? "Owner workflow returned; review its current result" : "Result unverified; open the owning workflow");
            return { status: known ? "REVIEWED" : "UNVERIFIED" };
        } catch (error) { return { status: error instanceof Error && error.name === "AbortError" ? "CANCELLED" : "INCOMPLETE" }; }
        finally { this.#pending = false; }
    }
    dispose(): void { this.#disposed = true; this.invalidate(); }
}
