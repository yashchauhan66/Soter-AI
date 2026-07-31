import { rename, writeFile } from "node:fs/promises";
import * as vscode from "vscode";
import { redactForSharing } from "@soterai/guard-core";
import type { BrokerManager } from "./broker/BrokerManager";
import type { ProtectionController } from "./protection/ProtectionController";

interface ProbeCheck {
    name: string;
    passed: boolean;
    detail: string;
}

/**
 * Test-only packaged-runtime proof. It is dormant unless the editor host is
 * launched with SOTERAI_PACKAGED_RUNTIME_PROBE pointing at an evidence file.
 */
export async function runPackagedRuntimeProbe(
    manager: BrokerManager,
    controller: ProtectionController,
): Promise<void> {
    const reportPath = process.env.SOTERAI_PACKAGED_RUNTIME_PROBE;
    if (!reportPath) return;
    const checks: ProbeCheck[] = [];
    // `activate()` returns void; allow the extension host to finish marking the
    // extension active before inspecting its public runtime state.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const check = async (name: string, operation: () => Promise<string>): Promise<void> => {
        // A hung check would otherwise produce no evidence at all, which is
        // indistinguishable from "the extension never activated". Time-box each
        // one so a stall is recorded as a FAIL with a name attached.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const budget = Number(process.env.SOTERAI_PROBE_CHECK_TIMEOUT_MS ?? "") || 30_000;
        try {
            const detail = await Promise.race([
                operation(),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`timed out after ${budget}ms`)), budget);
                }),
            ]);
            checks.push({ name, passed: true, detail });
        } catch (error) {
            checks.push({
                name,
                passed: false,
                detail: error instanceof Error ? error.stack ?? error.message : String(error),
            });
        } finally {
            if (timer) clearTimeout(timer);
        }
    };

    await check("packaged extension activation", async () => {
        const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
        if (!extension?.isActive) throw new Error("Packaged extension is not active");
        return `${extension.packageJSON.version} active in ${vscode.env.appName}`;
    });
    await check("broker startup", async () => {
        const status = await manager.start();
        if (!status.running || status.state !== "healthy") throw new Error(`broker state=${status.state}`);
        return `healthy version=${status.version}`;
    });
    await check("policy load", async () => {
        await manager.request("/v1/safe-mode/enable", { method: "POST", body: JSON.stringify({ level: "strict" }) });
        const safeMode = await manager.request<{ enabled: boolean; level: string }>("/v1/safe-mode/status");
        if (!safeMode.enabled || safeMode.level !== "strict") throw new Error("broker did not load strict Safe Mode policy");
        return "broker policy=strict";
    });
    await check("secret and context protection", async () => {
        const secret = "OPENAI_API_KEY=sk-proj-runtime-probe-1234567890abcdefghijkl";
        const redacted = redactForSharing(secret);
        if (redacted.includes("sk-proj-runtime-probe")) throw new Error("guard-core context redaction leaked secret");
        const broker = await manager.request<{ decision: string; redacted?: boolean }>(
            "/v1/scan",
            { method: "POST", body: JSON.stringify({ content: secret }) },
        );
        if (broker.decision === "allow" && !broker.redacted) throw new Error("broker did not protect secret");
        return `guard-core redacted; broker decision=${broker.decision}`;
    });
    await check("controlled terminal", async () => {
        const preview = await manager.request<{ action: string; coverageLevel: string }>(
            "/v1/terminal/preview",
            { method: "POST", body: JSON.stringify({ command: "git status --short" }) },
        );
        if (preview.action !== "ALLOW") throw new Error(`preview action=${preview.action}`);
        const executed = await manager.request<{ result: { exitCode: number }; analysis: { action: string } }>(
            "/v1/terminal/execute",
            { method: "POST", body: JSON.stringify({ command: "git status --short" }) },
            35_000,
        );
        if (executed.analysis.action !== "ALLOW") {
            throw new Error(`execution action=${executed.analysis.action} exit=${executed.result.exitCode}`);
        }
        return `ALLOW executed with exit=${executed.result.exitCode}; coverage=${preview.coverageLevel}`;
    });
    await check("MCP routing", async () => {
        const result = await manager.request<{ action: string; coverageLevel?: string }>(
            "/v1/preflight/mcp-tool",
            {
                method: "POST",
                body: JSON.stringify({
                    mcpConfig: { servers: [{ name: "runtime-probe", permissions: [] }] },
                    serverName: "runtime-probe",
                    toolName: "health",
                    args: {},
                    allowedPermissions: [],
                    taintedSources: [],
                }),
            },
        );
        if (!result.action) throw new Error("MCP preflight returned no action");
        return `broker preflight action=${result.action} coverage=${result.coverageLevel ?? "declared by decision"}`;
    });
    await check("lockdown and recovery", async () => {
        await controller.engageLockdown("packaged runtime probe");
        let blocked = false;
        try {
            await manager.start();
        } catch {
            blocked = true;
        }
        if (!blocked) throw new Error("broker start was not blocked during lockdown");
        await controller.unlock();
        const recovered = await manager.start();
        if (!recovered.running || recovered.state !== "healthy") throw new Error("broker did not recover after unlock");
        return "lockdown blocked startup; unlock restored healthy broker";
    });

    // Shutdown is best-effort: a broker that refuses to stop must not swallow the
    // evidence for the seven checks that already ran.
    await Promise.race([
        manager.stop().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);
    const mem = process.memoryUsage();
    const report = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        performance: {
            activationMs: Number(process.env.SOTERAI_ACTIVATION_MS ?? "") || null,
            rssMiB: Number((mem.rss / 1024 / 1024).toFixed(2)),
            heapUsedMiB: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
            heapTotalMiB: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
            externalMiB: Number((mem.external / 1024 / 1024).toFixed(2)),
        },
        editor: {

            appName: vscode.env.appName,
            appHost: vscode.env.appHost,
            language: vscode.env.language,
            remoteName: vscode.env.remoteName ?? null,
        },
        extension: "soterai.soterai-ide-guard",
        // Version travels with the evidence so a stale report cannot silently
        // qualify a newer VSIX in the publish preflight.
        version: vscode.extensions.getExtension("soterai.soterai-ide-guard")?.packageJSON?.version ?? null,
        packagedExecution: true,
        result: checks.every((item) => item.passed) ? "PASS" : "FAIL",
        checks,
    };
    // Write-then-rename: if the host is killed mid-write, the reader sees no
    // evidence rather than a truncated file that parses as success.
    const staging = `${reportPath}.partial`;
    await writeFile(staging, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await rename(staging, reportPath);
    await vscode.commands.executeCommand("workbench.action.quit");
}
