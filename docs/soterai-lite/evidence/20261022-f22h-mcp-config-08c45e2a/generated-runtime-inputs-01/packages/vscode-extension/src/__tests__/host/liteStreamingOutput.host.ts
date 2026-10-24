/** F08: actual packaged registered-command path, synthetic in-process cases.
 * No network or requester identity proof. Same-lineage independence LOW.
 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const FLAG = "lite.outputRedactor", COMMAND = "soterai.testProtection";
const MARKER = ".synthetic-lite-f08-host";
const CASES = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"] as const;
const SCOPES: Record<typeof CASES[number], string> = {
    S01: "Public stdout and stderr remain usable after completed stream filtering.",
    S02: "A raw registered value split over chunks is redacted.",
    S03: "A registered encoded value split over chunks is redacted.",
    S04: "UTF-8 scalar bytes split across chunks remain recognized.",
    S05: "ANSI SGR insertion and split sequences are removed before matching.",
    S06: "OSC payloads never reach the released plain-text output.",
    S07: "Nonzero process exit retains sanitized public output and status.",
    S08: "Incomplete final UTF-8 withholds all output; incomplete controls have separate unit coverage.",
    S09: "Oversized combined output is withheld without a raw fallback.",
    S10: "Fresh sequential operations retain separate private states; interleaved instances have separate unit coverage.",
};
interface CaseResult { id: typeof CASES[number]; pass: boolean }
interface OutputReport { pass: boolean; output: { status: "PASS" | "FAIL" | "WITHHELD"; cases: CaseResult[] } }
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
function report(value: unknown): OutputReport {
    record(value, ["pass", "matching", "output"]); assert.equal(typeof value.pass, "boolean");
    record(value.matching, ["status", "cases"]);
    assert.ok(["PASS", "FAIL", "WITHHELD"].includes(value.matching.status as string));
    assert.ok(Array.isArray(value.matching.cases) && value.matching.cases.length <= 10);
    for (const retained of value.matching.cases) { record(retained, ["id", "pass"]); assert.match(retained.id as string, /^M(?:0[1-9]|10)$/); assert.equal(typeof retained.pass, "boolean"); }
    if (value.pass === true) { assert.equal(value.matching.status, "PASS"); assert.equal(value.matching.cases.length, 10); assert.ok(value.matching.cases.every(item => item.pass === true)); }
    record(value.output, ["status", "cases"]);
    assert.ok(["PASS", "FAIL", "WITHHELD"].includes(value.output.status as string));
    assert.ok(Array.isArray(value.output.cases) && value.output.cases.length <= CASES.length);
    const seen = new Set<string>();
    const cases = value.output.cases.map(candidate => {
        record(candidate, ["id", "pass"]);
        assert.ok(CASES.includes(candidate.id as typeof CASES[number])); assert.equal(typeof candidate.pass, "boolean");
        const id = candidate.id as typeof CASES[number]; assert.ok(!seen.has(id)); seen.add(id);
        return { id, pass: candidate.pass as boolean };
    });
    const safe: OutputReport = { pass: value.pass as boolean,
        output: { status: value.output.status as OutputReport["output"]["status"], cases } };
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
    const output = process.env.SOTERAI_LITE_F08_EVIDENCE, profile = process.env.SOTERAI_LITE_F08_PROFILE;
    if (!output || !profile || !isAbsolute(output) || !isAbsolute(profile)) throw new Error("F08 requires isolated absolute paths.");
    const observations: Observation[] = [
        { id: "F08-H00", scope: "Actual packaged runtime activates and registers the production test command.", status: "NOT_RUN" },
        ...CASES.map(id => ({ id: `F08-${id}`, scope: SCOPES[id], status: "NOT_RUN" as const })),
        { id: "F08-H11", scope: "Machine flag withdrawal makes the production seam WITHHELD with pass=false and safe metadata only.", status: "NOT_RUN" },
        { id: "F08-H12", scope: "Re-enabling the machine flag restores all ten real singleton cases in a fresh invocation.", status: "NOT_RUN" },
    ];
    const reports: Array<{ phase: "enabled" | "withdrawn" | "reenabled"; result: OutputReport }> = [];
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
        assert.equal(process.env.SOTERAI_LITE_F08_DRIVER_KIND, "native-bootstrap");
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
        assert.equal(runtime, process.env.SOTERAI_LITE_F08_BUNDLE_SHA256);
        await check("F08-H00", async () => {
            await waitUntil(() => extension.isActive, "Actual packaged extension did not activate.");
            await waitUntil(async () => (await vscode.commands.getCommands(true)).includes(COMMAND), "Production command did not register.");
        });
        assert.equal(observations.find(item => item.id === "F08-H00")?.status, "PASS");
        oldFlag = vscode.workspace.getConfiguration("soterai").inspect<boolean>(FLAG)?.globalValue; restoreFlag = true;
        await setFlag(true);
        const first = report(await vscode.commands.executeCommand<unknown>(COMMAND)); reports.push({ phase: "enabled", result: first });
        for (const id of CASES) await check(`F08-${id}`, async () => {
            assert.equal(first.pass, true); assert.equal(first.output.status, "PASS");
            assert.equal(first.output.cases.length, CASES.length);
            assert.equal(first.output.cases.find(item => item.id === id)?.pass, true);
        });
        await check("F08-H11", async () => {
            await setFlag(false); const withdrawn = report(await vscode.commands.executeCommand<unknown>(COMMAND));
            reports.push({ phase: "withdrawn", result: withdrawn });
            assert.equal(withdrawn.pass, false); assert.equal(withdrawn.output.status, "WITHHELD");
        });
        await check("F08-H12", async () => {
            await setFlag(true); const fresh = report(await vscode.commands.executeCommand<unknown>(COMMAND));
            reports.push({ phase: "reenabled", result: fresh }); assert.equal(fresh.pass, true);
            assert.equal(fresh.output.status, "PASS"); assert.equal(fresh.output.cases.length, CASES.length);
            for (const id of CASES) assert.equal(fresh.output.cases.find(item => item.id === id)?.pass, true);
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
    if (result.failed || result.notRun || driverFailure) throw new Error("F08 native fixture incomplete or failed; inspect safe observations.");
}
