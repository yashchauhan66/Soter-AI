/** F07: actual packaged registered-command path, synthetic in-process cases.
 * No network or requester identity proof. Same-lineage independence LOW.
 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const FLAG = "lite.secretMatching", COMMAND = "soterai.testProtection";
const MARKER = ".synthetic-lite-f07-host";
const CASES = ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10"] as const;
const SCOPES: Record<typeof CASES[number], string> = {
    M01: "Public response remains usable through the real singleton capability/output filter.",
    M02: "Registered raw value is withheld from the returned response.",
    M03: "Registered standard base64 reflection is redacted.",
    M04: "Registered base64url reflection is redacted.",
    M05: "Registered hex reflection is redacted.",
    M06: "Registered URL representation is redacted.",
    M07: "Registered JSON representation is redacted.",
    M08: "Request-local split JSON leaves are recognized.",
    M09: "Short registered value embedded in ordinary prose follows the frozen negative control.",
    M10: "Budget withdrawal provides no response body after the synthetic transport ran.",
};
interface CaseResult { id: typeof CASES[number]; pass: boolean }
interface MatchingReport { pass: boolean; matching: { status: "PASS" | "FAIL" | "WITHHELD"; cases: CaseResult[] } }
interface Observation { id: string; scope: string; status: "NOT_RUN" | "PASS" | "FAIL"; diagnostic?: string }
const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const within = (root: string, target: string): boolean => {
    const part = relative(resolve(root), resolve(target));
    return part === "" || !part.startsWith("..") && !isAbsolute(part);
};
function record(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
    assert.ok(value && typeof value === "object" && !Array.isArray(value));
    assert.ok([Object.prototype, null].includes(Object.getPrototypeOf(value)));
    assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}
/** Rebuild value-free metadata. Never serialize a rejected command response. */
function report(value: unknown): MatchingReport {
    record(value, ["pass", "matching"]); assert.equal(typeof value.pass, "boolean");
    record(value.matching, ["status", "cases"]);
    assert.ok(["PASS", "FAIL", "WITHHELD"].includes(value.matching.status as string));
    assert.ok(Array.isArray(value.matching.cases) && value.matching.cases.length <= CASES.length);
    const seen = new Set<string>();
    const cases = value.matching.cases.map(candidate => {
        record(candidate, ["id", "pass"]);
        assert.ok(CASES.includes(candidate.id as typeof CASES[number])); assert.equal(typeof candidate.pass, "boolean");
        const id = candidate.id as typeof CASES[number]; assert.ok(!seen.has(id)); seen.add(id);
        return { id, pass: candidate.pass as boolean };
    });
    const safe: MatchingReport = { pass: value.pass as boolean,
        matching: { status: value.matching.status as MatchingReport["matching"]["status"], cases } };
    assert.ok(Buffer.byteLength(JSON.stringify(safe), "utf8") <= 4096);
    return safe;
}
async function waitUntil(predicate: () => boolean | PromiseLike<boolean>, label: string): Promise<void> {
    const deadline = performance.now() + 15000;
    while (performance.now() < deadline) {
        if (await predicate()) return;
        await new Promise<void>(done => setTimeout(done, 50));
    }
    throw new Error(label);
}

