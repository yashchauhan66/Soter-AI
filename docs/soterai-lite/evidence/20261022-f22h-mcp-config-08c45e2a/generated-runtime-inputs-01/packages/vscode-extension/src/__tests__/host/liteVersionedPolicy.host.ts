/** F02: actual commands/providers in an isolated synthetic developer host. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
const FLAG = "lite.versionedPolicy", PRIVATE = "SYNTHETIC_F02_HOST_PRIVATE_NOTE_20261013", PUBLIC = "Useful F02 public control.\n";
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const policy = (sensitiveGlobs: string[] = [], paths: unknown[] = [], presets: string[] = []) => ({ schemaVersion: 1, presets, rules: { paths, regions: [] }, sensitiveGlobs });
export async function run(): Promise<void> {
    const output = process.env.SOTERAI_LITE_F02_EVIDENCE, profile = process.env.SOTERAI_LITE_F02_PROFILE, phase = process.env.SOTERAI_LITE_F02_PHASE;
    assert.ok(output && isAbsolute(output)); assert.ok(profile && isAbsolute(profile)); assert.ok(phase === "save" || phase === "reload");
    assert.equal(vscode.workspace.workspaceFolders?.length, 1); const folder = vscode.workspace.workspaceFolders![0], root = folder.uri.fsPath;
    assert.equal(await readFile(join(root, ".synthetic-lite-f02-host"), "utf8"), "synthetic-only-v1"); assert.ok(vscode.workspace.isTrusted);
    const ext = vscode.extensions.getExtension("soterai.soterai-ide-guard")!; assert.ok(ext); const bundle = join(ext.extensionPath, "dist/extension.js"), runtime = sha(await readFile(bundle));
    assert.equal(runtime, process.env.SOTERAI_LITE_F02_BUNDLE_SHA256); await ext.activate(); assert.ok(ext.isActive);
    const api = vscode.window as unknown as Record<string, unknown>, originals = new Map<string, unknown>(), config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect<boolean>(FLAG)?.globalValue;
    const messages: string[] = [], statuses: { command: string; status: unknown }[] = [], observations: { id: string; status: string; diagnostic?: string }[] = [];
    let pick: vscode.Uri | undefined, dest: vscode.Uri | undefined, allow = true, lastPreview: string | undefined, lastVirtualDocument: vscode.TextDocument | undefined;
    const patch = (name: string, value: unknown) => { originals.set(name, api[name]); api[name] = value; };
    const uri = (relative: string) => vscode.Uri.joinPath(folder.uri, relative);
    const write = async (relative: string, text: string) => { await mkdir(dirname(join(root, relative)), { recursive: true }); await writeFile(join(root, relative), text, { flag: "wx" }); };
    const status = async (command: string, expected: string, target?: vscode.Uri) => { const result = await vscode.commands.executeCommand<{ status?: unknown }>(command, ...(target ? [target] : [])); statuses.push({ command, status: result?.status }); assert.deepEqual(result, { status: expected }); };
    const check = async (id: string, action: () => Promise<void>) => { const observation: typeof observations[number] = { id, status: "NOT_RUN" }; observations.push(observation); try { await action(); observation.status = "PASS"; } catch(error) { observation.status = "FAIL"; observation.diagnostic = error instanceof Error ? error.name + ": " + error.message.split("\n")[0].slice(0,160) : "UnknownFailure"; } console.log(`LITE_POLICY_HOST ${phase} ${id} ${observation.status}`); };
    const preview = async (relative: string) => { lastPreview = undefined; await vscode.commands.executeCommand("soterai.openRedactedPreview", uri(relative)); assert.equal(typeof lastPreview, "string"); return lastPreview!; };
    const withheld = async (relative: string) => { const text = await preview(relative); assert.match(text, /AI-forbidden content omitted/); assert.ok(!text.includes(PRIVATE)); };
    const retained = async () => {
        await withheld(".config/gcloud/application_default_credentials.json"); await withheld("imported.txt"); await withheld("team.txt");
        const safe = await vscode.commands.executeCommand<{status:string;text?:string}>("soterai.readProjectFileSafely", uri("memo.txt"));
        assert.equal(safe.status, "ALLOWED_ONCE"); assert.match(safe.text ?? "", /MASKED/); assert.ok(!safe.text?.includes(PRIVATE));
        assert.equal(await preview("public.txt"), PUBLIC);
    };
    try {
        patch("showInformationMessage", async (message: string) => { messages.push(message); return undefined; }); patch("showErrorMessage", async () => undefined);
        patch("showWarningMessage", async (_message: string, ...items: unknown[]) => items.includes("Allow safe read once") ? "Allow safe read once" : allow && items.includes("Add protection") ? "Add protection" : undefined);
        patch("showWorkspaceFolderPick", async () => folder); patch("showOpenDialog", async () => pick ? [pick] : undefined); patch("showSaveDialog", async () => dest);
        patch("showQuickPick", async (items: {id:string}[]) => items.find(item => item.id === "ci"));
        patch("showTextDocument", async (document: vscode.TextDocument, ...args: unknown[]) => { if(document.uri.scheme === "soterai-redacted") { lastPreview = document.getText(); lastVirtualDocument = document; } return (originals.get("showTextDocument") as (...values:unknown[])=>unknown)(document,...args); });
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        if (phase === "save") {
            for (const relative of ["memo.txt", "imported.txt", "team.txt", "manual-sensitive.txt", ".config/gcloud/application_default_credentials.json"]) await write(relative, PRIVATE);
            await write("public.txt", PUBLIC); await write(".vscode/settings.json", "{}");
            await write(".soterai/incoming.json", JSON.stringify(policy(["memo.txt"], [{kind:"file",pattern:"imported.txt"}])));
            await check("F02-H01", async () => { await withheld(".config/gcloud/application_default_credentials.json"); assert.equal(await preview("public.txt"), PUBLIC); });
            await check("F02-H02", async () => {
                assert.ok((await preview("memo.txt")).includes(PRIVATE)); const existingView = lastVirtualDocument!;
                await write(".soterai/team-policy.json", JSON.stringify(policy(["memo.txt"], [{kind:"file",pattern:"team.txt"}])));
                const control = await vscode.commands.executeCommand<{text:string}>("soterai.readProjectFileSafely", uri("public.txt")); assert.equal(control.text,PUBLIC);
                for(let attempt=0;attempt<40&&!existingView.getText().includes("AI-forbidden content omitted");attempt++) await new Promise(done=>setTimeout(done,50));
                assert.match(existingView.getText(),/AI-forbidden content omitted/); assert.ok(!existingView.getText().includes(PRIVATE));
                await withheld("team.txt"); await unlink(join(root,".soterai/team-policy.json")); await withheld("team.txt");
            });
            await check("F02-H03", async () => {
                pick = undefined; await status("soterai.importLitePolicy", "CANCELLED"); pick = uri(".soterai/incoming.json"); allow = false; await status("soterai.importLitePolicy", "CANCELLED"); allow = true;
                await status("soterai.importLitePolicy", "SAVED");
                await write(".soterai/future.json", JSON.stringify({...policy(),schemaVersion:99})); pick = uri(".soterai/future.json"); const before = messages.length; await status("soterai.importLitePolicy", "FAILED"); assert.ok(!messages.slice(before).some(text => /saved/i.test(text)));
                await retained();
            });
            await check("F02-H04", async () => { await status("soterai.applyLitePolicyPreset", "SAVED"); await withheld(".vscode/settings.json"); });
            await check("F02-H05", async () => {
                await status("soterai.restrictSensitiveFile", "SAVED", uri("manual-sensitive.txt")); dest = uri("policy.export.json"); await status("soterai.exportLitePolicy", "EXPORTED");
                const text = await readFile(dest.fsPath,"utf8"), exported = JSON.parse(text);
                assert.equal(exported.schemaVersion,1); assert.ok(exported.sensitiveGlobs.length >= 200); assert.equal(new Set(exported.sensitiveGlobs).size, exported.sensitiveGlobs.length);
                assert.ok(exported.rules.paths.some((rule:{pattern:string;sensitive?:boolean})=>rule.pattern==="manual-sensitive.txt"&&rule.sensitive===true));
                assert.ok(exported.presets.includes("ci")); assert.ok(exported.sensitiveGlobs.includes("memo.txt")); assert.ok(!text.includes(PRIVATE));
                await status("soterai.exportLitePolicy", "FAILED"); assert.equal(await readFile(dest.fsPath,"utf8"),text);
            });
            if (!observations.some(row=>row.status === "FAIL")) await write(".f02-save-receipt.json", JSON.stringify({runtime,profile:resolve(profile),workspace:root}));
        } else await check("F02-H07", async () => { const saved=JSON.parse(await readFile(join(root,".f02-save-receipt.json"),"utf8")); assert.equal(saved.runtime,runtime); assert.equal(saved.profile,resolve(profile)); assert.equal(saved.workspace,root); await retained(); await withheld(".vscode/settings.json"); });
        await check("F02-H06", async () => { await config.update(FLAG,false,vscode.ConfigurationTarget.Global); for(const command of ["soterai.importLitePolicy","soterai.exportLitePolicy","soterai.applyLitePolicyPreset"]) await status(command,"UNAVAILABLE"); await retained(); await withheld(".vscode/settings.json"); });
    } finally { for(const [name,value] of originals) api[name]=value; await config.update(FLAG,oldFlag,vscode.ConfigurationTarget.Global); }
    const result={schemaVersion:1,observedAt:new Date().toISOString(),phase,syntheticOnly:true,workspace:root,declaredProfilePath:resolve(profile),hostVersion:vscode.version,
        extensionBundleSha256:runtime,currentDeveloperBundleSha256:sha(await readFile(bundle)),hostProbeSha256:sha(await readFile(__filename)),observations,commandStatuses:statuses,
        passed:observations.filter(row=>row.status==="PASS").length,failed:observations.filter(row=>row.status==="FAIL").length,
        identityScope:"Byte-identical packaged runtime in a normal isolated developer window with a test-only bootstrap; no clean-profile installed-VSIX or authenticated memory claim.",independence:"LOW",externalAgents:"NOT_TESTED"};
    await writeFile(output,JSON.stringify(result,null,2)+"\n",{flag:"wx"}); assert.equal(result.currentDeveloperBundleSha256,runtime); if(result.failed)throw new Error("F02 host assertions failed; inspect raw observations.");
}