/** Launcher supplies the very context passed to actual.activate(context). */
export async function run(context: vscode.ExtensionContext): Promise<void> {
    const output = process.env.SOTERAI_LITE_F07_EVIDENCE, profile = process.env.SOTERAI_LITE_F07_PROFILE;
    if (!output || !profile || !isAbsolute(output) || !isAbsolute(profile)) throw new Error("F07 requires isolated absolute paths.");
    const observations: Observation[] = [
        { id: "F07-H00", scope: "Actual packaged runtime activates and registers the production test command.", status: "NOT_RUN" },
        ...CASES.map(id => ({ id: `F07-${id}`, scope: SCOPES[id], status: "NOT_RUN" as const })),
        { id: "F07-H11", scope: "Machine flag withdrawal makes the production seam WITHHELD with pass=false and safe metadata only.", status: "NOT_RUN" },
        { id: "F07-H12", scope: "Re-enabling the machine flag restores all ten real singleton cases in a fresh invocation.", status: "NOT_RUN" },
    ];
    const reports: Array<{ phase: "enabled" | "withdrawn" | "reenabled"; result: MatchingReport }> = [];
    let runtime = "", bundle = "", root = "", driverFailure: string | undefined;
    let oldFlag: boolean | undefined, restoreFlag = false;
    const check = async (id: string, action: () => Promise<void>): Promise<void> => {
        const row = observations.find(item => item.id === id)!;
        try { await action(); row.status = "PASS"; }
        catch (error) { row.status = "FAIL"; row.diagnostic = `${error instanceof Error ? error.name : "UnknownFailure"} in ${id}`; }
        console.log(`LITE_SECRET_MATCHING_HOST ${id} ${row.status}`);
    };
    const setFlag = async (enabled: boolean): Promise<void> => {
        await vscode.workspace.getConfiguration("soterai").update(FLAG, enabled, vscode.ConfigurationTarget.Global);
        await waitUntil(() => vscode.workspace.getConfiguration("soterai").inspect<boolean>(FLAG)?.globalValue === enabled,
            "Isolated machine flag did not settle.");
    };
    try {
        assert.equal(process.env.SOTERAI_LITE_F07_DRIVER_KIND, "native-bootstrap");
        assert.equal(resolve(process.env.USERPROFILE ?? ""), resolve(profile));
        assert.match(resolve(profile), /^D:\\SoterAI-Lite-test-profiles\\/i);
        assert.ok(within(dirname(profile), output)); assert.equal(context.extensionMode, vscode.ExtensionMode.Development);
        assert.equal(vscode.workspace.workspaceFolders?.length, 1); assert.ok(vscode.workspace.isTrusted);
        const folder = vscode.workspace.workspaceFolders![0]; assert.equal(folder.uri.scheme, "file"); root = folder.uri.fsPath;
        assert.ok(within(dirname(profile), root));
        assert.equal(await readFile(join(root, MARKER), "utf8"), "synthetic-only-v1");
        assert.ok(within(profile, context.globalStorageUri.with({ scheme: "file" }).fsPath));
        const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard"); assert.ok(extension);
        bundle = join(extension.extensionPath, "dist", "extension.js"); runtime = sha(await readFile(bundle));
        assert.equal(runtime, process.env.SOTERAI_LITE_F07_BUNDLE_SHA256);
        await check("F07-H00", async () => {
            await waitUntil(() => extension.isActive, "Actual packaged extension did not activate.");
            await waitUntil(async () => (await vscode.commands.getCommands(true)).includes(COMMAND), "Production command did not register.");
        });
        assert.equal(observations.find(item => item.id === "F07-H00")?.status, "PASS");
        oldFlag = vscode.workspace.getConfiguration("soterai").inspect<boolean>(FLAG)?.globalValue; restoreFlag = true;
        await setFlag(true);
        const first = report(await vscode.commands.executeCommand<unknown>(COMMAND)); reports.push({ phase: "enabled", result: first });
        for (const id of CASES) await check(`F07-${id}`, async () => {
            assert.equal(first.pass, true); assert.equal(first.matching.status, "PASS");
            assert.equal(first.matching.cases.length, CASES.length);
            assert.equal(first.matching.cases.find(item => item.id === id)?.pass, true);
        });
        await check("F07-H11", async () => {
            await setFlag(false); const withdrawn = report(await vscode.commands.executeCommand<unknown>(COMMAND));
            reports.push({ phase: "withdrawn", result: withdrawn });
            assert.equal(withdrawn.pass, false); assert.equal(withdrawn.matching.status, "WITHHELD");
        });
        await check("F07-H12", async () => {
            await setFlag(true); const fresh = report(await vscode.commands.executeCommand<unknown>(COMMAND));
            reports.push({ phase: "reenabled", result: fresh }); assert.equal(fresh.pass, true);
            assert.equal(fresh.matching.status, "PASS"); assert.equal(fresh.matching.cases.length, CASES.length);
            for (const id of CASES) assert.equal(fresh.matching.cases.find(item => item.id === id)?.pass, true);
        });
    } catch (error) { driverFailure = error instanceof Error ? error.name : "UnknownFailure"; }
    finally {
        if (restoreFlag) {
            try { await vscode.workspace.getConfiguration("soterai").update(FLAG, oldFlag, vscode.ConfigurationTarget.Global); }
            catch { driverFailure = "IsolatedFlagRestoreFailure"; }
        }
    }
    const currentRuntime = bundle ? sha(await readFile(bundle)) : "";
    if (currentRuntime !== runtime) driverFailure = "RuntimeIdentityChanged";
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), phase: "single", syntheticOnly: true,
        workspace: root, declaredProfilePath: resolve(profile), hostVersion: vscode.version, extensionMode: "Development",
        extensionBundleSha256: runtime, currentDeveloperBundleSha256: currentRuntime, hostProbeSha256: sha(await readFile(__filename)),
        observations, reports, passed: observations.filter(item => item.status === "PASS").length,
        failed: observations.filter(item => item.status === "FAIL").length, notRun: observations.filter(item => item.status === "NOT_RUN").length,
        ...(driverFailure ? { driverFailure } : {}),
        identityScope: "Byte-identical packaged runtime invoked through the actual registered command in a normal isolated developer window; no clean-profile installed-VSIX claim.",
        interactionScope: "Production synthetic in-process transports and value-free returned case metadata; no network, external agent, streaming or gateway-routing proof.",
        commandScope: "Ten matching cases plus registration and flag withdrawal/re-enable checks; all case oracles originate from the production synthetic self-test.",
        independence: "LOW", ownerPresence: "SYNTHETIC_SELF_TEST_NO_OWNER_APPROVAL_ASSERTION" };
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || result.notRun || driverFailure) throw new Error("F07 native fixture incomplete or failed; inspect safe observations.");
}
